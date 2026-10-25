# Misuc Neu — Qt 6 / QML port

The same neumorphic workspace as the web UI (`../ui-neu`), rebuilt in Qt Quick
so it runs natively against the Misuc engine. This is the shipping-app
rendering of the design; the web build is the interactive reference.

> **Build status — read this first.** This QML tree is **written but not
> compiled in the Arena sandbox** (no Qt 6 / CMake / PipeWire here). It has been
> hand-reviewed for the usual QML traps (signal-handler name collisions,
> self-referential aliases, out-of-scope ids, singleton imports), but expect to
> do a first build/fix pass on a machine with Qt 6.5+. The web UI in
> `../ui-neu` *is* verified (headless boot + interaction tests pass) and is the
> ground truth for layout and behaviour.

---

## Build & run (standalone design preview)

Requires **Qt 6.5+** with `QtQuick`, `QtQuick.Controls` (Basic style) and
`QtQuick.Effects` (the neumorphic soft shadows use `MultiEffect`).

```bash
cmake -S ui-qml -B ui-qml/build
cmake --build ui-qml/build -j
./ui-qml/build/misuc_neu
```

This boots the full shell on a demo song so you can see and click the design
without the audio engine. It renders all six workspaces, the transport, the
inspector and the status dock, and the light/dark + accent theming is live.

If CMake warns *"QtQuick.Effects not found"*, install the Qt **Effects** module
(e.g. `qt6-declarative`/`qml6-module-qtquick-effects` on Debian/Ubuntu) — without
it the surfaces still draw, just without the soft shadows.

## Layout

```
ui-qml/
├── CMakeLists.txt          # Qt 6 Quick target (misuc_neu)
├── qml.qrc                 # QML resource manifest
├── src/main.cpp            # QGuiApplication + QQmlApplicationEngine
└── qml/
    ├── Main.qml            # shell: header / rail / workspace stack / inspector / dock
    ├── HeaderBar.qml       # brand + TransportBar + master cluster + theme toggle
    ├── WorkspaceRail.qml   # left icon column
    ├── Inspector.qml       # context-sensitive properties
    ├── StatusDock.qml      # bottom status bar
    ├── ToastHost.qml       # transient notifications
    ├── SongModel.qml       # demo song data + transport state (swap for engine bridge)
    ├── theme/Theme.qml     # singleton: light/dark × 5 accents, shadow recipes
    ├── components/         # NeuSurface, NeuButton, NeuIconButton, NeuSegmented,
    │                       # NeuLed, NeuKnob, NeuFader, NeuMeter, NeuStepCell,
    │                       # NeuField, TransportBar
    └── views/              # ChannelRack, PianoRoll, Playlist, Mixer, Browser, Settings
```

## Design system

`theme/Theme.qml` is a singleton holding every token — the exact QML mirror of
the web `css/tokens.css`:

- **Neumorphism:** surfaces get depth from a paired `shDark` (down-right) +
  `shLight` (up-left) soft shadow, never borders. `NeuSurface` is the primitive;
  everything else is a `NeuSurface` plus content.
- **Two palettes × five accents:** `Theme.dark` toggles light/dark;
  `Theme.accentName` selects violet / cyan / emerald / amber / crimson —
  the same preset names as the existing Qt Widgets `ThemeEngine`.

`NeuSurface` draws raised surfaces with two `MultiEffect` shadows and inset
"wells" with inner dark/light gradients. All controls (knob, fader, meter, step
cell, segmented, LED) are built on it and mirror the web widgets 1:1.

## Wiring to the engine

The QML is deliberately decoupled from any backend. Every view reads and writes
the **`SongModel`** singleton — channels, patterns, playlist, transport state —
using plain property names. To ship it inside Misuc:

1. Replace `SongModel.qml` with a C++ bridge exposed as a context property:
   - `channels` / `patterns` / `playlist` → `QAbstractListModel`s over `Session`.
   - `bpm`, `playing`, `mode`, `loopOn`, `metronome`, `masterVolume` → the
     existing `Transport`.
   - `togglePlay()`, `toggleStep()` → calls into `Transport` / `Session`.
2. Bind the meters (`NeuMeter.level`) to the engine's per-bus analysers (the
   `MixerPage`/`ChannelStrip` metering path already exists in the C++ app).
3. Route `toast()` and audition/preview through the engine's clip-playback path.

Because the views only touch `SongModel`, this swap is local to the bridge — the
QML layout, theming and interactions do not change. This mirrors how the web UI
keeps its views on a single store.

## Differences from the web UI

- Standalone build has **no audio backend**; playback state toggles but the C++
  bridge drives real sound (the web build uses Web Audio for the same purpose).
- The piano roll / playlist render via `Canvas` (grid, notes, clips) exactly as
  the web canvases do; the C++ build can later swap these for the existing
  native `PianoRoll` / `Playlist` widgets behind the same view slots.
- Project save/export are wired to the engine's `.misuc` ZIP path rather than
  the web build's plain-JSON documents.
