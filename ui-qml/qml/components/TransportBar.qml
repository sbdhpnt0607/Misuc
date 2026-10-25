import QtQuick
import QtQuick.Layouts
import "../theme"
import ".."

/* ===========================================================================
   TransportBar — the header's centre pod: play/pause, stop, record, PAT/SONG,
   loop, metronome, position readout and BPM stepper. Reads/writes SongModel.
   =========================================================================== */
NeuSurface {
    id: root
    raised: false
    surfRadius: Theme.radiusPill
    insetDistance: Theme.d1
    implicitHeight: 56
    implicitWidth: row.implicitWidth + 24

    RowLayout {
        id: row
        anchors.centerIn: parent
        spacing: 8

        NeuIconButton { glyph: "⏮"; size: 34; tip: "Back to start" }
        NeuIconButton {
            glyph: SongModel.playing ? "⏸" : "▶"; size: 44; round: true
            tip: SongModel.playing ? "Pause (Space)" : "Play (Space)"
            glyphColor: SongModel.playing ? Theme.ok : Theme.text
            onClicked: SongModel.togglePlay()
        }
        NeuIconButton { glyph: "⏹"; size: 34; tip: "Stop"; onClicked: SongModel.playing = false }
        NeuIconButton {
            glyph: "⏺"; size: 34; tip: "Record — needs PipeWire engine"
            active: SongModel.recording
            glyphColor: SongModel.recording ? Theme.danger : Theme.text
            onClicked: {
                SongModel.recording = !SongModel.recording
                SongModel.toast(SongModel.recording
                    ? "Recording armed — capture requires the PipeWire engine"
                    : "Recording disarmed", SongModel.recording ? "warn" : "")
            }
        }

        Rectangle { Layout.preferredWidth: 1; Layout.preferredHeight: 30; color: Theme.withAlpha(Theme.shDark, 0.6) }

        NeuSegmented {
            items: [ { label: "PAT", value: "pattern" }, { label: "SONG", value: "song" } ]
            current: SongModel.mode
            onPicked: (v) => SongModel.mode = v
        }

        Rectangle { Layout.preferredWidth: 1; Layout.preferredHeight: 30; color: Theme.withAlpha(Theme.shDark, 0.6) }

        NeuIconButton { glyph: "🔁"; size: 34; active: SongModel.loopOn; tip: "Loop region"
            onClicked: SongModel.loopOn = !SongModel.loopOn }
        NeuIconButton { glyph: "🕒"; size: 34; active: SongModel.metronome; tip: "Metronome"
            onClicked: SongModel.metronome = !SongModel.metronome }

        // position readout
        NeuSurface {
            raised: false; surfRadius: Theme.radiusSm; insetDistance: Theme.d1
            Layout.preferredWidth: 108; Layout.preferredHeight: 40
            Column {
                anchors.centerIn: parent
                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: "%1:%2".arg(SongModel.positionBar).arg(SongModel.positionBeat)
                    color: Theme.textStrong; font.pixelSize: 17; font.family: "monospace"; font.weight: Font.Bold
                }
                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: "BAR : BEAT"; color: Theme.textFaint; font.pixelSize: 8; font.weight: Font.DemiBold
                }
            }
        }

        // BPM stepper
        NeuSurface {
            raised: false; surfRadius: Theme.radiusSm; insetDistance: Theme.d1
            Layout.preferredWidth: 104; Layout.preferredHeight: 34
            RowLayout {
                anchors.fill: parent
                anchors.margins: 2
                spacing: 0
                NeuIconButton { glyph: "−"; size: 26; onClicked: SongModel.bpm = Math.max(20, SongModel.bpm - 1) }
                Text {
                    Layout.fillWidth: true
                    horizontalAlignment: Text.AlignHCenter
                    text: SongModel.bpm
                    color: Theme.textStrong; font.pixelSize: 13; font.family: "monospace"; font.weight: Font.Bold
                }
                NeuIconButton { glyph: "+"; size: 26; onClicked: SongModel.bpm = Math.min(300, SongModel.bpm + 1) }
            }
        }
    }
}
