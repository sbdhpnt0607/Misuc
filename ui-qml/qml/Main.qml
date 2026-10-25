import QtQuick
import QtQuick.Layouts
import QtQuick.Controls.Basic
import QtQuick.Window
import "theme"
import "components"
import "views"
import "."

/* ===========================================================================
   Main — the Misuc Neu shell. Same five-zone grid as the web UI:
   header (top), workspace rail (left), active workspace (centre), inspector
   (right), status dock (bottom). The workspace stack swaps the six views.
   =========================================================================== */
ApplicationWindow {
    id: win
    visible: true
    width: 1440
    height: 900
    minimumWidth: 1024
    minimumHeight: 640
    title: "Misuc — Neu Studio"
    color: Theme.bg

    property int workspace: 0

    // ---- keyboard shortcuts (mirror the web app) ----
    Shortcut { sequence: "Space"; onActivated: SongModel.togglePlay() }
    Shortcut { sequence: "1"; onActivated: win.workspace = 0 }
    Shortcut { sequence: "2"; onActivated: win.workspace = 1 }
    Shortcut { sequence: "3"; onActivated: win.workspace = 2 }
    Shortcut { sequence: "4"; onActivated: win.workspace = 3 }
    Shortcut { sequence: "5"; onActivated: win.workspace = 4 }
    Shortcut { sequence: "6"; onActivated: win.workspace = 5 }
    Shortcut { sequence: "L"; onActivated: SongModel.loopOn = !SongModel.loopOn }
    Shortcut { sequence: "M"; onActivated: SongModel.metronome = !SongModel.metronome }

    GridLayout {
        anchors.fill: parent
        anchors.margins: 14
        rowSpacing: 14
        columnSpacing: 14
        columns: 3
        rows: 3

        // ---- header spans all columns ----
        HeaderBar {
            Layout.columnSpan: 3
            Layout.fillWidth: true
            Layout.preferredHeight: 72
        }

        // ---- rail ----
        WorkspaceRail {
            Layout.row: 1
            Layout.column: 0
            Layout.fillHeight: true
            Layout.preferredWidth: 84
            current: win.workspace
            onSelected: (i) => win.workspace = i
        }

        // ---- workspace stack ----
        NeuSurface {
            Layout.row: 1
            Layout.column: 1
            Layout.fillWidth: true
            Layout.fillHeight: true
            surfRadius: Theme.radiusLg
            distance: Theme.d2; blur: Theme.blur2

            StackLayout {
                anchors.fill: parent
                anchors.margins: 0
                currentIndex: win.workspace
                ChannelRackView {}
                PianoRollView {}
                PlaylistView {}
                MixerView {}
                BrowserView {}
                SettingsView {}
            }
        }

        // ---- inspector ----
        Inspector {
            Layout.row: 1
            Layout.column: 2
            Layout.fillHeight: true
            Layout.preferredWidth: 300
        }

        // ---- status dock spans all columns ----
        StatusDock {
            Layout.columnSpan: 3
            Layout.fillWidth: true
            Layout.preferredHeight: 40
            workspace: win.workspace
        }
    }

    // ---- toast host ----
    ToastHost { id: toasts }
    Connections {
        target: SongModel
        function onToast(message, kind) { toasts.show(message, kind) }
    }
}
