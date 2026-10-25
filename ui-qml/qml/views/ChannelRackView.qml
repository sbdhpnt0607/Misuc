import QtQuick
import QtQuick.Layouts
import QtQuick.Controls.Basic
import "../theme"
import "../components"
import ".."

/* ===========================================================================
   ChannelRackView — pattern tabs + one row per channel (colour, name, mute/
   solo, a 16-step grid, volume knob). Steps toggle through SongModel. This is
   the QML mirror of ui-neu/js/channelrack.js.
   =========================================================================== */
Item {
    id: root

    NeuSurface {
        anchors.fill: parent
        surfRadius: Theme.radiusLg
        distance: Theme.d2
        blur: Theme.blur2

        ColumnLayout {
            anchors.fill: parent
            anchors.margins: 14
            spacing: 12

            // ---- toolbar: pattern tabs + add pattern ----
            RowLayout {
                spacing: 8
                Repeater {
                    model: SongModel.patterns
                    delegate: NeuSurface {
                        required property var modelData
                        required property int index
                        readonly property bool active: index === SongModel.activePattern
                        raised: !active
                        surfRadius: Theme.radiusPill
                        distance: Theme.d1; blur: Theme.blur1
                        implicitWidth: tabRow.implicitWidth + 24
                        implicitHeight: 34
                        Row {
                            id: tabRow
                            anchors.centerIn: parent
                            spacing: 8
                            Rectangle {
                                width: 9; height: 9; radius: 4.5
                                anchors.verticalCenter: parent.verticalCenter
                                color: modelData.color
                            }
                            Text {
                                anchors.verticalCenter: parent.verticalCenter
                                text: modelData.name
                                color: active ? Theme.textStrong : Theme.textDim
                                font.pixelSize: 11; font.weight: Font.Bold
                            }
                        }
                        MouseArea { anchors.fill: parent; onClicked: SongModel.activePattern = index }
                    }
                }
                Item { Layout.fillWidth: true }
                NeuIconButton { glyph: "＋"; size: 34; tip: "New pattern" }
            }

            // ---- inset well holding the channel rows ----
            NeuSurface {
                Layout.fillWidth: true
                Layout.fillHeight: true
                raised: false
                surfRadius: Theme.radiusMd
                insetDistance: Theme.d2

                Flickable {
                    anchors.fill: parent
                    anchors.margins: 10
                    contentHeight: rackCol.implicitHeight
                    clip: true
                    boundsBehavior: Flickable.StopAtBounds

                    Column {
                        id: rackCol
                        width: parent.width
                        spacing: 10

                        Repeater {
                            model: SongModel.channels
                            delegate: ChannelRow {}
                        }
                    }
                }
            }
        }
    }

    // One channel row. Extracted so the step cells can capture `channel.id`
    // cleanly (a Repeater-of-Repeater cannot otherwise see the outer model).
    component ChannelRow: NeuSurface {
        id: rowRoot
        required property var modelData
        property var channel: modelData
        readonly property var steps: SongModel.activePatternObj().steps[channel.id] || []

        width: rackCol.width
        height: 52
        surfRadius: Theme.radiusMd
        distance: Theme.d1; blur: Theme.blur1

        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: 12
            anchors.rightMargin: 12
            spacing: 10

            Rectangle { width: 14; height: 14; radius: 7; color: rowRoot.channel.color }
            Text {
                Layout.preferredWidth: 110
                text: rowRoot.channel.name
                color: Theme.textStrong
                font.pixelSize: 12; font.weight: Font.DemiBold
                elide: Text.ElideRight
            }
            NeuIconButton { glyph: "M"; size: 26; active: rowRoot.channel.mute
                glyphColor: rowRoot.channel.mute ? Theme.danger : Theme.textDim
                onClicked: { rowRoot.channel.mute = !rowRoot.channel.mute; SongModel.songChanged() } }
            NeuIconButton { glyph: "S"; size: 26; active: rowRoot.channel.solo
                glyphColor: rowRoot.channel.solo ? Theme.warn : Theme.textDim
                onClicked: { rowRoot.channel.solo = !rowRoot.channel.solo; SongModel.songChanged() } }

            // ---- step grid ----
            Row {
                Layout.fillWidth: true
                spacing: 4
                Repeater {
                    model: rowRoot.steps
                    delegate: NeuStepCell {
                        required property var modelData
                        required property int index
                        width: 22; height: 22
                        lit: modelData === 1
                        beat: index % 4 === 0
                        onToggled: { SongModel.toggleStep(rowRoot.channel.id, index); }
                    }
                }
            }

            NeuKnob {
                small: true
                value: rowRoot.channel.volume
                displayText: Math.round(rowRoot.channel.volume * 100)
                onEdited: (v) => { rowRoot.channel.volume = v; SongModel.songChanged() }
            }
        }
    }
}
