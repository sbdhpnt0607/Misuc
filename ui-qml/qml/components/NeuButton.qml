import QtQuick
import QtQuick.Controls.Basic
import "../theme"

/* ===========================================================================
   NeuButton — raised neumorphic button that presses inward on click.
   Variants: normal, accent (gradient fill + glow), danger/ok (state fills),
   toggle (latches pressed while `checked`). Emits clicked().
   =========================================================================== */
NeuSurface {
    id: root

    property string text: ""
    property bool accent: false
    property string variant: "normal"   // normal | accent | danger | ok
    property bool pressedState: mouse.pressed || (checkable && checked)
    property bool checkable: false
    property bool checked: false
    property color iconColor: Theme.text

    signal clicked()

    raised: !pressedState
    distance: Theme.d1
    blur: Theme.blur1
    surfRadius: Theme.radiusSm
    surfColor: {
        if (variant === "accent" || accent) return Theme.accent
        if (variant === "danger" && (checked || pressedState)) return Theme.danger
        if (variant === "ok" && (checked || pressedState)) return Theme.ok
        return Theme.surface
    }

    implicitWidth: label.implicitWidth + 32
    implicitHeight: 36

    Behavior on raised { PropertyAnimation { duration: Theme.tFast } }

    Label {
        id: label
        anchors.centerIn: parent
        text: root.text
        color: {
            if (root.variant === "accent" || root.accent) return Theme.accentInk
            if ((root.variant === "danger" || root.variant === "ok") && (root.checked || root.pressedState))
                return "#ffffff"
            return Theme.text
        }
        font.pixelSize: 12
        font.weight: Font.DemiBold
    }

    MouseArea {
        id: mouse
        anchors.fill: parent
        onClicked: {
            if (root.checkable) root.checked = !root.checked
            root.clicked()
        }
    }
}
