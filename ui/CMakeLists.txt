find_package(Qt6 REQUIRED COMPONENTS Widgets)

qt_standard_project_setup()

# ---------------------------------------------------------------------------
# Canonical version: project(misuc VERSION ...) in the top-level CMakeLists.txt
# is the single source of truth. Every consumer (the app binary, the About
# dialog / splash / window title, Qt application metadata, and the CPack
# .deb / tarball package names) derives from this generated header and from
# ${PROJECT_VERSION}. Bump the version in the top-level CMakeLists.txt only.
# ---------------------------------------------------------------------------
configure_file(
  ${CMAKE_CURRENT_SOURCE_DIR}/src/branding/MisucVersion.h.in
  ${CMAKE_CURRENT_BINARY_DIR}/branding/MisucVersion.h
  @ONLY)

set(MISUC_UI_SOURCES
  src/Theme.cpp
  src/theme/ThemeEngine.cpp
  src/theme/ThemePage.cpp
  src/branding/Logo.cpp
  src/branding/AboutDialog.cpp
  src/branding/Icons.cpp
  src/HeaderBar.cpp
  src/HintSystem.cpp
  src/MainWindow.cpp
  src/TransportBar.cpp
  src/MeterWidget.cpp
  src/AudioSettingsPage.cpp
  src/ProjectPage.cpp
  src/StatusPanel.cpp
  src/PianoRoll.cpp
  src/EditorPage.cpp
  src/mixer/Knob.cpp
  src/mixer/Fader.cpp
  src/mixer/VerticalMeter.cpp
  src/mixer/ChannelStrip.cpp
  src/mixer/MixerPage.cpp
  src/mixer/RoutingDialogs.cpp
  src/commands/MisucCommandRegistry.cpp
  src/tooltip/MisucTooltip.cpp
  src/playlist/Playlist.cpp
  src/playlist/PlaylistSelection.cpp
  src/RecordSetupDialog.cpp
  src/channel/ChannelRack.cpp
  src/browser/Browser.cpp
  src/inspector/Inspector.cpp
  src/project/DemoProject.cpp
  src/export/ExportDialog.cpp
  src/workspace/WorkspaceManager.cpp)

# Header-only QObject subclass: listed explicitly so AUTOMOC runs moc on it
# (findChild + vtable require the generated metaobject; MSVC static-asserts
# the Q_OBJECT contract at compile time, so the guard cannot be skipped).
set(MISUC_UI_MOC_HEADERS src/elide/ElideLabel.h)

# The UI sources compiled once, shared by the real app and the QA harness so
# GUI checks exercise the very same translation units shipped to users.
add_library(misuc_ui_objs OBJECT ${MISUC_UI_SOURCES} ${MISUC_UI_MOC_HEADERS})
target_include_directories(misuc_ui_objs PRIVATE src)
target_include_directories(misuc_ui_objs PUBLIC
  ${CMAKE_CURRENT_BINARY_DIR}
  ${CMAKE_CURRENT_SOURCE_DIR}/src)
target_link_libraries(misuc_ui_objs PRIVATE misuc_engine Qt6::Widgets)

# WIN32 builds a GUI-subsystem binary on Windows. A plain add_executable
# produced a console window, and closing that console also terminated Misuc.
qt_add_executable(misuc_app WIN32 src/main.cpp)
target_link_libraries(misuc_app PRIVATE
  misuc_ui_objs
  misuc_engine
  Qt6::Widgets)
if(WIN32)
  # HeaderBar CPU/RAM bookkeeping uses GetProcessMemoryInfo (psapi).
  target_link_libraries(misuc_app PRIVATE psapi)

  # Shell identity: Explorer/taskbar/alt-tab icon + version stamp, compiled
  # into the exe by rc.exe. The icon path is absolute because the generated
  # .rc lives in the binary tree while the .ico stays with the assets.
  set(MISUC_RC_ICON_PATH "${CMAKE_CURRENT_SOURCE_DIR}/../assets/nsis/misuc.ico")
  string(REPLACE "\\" "/" MISUC_RC_ICON_PATH "${MISUC_RC_ICON_PATH}")
  string(REPLACE "." ";" _misuc_ver_list "${PROJECT_VERSION}")
  list(GET _misuc_ver_list 0 _misuc_ver_major)
  list(GET _misuc_ver_list 1 _misuc_ver_minor)
  list(GET _misuc_ver_list 2 _misuc_ver_patch)
  set(MISUC_RC_FILEVER_Q
      "${_misuc_ver_major},${_misuc_ver_minor},${_misuc_ver_patch},0")
  configure_file(src/branding/misuc_app.rc.in src/branding/misuc_app.rc @ONLY)
  target_sources(misuc_app PRIVATE
    ${CMAKE_CURRENT_BINARY_DIR}/src/branding/misuc_app.rc)
endif()

# Qt-converted resources (window icon, about image, user guide text). Compile
# the .qrc explicitly with rcc - the AUTORCC path is unreliable here (Qt 6.4 /
# CMake 3.28) and silently embeds nothing, which gutted the user guide.
find_program(MISUC_RCC_EXECUTABLE NAMES rcc
  HINTS ${Qt6_DIR}/../../../bin /usr/lib/qt6/libexec ${Qt6_DIR}/../../../libexec)
add_custom_command(
  OUTPUT ${CMAKE_CURRENT_BINARY_DIR}/qrc_resources.cpp
  COMMAND ${MISUC_RCC_EXECUTABLE} --name resources
          --output ${CMAKE_CURRENT_BINARY_DIR}/qrc_resources.cpp
          ${CMAKE_CURRENT_SOURCE_DIR}/resources.qrc
  DEPENDS ${CMAKE_CURRENT_SOURCE_DIR}/resources.qrc
          ${CMAKE_CURRENT_SOURCE_DIR}/resources/help/user-guide.txt
          ${CMAKE_CURRENT_SOURCE_DIR}/resources/icons/misuc-256.png
          ${CMAKE_CURRENT_SOURCE_DIR}/resources/about/obhup.png)
target_sources(misuc_app PRIVATE ${CMAKE_CURRENT_BINARY_DIR}/qrc_resources.cpp)
set_source_files_properties(${CMAKE_CURRENT_BINARY_DIR}/qrc_resources.cpp
  PROPERTIES GENERATED TRUE)

if(CMAKE_BUILD_TYPE STREQUAL "Debug")
  target_compile_definitions(misuc_app PRIVATE MISUC_DEBUG)
endif()

# ---------------------------------------------------------------------------
# QA harness: links the real UI objects plus a test driver (qa/qatool.cpp) and
# synthesizes real Qt mouse events against the live widgets. No test-only
# stubs in production code; everything it asserts is reachable GUI behaviour.
# ---------------------------------------------------------------------------
add_executable(misuc_qa ${CMAKE_CURRENT_SOURCE_DIR}/../qa/qatool.cpp)
target_include_directories(misuc_qa PRIVATE src)
target_link_libraries(misuc_qa PRIVATE
  misuc_ui_objs
  misuc_engine
  Qt6::Widgets)
if(WIN32)
  target_link_libraries(misuc_qa PRIVATE psapi)
endif()

# ---------------------------------------------------------------------------
# Linux desktop integration: install the app, a real .desktop entry, and the
# hicolor icon set rendered from branding/Logo.cpp by tools/rendericons.
# Windows ships a plain ZIP of windeployqt output instead (CI artifact), so
# the desktop-entry/icon-tree install only applies off-Windows.
# ---------------------------------------------------------------------------
if(NOT WIN32)
  install(TARGETS misuc_app RUNTIME DESTINATION bin)

  install(FILES ${CMAKE_CURRENT_SOURCE_DIR}/../assets/desktop/misuc.desktop
          DESTINATION share/applications)

  foreach(SIZE 16 22 24 32 48 64 128 256 512)
    install(FILES
        ${CMAKE_CURRENT_SOURCE_DIR}/../assets/hicolor/${SIZE}x${SIZE}/apps/misuc.png
        DESTINATION share/icons/hicolor/${SIZE}x${SIZE}/apps)
  endforeach()

  # AppStream metadata: store-quality presence in GNOME Software / Discover.
  install(FILES ${CMAKE_CURRENT_SOURCE_DIR}/../assets/metainfo/misuc.appdata.xml
          DESTINATION share/metainfo)
endif()

# Windows side of the staged install (feeds the NSIS .exe installer + ZIP):
# the exe lands in the install root and EVERY runtime dependency rides along,
# because a single missing DLL is exactly the "installer doesn't work" class
# of failure seen in the wild:
#   - Qt runtime + MSVC redist: windeployqt runs inside the CPack staging
#     tree at cpack time (install-qt-action provides it on PATH on CI).
#   - Engine codecs (libsndfile + zlib + their import chains): the whole
#     vcpkg x64-windows/bin runtime set, only known after the vcpkg install.
# A missing or failed windeployqt is FATAL so a broken installer can never
# ship again.
if(WIN32)
  install(TARGETS misuc_app RUNTIME DESTINATION .)
  install(FILES ${CMAKE_CURRENT_SOURCE_DIR}/../LICENSE DESTINATION .)
  if(VCPKG_INSTALLED_DIR AND EXISTS "${VCPKG_INSTALLED_DIR}/x64-windows/bin")
    file(GLOB MISUC_VCPKG_RUNTIME_DLLS
         "${VCPKG_INSTALLED_DIR}/x64-windows/bin/*.dll")
    if(MISUC_VCPKG_RUNTIME_DLLS)
      message(STATUS "vcpkg runtime DLLs: ${MISUC_VCPKG_RUNTIME_DLLS}")
      install(FILES ${MISUC_VCPKG_RUNTIME_DLLS} DESTINATION .)
    else()
      message(FATAL_ERROR "vcpkg x64-windows/bin has no DLLs - check the vcpkg install step")
    endif()
  endif()
  # MSVC CRT redist: windeployqt's --compiler-runtime is unreliable (it
  # silently skipped vcruntime140/msvcp140 on the Actions runner), so the
  # redist DLLs are staged straight from the toolchain's Redist tree. Without
  # them the app dies at startup on machines without the VC++ runtime.
  if(MSVC)
    get_filename_component(_misuc_msvc_bin "${CMAKE_CXX_COMPILER}" DIRECTORY)
    # Probe upward from .../VC/Tools/MSVC/<ver>/bin/Hostx64/x64 for the VC
    # root - the depth differs between VS editions/toolset layouts.
    set(_misuc_vc_dir "")
    set(_misuc_probe "${_misuc_msvc_bin}")
    foreach(_misuc_i RANGE 1 7)
      get_filename_component(_misuc_probe "${_misuc_probe}/.." ABSOLUTE)
      if(EXISTS "${_misuc_probe}/Redist/MSVC")
        set(_misuc_vc_dir "${_misuc_probe}")
        break()
      endif()
    endforeach()
    file(GLOB MISUC_MSVC_CRT_DLLS
         "${_misuc_vc_dir}/Redist/MSVC/*/x64/Microsoft.VC*.CRT/*.dll")
    if(MISUC_MSVC_CRT_DLLS)
      message(STATUS "MSVC CRT DLLs: ${MISUC_MSVC_CRT_DLLS}")
      install(FILES ${MISUC_MSVC_CRT_DLLS} DESTINATION .)
    else()
      message(FATAL_ERROR
        "MSVC CRT redist not found under ${_misuc_probe}/Redist/MSVC - "
        "without it the installer cannot run on clean machines")
    endif()
  endif()
  install(CODE [[
    execute_process(COMMAND windeployqt --release --compiler-runtime
                            "${CMAKE_INSTALL_PREFIX}/misuc_app.exe"
                    RESULT_VARIABLE _wdqRc
                    OUTPUT_VARIABLE _wdqOut
                    ERROR_VARIABLE _wdqErr
                    OUTPUT_STRIP_TRAILING_WHITESPACE ERROR_STRIP_TRAILING_WHITESPACE)
    if(NOT _wdqRc EQUAL 0)
      message(FATAL_ERROR "windeployqt failed (rc ${_wdqRc}): ${_wdqErr}")
    endif()
  ]])
endif()

# ---------------------------------------------------------------------------
# Release packaging with CPack (`cmake --build build --target package`):
# a Debian package (with automatic shared-library dependencies) and a plain
# tarball of the staged install layout for manual/system-agnostic installs.
# ---------------------------------------------------------------------------
set(CPACK_PACKAGE_NAME "misuc")
set(CPACK_PACKAGE_VERSION "${PROJECT_VERSION}")
set(CPACK_PACKAGE_RELEASE "1")
set(CPACK_PACKAGE_VENDOR "Misuc")
set(CPACK_PACKAGE_CONTACT "SPOOKEYfr <oibhupii@gmail.com>")
set(CPACK_PACKAGE_DESCRIPTION_SUMMARY "Multi-track MIDI sequencer and audio workstation")
get_filename_component(CPACK_RESOURCE_FILE_LICENSE
  "${CMAKE_CURRENT_SOURCE_DIR}/../LICENSE" ABSOLUTE)
# NOTE: leave the license path forward-slashed. CPack.cmake pastes this value
# into its own CMake code (cpack_check_file_exists), where an unquoted
# "D:\a\..." explodes with "Invalid character escape '\a'". The NSIS
# generator, in contrast, accepts forward slashes for LicenseData lines.
if(WIN32)
  set(CPACK_PACKAGE_FILE_NAME "misuc-${CPACK_PACKAGE_VERSION}-${CPACK_PACKAGE_RELEASE}-win64")
  # NSIS drives the double-click installer (.exe); the ZIP stays for portable
  # usage (stick installs where no registry writes are wanted).
  set(CPACK_GENERATOR "NSIS;ZIP")
  # ── Misuc-themed NSIS wizard ─────────────────────────────────────────────
  # Shell-facing art lives in assets/nsis/ (bitmaps are exact-size PNG->BMP3
  # renders from assets/nsis/make_assets.sh).
  #
  # makensis `File` cannot resolve embedded ".." path elements and rejects
  # forward slashes, so each art path is fully resolved then converted to a
  # native (backslash) path in ONE go - a partially-native string like
  # "D:\...\nsis/welcome.bmp" still fails with "-> no files found".
  get_filename_component(MISUC_NSIS_ASSETS_DIR
    "${CMAKE_CURRENT_SOURCE_DIR}/../assets/nsis" ABSOLUTE)
  file(TO_NATIVE_PATH "${MISUC_NSIS_ASSETS_DIR}/misuc.ico"
    CPACK_NSIS_MUI_ICON)
  file(TO_NATIVE_PATH "${MISUC_NSIS_ASSETS_DIR}/misuc.ico"
    CPACK_NSIS_MUI_UNIICON)
  file(TO_NATIVE_PATH "${MISUC_NSIS_ASSETS_DIR}/welcome.bmp"
    CPACK_NSIS_MUI_WELCOMEFINISHPAGE_BITMAP)
  file(TO_NATIVE_PATH "${MISUC_NSIS_ASSETS_DIR}/welcome.bmp"
    CPACK_NSIS_MUI_UNWELCOMEFINISHPAGE_BITMAP)
  file(TO_NATIVE_PATH "${MISUC_NSIS_ASSETS_DIR}/header.bmp"
    CPACK_NSIS_MUI_HEADERIMAGE)
  set(CPACK_NSIS_BRANDING_TEXT "Misuc Installer")
  set(CPACK_NSIS_WELCOME_TITLE "Misuc ${CPACK_PACKAGE_VERSION}")
  set(CPACK_NSIS_FINISH_TITLE "Misuc is ready")
  set(CPACK_NSIS_DISPLAY_NAME "Misuc ${CPACK_PACKAGE_VERSION}")
  set(CPACK_NSIS_PACKAGE_NAME "Misuc")
  set(CPACK_NSIS_INSTALL_ROOT "$PROGRAMFILES64")
  set(CPACK_NSIS_EXECUTABLES_DIRECTORY ".")
  set(CPACK_NSIS_INSTALLED_ICON_NAME "misuc_app.exe")
  set(CPACK_NSIS_MUI_FINISHPAGE_RUN "misuc_app.exe")
  set(CPACK_NSIS_ENABLE_UNINSTALL_BEFORE_INSTALL ON)
  set(CPACK_NSIS_MANIFEST_DPI_AWARE ON)
  set(CPACK_NSIS_UNINSTALL_NAME "Uninstall Misuc")
  set(CPACK_NSIS_URL_INFO_ABOUT "https://github.com/SPOOKEYfr/Misuc")
  set(CPACK_NSIS_CONTACT "SPOOKEYfr <oibhupii@gmail.com>")
  # Start Menu folder + Desktop shortcut (theme-consistent, removed on
  # uninstall) - CPack's default only lists the bin/ exe shortcut.
  set(CPACK_NSIS_CREATE_ICONS_EXTRA
    "CreateDirectory '$SMPROGRAMS\\Misuc'
     CreateShortCut '$SMPROGRAMS\\Misuc\\Misuc.lnk' '$INSTDIR\\misuc_app.exe'
     CreateShortCut '$DESKTOP\\Misuc.lnk' '$INSTDIR\\misuc_app.exe'")
  set(CPACK_NSIS_DELETE_ICONS_EXTRA
    "Delete '$SMPROGRAMS\\Misuc\\Misuc.lnk'
     RMDir '$SMPROGRAMS\\Misuc'
     Delete '$DESKTOP\\Misuc.lnk'")
else()
  set(CPACK_PACKAGE_FILE_NAME "misuc-${CPACK_PACKAGE_VERSION}-${CPACK_PACKAGE_RELEASE}-linux")
  set(CPACK_GENERATOR "DEB;TGZ")
  set(CPACK_DEBIAN_PACKAGE_SHLIBDEPS ON)
  set(CPACK_DEBIAN_PACKAGE_SECTION "sound")
  set(CPACK_DEBIAN_PACKAGE_PRIORITY "optional")
  set(CPACK_DEBIAN_PACKAGE_HOMEPAGE "https://github.com/SPOOKEYfr/Misuc")
  set(CPACK_DEBIAN_PACKAGE_MAINTAINER "SPOOKEYfr <oibhupii@gmail.com>")
  set(CPACK_DEBIAN_PACKAGE_DESCRIPTION
"Misuc - multi-track MIDI sequencer and audio workstation
 .
 A DAW built around the pattern workflow: a full-range piano roll with
 snap quantise, an arrangement playlist, and a live mixer with buses and
 per-track FX chains (LV2 hosting on Linux, WASAPI on Windows), plus
 metronome/count-in, groove templates, sample-accurate export, and
 session autosaves you can actually recover from.")
  set(CPACK_DEBIAN_PACKAGE_CONTROL_EXTRA
      "${CMAKE_CURRENT_SOURCE_DIR}/packaging/deb/postinst;${CMAKE_CURRENT_SOURCE_DIR}/packaging/deb/postrm;${CMAKE_CURRENT_SOURCE_DIR}/packaging/deb/triggers")
endif()
set(CPACK_DEBIAN_FILE_NAME "${CPACK_PACKAGE_NAME}_${CPACK_PACKAGE_VERSION}-${CPACK_PACKAGE_RELEASE}_amd64.deb")
set(CPACK_SOURCE_GENERATOR "TGZ")
include(CPack)