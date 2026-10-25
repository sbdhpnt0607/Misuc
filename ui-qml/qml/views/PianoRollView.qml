import QtQuick
import QtQuick.Layouts
import QtQuick.Controls.Basic
import "../theme"
import "../components"
import ".."

/* ===========================================================================
   PianoRollView — canvas note editor for the active pattern. Draws the key
   rows, step grid and the notes stored in SongModel.patterns[].notes, plus a
   velocity lane. Tools (draw/select/erase) and snap mirror the web roll.
   Standalone build renders + lets you click notes; the C++ bridge drives
   audible playback. Mirrors ui-neu/js/pianoroll.js.
   =========================================================================== */
Item {
    id: root

    property string tool: "draw"
    property int snap: 4
    readonly property int lo: 36
    readonly property int hi: 96
    readonly property int pxPerKey: 14
    readonly property int pxPerStep: 26
    readonly property int keyWidth: 52

    function notesFor() {
        const pat = SongModel.activePatternObj()
        if (!pat || !pat.notes) return []
        // show the first melodic channel's notes in the demo
        for (const cid in pat.notes)
            if (pat.notes[cid] && pat.notes[cid].length) return pat.notes[cid]
        return []
    }

    NeuSurface {
        anchors.fill: parent
        surfRadius: Theme.radiusLg
        distance: Theme.d2; blur: Theme.blur2

        ColumnLayout {
            anchors.fill: parent
            anchors.margins: 14
            spacing: 12

            // ---- toolbar ----
            RowLayout {
                spacing: 8
                Text { text: "Piano Roll"; color: Theme.textDim; font.pixelSize: 10; font.weight: Font.Bold; font.letterSpacing: 1.2 }
                Item { Layout.preferredWidth: 8 }
                NeuSegmented {
                    items: [ { label: "✏ Draw", value: "draw" }, { label: "⬚ Select", value: "select" }, { label: "⌫ Erase", value: "erase" } ]
                    current: root.tool
                    onPicked: (v) => root.tool = v
                }
                Item { Layout.fillWidth: true }
                Text { text: "Snap"; color: Theme.textDim; font.pixelSize: 10 }
                NeuSegmented {
                    items: [ { label: "1/16", value: "1" }, { label: "1/8", value: "2" }, { label: "1/4", value: "4" } ]
                    current: String(root.snap)
                    onPicked: (v) => root.snap = parseInt(v)
                }
            }

            // ---- key gutter + note canvas ----
            RowLayout {
                Layout.fillWidth: true
                Layout.fillHeight: true
                spacing: 0

                Canvas {
                    id: keys
                    Layout.preferredWidth: root.keyWidth
                    Layout.fillHeight: true
                    onPaint: {
                        const ctx = getContext("2d")
                        ctx.clearRect(0, 0, width, height)
                        for (let p = root.lo; p <= root.hi; p++) {
                            const y = (root.hi - p) * root.pxPerKey
                            if (y > height) continue
                            const black = [1,3,6,8,10].indexOf(p % 12) >= 0
                            ctx.fillStyle = black ? String(Theme.shDark) : String(Theme.surfaceHi)
                            ctx.fillRect(0, y, width, root.pxPerKey - 1)
                            if (p % 12 === 0) {
                                ctx.fillStyle = String(Theme.textDim)
                                ctx.font = "9px monospace"
                                ctx.fillText("C" + (Math.floor(p/12) - 1), 4, y + root.pxPerKey - 4)
                            }
                        }
                    }
                }

                Canvas {
                    id: grid
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    property var notes: []
                    onPaint: {
                        const ctx = getContext("2d")
                        ctx.clearRect(0, 0, width, height)
                        ctx.fillStyle = String(Theme.bgDeep)
                        ctx.fillRect(0, 0, width, height)
                        const pat = SongModel.activePatternObj()
                        const totalSteps = pat ? pat.lengthSteps : 16

                        // row shading for black keys
                        for (let p = root.lo; p <= root.hi; p++) {
                            const y = (root.hi - p) * root.pxPerKey
                            if (y > height) continue
                            if ([1,3,6,8,10].indexOf(p % 12) >= 0) {
                                ctx.fillStyle = String(Theme.laneAlt)
                                ctx.fillRect(0, y, width, root.pxPerKey)
                            }
                        }
                        // vertical grid
                        for (let s = 0; s <= totalSteps; s++) {
                            const x = s * root.pxPerStep
                            ctx.fillStyle = (s % 4 === 0) ? String(Theme.gridLine2) : String(Theme.gridLine)
                            ctx.fillRect(x, 0, s % 4 === 0 ? 2 : 1, height)
                        }
                        // notes
                        const notes = root.notesFor()
                        for (let i = 0; i < notes.length; i++) {
                            const n = notes[i]
                            const x = n.s * root.pxPerStep
                            const w = Math.max(4, n.d * root.pxPerStep - 2)
                            const y = (root.hi - n.p) * root.pxPerKey + 1
                            const h = root.pxPerKey - 2
                            const g = ctx.createLinearGradient(0, y, 0, y + h)
                            g.addColorStop(0, String(Theme.accent))
                            g.addColorStop(1, String(Theme.accentDeep))
                            ctx.fillStyle = g
                            ctx.fillRect(x, y, w, h)
                            ctx.fillStyle = Qt.rgba(1,1,1, 0.15 + n.v * 0.35)
                            ctx.fillRect(x, y, w, 3)
                        }
                    }
                    MouseArea {
                        anchors.fill: parent
                        onClicked: (m) => {
                            const pat = SongModel.activePatternObj()
                            if (!pat || !pat.notes) return
                            const step = Math.max(0, Math.round((m.x / root.pxPerStep) / root.snap) * root.snap)
                            const pitch = root.hi - Math.floor(m.y / root.pxPerKey)
                            // find a melodic channel to write to (first with a notes lane)
                            let cid = null
                            for (const c of SongModel.channels)
                                if (["bass","lead","pluck","pad"].indexOf(c.instrument) >= 0) { cid = c.id; break }
                            if (!cid) { SongModel.toast("Add a melodic channel first", "warn"); return }
                            if (!pat.notes[cid]) pat.notes[cid] = []
                            if (root.tool === "erase") {
                                const idx = pat.notes[cid].findIndex(n => n.s === step && n.p === pitch)
                                if (idx >= 0) pat.notes[cid].splice(idx, 1)
                            } else {
                                pat.notes[cid].push({ s: step, p: pitch, d: root.snap, v: 0.8 })
                            }
                            SongModel.songChanged()
                            grid.requestPaint()
                        }
                    }
                }
            }
        }
    }

    Connections {
        target: SongModel
        function onSongChanged() { grid.requestPaint(); keys.requestPaint() }
        function onActivePatternChanged() { grid.requestPaint() }
    }
}
