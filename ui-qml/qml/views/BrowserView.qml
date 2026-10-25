import QtQuick
import QtQuick.Layouts
import QtQuick.Controls.Basic
import "../theme"
import "../components"
import ".."

/* ===========================================================================
   BrowserView — searchable instrument browser grouped by category (Drums /
   Melodic). Click to audition (toast in the standalone build; the C++ bridge
   routes the preview through the engine). Mirrors ui-neu/js/browser.js.
   =========================================================================== */
Item {
    id: root

    property string query: ""

    NeuSurface {
        anchors.fill: parent
        surfRadius: Theme.radiusLg
        distance: Theme.d2; blur: Theme.blur2

        ColumnLayout {
            anchors.fill: parent
            anchors.margins: 14
            spacing: 12

            NeuField {
                id: search
                Layout.fillWidth: true
                placeholderText: "Search instruments…"
                onTextChanged: root.query = text.toLowerCase()
            }

            NeuSurface {
                Layout.fillWidth: true
                Layout.fillHeight: true
                raised: false
                surfRadius: Theme.radiusMd
                insetDistance: Theme.d2

                ListView {
                    id: list
                    anchors.fill: parent
                    anchors.margins: 8
                    clip: true
                    spacing: 6
                    model: SongModel.instruments.filter(i =>
                        root.query.length === 0 ||
                        i.name.toLowerCase().includes(root.query) ||
                        i.desc.toLowerCase().includes(root.query))

                    section.property: "kind"
                    section.delegate: Text {
                        required property string section
                        text: section.toUpperCase()
                        color: Theme.textDim
                        font.pixelSize: 10; font.weight: Font.Bold; font.letterSpacing: 1.2
                        topPadding: 8; bottomPadding: 2
                    }

                    delegate: NeuSurface {
                        required property var modelData
                        width: ListView.view.width
                        height: 48
                        surfRadius: Theme.radiusSm
                        distance: Theme.d1; blur: Theme.blur1

                        RowLayout {
                            anchors.fill: parent
                            anchors.leftMargin: 10
                            anchors.rightMargin: 10
                            spacing: 10

                            NeuSurface {
                                Layout.preferredWidth: 32; Layout.preferredHeight: 32
                                surfRadius: Theme.radiusXs; distance: Theme.d1; blur: Theme.blur1
                                Text { anchors.centerIn: parent; text: modelData.icon; font.pixelSize: 15 }
                            }
                            ColumnLayout {
                                Layout.fillWidth: true
                                spacing: 0
                                Text { text: modelData.name; color: Theme.textStrong; font.pixelSize: 12; font.weight: Font.DemiBold }
                                Text { text: modelData.desc; color: Theme.textDim; font.pixelSize: 10; elide: Text.ElideRight; Layout.fillWidth: true }
                            }
                            NeuIconButton { glyph: "▶"; size: 26; tip: "Audition"
                                onClicked: SongModel.toast("Audition " + modelData.name + " — engine preview in the Qt build", "") }
                            NeuIconButton { glyph: "＋"; size: 26; tip: "Add channel"
                                onClicked: SongModel.toast("Add " + modelData.name + " channel — wired to Session in the Qt build", "ok") }
                        }
                    }
                }
            }
        }
    }
}
