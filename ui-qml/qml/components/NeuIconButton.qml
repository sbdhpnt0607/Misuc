import QtQuick
import QtQuick.Controls.Basic
import "../theme"

/* ===========================================================================
   NeuIconButton — square/circular icon button. `glyph` is a text glyph or a
   short label; `active` latches the pressed-in accent look (for toggles).
   =========================================================================== */
NeuSurface {
    id: root

    property string glyph: ""
    property bool active: false
    property bool round: false
    property color glyphColor: active ? Theme.accent : Theme.text
    property real size: 36
    property string tip: ""

    signal clicked()

    raised: !(mouse.pressed || active)
    distance: Theme.d1
    blur: Theme.blur1
    surfRadius: round ? width / 2 : Theme.radiusSm
    width: size
    height: size
    implicitWidth: size
    implicitHeight: size

    Label {
        anchors.centerIn: parent
        text: root.glyph
        color: root.glyphColor
        font.pixelSize: root.size * 0.45
        font.weight: Font.DemiBold
    }

    ToolTip.visible: root.tip.length > 0 && mouse.containsMouse
    ToolTip.text: root.tip
    ToolTip.delay: 500

    MouseArea {
        id: mouse
        anchors.fill: parent
        hoverEnabled: true
        onClicked: root.clicked()
    }
}
