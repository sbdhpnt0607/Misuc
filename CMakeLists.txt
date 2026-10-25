cmake_minimum_required(VERSION 3.20)

project(misuc
  VERSION 0.3.1
  DESCRIPTION "Misuc - Multi-track MIDI sequencer and audio workstation"
  LANGUAGES C CXX)

# Windows-only resource language for the misuc_app shell icon/versioninfo
# (.rc compiled by rc.exe under the VS toolchain; on Linux the RC toolset
# does not exist).
if(WIN32)
  enable_language(RC)
endif()

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

option(MISUC_BUILD_TESTS "Build unit tests" ON)
option(MISUC_BUILD_UI   "Build the Qt user interface" ON)
option(MISUC_BUILD_NEU  "Build the Misuc Neu QML interface" ON)

set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)

if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()

# Compiler-neutral warning levels (MSVC needs /W4 and never understands -Wall).
if(MSVC)
  add_compile_options(/W4 /EHsc /utf-8 /permissive-)
  set(CMAKE_CXX_FLAGS_RELEASE "/O2")
  # MSVC's <cmath> hides M_PI behind _USE_MATH_DEFINES (Groove.h, Icons.cpp,
  # Knob.cpp use it); define it for every translation unit up front.
  add_compile_definitions(_USE_MATH_DEFINES)
else()
  add_compile_options(-Wall -Wextra)
  set(CMAKE_CXX_FLAGS_RELEASE "-O3")
endif()

# ---------------------------------------------------------------------------
# Platform audio stack:
#   Linux (and other pkg-config platforms) -> PipeWire + ALSA + pkg sndfile
#   Windows -> WASAPI (system-provided)   + libsndfile via vcpkg manifest
# The selected backend is wired into the engine by misuc_engine's CMakeLists
# via MISUC_BACKEND_PIPEWIRE / MISUC_BACKEND_WASAPI compile definitions.
# ---------------------------------------------------------------------------
if(WIN32)
  find_package(ZLIB REQUIRED)
  find_package(SndFile CONFIG REQUIRED)
  set(MISUC_SNDFILE_TARGET SndFile::sndfile)
else()
  find_package(PkgConfig REQUIRED)
  pkg_check_modules(PIPEWIRE REQUIRED IMPORTED_TARGET libpipewire-0.3)
  pkg_check_modules(ALSA     REQUIRED IMPORTED_TARGET alsa)
  pkg_check_modules(SNDFILE  REQUIRED IMPORTED_TARGET sndfile)
  set(MISUC_SNDFILE_TARGET PkgConfig::SNDFILE)
endif()
# LV2 effect hosting is optional: when the lilv dev libraries are present the
# engine compiles the real-time FX rack; otherwise the session still round-trips
# the "fx" schema and the UI shows the feature as unsupported.
if(NOT WIN32)
  pkg_check_modules(LILV     IMPORTED_TARGET lilv-0)
  pkg_check_modules(LV2      IMPORTED_TARGET lv2)
endif()
if(LILV_FOUND AND LV2_FOUND)
  message(STATUS "LV2 hosting: ENABLED (lilv ${LILV_VERSION}, lv2 ${LV2_VERSION})")
else()
  message(STATUS "LV2 hosting: DISABLED (liblilv-0/lv2 not found)")
endif()

add_subdirectory(engine)

if(MISUC_BUILD_UI)
  # Defined before ui/ so its CPack rules can see whether misuc_neu exists and
  # only then add the "Misuc Neu" shortcuts to the Windows installer.
  if(MISUC_BUILD_NEU)
    add_subdirectory(ui-neu-app)
  endif()
  add_subdirectory(ui)
endif()

if(MISUC_BUILD_TESTS)
  enable_testing()
  add_subdirectory(tests)
endif()