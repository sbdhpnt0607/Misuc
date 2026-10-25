import QtQuick
import QtQuick.Layouts
import QtQuick.Controls.Basic
import "theme"
import "components"
import "."

/* ===========================================================================
   WorkspaceRail — the left icon column. One button per workspace; the active
   one presses in with an accent glow. Mirrors the web #rail.
   =========================================================================== */
NeuSurface {
    id: root

    property int current: 0
    signal selected(int index)

    readonly property var workspaces: [
        { glyph: "🎚", label: "Rack" },
        { glyph: "🎹", label: "Roll" },
        { glyph: "🎞", label: "Arrange" },
        { glyph: "🎛", label: "Mixer" },
        { glyph: "📁", label: "Browser" },
        { glyph: "⚙", label: "Setup" }
    ]

    surfRadius: Theme.radiusLg
    distance: Theme.d2; blur: Theme.blur2
    implicitWidth: 84

    ColumnLayout {
        anchors.fill: parent
        anchors.topMargin: 14
        anchors.bottomMargin: 14
        spacing: 10

        Repeater {
            model: root.workspaces
            delegate: Item {
                required property var modelData
                required property int index
                Layout.alignment: Qt.AlignHCenter
                Layout.preferredWidth: 56
                Layout.preferredHeight: 56

                readonly property bool active: index === root.current

                NeuSurface {
                    anchors.fill: parent
                    raised: !parent.active
                    surfRadius: Theme.radiusMd
                    distance: Theme.d1; blur: Theme.blur1

                    Column {
                        anchors.centerIn: parent
                        spacing: 4
                        Text {
                            anchors.horizontalCenter: parent.horizontalCenter
                            text: modelData.glyph
                            font.pixelSize: 20
                            opacity: parent.parent.active ? 1 : 0.7
                        }
                        Text {
                            anchors.horizontalCenter: parent.horizontalCenter
                            text: modelData.label
                            color: parent.parent.active ? Theme.accent : Theme.textDim
                            font.pixelSize: 8
                            font.weight: Font.Bold
                            font.letterSpacing: 0.6
                        }
                    }
                }
                MouseArea {
                    anchors.fill: parent
                    onClicked: { root.current = index; root.selected(index) }
                }
            }
        }

        Item { Layout.fillHeight: true }
    }
}
