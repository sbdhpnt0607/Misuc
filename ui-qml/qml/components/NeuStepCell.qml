import QtQuick
import "../theme"

/* ===========================================================================
   NeuStepCell — one sequencer step. `on` fills it with the accent gradient
   and a glow; `beat` lightens the off-state; `playing` rings it with the
   accent while the transport passes over it. Mirrors css .step-cell.
   =========================================================================== */
Item {
    id: root

    property bool lit: false
    property bool beat: false
    property bool playing: false
    signal toggled()

    width: 24
    height: 24

    Rectangle {
        anchors.fill: parent
        radius: Theme.radiusXs
        color: root.lit ? Theme.accent : (root.beat ? Theme.withAlpha(Theme.shLight, 0.35) : Theme.stepOff)

        // off-state inset shading
        Rectangle {
            visible: !root.lit
            anchors.fill: parent
            radius: parent.radius
            color: "transparent"
            border.width: 1
            border.color: Theme.withAlpha(Theme.shDark, 0.4)
        }
        // lit-state top highlight
        Rectangle {
            visible: root.lit
            anchors { left: parent.left; right: parent.right; top: parent.top }
            height: parent.height * 0.5
            radius: parent.radius
            gradient: Gradient {
                GradientStop { position: 0.0; color: Theme.withAlpha("#ffffff", 0.25) }
                GradientStop { position: 1.0; color: "transparent" }
            }
        }
        // playing ring
        Rectangle {
            visible: root.playing
            anchors.fill: parent
            radius: parent.radius
            color: "transparent"
            border.width: 2
            border.color: Theme.withAlpha(Theme.accent, 0.7)
        }
        Behavior on color { ColorAnimation { duration: Theme.tFast } }
    }

    MouseArea {
        anchors.fill: parent
        onClicked: root.toggled()
    }
}
