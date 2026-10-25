import QtQuick
import QtQuick.Layouts
import QtQuick.Controls.Basic
import "theme"
import "components"
import "."

/* ===========================================================================
   Inspector — context-sensitive right panel. Shows project summary by
   default; when a channel is selected it exposes name, volume, pan and tone
   bound to that channel. Mirrors ui-neu/js/inspector.js.
   =========================================================================== */
NeuSurface {
    id: root
    surfRadius: Theme.radiusLg
    distance: Theme.d2; blur: Theme.blur2
    implicitWidth: 300

    readonly property var channel: {
        if (SongModel.selectionType !== "channel") return null
        for (const c of SongModel.channels)
            if (c.id === SongModel.selectionId) return c
        return null
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 16
        spacing: 14

        // ---- header ----
        RowLayout {
            spacing: 10
            NeuSurface {
                Layout.preferredWidth: 34; Layout.preferredHeight: 34
                surfRadius: Theme.radiusSm; distance: Theme.d1; blur: Theme.blur1
                Text { anchors.centerIn: parent; text: root.channel ? "🎹" : "🎼"; font.pixelSize: 15; color: Theme.accent }
            }
            Text {
                text: root.channel ? "Channel" : "Project"
                color: Theme.textDim; font.pixelSize: 10; font.weight: Font.Bold; font.letterSpacing: 1.2
            }
        }

        // ---- channel properties ----
        ColumnLayout {
            visible: root.channel !== null
            Layout.fillWidth: true
            spacing: 12

            RowLayout {
                spacing: 10
                Text { text: "Name"; color: Theme.textDim; font.pixelSize: 10; font.weight: Font.Bold; Layout.preferredWidth: 60 }
                NeuField { Layout.fillWidth: true; text: root.channel ? root.channel.name : ""
                    onTextChanged: if (root.channel && text !== root.channel.name) { root.channel.name = text; SongModel.songChanged() } }
            }
            RowLayout {
                spacing: 10
                Text { text: "Volume"; color: Theme.textDim; font.pixelSize: 10; font.weight: Font.Bold; Layout.preferredWidth: 60 }
                NeuKnob { value: root.channel ? root.channel.volume : 0
                    displayText: Math.round((root.channel ? root.channel.volume : 0) * 100) + "%"
                    onEdited: (v) => { if (root.channel) { root.channel.volume = v; SongModel.songChanged() } } }
            }
            RowLayout {
                spacing: 10
                Text { text: "Pan"; color: Theme.textDim; font.pixelSize: 10; font.weight: Font.Bold; Layout.preferredWidth: 60 }
                NeuKnob { value: root.channel ? root.channel.pan : 0; from: -1; to: 1
                    displayText: Math.abs(root.channel ? root.channel.pan : 0) < 0.02 ? "C"
                        : ((root.channel.pan < 0 ? "L" : "R") + Math.round(Math.abs(root.channel.pan) * 100))
                    onEdited: (v) => { if (root.channel) { root.channel.pan = v; SongModel.songChanged() } } }
            }
            RowLayout {
                spacing: 10
                Text { text: "Tone"; color: Theme.textDim; font.pixelSize: 10; font.weight: Font.Bold; Layout.preferredWidth: 60 }
                NeuKnob { value: root.channel ? root.channel.tone : 1
                    displayText: Math.round((root.channel ? root.channel.tone : 1) * 100) + "%"
                    onEdited: (v) => { if (root.channel) { root.channel.tone = v; SongModel.songChanged() } } }
            }
        }

        // ---- project summary ----
        ColumnLayout {
            visible: root.channel === null
            Layout.fillWidth: true
            spacing: 8
            Repeater {
                model: [
                    ["Name", SongModel.name],
                    ["Tempo", SongModel.bpm + " BPM"],
                    ["Channels", SongModel.channels.length],
                    ["Patterns", SongModel.patterns.length],
                    ["Tracks", SongModel.playlist.length]
                ]
                delegate: RowLayout {
                    required property var modelData
                    Layout.fillWidth: true
                    Text { text: modelData[0]; color: Theme.textDim; font.pixelSize: 12; Layout.fillWidth: true }
                    Text { text: String(modelData[1]); color: Theme.textStrong; font.pixelSize: 12; font.weight: Font.DemiBold }
                }
            }
        }

        Item { Layout.fillHeight: true }

        // ---- empty-state hint ----
        Rectangle {
            visible: root.channel === null
            Layout.fillWidth: true
            Layout.preferredHeight: 80
            radius: Theme.radiusMd
            color: "transparent"
            border.width: 1
            border.color: Theme.withAlpha(Theme.shDark, 0.4)
            Column {
                anchors.centerIn: parent
                spacing: 6
                Text { anchors.horizontalCenter: parent.horizontalCenter; text: "🎚"; font.pixelSize: 26; opacity: 0.5 }
                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: "Select a channel to inspect it"
                    color: Theme.textFaint; font.pixelSize: 11
                }
            }
        }
    }
}
