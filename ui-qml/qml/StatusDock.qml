import QtQuick
import QtQuick.Layouts
import QtQuick.Controls.Basic
import "theme"
import "components"
import "."

/* ===========================================================================
   StatusDock — the bottom status bar: engine/transport state LED, the current
   workspace hint, and mode/engine chips. Mirrors the web #dock.
   =========================================================================== */
NeuSurface {
    id: root
    property int workspace: 0
    surfRadius: Theme.radiusPill
    distance: Theme.d1; blur: Theme.blur1
    implicitHeight: 40

    readonly property var hints: [
        "Channel Rack — step sequencer & instruments",
        "Piano Roll — melodic note editor",
        "Playlist — arrange patterns into a song",
        "Mixer — levels, pan, tone & metering",
        "Browser — instruments & saved projects",
        "Settings — appearance, audio & project I/O"
    ]

    RowLayout {
        anchors.fill: parent
        anchors.leftMargin: 18
        anchors.rightMargin: 18
        spacing: 14

        RowLayout {
            spacing: 8
            NeuLed { lit: SongModel.playing; litColor: Theme.ok }
            Text { text: "Misuc Neu"; color: Theme.textDim; font.pixelSize: 10; font.weight: Font.Bold; font.letterSpacing: 1 }
        }

        Text {
            Layout.fillWidth: true
            text: root.hints[Math.min(root.workspace, root.hints.length - 1)]
            color: Theme.textDim
            font.pixelSize: 11.5
            elide: Text.ElideRight
        }

        RowLayout {
            spacing: 8
            Rectangle {
                radius: Theme.radiusPill
                color: Theme.bgDeep
                width: modeText.implicitWidth + 20; height: 22
                Text { id: modeText; anchors.centerIn: parent
                    text: SongModel.mode === "song" ? "SONG" : "PAT"
                    color: Theme.textDim; font.pixelSize: 10; font.weight: Font.Bold }
            }
            Rectangle {
                radius: Theme.radiusPill
                color: Theme.bgDeep
                width: engineText.implicitWidth + 20; height: 22
                Text { id: engineText; anchors.centerIn: parent
                    text: "engine idle"
                    color: Theme.textDim; font.pixelSize: 10; font.weight: Font.Bold }
            }
        }
    }
}
