import QtQuick
import QtQuick.Layouts
import QtQuick.Controls.Basic
import "theme"
import "components"
import "."

/* ===========================================================================
   HeaderBar — brand cluster (logo + wordmark + editable project name),
   the TransportBar pod, and the right cluster (master meters, volume knob,
   theme toggle). Mirrors the web #header.
   =========================================================================== */
NeuSurface {
    id: root
    surfRadius: Theme.radiusLg
    distance: Theme.d2; blur: Theme.blur2
    implicitHeight: 72

    RowLayout {
        anchors.fill: parent
        anchors.leftMargin: 18
        anchors.rightMargin: 18
        spacing: 16

        // ---- brand ----
        RowLayout {
            spacing: 12
            Layout.preferredWidth: 240
            Rectangle {
                Layout.preferredWidth: 42; Layout.preferredHeight: 42
                radius: Theme.radiusMd
                gradient: Gradient {
                    GradientStop { position: 0; color: Theme.accent }
                    GradientStop { position: 1; color: Theme.accentDeep }
                }
                Text { anchors.centerIn: parent; text: "🎵"; font.pixelSize: 20 }
            }
            ColumnLayout {
                spacing: 0
                Text { text: "MISUC"; color: Theme.textStrong; font.pixelSize: 16; font.weight: Font.ExtraBold; font.letterSpacing: 1 }
                TextField {
                    id: nameField
                    Layout.preferredWidth: 160
                    text: SongModel.name
                    color: Theme.textDim
                    font.pixelSize: 10
                    background: null
                    onEditingFinished: { SongModel.name = text }
                }
            }
        }

        Item { Layout.fillWidth: true }

        // ---- transport ----
        TransportBar { Layout.preferredHeight: 56 }

        Item { Layout.fillWidth: true }

        // ---- right cluster ----
        RowLayout {
            spacing: 12
            Layout.preferredWidth: 240
            Layout.alignment: Qt.AlignRight

            NeuSurface {
                raised: false; surfRadius: Theme.radiusPill; insetDistance: Theme.d1
                Layout.preferredHeight: 48
                Layout.preferredWidth: masterRow.implicitWidth + 24
                RowLayout {
                    id: masterRow
                    anchors.centerIn: parent
                    spacing: 10
                    Row {
                        spacing: 4
                        NeuMeter { height: 34; level: 0 }
                        NeuMeter { height: 34; level: 0 }
                    }
                    NeuKnob {
                        small: true
                        value: SongModel.masterVolume
                        displayText: Math.round(SongModel.masterVolume * 100)
                        onEdited: (v) => SongModel.masterVolume = v
                    }
                }
            }

            NeuIconButton {
                glyph: Theme.dark ? "🌙" : "☀"
                size: 40; round: true
                tip: "Toggle light / dark"
                onClicked: Theme.toggle()
            }
        }
    }
}
