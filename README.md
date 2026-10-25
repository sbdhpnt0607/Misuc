<p align="center">
  <img src="docs/assets/misuc-logo.png" width="120" alt="Misuc logo"/>
</p>

<h1 align="center">Misuc</h1>

<p align="center">
  A digital audio workstation — pattern sequencer, piano roll,<br/>
  playlist and a live mixer, built with Qt 6 / C++20. Linux (PipeWire)<br/>
  is the daily-driver platform; a Windows build ships installers too.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-GPL--3.0--or--later-blue" alt="License"/>
  <img src="https://img.shields.io/badge/status-in%20development-orange" alt="Status"/>
  <img src="https://img.shields.io/badge/C%2B%2B-20-00599C" alt="C++20"/>
  <img src="https://img.shields.io/badge/Qt-6-41CD52" alt="Qt6"/>
  <img src="https://img.shields.io/badge/audio-PipeWire-EF4335" alt="PipeWire"/>
</p>

> **Misuc is under active development.** Core editing, mixing, routing and
> persistence are working today (see
> [`MISUC_CURRENT_STATUS.txt`](MISUC_CURRENT_STATUS.txt) for a per-component
> honesty report); expect missing pieces and rough edges.

## Screenshots

![Misuc workspace: Playlist with Browser, Inspector and live Mixer dock](docs/screenshots/workspace.png)

| Playlist | Piano Roll |
| --- | --- |
| ![Playlist with demo clips](docs/screenshots/playlist.png) | ![Piano roll editor](docs/screenshots/piano-roll.png) |
| **Channel Rack + Audio** | **Project / Appearance** |
| ![Channel rack with step cells](docs/screenshots/channel-rack.png) | ![Project page](docs/screenshots/project.png) |

## Highlights

- **Channel Rack** — step sequencer with 4 pattern banks, per-channel volume /
  pan / mute / solo, per-step velocity, resizable step counts (4–128), channel
  reordering and sound-file lanes (drop a sample from the browser to create a
  Sampler channel).
- **Piano Roll** — draw / move / resize / delete notes, velocity lane, grid
  snap (1/32–1) with quantize, horizontal *and* vertical zoom, full 128-note
  range, pitch naming.
- **Playlist** — unlimited virtualized tracks, paint-brush tooling, marquee /
  range selection, duplicate / slice / region tools, drag-and-drop from the
  sample browser.
- **Mixer** — per-track strips (gain / pan / mute / solo), 32-bus DAG routing
  with cycle rescue, parallel sends, per-bus FX with sidechain compressor,
  per-track insert chains (built-in EQ + LV2 hosting).
- **Audio foundation** — PipeWire backend, brickwall master limiter (−1 dBFS,
  live == export), RMS + true-peak metering with sticky clip indicators,
  configurable buffer/sample-rate page with a 440 Hz test tone.
- **Project persistence** — `.misuc` documents are real ZIP containers
  (`misuc.meta` + `misuc.song`), atomic writes, rotated autosave with
  round-trip verification, session recovery, clipboard-safe undo/redo
  (50-step snapshot stack).

## Download

Prebuilt installers are attached to tagged GitHub Releases
([latest](https://github.com/SPOOKEYfr/Misuc/releases)):

| Platform | File | How to install |
| --- | --- | --- |
| Linux (.deb) | `misuc_0.3.1-1_amd64.deb` | `sudo apt install ./misuc_0.3.1-1_amd64.deb` |
| Windows (.exe) | `misuc-0.3.1-1-win64.exe` | Double-click the installer (installs into `C:\Program Files\Misuc`) |

The Windows audio backend (WASAPI) has not been validated on real hardware
yet — on Linux, Misuc talks to a running PipeWire daemon.

## Misuc Neu (preview)

`ui-qml/` holds **Misuc Neu**, a neumorphic Qt Quick shell designed by Arena AI.
It is built as a second executable, `misuc_neu`, next to the classic Widgets
app; on Windows the installer adds **Misuc Neu** Start Menu and Desktop
shortcuts, while classic Misuc stays the default launch.

The preview runs on Arena's demo `SongModel` — the transport and controls are
visual and produce no audio. Wiring it to the engine (Session / Transport /
mixer) is a separate step; see [`ui-neu-app/README.md`](ui-neu-app/README.md)
for the build integration, the four minimal QML compile fixes, and the verified
installer payload.

Qt Quick is optional at configure time: `MISUC_BUILD_NEU` defaults to `ON` and
the target is skipped automatically when Qt Quick/Controls are not installed,
so a Qt-base-only Linux build is unaffected.

## Building

Prerequisites (Debian / Ubuntu / Mint):

```bash
sudo apt install -y cmake ninja-build g++ \
    qt6-base-dev \
    libpipewire-0.3-dev libasound2-dev libsndfile1-dev \
    pkg-config
```

Configure and build:

```bash
cmake -S . -B build -G Ninja
cmake --build build
./build/bin/misuc_app
```

Options: `MISUC_BUILD_TESTS`, `MISUC_BUILD_UI` and `MISUC_BUILD_NEU` (all `ON`
by default — see [`BUILD.md`](BUILD.md)).

### Tests

```bash
ctest --test-dir build --output-on-failure
# or directly:
./build/bin/misuc_tests
```

The engine and editor model are covered by a large unit-test suite
(50k+ assertions and counting). Tests that talk to a live PipeWire daemon
only report counts and never hard-fail a release build.

### Runtime requirements

- A running PipeWire daemon (standard on modern Linux desktops).
- Wayland or X11 session for the UI.

## Repository layout

```
engine/   PipeWire audio engine, DSP (EQ, compressor, pitch), .misuc container
ui/       Qt 6 desktop app (pages, docks, dialogs, theme)
tests/    unit tests (engine + editor model)
tools/    and qa/   maintenance & QA scripts
docs/     architecture notes, status matrix, roadmap, screenshots
```

## License

Misuc is free software: licensed under the
[GNU GPL-3.0-or-later](LICENSE).
© 2026 SPOOKEYfr
