# Misuc Neu — integration build

`ui-qml/` is the standalone Qt 6 / QML UI written by Arena AI. This directory
contains **only build/packaging glue**; the QML tree and its entry point remain
in `ui-qml/` and are compiled as-is.

## What the build does

`CMakeLists.txt` creates a second GUI executable, `misuc_neu`, from:

- `ui-qml/src/main.cpp` (Arena's `QGuiApplication` + `QQmlApplicationEngine`)
- `ui-qml/qml.qrc` (Arena's QML resource manifest)

It links `Qt6::Quick`, `Qt6::QuickControls2` and, when present,
`Qt6::QuickEffects`. If Qt Quick is not installed, the target is skipped with a
status message instead of failing the build. That keeps the Linux release image
(`qt6-base-dev` only) working while the Windows Qt 6.8 build ships the preview.

On Windows the target is a `WIN32_EXECUTABLE` (PE subsystem 2), so it starts
without a console window. A small `.rc` resource gives the executable Misuc's
multi-size icon and version stamp, so Explorer, the taskbar and both shortcuts
show the correct branding instead of Qt's generic icon (Arena's QML and
`main.cpp` are not modified). `windeployqt --qmldir ui-qml/qml` runs both:

- after the build, so `build/bin/Release` (and the CI ZIP) is self-contained;
- after the CPack staging install, so the NSIS installer carries the Qt Quick
  DLLs and the `qml/QtQuick/...` module tree.

The NSIS installer adds Start Menu and Desktop shortcuts named **Misuc Neu**.
The classic Widgets app (`misuc_app`) remains the default launch target and
keeps its existing shortcuts.

Build options:

```text
MISUC_BUILD_UI   ON   build the classic Widgets app
MISUC_BUILD_NEU  ON   build the QML preview when Qt Quick is available
```

Disable the preview with `-DMISUC_BUILD_NEU=OFF`.

## Minimal fixes applied to Arena's QML

The QML was hand-written and, as its own README warns, had never been compiled.
Four runtime blockers were fixed without changing layout or design:

1. `WorkspaceRail.qml` — `font.pixelSize: 8.5` → `8` (QML `pixelSize` is an
   integer).
2. `StatusDock.qml` — `font.pixelSize: 11.5` → `12` (same reason).
3. `ChannelRackView.qml` — the inline `ChannelRow` delegate now declares
   `required property var modelData` and derives `channel` from it. Passing
   `channel: modelData` from the `Repeater` does not resolve in the inline
   component's scope under Qt 6.12 and produced `modelData is not defined`.
4. `MixerView.qml` — the same required-`modelData` fix for `ChannelStrip`.

No other QML source was edited.

## What it is (and is not)

This is Arena's design preview, not an engine-wired application. Every view
reads the `SongModel` singleton in `ui-qml/qml/SongModel.qml`, which contains
demo channels, patterns, clips and transport state. Playback toggles the demo
state but produces no audio. Arena's own README describes the intended bridge
(replace `SongModel` with a C++ object over `Session`, `Transport` and the
mixer); that bridge is not part of this integration.

Classic `misuc_app` is unchanged: real engine, WASAPI/PipeWire audio, project
save/load, recording and export.

## Verification

Local QML validation: `pyside6-qmllint` plus a Qt 6.12 `QQmlApplicationEngine`
load that switched all six workspaces; zero QML warnings after the fixes above.

Windows CI (`windows.yml`) builds the ZIP and the release workflow builds the
NSIS installer. The installed package was checked on Windows:

```text
misuc_neu.exe           180,736 bytes, PE subsystem 2 (WINDOWS_GUI)
icon                    Misuc multi-size .ico + 0.3.1 version resource
installed title         Misuc - Neu Studio
child processes         none (no conhost.exe)
crash events            0
CloseMainWindow         exits only Misuc Neu; the shell stays alive
Qt Quick payload        Qt6Quick.dll, Qt6Qml.dll, Qt6QuickEffects.dll,
                        qml/QtQuick/Controls/Basic/qmldir
shortcuts               Desktop + Start Menu "Misuc Neu" -> misuc_neu.exe
```

Classic Misuc was re-verified from the same installer: WASAPI 48 kHz,
`0 xruns`, no crash, no console child, clean close.
