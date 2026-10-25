# Building Misuc

## Prerequisites (Debian / Ubuntu / Mint)

```bash
sudo apt update
sudo apt install -y cmake ninja-build g++ \
    qt6-base-dev \
    libpipewire-0.3-dev libasound2-dev libsndfile1-dev \
    pkg-config
```

Minimum toolchain: C++20 compiler (g++ 13+), CMake 3.21+, Ninja, Qt 6.4+,
PipeWire 1.0+ headers/runtime.

## Configure & build

```bash
cmake -S . -B build -G Ninja
cmake --build build
```

Options (all `ON` by default):

| Option                | Meaning                                |
| --------------------- | -------------------------------------- |
| `MISUC_BUILD_TESTS`   | Build the `misuc_tests` unit tests.    |
| `MISUC_BUILD_UI`      | Build the Qt app `misuc_app`.          |
| `MISUC_BUILD_NEU`     | Build the QML preview `misuc_neu` when Qt Quick/Controls are available. |

Example (engine + tests only):

```bash
cmake -S . -B build-engine -G Ninja -DMISUC_BUILD_UI=OFF
cmake --build build-engine
```

## Tests

```bash
ctest --test-dir build --output-on-failure
# or directly:
./build/bin/misuc_tests
```

Some tests (device enumeration) talk to a live PipeWire daemon and only report
counts; they must never hard-fail a release build when no daemon is present.

## Running the app

```bash
./build/bin/misuc_app
```

## Runtime requirements

- A running PipeWire daemon (standard on modern distros; verify with
  `pactl info` or `pw-cli info 0`).
- A Wayland or X11 session for the UI.
- The default sound device exposed by PipeWire (e.g. "Built-in Audio Analog
  Stereo").