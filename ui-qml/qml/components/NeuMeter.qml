import QtQuick
import "../theme"

/* ===========================================================================
   NeuMeter — inset peak meter with a green→amber→red gradient fill. Set
   `level` (0..1) from the engine's analyser; the fill animates smoothly.
   =========================================================================== */
Item {
    id: root

    property real level: 0.0        // 0..1
    property bool horizontal: false

    width: horizontal ? 120 : 8
    height: horizontal ? 8 : 120

    Rectangle {
        anchors.fill: parent
        radius: width < height ? width / 2 : height / 2
        color: Theme.bgDeep
        clip: true
        Rectangle {
            anchors { left: parent.left; right: parent.right; bottom: parent.bottom }
            visible: !root.horizontal
            height: parent.height * Math.max(0, Math.min(1, root.level))
            gradient: Gradient {
                GradientStop { position: 0.0; color: Theme.ok }
                GradientStop { position: 0.6; color: Theme.ok }
                GradientStop { position: 0.82; color: Theme.warn }
                GradientStop { position: 1.0; color: Theme.danger }
            }
            Behavior on height { PropertyAnimation { duration: 60 } }
        }
        Rectangle {
            anchors { left: parent.left; top: parent.top; bottom: parent.bottom }
            visible: root.horizontal
            width: parent.width * Math.max(0, Math.min(1, root.level))
            gradient: Gradient {
                orientation: Gradient.Horizontal
                GradientStop { position: 0.0; color: Theme.ok }
                GradientStop { position: 0.6; color: Theme.ok }
                GradientStop { position: 0.82; color: Theme.warn }
                GradientStop { position: 1.0; color: Theme.danger }
            }
            Behavior on width { PropertyAnimation { duration: 60 } }
        }
    }
}
