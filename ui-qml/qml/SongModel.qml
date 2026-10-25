pragma Singleton
import QtQuick

/* ===========================================================================
   SongModel — the QML app's song data + transport state.
   This is the standalone demo source. In the shipping Misuc build the same
   properties are bound to the C++ Session/Transport via a QAbstractListModel
   + QObject bridge (see ui-qml/README.md — "Wiring to the engine"); the QML
   views read/write exactly these names, so swapping the source is local.
   Mirrors the web store's model: channels, patterns, playlist, transport.
   =========================================================================== */
QtObject {
    id: song

    // ---- project ----
    property string name: "Midnight Drive"
    property int bpm: 100
    property real masterVolume: 0.8

    // ---- transport ----
    property bool playing: false
    property string mode: "pattern"     // "pattern" | "song"
    property bool loopOn: false
    property bool metronome: false
    property bool recording: false
    property int positionBar: 1
    property int positionBeat: 1

    // ---- selection ----
    property string selectionType: "project"
    property string selectionId: ""

    // ---- demo channels ----
    property var channels: [
        { id: "ch_kick",  name: "Kick",     instrument: "kick",  color: "#8f7bfa", volume: 0.8,  pan: 0,    tone: 1, mute: false, solo: false },
        { id: "ch_snare", name: "Snare",    instrument: "snare", color: "#22d3ee", volume: 0.8,  pan: 0,    tone: 1, mute: false, solo: false },
        { id: "ch_hat",   name: "Hi-Hat",   instrument: "hihat", color: "#34d399", volume: 0.75, pan: 0.2,  tone: 1, mute: false, solo: false },
        { id: "ch_ohat",  name: "Open Hat", instrument: "ohat",  color: "#ffb454", volume: 0.7,  pan: -0.2, tone: 1, mute: false, solo: false },
        { id: "ch_clap",  name: "Clap",     instrument: "clap",  color: "#ff5470", volume: 0.8,  pan: 0,    tone: 1, mute: false, solo: false },
        { id: "ch_bass",  name: "Bassline", instrument: "bass",  color: "#60a5fa", volume: 0.75, pan: 0,    tone: 1, mute: false, solo: false },
        { id: "ch_lead",  name: "Lead",     instrument: "lead",  color: "#f472b6", volume: 0.6,  pan: 0,    tone: 1, mute: false, solo: false },
        { id: "ch_pluck", name: "Plucks",   instrument: "pluck", color: "#a3e635", volume: 0.5,  pan: 0,    tone: 1, mute: false, solo: false }
    ]

    // ---- demo patterns (16-step grids; 1 = trigger) ----
    property var patterns: [
        { id: "pat_a", name: "Beat A", color: "#8f7bfa", lengthSteps: 16,
          steps: {
              "ch_kick":  [1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0],
              "ch_snare": [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
              "ch_hat":   [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],
              "ch_ohat":  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
              "ch_clap":  [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
              "ch_bass":  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
              "ch_lead":  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
              "ch_pluck": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
          } },
        { id: "pat_b", name: "Beat B", color: "#22d3ee", lengthSteps: 16,
          steps: {
              "ch_kick":  [1,0,0,1,0,0,1,0,0,0,1,0,0,0,0,0],
              "ch_snare": [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
              "ch_hat":   [0,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
              "ch_ohat":  [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1],
              "ch_clap":  [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
              "ch_bass":  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
              "ch_lead":  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
              "ch_pluck": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
          } },
        { id: "pat_m", name: "Melody", color: "#34d399", lengthSteps: 16,
          steps: {
              "ch_kick":  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
              "ch_snare": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
              "ch_hat":   [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
              "ch_ohat":  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
              "ch_clap":  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
              "ch_bass":  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
              "ch_lead":  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
              "ch_pluck": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
          },
          // piano-roll notes for the melody (step, midi pitch, length, vel)
          notes: {
              "ch_lead": [ {s:0,p:69,d:2,v:0.85}, {s:2,p:72,d:2,v:0.8}, {s:4,p:76,d:4,v:0.9},
                           {s:8,p:74,d:2,v:0.8}, {s:10,p:72,d:2,v:0.75}, {s:12,p:69,d:4,v:0.9} ],
              "ch_bass": [ {s:0,p:45,d:3,v:0.9}, {s:4,p:45,d:2,v:0.8}, {s:6,p:48,d:2,v:0.8},
                           {s:8,p:41,d:3,v:0.9}, {s:12,p:43,d:4,v:0.85} ]
          } }
    ]

    property int activePattern: 0

    // ---- demo playlist arrangement (clips reference patterns by id) ----
    property var playlist: [
        { id: "tr1", name: "Drums",  mute: false, color: "#8f7bfa",
          clips: [ {patternId:"pat_a", startBar:0, lengthBars:1}, {patternId:"pat_a", startBar:1, lengthBars:1},
                   {patternId:"pat_b", startBar:2, lengthBars:1}, {patternId:"pat_a", startBar:3, lengthBars:1} ] },
        { id: "tr2", name: "Melody", mute: false, color: "#34d399",
          clips: [ {patternId:"pat_m", startBar:4, lengthBars:2}, {patternId:"pat_m", startBar:6, lengthBars:2} ] },
        { id: "tr3", name: "Track 3", mute: false, color: "#22d3ee", clips: [] },
        { id: "tr4", name: "Track 4", mute: false, color: "#ffb454", clips: [] }
    ]

    // ---- instrument catalogue (browser + add-channel picker) ----
    readonly property var instruments: [
        { id: "kick",   name: "Kick",     kind: "drum",    icon: "🥁", desc: "808-style sine drop + click" },
        { id: "snare",  name: "Snare",    kind: "drum",    icon: "🪘", desc: "Noise body + tonal shell" },
        { id: "hihat",  name: "Hi-Hat",   kind: "drum",    icon: "🎩", desc: "High-passed noise tick" },
        { id: "ohat",   name: "Open Hat", kind: "drum",    icon: "🎩", desc: "Ringy open noise hat" },
        { id: "clap",   name: "Clap",     kind: "drum",    icon: "👏", desc: "Triple noise burst" },
        { id: "tom",    name: "Tom",      kind: "drum",    icon: "🥁", desc: "Pitched membrane thump" },
        { id: "bass",   name: "Bass",     kind: "melodic", icon: "🎸", desc: "Filtered saw — piano-roll pitched" },
        { id: "lead",   name: "Lead",     kind: "melodic", icon: "🎹", desc: "Detuned squares — piano-roll pitched" },
        { id: "pluck",  name: "Pluck",    kind: "melodic", icon: "✨", desc: "Fast-decay triangle pluck" },
        { id: "pad",    name: "Pad",      kind: "melodic", icon: "🌊", desc: "Slow detuned saw pad" }
    ]

    // ---- signals the views connect to ----
    signal toast(string message, string kind)
    signal songChanged()

    function activePatternObj() { return patterns[activePattern]; }

    function toggleStep(channelId, step) {
        const pat = activePatternObj()
        const arr = pat.steps[channelId]
        if (!arr) return
        arr[step] = arr[step] ? 0 : 1
        songChanged()
    }

    function togglePlay() {
        playing = !playing
        // NOTE: standalone demo has no audio backend; the C++ bridge drives
        // real Transport playback. See README "Wiring to the engine".
        toast(playing ? "Playback (demo state — engine drives audio in the Qt build)"
                      : "Stopped", "")
    }
}
