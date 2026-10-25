import QtQuick
import "../theme"

/* ===========================================================================
   NeuKnob — rotary control. Drag vertically (or wheel) to change value over
   a 270° sweep; the accent pointer rotates with it. Double-click resets to
   `defaultValue`. Mirrors the web attachKnob() behaviour.
   =========================================================================== */
Item {
    id: root

    property real value: 0.5
    property real from: 0.0
    property real to: 1.0
    property real defaultValue: 0.5
    property bool small: false
    property string displayText: Math.round(normalized * 100) + "%"
    signal edited(real value)

    readonly property real normalized: (value - from) / (to - from)
    readonly property real angle: -135 + normalized * 270

    width: small ? 28 : 38
    height: small ? 28 : 38

    // dial body
    Rectangle {
        id: dial
        anchors.fill: parent
        radius: width / 2
        gradient: Gradient {
            GradientStop { position: 0.0; color: Theme.surfaceHi }
            GradientStop { position: 1.0; color: Theme.surface }
        }
        // raised shadow via a subtle darker ring underneath
        Rectangle {
            anchors.fill: parent
            radius: width / 2
            color: "transparent"
            border.width: 1
            border.color: Theme.withAlpha(Theme.shDark, 0.6)
        }
    }

    // pointer
    Rectangle {
        id: pointer
        width: small ? 2.5 : 3
        height: parent.height * 0.32
        radius: width / 2
        color: Theme.accent
        anchors.horizontalCenter: parent.horizontalCenter
        y: small ? 3.5 : 4
        transformOrigin: Item.Bottom
        antialiasing: true
        // pivot around the dial centre
        transform: Translate { y: (root.height / 2) - (pointer.y + pointer.height) }
        Rotation {
            origin.x: pointer.width / 2
            origin.y: (root.height / 2) - pointer.y
            angle: root.angle
        }
        Rectangle {
            anchors.fill: parent
            radius: parent.radius
            color: Theme.accentSoft
            z: -1
        }
    }

    // value label below
    Text {
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.top: parent.bottom
        anchors.topMargin: 2
        text: root.displayText
        color: Theme.textDim
        font.pixelSize: 9
        font.family: "monospace"
    }

    MouseArea {
        id: ma
        anchors.fill: parent
        property real startY: 0
        property real startVal: 0
        cursorShape: Qt.SizeVerCursor
        onPressed: (m) => { startY = m.y; startVal = root.value; }
        onPositionChanged: (m) => {
            if (!pressed) return
            const fine = (m.modifiers & Qt.ShiftModifier) ? 0.25 : 1
            const range = root.to - root.from
            const v = startVal - ((m.y - startY) / 150) * range * fine
            root.value = Math.max(root.from, Math.min(root.to, v))
            root.edited(root.value)
        }
        onWheel: (w) => {
            const range = root.to - root.from
            const step = range * ((w.modifiers & Qt.ShiftModifier) ? 0.01 : 0.04)
            root.value = Math.max(root.from, Math.min(root.to, root.value + (w.angleDelta.y > 0 ? step : -step)))
            root.edited(root.value)
        }
        onDoubleClicked: { root.value = root.defaultValue; root.edited(root.value) }
    }
}
