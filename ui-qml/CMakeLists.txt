# ===========================================================================
# Misuc Neu — Qt 6 Quick build (standalone design/preview app)
#
#   cmake -S ui-qml -B ui-qml/build
#   cmake --build ui-qml/build
#   ./ui-qml/build/misuc_neu
#
# Requires Qt 6.5+ (QtQuick, QtQuick.Controls.Basic, QtQuick.Effects for the
# neumorphic soft shadows). This target runs the QML UI on its own so the
# design can be previewed and iterated without the audio engine. See README.md
# for wiring it into the shipping app (SongModel -> C++ Session/Transport).
# ===========================================================================
cmake_minimum_required(VERSION 3.20)

project(misuc_neu
  VERSION 0.2.0
  DESCRIPTION "Misuc Neu — neumorphic QML workspace (design/preview build)"
  LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)

find_package(Qt6 6.5 REQUIRED COMPONENTS Quick QuickControls2)

qt_standard_project_setup()

qt_add_executable(misuc_neu
  src/main.cpp
  qml.qrc)

target_link_libraries(misuc_neu PRIVATE
  Qt6::Quick
  Qt6::QuickControls2)

# QtQuick.Effects (MultiEffect) ships with Qt 6.5+; link it if present so the
# neumorphic soft shadows render. The QML `import QtQuick.Effects` also needs
# the module available at runtime.
find_package(Qt6 6.5 QUIET COMPONENTS QuickEffects)
if(TARGET Qt6::QuickEffects)
  target_link_libraries(misuc_neu PRIVATE Qt6::QuickEffects)
  message(STATUS "Misuc Neu: QtQuick.Effects found — neumorphic shadows enabled")
else()
  message(WARNING "Misuc Neu: QtQuick.Effects not found — build Qt 6.5+ with the Effects module")
endif()

set_target_properties(misuc_neu PROPERTIES
  WIN32_EXECUTABLE TRUE
  MACOSX_BUNDLE TRUE)
