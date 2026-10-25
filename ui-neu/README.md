# Misuc Neu — Web UI

A from-scratch, **neumorphic** re-imagining of the Misuc workspace, built as a
zero-dependency static web app. It is a fully functional design + interaction
prototype: a real Web Audio synth engine drives playback, so every control you
touch makes sound. This is the reference design that the Qt/QML build
(`../ui-qml`) mirrors.

> **Status:** interactive prototype with a real Web Audio engine. It is *not*
> wired to the PipeWire/`.misuc` engine — the shipping desktop app renders this
> same layout in Qt 6 / QML against the real engine (see `../ui-qml/README.md`).
> Nothing here is faked: the instruments are synthesised live, and features that
> need the native engine (audio recording, `.misuc` ZIP save) are labelled
> honestly rather than stubbed.

---

## Run it

No build step, no dependencies. Any static server works:

```bash
cd ui-neu
node server.js            # serves on http://localhost:5173  (binds 0.0.0.0)
# or
python3 -m http.server 5173
```

Then open the URL. **Click anywhere once** to unlock audio (browser autoplay
policy) — the transport and instruments come alive after the first gesture.

## Test it

A headless boot + interaction test runs the *real* ES modules in a jsdom DOM,
stubbing only Web Audio and canvas:

```bash
cd ui-neu
npm i jsdom                # one-time
node tests/boot.test.mjs   # 33 assertions: boot, views, store, transport, theme, I/O
```

---

## What's here

Six workspaces on a left icon rail, a transport pod in the header, a
context-sensitive inspector on the right, and a status dock at the bottom.

| Workspace | What it does |
| --- | --- |
| **Rack** | Step sequencer — 4 patterns, per-channel mute/solo/volume, 16/32/64 steps, live playhead column, add-channel instrument picker. |
| **Roll** | Piano roll — draw / select-move / erase tools, grid snap, H+V zoom, velocity lane, piano-key gutter, playhead. |
| **Arrange** | Playlist — paint pattern clips onto track lanes, move/erase, draggable loop region on the ruler, bar grid. |
| **Mixer** | Per-channel strips (pan + tone knobs, fader, live peak meter, mute/solo) and a sticky master strip. |
| **Browser** | Searchable instruments (audition + add) and the saved-projects shelf. |
| **Setup** | Theme (light/dark), accent colour, audio diagnostics, 440 Hz test tone, project save/export/import, shortcut reference. |

**Playback modes:** `PAT` loops the active pattern; `SONG` plays the playlist
arrangement. Both are driven by a single look-ahead scheduler.

## The audio engine

`js/audio.js` synthesises every instrument from oscillators, noise, filters and
envelopes (kick, snare, hats, clap, tom, bass, lead, pluck, pad). Each channel
is `gain → pan → lowpass(tone) → analyser`, summed to a master bus with a
`DynamicsCompressor` acting as a −1 dBFS brickwall limiter — the same "live ==
export" ceiling the Qt engine uses. Meters read the per-channel analysers.

## Design system

Neumorphism: the background *is* the surface, and depth comes from a paired
dark (down-right) + light (up-left) soft shadow — never borders.

- `css/tokens.css` — light/dark palettes × 5 accents (violet, cyan, emerald,
  amber, crimson — mirroring the Qt `ThemeEngine` presets), shadow recipes.
- `css/components.css` — buttons, knobs, faders, meters, segmented controls,
  step cells, chips, inputs.
- `css/views.css` — the DAW-specific layout.

Switch theme with the header moon/sun button or **Setup → Appearance**; the
choice persists in `localStorage`.

## Layout

```
ui-neu/
├── index.html              # app shell (header / rail / main / inspector / dock)
├── server.js               # tiny static server (binds 0.0.0.0 for preview)
├── css/                    # tokens, base, components, views
├── js/
│   ├── app.js              # bootstrap: rail nav, view switching, shortcuts, autosave
│   ├── state.js            # project model, event bus, undo/redo, persistence, demo song
│   ├── audio.js            # Web Audio synth engine + metering
│   ├── transport.js        # look-ahead scheduler (PAT / SONG)
│   ├── widgets.js          # knob / fader / segmented / popover / toast behaviours
│   ├── icons.js            # inline SVG icon set
│   ├── header.js           # brand, transport pod, master cluster, theme
│   ├── channelrack.js      # step sequencer view
│   ├── pianoroll.js        # canvas note editor
│   ├── playlist.js         # arrangement view
│   ├── mixer.js            # channel strips + master
│   ├── browser.js          # instruments + saved projects
│   ├── inspector.js        # context-sensitive properties
│   └── settings.js         # appearance, audio, project I/O
└── tests/boot.test.mjs     # headless boot + interaction test (jsdom)
```

## Keyboard

`Space` play/stop · `1`–`6` switch workspace · `L` loop · `M` metronome ·
`D`/`S`/`E` roll tools (draw/select/erase) · `Ctrl+Z`/`Ctrl+Shift+Z` undo/redo ·
`Ctrl+S` save to shelf.

## Honesty boundaries

Following the repo's "no fake features" rule: **Record** arms but routes
nowhere (capture needs the PipeWire engine); **Save to shelf** and **Export**
write plain-JSON documents (the `.misuc` container is a real ZIP handled by the
engine); audition and playback are genuinely synthesised, not samples.
