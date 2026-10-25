import QtQuick
import QtQuick.Layouts
import QtQuick.Controls.Basic
import "../theme"
import "../components"
import ".."

/* ===========================================================================
   SettingsView — appearance (theme + accent, mirroring the Qt ThemeEngine
   presets), audio diagnostics placeholders and the shortcut reference.
   Mirrors ui-neu/js/settings.js.
   =========================================================================== */
Item {
    id: root

    NeuSurface {
        anchors.fill: parent
        surfRadius: Theme.radiusLg
        distance: Theme.d2; blur: Theme.blur2

        Flickable {
            anchors.fill: parent
            anchors.margins: 14
            contentHeight: grid.implicitHeight
            clip: true
            boundsBehavior: Flickable.StopAtBounds

            GridLayout {
                id: grid
                width: parent.width
                columns: 2
                columnSpacing: 14
                rowSpacing: 14

                // ---- appearance ----
                NeuSurface {
                    Layout.fillWidth: true
                    Layout.preferredHeight: appCol.implicitHeight + 32
                    surfRadius: Theme.radiusLg; distance: Theme.d2; blur: Theme.blur2
                    ColumnLayout {
                        id: appCol
                        anchors.fill: parent
                        anchors.margins: 16
                        spacing: 12
                        Text { text: "🎨  Appearance"; color: Theme.textStrong; font.pixelSize: 13; font.weight: Font.Bold }

                        RowLayout {
                            Text { text: "Theme"; color: Theme.textDim; font.pixelSize: 10; font.weight: Font.Bold; Layout.preferredWidth: 60 }
                            NeuSegmented {
                                items: [ { label: "🌙 Dark", value: "dark" }, { label: "☀ Light", value: "light" } ]
                                current: Theme.dark ? "dark" : "light"
                                onPicked: (v) => Theme.dark = (v === "dark")
                            }
                        }
                        RowLayout {
                            Text { text: "Accent"; color: Theme.textDim; font.pixelSize: 10; font.weight: Font.Bold; Layout.preferredWidth: 60 }
                            Row {
                                spacing: 10
                                Repeater {
                                    model: ["violet", "cyan", "emerald", "amber", "crimson"]
                                    delegate: Rectangle {
                                        required property var modelData
                                        width: 26; height: 26; radius: 13
                                        color: Theme.accents[modelData].c
                                        Rectangle {
                                            visible: Theme.accentName === modelData
                                            anchors.fill: parent; anchors.margins: -4
                                            radius: width/2; color: "transparent"
                                            border.width: 2; border.color: Theme.accents[modelData].c
                                        }
                                        MouseArea { anchors.fill: parent; onClicked: Theme.accentName = modelData }
                                    }
                                }
                            }
                        }
                    }
                }

                // ---- audio ----
                NeuSurface {
                    Layout.fillWidth: true
                    Layout.preferredHeight: audioCol.implicitHeight + 32
                    surfRadius: Theme.radiusLg; distance: Theme.d2; blur: Theme.blur2
                    ColumnLayout {
                        id: audioCol
                        anchors.fill: parent
                        anchors.margins: 16
                        spacing: 10
                        Text { text: "🔊  Audio"; color: Theme.textStrong; font.pixelSize: 13; font.weight: Font.Bold }
                        RowLayout {
                            Text { text: "Backend"; color: Theme.textDim; font.pixelSize: 10; font.weight: Font.Bold; Layout.preferredWidth: 70 }
                            Text { text: "PipeWire (engine bridge)"; color: Theme.text; font.pixelSize: 12 }
                        }
                        RowLayout {
                            Text { text: "Limiter"; color: Theme.textDim; font.pixelSize: 10; font.weight: Font.Bold; Layout.preferredWidth: 70 }
                            Text { text: "−1 dBFS brickwall · live == export"; color: Theme.text; font.pixelSize: 12 }
                        }
                        NeuButton { text: "440 Hz test tone"; onClicked: SongModel.toast("Test tone — routed through the engine in the Qt build", "") }
                    }
                }

                // ---- project ----
                NeuSurface {
                    Layout.fillWidth: true
                    Layout.preferredHeight: projCol.implicitHeight + 32
                    surfRadius: Theme.radiusLg; distance: Theme.d2; blur: Theme.blur2
                    ColumnLayout {
                        id: projCol
                        anchors.fill: parent
                        anchors.margins: 16
                        spacing: 10
                        Text { text: "📁  Project"; color: Theme.textStrong; font.pixelSize: 13; font.weight: Font.Bold }
                        RowLayout {
                            spacing: 8
                            NeuButton { text: "💾 Save"; onClicked: SongModel.toast("Save — writes .misuc via the engine", "ok") }
                            NeuButton { text: "⤓ Export"; onClicked: SongModel.toast("Export audio — engine render path", "") }
                        }
                    }
                }

                // ---- shortcuts ----
                NeuSurface {
                    Layout.fillWidth: true
                    Layout.preferredHeight: keyCol.implicitHeight + 32
                    surfRadius: Theme.radiusLg; distance: Theme.d2; blur: Theme.blur2
                    ColumnLayout {
                        id: keyCol
                        anchors.fill: parent
                        anchors.margins: 16
                        spacing: 8
                        Text { text: "⌨  Keyboard"; color: Theme.textStrong; font.pixelSize: 13; font.weight: Font.Bold }
                        Repeater {
                            model: [
                                ["Space", "Play / stop"], ["1–6", "Switch workspace"],
                                ["L", "Toggle loop"], ["M", "Toggle metronome"],
                                ["Ctrl+Z", "Undo"], ["Ctrl+S", "Save"]
                            ]
                            delegate: RowLayout {
                                required property var modelData
                                spacing: 12
                                Rectangle {
                                    radius: 5; color: Theme.surface
                                    width: kbdText.implicitWidth + 14; height: 22
                                    Text { id: kbdText; anchors.centerIn: parent; text: modelData[0]
                                        color: Theme.textStrong; font.pixelSize: 10; font.family: "monospace"; font.weight: Font.Bold }
                                }
                                Text { text: modelData[1]; color: Theme.textDim; font.pixelSize: 12 }
                            }
                        }
                    }
                }
            }
        }
    }
}
