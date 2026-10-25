import QtQuick
import "../theme"

/* ===========================================================================
   NeuFader — vertical fader with an inset track, an accent fill and a raised
   cap. Drag or wheel to change value. Mirrors the web attachFader().
   =========================================================================== */
Item {
    id: root

    property real value: 0.8
    property real from: 0.0
    property real to: 1.0
    signal edited(real value)

    readonly property real normalized: (value - from) / (to - from)

    width: 40
    height: 160

    // inset track
    Rectangle {
        id: track
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.top: parent.top
        anchors.bottom: parent.bottom
        anchors.margins: 6
        width: 8
        radius: width / 2
        color: Theme.bgDeep
        Rectangle {
            anchors { fill: parent; margins: 0 }
            radius: parent.radius
            color: "transparent"
            border.width: 1
            border.color: Theme.withAlpha(Theme.shDark, 0.6)
        }
    }

    // accent fill from the bottom
    Rectangle {
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottom: track.bottom
        width: 8
        radius: width / 2
        height: (track.height) * root.normalized
        gradient: Gradient {
            GradientStop { position: 0.0; color: Theme.accentDeep }
            GradientStop { position: 1.0; color: Theme.accent }
        }
    }

    // cap
    Rectangle {
        id: cap
        width: 30
        height: 16
        radius: 5
        anchors.horizontalCenter: parent.horizontalCenter
        y: 6 + (track.height) * (1 - root.normalized) - height / 2
        gradient: Gradient {
            GradientStop { position: 0.0; color: Theme.surfaceHi }
            GradientStop { position: 1.0; color: Theme.surface }
        }
        Rectangle {
            anchors.centerIn: parent
            width: parent.width - 10
            height: 2
            radius: 1
            color: Theme.accent
        }
        Rectangle {
            anchors.fill: parent
            radius: parent.radius
            color: "transparent"
            border.width: 1
            border.color: Theme.withAlpha(Theme.shDark, 0.5)
        }
    }

    MouseArea {
        id: ma
        anchors.fill: parent
        cursorShape: Qt.SizeVerCursor
        function setFromY(y) {
            const pad = 6
            const usable = root.height - pad * 2
            const ratio = 1 - Math.max(0, Math.min(1, (y - pad) / usable))
            root.value = root.from + ratio * (root.to - root.from)
            root.edited(root.value)
        }
        onPressed: (m) => setFromY(m.y)
        onPositionChanged: (m) => { if (pressed) setFromY(m.y) }
        onWheel: (w) => {
            const step = (root.to - root.from) * 0.03
            root.value = Math.max(root.from, Math.min(root.to, root.value + (w.angleDelta.y > 0 ? step : -step)))
            root.edited(root.value)
        }
    }
}
