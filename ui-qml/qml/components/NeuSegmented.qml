import QtQuick
import QtQuick.Controls.Basic
import "../theme"

/* ===========================================================================
   NeuSegmented — inset pill track with a sliding accent "thumb" behind the
   selected segment. Mirrors the web makeSegmented() control (e.g. PAT/SONG).
   =========================================================================== */
Item {
    id: root

    property var items: []          // [{label, value, tip}]
    property string current
    signal picked(string value)

    implicitHeight: 34
    implicitWidth: track.implicitWidth

    NeuSurface {
        id: track
        anchors.fill: parent
        raised: false
        surfRadius: Theme.radiusPill
        insetDistance: Theme.d1

        Row {
            id: row
            anchors.centerIn: parent
            spacing: 2
            Repeater {
                model: root.items
                delegate: Button {
                    id: seg
                    required property var modelData
                    readonly property bool selected: modelData.value === root.current
                    flat: true
                    text: modelData.label
                    width: Math.max(48, segLabel.implicitWidth + 24)
                    height: 26
                    background: Rectangle {
                        radius: Theme.radiusPill
                        color: seg.selected ? Theme.accent : "transparent"
                        Rectangle {
                            visible: seg.selected
                            anchors.fill: parent
                            radius: parent.radius
                            color: "transparent"
                            // glow
                            Rectangle {
                                anchors.fill: parent
                                radius: parent.radius
                                color: Theme.accentSoft
                                opacity: 0.4
                                z: -1
                            }
                        }
                    }
                    contentItem: Label {
                        id: segLabel
                        text: seg.text
                        color: seg.selected ? Theme.accentInk : Theme.textDim
                        font.pixelSize: 11
                        font.weight: Font.Bold
                        horizontalAlignment: Text.AlignHCenter
                        verticalAlignment: Text.AlignVCenter
                    }
                    onClicked: root.picked(seg.modelData.value)
                }
            }
        }
    }
}
