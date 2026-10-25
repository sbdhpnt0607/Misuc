import QtQuick
import QtQuick.Layouts
import QtQuick.Controls.Basic
import "../theme"
import "../components"
import ".."

/* ===========================================================================
   PlaylistView — arrangement lanes with pattern clips on a bar grid. Track
   headers on the left (name + mute), a canvas arrangement on the right. Clips
   come from SongModel.playlist. Mirrors ui-neu/js/playlist.js.
   =========================================================================== */
Item {
    id: root

    readonly property int pxPerBar: 96
    readonly property int trackH: 52
    readonly property int rulerH: 26
    readonly property int headW: 132
    property string tool: "select"

    NeuSurface {
        anchors.fill: parent
        surfRadius: Theme.radiusLg
        distance: Theme.d2; blur: Theme.blur2

        ColumnLayout {
            anchors.fill: parent
            anchors.margins: 14
            spacing: 12

            RowLayout {
                spacing: 8
                Text { text: "Playlist"; color: Theme.textDim; font.pixelSize: 10; font.weight: Font.Bold; font.letterSpacing: 1.2 }
                Item { Layout.preferredWidth: 8 }
                NeuSegmented {
                    items: [ { label: "🖌 Paint", value: "paint" }, { label: "⬚ Select", value: "select" }, { label: "⌫ Erase", value: "erase" } ]
                    current: root.tool
                    onPicked: (v) => root.tool = v
                }
                Item { Layout.fillWidth: true }
                NeuButton {
                    text: "▶ Play arrangement"
                    onClicked: { SongModel.mode = "song"; SongModel.playing = true }
                }
            }

            RowLayout {
                Layout.fillWidth: true
                Layout.fillHeight: true
                spacing: 8

                // ---- track headers ----
                NeuSurface {
                    Layout.preferredWidth: root.headW
                    Layout.fillHeight: true
                    surfRadius: Theme.radiusMd
                    distance: Theme.d1; blur: Theme.blur1

                    Column {
                        anchors.fill: parent
                        anchors.topMargin: root.rulerH
                        Repeater {
                            model: SongModel.playlist
                            delegate: Item {
                                required property var modelData
                                width: parent.width
                                height: root.trackH
                                RowLayout {
                                    anchors.fill: parent
                                    anchors.leftMargin: 8
                                    anchors.rightMargin: 8
                                    spacing: 6
                                    TextField {
                                        Layout.fillWidth: true
                                        text: modelData.name
                                        color: Theme.textStrong
                                        font.pixelSize: 11; font.weight: Font.DemiBold
                                        background: null
                                        onEditingFinished: { modelData.name = text; SongModel.songChanged() }
                                    }
                                    NeuIconButton { glyph: "M"; size: 22; active: modelData.mute
                                        glyphColor: modelData.mute ? Theme.danger : Theme.textDim
                                        onClicked: { modelData.mute = !modelData.mute; SongModel.songChanged() } }
                                }
                                Rectangle { anchors.bottom: parent.bottom; width: parent.width; height: 1; color: Theme.gridLine }
                            }
                        }
                    }
                }

                // ---- arrangement canvas ----
                NeuSurface {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    raised: false
                    surfRadius: Theme.radiusMd
                    insetDistance: Theme.d2

                    Canvas {
                        id: cv
                        anchors.fill: parent
                        onPaint: {
                            const ctx = getContext("2d")
                            ctx.clearRect(0, 0, width, height)
                            // ruler
                            ctx.fillStyle = String(Theme.surface)
                            ctx.fillRect(0, 0, width, root.rulerH)
                            const totalBars = 16
                            for (let b = 0; b <= totalBars; b++) {
                                const x = b * root.pxPerBar
                                ctx.fillStyle = (b % 4 === 0) ? String(Theme.gridLine2) : String(Theme.gridLine)
                                ctx.fillRect(x, 0, 1, height)
                                if (b % 2 === 0) {
                                    ctx.fillStyle = String(Theme.textDim)
                                    ctx.font = "10px monospace"
                                    ctx.fillText(String(b + 1), x + 4, 16)
                                }
                            }
                            // lanes
                            for (let t = 0; t < SongModel.playlist.length; t++) {
                                const y = root.rulerH + t * root.trackH
                                if (t % 2) { ctx.fillStyle = String(Theme.laneAlt); ctx.fillRect(0, y, width, root.trackH) }
                                ctx.fillStyle = String(Theme.gridLine)
                                ctx.fillRect(0, y + root.trackH - 1, width, 1)
                            }
                            // clips
                            for (let t = 0; t < SongModel.playlist.length; t++) {
                                const track = SongModel.playlist[t]
                                for (let c = 0; c < track.clips.length; c++) {
                                    const clip = track.clips[c]
                                    const pat = SongModel.patterns.find(p => p.id === clip.patternId)
                                    if (!pat) continue
                                    const x = clip.startBar * root.pxPerBar
                                    const w = clip.lengthBars * root.pxPerBar - 3
                                    const y = root.rulerH + t * root.trackH + 5
                                    const h = root.trackH - 10
                                    const g = ctx.createLinearGradient(0, y, 0, y + h)
                                    g.addColorStop(0, pat.color)
                                    g.addColorStop(1, String(Theme.accentDeep))
                                    ctx.globalAlpha = track.mute ? 0.35 : 1
                                    ctx.fillStyle = g
                                    ctx.fillRect(x, y, w, h)
                                    ctx.globalAlpha = 1
                                    ctx.fillStyle = "#ffffff"
                                    ctx.font = "600 11px sans-serif"
                                    ctx.fillText(pat.name, x + 6, y + h/2 + 4)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Connections {
        target: SongModel
        function onSongChanged() { cv.requestPaint() }
    }
}
