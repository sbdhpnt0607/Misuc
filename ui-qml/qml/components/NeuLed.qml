import QtQuick
import "../theme"

/* ===========================================================================
   NeuLed — a small round status light. `on` lights it with the accent (or a
   semantic colour) plus a glow; off it reads as an inset dimple.
   =========================================================================== */
Item {
    id: root

    property bool lit: false
    property color litColor: Theme.accent
    property real diameter: 10

    width: diameter
    height: diameter

    Rectangle {
        anchors.fill: parent
        radius: width / 2
        color: root.lit ? root.litColor : Theme.ledOff
        border.width: root.lit ? 0 : 1
        border.color: Theme.withAlpha(Theme.shDark, 0.5)

        // inner specular dot when lit
        Rectangle {
            visible: root.lit
            anchors.centerIn: parent
            width: parent.width * 0.4
            height: parent.height * 0.4
            radius: width / 2
            color: Theme.withAlpha("#ffffff", 0.5)
        }
        // glow halo when lit
        Rectangle {
            visible: root.lit
            anchors.centerIn: parent
            width: parent.width * 2.2
            height: parent.height * 2.2
            radius: width / 2
            color: Theme.withAlpha(root.litColor, 0.25)
            z: -1
        }
        Behavior on color { ColorAnimation { duration: Theme.tFast } }
    }
}
