# ===========================================================================
# Misuc Neu — integration build for Arena AI's standalone QML UI (ui-qml/).
#
# The QML tree, qml.qrc and src/main.cpp are authored in ui-qml/ and are used
# here as-is. This file only wires that preview app into the main build and the
# Windows installer; edit the UI itself in ui-qml/.
#
# Qt Quick is optional on platforms that do not ship it (the Linux CI image
# installs qt6-base-dev only), so the target is skipped when the module is not
# available instead of failing the whole build.
# ===========================================================================
find_package(Qt6 QUIET COMPONENTS Quick QuickControls2)
if(NOT TARGET Qt6::Quick)
  message(STATUS "Misuc Neu: skipped (Qt Quick / Qt Quick Controls not available)")
  return()
endif()

qt_standard_project_setup()

# qt_standard_project_setup() enables AUTOMOC/AUTOUIC but not AUTORCC; without
# this the external ui-qml/qml.qrc is linked as data and qrc:/qml/Main.qml is
# missing at runtime (found by launching the CI build).
set(CMAKE_AUTORCC ON)

qt_add_executable(misuc_neu
  ${CMAKE_CURRENT_SOURCE_DIR}/../ui-qml/src/main.cpp
  ${CMAKE_CURRENT_SOURCE_DIR}/../ui-qml/qml.qrc)

target_link_libraries(misuc_neu PRIVATE
  Qt6::Quick
  Qt6::QuickControls2)

# QtQuick.Effects (MultiEffect) ships with Qt 6.5+; link it when present so the
# neumorphic shadows render instead of silently disappearing.
find_package(Qt6 QUIET COMPONENTS QuickEffects)
if(TARGET Qt6::QuickEffects)
  target_link_libraries(misuc_neu PRIVATE Qt6::QuickEffects)
else()
  message(WARNING "Misuc Neu: QtQuick.Effects not found - soft shadows disabled")
endif()

# WIN32: a GUI-subsystem binary, matching misuc_app (no console window).
set_target_properties(misuc_neu PROPERTIES
  WIN32_EXECUTABLE TRUE
  MACOSX_BUNDLE TRUE)

set(MISUC_NEU_QML_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../ui-qml/qml")
get_filename_component(MISUC_NEU_QML_DIR "${MISUC_NEU_QML_DIR}" ABSOLUTE)

if(WIN32)
  # ---------------------------------------------------------------------
  # Shell identity (Explorer, taskbar, shortcuts) plus version information.
  # Same multi-size .ico as misuc_app, compiled by rc.exe. This is
  # integration glue; Arena's QML and main.cpp remain unchanged.
  # ---------------------------------------------------------------------
  set(MISUC_NEU_RC_ICON_PATH
      "${CMAKE_CURRENT_SOURCE_DIR}/../assets/nsis/misuc.ico")
  string(REPLACE "\\" "/" MISUC_NEU_RC_ICON_PATH
         "${MISUC_NEU_RC_ICON_PATH}")
  string(REPLACE "." ";" _misuc_neu_ver_list "${PROJECT_VERSION}")
  list(GET _misuc_neu_ver_list 0 _misuc_neu_ver_major)
  list(GET _misuc_neu_ver_list 1 _misuc_neu_ver_minor)
  list(GET _misuc_neu_ver_list 2 _misuc_neu_ver_patch)
  set(MISUC_NEU_RC_FILEVER_Q
      "${_misuc_neu_ver_major},${_misuc_neu_ver_minor},${_misuc_neu_ver_patch},0")
  set(MISUC_NEU_RC_FILEVER_S "${PROJECT_VERSION}.0")
  configure_file(misuc_neu.rc.in misuc_neu.rc @ONLY)
  target_sources(misuc_neu PRIVATE
    ${CMAKE_CURRENT_BINARY_DIR}/misuc_neu.rc)

  # ---------------------------------------------------------------------
  # Windows runtime deployment. The release workflow deploys misuc_app,
  # and leaves misuc_neu to these rules so both installers and the plain
  # CI ZIP carry the Qt Quick DLLs + QML modules.
  # ---------------------------------------------------------------------
  get_target_property(_misuc_qmake Qt6::qmake IMPORTED_LOCATION)
  get_filename_component(_misuc_qt_bin "${_misuc_qmake}" DIRECTORY)
  find_program(MISUC_WINDEPLOYQT NAMES windeployqt
    HINTS "${_misuc_qt_bin}" NO_DEFAULT_PATH)
  if(NOT MISUC_WINDEPLOYQT)
    find_program(MISUC_WINDEPLOYQT NAMES windeployqt)
  endif()

  if(MISUC_WINDEPLOYQT)
    # Keep build/bin/Release self-contained: windows.yml packages that tree
    # into the CI ZIP without a second windeployqt pass.
    add_custom_command(TARGET misuc_neu POST_BUILD
      COMMAND "${MISUC_WINDEPLOYQT}" --compiler-runtime
              --qmldir "${MISUC_NEU_QML_DIR}"
              "$<TARGET_FILE:misuc_neu>"
      COMMENT "Deploying Qt Quick runtime for Misuc Neu"
      VERBATIM)
  else()
    message(WARNING "Misuc Neu: windeployqt not found - the CI ZIP may lack Qt Quick")
  endif()

  install(TARGETS misuc_neu RUNTIME DESTINATION .)

  if(MISUC_WINDEPLOYQT)
    # Runs after the target is copied into the CPack staging tree. --qmldir
    # is required: without it windeployqt misses the QML modules that the
    # embedded qrc imports at runtime.
    install(CODE "
      execute_process(
        COMMAND \"${MISUC_WINDEPLOYQT}\" --release --compiler-runtime
                --qmldir \"${MISUC_NEU_QML_DIR}\"
                \"\${CMAKE_INSTALL_PREFIX}/misuc_neu.exe\"
        RESULT_VARIABLE _misuc_neu_wdq_rc
        OUTPUT_VARIABLE _misuc_neu_wdq_out
        ERROR_VARIABLE _misuc_neu_wdq_err
        OUTPUT_STRIP_TRAILING_WHITESPACE ERROR_STRIP_TRAILING_WHITESPACE)
      if(NOT _misuc_neu_wdq_rc EQUAL 0)
        message(FATAL_ERROR
          \"windeployqt for misuc_neu failed (rc \${_misuc_neu_wdq_rc}): \${_misuc_neu_wdq_err}\")
      endif()
    ")
  endif()
endif()
