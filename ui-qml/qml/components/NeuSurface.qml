import QtQuick
import QtQuick.Effects
import "../theme"

/* ===========================================================================
   NeuSurface — the neumorphic primitive.
   raised=true : flat surface with a paired soft shadow (dark down-right,
                 light up-left) — the classic extruded look.
   raised=false: an inset "well" (pressed into the background), drawn as a
                 recessed rect with inner dark/light gradients on the edges.
   Everything else in the design system is a NeuSurface plus content.
   Child items land in `contentItem`, which sits above the surface.
   Requires QtQuick.Effects (Qt 6.5+).
   =========================================================================== */
Item {
    id: root

    property bool raised: true
    property real surfRadius: Theme.radiusMd
    property color surfColor: Theme.surface
    property real distance: Theme.d2
    property real blur: Theme.blur2
    property real insetDistance: Theme.d2

    default property alias content: contentArea.data
    readonly property alias contentItem: contentArea

    // ---- raised: two soft shadows beneath the surface ----
    MultiEffect {
        visible: root.raised
        anchors.fill: surfaceRect
        source: surfaceRect
        shadowEnabled: true
        shadowColor: Theme.withAlpha(Theme.shDark, 0.75)
        shadowBlur: root.blur / 40
        shadowHorizontalOffset: root.distance / 100
        shadowVerticalOffset: root.distance / 100
        z: -2
    }
    MultiEffect {
        visible: root.raised
        anchors.fill: surfaceRect
        source: surfaceRect
        shadowEnabled: true
        shadowColor: Theme.withAlpha(Theme.shLight, 0.85)
        shadowBlur: root.blur / 40
        shadowHorizontalOffset: -root.distance / 100
        shadowVerticalOffset: -root.distance / 100
        z: -1
    }

    // ---- the surface itself ----
    Rectangle {
        id: surfaceRect
        anchors.fill: parent
        radius: root.surfRadius
        color: root.raised ? root.surfColor : Theme.bgDeep

        // soft top highlight so raised surfaces read as domes
        Rectangle {
            visible: root.raised
            anchors { left: parent.left; right: parent.right; top: parent.top }
            height: parent.height * 0.5
            radius: parent.radius
            gradient: Gradient {
                GradientStop { position: 0.0; color: Theme.withAlpha(Theme.shLight, 0.10) }
                GradientStop { position: 1.0; color: "transparent" }
            }
        }
        // ---- inset inner-shadow approximation ----
        Rectangle {
            visible: !root.raised
            anchors { left: parent.left; right: parent.right; top: parent.top }
            height: Math.max(3, root.insetDistance)
            radius: parent.radius
            gradient: Gradient {
                GradientStop { position: 0.0; color: Theme.withAlpha(Theme.shDark, 0.55) }
                GradientStop { position: 1.0; color: "transparent" }
            }
        }
        Rectangle {
            visible: !root.raised
            anchors { left: parent.left; right: parent.right; bottom: parent.bottom }
            height: Math.max(3, root.insetDistance)
            radius: parent.radius
            gradient: Gradient {
                GradientStop { position: 0.0; color: "transparent" }
                GradientStop { position: 1.0; color: Theme.withAlpha(Theme.shLight, 0.35) }
            }
        }
        Rectangle {
            visible: !root.raised
            anchors { left: parent.left; top: parent.top; bottom: parent.bottom }
            width: Math.max(3, root.insetDistance)
            radius: parent.radius
            gradient: Gradient {
                orientation: Gradient.Horizontal
                GradientStop { position: 0.0; color: Theme.withAlpha(Theme.shDark, 0.4) }
                GradientStop { position: 1.0; color: "transparent" }
            }
        }
    }

    // ---- content layer (default property lands here) ----
    Item {
        id: contentArea
        anchors.fill: parent
        z: 1
    }
}
