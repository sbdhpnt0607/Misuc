import QtQuick
import QtQuick.Layouts
import QtQuick.Controls.Basic
import "../theme"
import "../components"
import ".."

/* ===========================================================================
   MixerView — one neumorphic strip per channel (colour, name, pan + tone
   knobs, vertical fader beside a live meter, mute/solo) plus a sticky master
   strip. Mirrors ui-neu/js/mixer.js. In the Qt build the meters bind to the
   engine's per-bus analysers; here they idle at zero.
   =========================================================================== */
Item {
    id: root

    NeuSurface {
        anchors.fill: parent
        surfRadius: Theme.radiusLg
        distance: Theme.d2; blur: Theme.blur2

        ColumnLayout {
            anchors.fill: parent
            anchors.margins: 14
            spacing: 12

            RowLayout {
                Text { text: "Mixer"; color: Theme.textDim; font.pixelSize: 10; font.weight: Font.Bold; font.letterSpacing: 1.2 }
                Item { Layout.fillWidth: true }
                Text { text: "peak · dBFS"; color: Theme.textFaint; font.pixelSize: 10 }
            }

            NeuSurface {
                Layout.fillWidth: true
                Layout.fillHeight: true
                raised: false
                surfRadius: Theme.radiusMd
                insetDistance: Theme.d2

                Flickable {
                    anchors.fill: parent
                    anchors.margins: 12
                    contentWidth: stripRow.implicitWidth
                    clip: true
                    boundsBehavior: Flickable.StopAtBounds

                    Row {
                        id: stripRow
                        spacing: 14
                        height: parent.height

                        Repeater {
                            model: SongModel.channels
                            delegate: ChannelStrip {}
                        }
                        MasterStrip {}
                    }
                }
            }
        }
    }

    component ChannelStrip: NeuSurface {
        id: strip
        required property var modelData
        property var channel: modelData
        width: 84
        height: parent ? parent.height : 300
        surfRadius: Theme.radiusMd
        distance: Theme.d1; blur: Theme.blur1

        ColumnLayout {
            anchors.fill: parent
            anchors.margins: 10
            spacing: 8

            Rectangle {
                Layout.fillWidth: true; Layout.preferredHeight: 5
                radius: 2.5; color: strip.channel.color
            }
            Text {
                Layout.fillWidth: true
                text: strip.channel.name
                color: Theme.textStrong
                font.pixelSize: 11; font.weight: Font.Bold
                horizontalAlignment: Text.AlignHCenter
                elide: Text.ElideRight
            }

            RowLayout {
                Layout.alignment: Qt.AlignHCenter
                spacing: 8
                NeuKnob { small: true; value: strip.channel.pan; from: -1; to: 1
                    displayText: Math.abs(strip.channel.pan) < 0.02 ? "C" : (strip.channel.pan < 0 ? "L" : "R") + Math.round(Math.abs(strip.channel.pan) * 100)
                    onEdited: (v) => { strip.channel.pan = v; SongModel.songChanged() } }
                NeuKnob { small: true; value: strip.channel.tone
                    displayText: Math.round(strip.channel.tone * 100)
                    onEdited: (v) => { strip.channel.tone = v; SongModel.songChanged() } }
            }

            RowLayout {
                Layout.fillHeight: true
                Layout.alignment: Qt.AlignHCenter
                spacing: 8
                NeuFader {
                    Layout.fillHeight: true
                    value: strip.channel.volume
                    onEdited: (v) => { strip.channel.volume = v; SongModel.songChanged() }
                }
                NeuMeter { Layout.fillHeight: true; level: 0 }
            }

            RowLayout {
                Layout.alignment: Qt.AlignHCenter
                spacing: 8
                NeuIconButton { glyph: "M"; size: 26; active: strip.channel.mute
                    glyphColor: strip.channel.mute ? Theme.danger : Theme.textDim
                    onClicked: { strip.channel.mute = !strip.channel.mute; SongModel.songChanged() } }
                NeuIconButton { glyph: "S"; size: 26; active: strip.channel.solo
                    glyphColor: strip.channel.solo ? Theme.warn : Theme.textDim
                    onClicked: { strip.channel.solo = !strip.channel.solo; SongModel.songChanged() } }
            }
        }
    }

    component MasterStrip: NeuSurface {
        width: 96
        height: parent ? parent.height : 300
        surfRadius: Theme.radiusMd
        distance: Theme.d2; blur: Theme.blur2

        ColumnLayout {
            anchors.fill: parent
            anchors.margins: 10
            spacing: 8

            Rectangle { Layout.fillWidth: true; Layout.preferredHeight: 5; radius: 2.5; color: Theme.textStrong }
            Text {
                Layout.fillWidth: true; text: "MASTER"
                color: Theme.textStrong; font.pixelSize: 11; font.weight: Font.Bold
                horizontalAlignment: Text.AlignHCenter
            }
            Text { text: "OUT"; color: Theme.textDim; font.pixelSize: 9; Layout.alignment: Qt.AlignHCenter }

            RowLayout {
                Layout.fillHeight: true
                Layout.alignment: Qt.AlignHCenter
                spacing: 8
                NeuFader {
                    Layout.fillHeight: true
                    value: SongModel.masterVolume
                    onEdited: (v) => SongModel.masterVolume = v
                }
                NeuMeter { Layout.fillHeight: true; level: 0 }
            }

            NeuLed { Layout.alignment: Qt.AlignHCenter; lit: false; litColor: Theme.danger }
        }
    }
}
