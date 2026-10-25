import QtQuick
import QtQuick.Controls.Basic
import "../theme"

/* ===========================================================================
   NeuField — inset neumorphic text field (used for project/track names,
   numeric entry). Focus rings the accent softly.
   =========================================================================== */
NeuSurface {
    id: root

    property alias text: input.text
    property alias placeholderText: input.placeholderText
    property alias validator: input.validator
    property alias inputMask: input.inputMask
    property bool numeric: false

    raised: false
    surfRadius: Theme.radiusSm
    insetDistance: Theme.d1
    implicitHeight: 34
    implicitWidth: 120

    Rectangle {
        anchors.fill: parent
        radius: root.surfRadius
        color: "transparent"
        border.width: input.activeFocus ? 2 : 0
        border.color: Theme.accentSoft
    }

    TextField {
        id: input
        anchors.fill: parent
        anchors.margins: 4
        verticalAlignment: TextInput.AlignVCenter
        color: Theme.textStrong
        placeholderTextColor: Theme.textFaint
        font.pixelSize: 12
        font.weight: Font.DemiBold
        background: null
        selectByMouse: true
        horizontalAlignment: root.numeric ? TextInput.AlignHCenter : TextInput.AlignLeft
    }
}
