/* ===========================================================================
   Misuc Neu — project state
   Single source of truth for the whole UI: channels, patterns, playlist,
   mixer state, transport, selection. Small event bus + snapshot undo/redo
   (mirrors the Qt app's 50-step UndoStack) + localStorage persistence and
   JSON export/import (the .misuc container itself is a ZIP — the web build
   ships a plain-JSON document and says so honestly).
   =========================================================================== */

export const STEPS_PER_BAR = 4;

/* Instrument catalogue — the browser and channel rack share this table. */
export const INSTRUMENTS = {
  kick:   { name: "Kick",     kind: "drum",     icon: "🥁", desc: "808-style sine drop + click" },
  snare:  { name: "Snare",    kind: "drum",     icon: "🪘", desc: "Noise body + tonal shell" },
  hihat:  { name: "Hi-Hat",   kind: "drum",     icon: "🎩", desc: "High-passed noise tick" },
  ohat:   { name: "Open Hat", kind: "drum",     icon: "🎩", desc: "Ringy open noise hat" },
  clap:   { name: "Clap",     kind: "drum",     icon: "👏", desc: "Triple noise burst" },
  tom:    { name: "Tom",      kind: "drum",     icon: "🥁", desc: "Pitched membrane thump" },
  bass:   { name: "Bass",     kind: "melodic",  icon: "🎸", desc: "Filtered saw — piano-roll pitched" },
  lead:   { name: "Lead",     kind: "melodic",  icon: "🎹", desc: "Detuned squares — piano-roll pitched" },
  pluck:  { name: "Pluck",    kind: "melodic",  icon: "✨", desc: "Fast-decay triangle pluck" },
  pad:    { name: "Pad",      kind: "melodic",  icon: "🌊", desc: "Slow detuned saw pad" },
};

export const CHANNEL_COLORS = [
  "#8f7bfa", "#22d3ee", "#34d399", "#ffb454", "#ff5470",
  "#60a5fa", "#f472b6", "#a3e635", "#facc15", "#c084fc",
];

export const PATTERN_COLORS = ["#8f7bfa", "#22d3ee", "#34d399", "#ffb454"];

const uid = (() => { let n = 1; return (p) => `${p}${(n++).toString(36)}${Date.now().toString(36).slice(-4)}`; })();

/* --------------------------------------------------------------------------
   Model constructors
   -------------------------------------------------------------------------- */

export function makeChannel(instrument, name, colorIndex) {
  return {
    id: uid("ch"),
    name: name || INSTRUMENTS[instrument].name,
    instrument,
    color: CHANNEL_COLORS[colorIndex % CHANNEL_COLORS.length],
    volume: 0.8,          // 0..1 linear
    pan: 0,               // -1..1
    tone: 1,              // 0..1 -> lowpass cutoff (tone knob)
    mute: false,
    solo: false,
  };
}

export function makePattern(name, index) {
  return {
    id: uid("pat"),
    name: name || `Pattern ${index + 1}`,
    color: PATTERN_COLORS[index % PATTERN_COLORS.length],
    lengthSteps: 16,      // 16 | 32 | 64
    steps: {},            // channelId -> Array(0|1, …lengthSteps)
    notes: {},            // channelId -> [{s, p, d, v}]  (step grid, midi pitch)
  };
}

export function makePlaylistTrack(index) {
  return {
    id: uid("tr"),
    name: `Track ${index + 1}`,
    mute: false,
    color: CHANNEL_COLORS[index % CHANNEL_COLORS.length],
    clips: [],            // {id, patternId, startBar, lengthBars}
  };
}

export function makeProject(name) {
  return {
    version: 1,
    name: name || "Untitled",
    bpm: 120,
    swing: 0,             // 0..0.5
    metronome: false,
    loopOn: false,
    loopStartBar: 0,
    loopBars: 4,
    masterVolume: 0.85,
    channels: [],
    patterns: [],
    playlist: { tracks: Array.from({ length: 8 }, (_, i) => makePlaylistTrack(i)) },
    activePattern: 0,
  };
}

/* --------------------------------------------------------------------------
   Reactive store + event bus
   -------------------------------------------------------------------------- */

class Store {
  constructor() {
    this.state = makeProject("Untitled");
    this.listeners = new Map();       // topic -> Set(fn)
    this.undoStack = [];
    this.redoStack = [];
    this.selection = { type: "project", id: null };
    this.edit = { rollTool: "draw", rollSnap: 4, plTool: "paint", plPattern: null, plSnap: 1 };
    this._lastSnapshot = JSON.stringify(this.state);
  }

  on(topic, fn) {
    if (!this.listeners.has(topic)) this.listeners.set(topic, new Set());
    this.listeners.get(topic).add(fn);
    return () => this.listeners.get(topic).delete(fn);
  }

  emit(topic, detail) {
    (this.listeners.get(topic) || []).forEach((fn) => fn(detail));
    (this.listeners.get("*") || []).forEach((fn) => fn({ topic, detail }));
  }

  /* Call after a discrete edit is committed (not on every pointermove). */
  commit() {
    const snap = JSON.stringify(this.state);
    if (snap !== this._lastSnapshot) {
      this.undoStack.push(this._lastSnapshot);
      if (this.undoStack.length > 50) this.undoStack.shift(); // parity with Qt UndoStack
      this.redoStack.length = 0;
      this._lastSnapshot = snap;
    }
  }

  undo() {
    if (!this.undoStack.length) return false;
    this.redoStack.push(JSON.stringify(this.state));
    this.state = JSON.parse(this.undoStack.pop());
    this._lastSnapshot = JSON.stringify(this.state);
    this.emit("state:replaced");
    return true;
  }

  redo() {
    if (!this.redoStack.length) return false;
    this.undoStack.push(JSON.stringify(this.state));
    this.state = JSON.parse(this.redoStack.pop());
    this._lastSnapshot = JSON.stringify(this.state);
    this.emit("state:replaced");
    return true;
  }

  select(type, id) {
    this.selection = { type, id };
    this.emit("selection");
  }

  /* --------------------------- model helpers ---------------------------- */

  addChannel(instrument, name) {
    const ch = makeChannel(instrument, name, this.state.channels.length);
    this.state.channels.push(ch);
    // give every existing pattern a lane for the new channel
    for (const pat of this.state.patterns) pat.steps[ch.id] = new Array(pat.lengthSteps).fill(0);
    this.commit();
    this.emit("channels");
    this.select("channel", ch.id);
    return ch;
  }

  removeChannel(id) {
    this.state.channels = this.state.channels.filter((c) => c.id !== id);
    for (const pat of this.state.patterns) { delete pat.steps[id]; delete pat.notes[id]; }
    if (this.selection.id === id) this.select("project", null);
    this.commit();
    this.emit("channels");
  }

  getChannel(id) { return this.state.channels.find((c) => c.id === id); }
  getPattern(id) { return this.state.patterns.find((p) => p.id === id); }
  activePatternObj() { return this.state.patterns[this.state.activePattern]; }

  addPattern() {
    const p = makePattern(null, this.state.patterns.length);
    for (const ch of this.state.channels) p.steps[ch.id] = new Array(p.lengthSteps).fill(0);
    this.state.patterns.push(p);
    this.state.activePattern = this.state.patterns.length - 1;
    this.commit();
    this.emit("patterns");
    return p;
  }

  setPatternLength(pat, lengthSteps) {
    for (const [cid, arr] of Object.entries(pat.steps)) {
      const next = new Array(lengthSteps).fill(0);
      next.set(arr.slice(0, lengthSteps));
      pat.steps[cid] = next;
    }
    for (const notes of Object.values(pat.notes)) {
      for (const n of notes) n.s = Math.min(n.s, lengthSteps - 1);
    }
    pat.lengthSteps = lengthSteps;
    this.commit();
    this.emit("patterns");
  }

  toggleStep(patternId, channelId, step) {
    const pat = this.getPattern(patternId);
    const arr = pat.steps[channelId] || (pat.steps[channelId] = new Array(pat.lengthSteps).fill(0));
    arr[step] = arr[step] ? 0 : 1;
    this.commit();
    this.emit("steps", { patternId, channelId });
  }

  /* --------------------------- persistence ------------------------------ */

  serialize() { return JSON.stringify(this.state, null, 1); }

  load(obj, { keepHistory = false } = {}) {
    if (!obj || !Array.isArray(obj.channels) || !Array.isArray(obj.patterns))
      throw new Error("Not a Misuc Neu project document");
    this.state = obj;
    if (!keepHistory) { this.undoStack.length = 0; this.redoStack.length = 0; }
    this._lastSnapshot = JSON.stringify(this.state);
    this.select("project", null);
    this.emit("state:replaced");
  }

  saveLocal(key = null) {
    const k = key || `misuc-neu:autosave`;
    localStorage.setItem(k, this.serialize());
    localStorage.setItem(`misuc-neu:autosave:name`, this.state.name);
  }

  loadLocal(key = `misuc-neu:autosave`) {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    this.load(JSON.parse(raw));
    return true;
  }

  listLocal() {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("misuc-neu:proj:")) {
        try {
          const doc = JSON.parse(localStorage.getItem(k));
          out.push({ key: k, name: doc.name, channels: doc.channels.length, bpm: doc.bpm });
        } catch { /* skip malformed */ }
      }
    }
    return out;
  }

  saveLocalProject() {
    const key = `misuc-neu:proj:${this.state.name.replace(/[^\w-]+/g, "_") || "untitled"}`;
    localStorage.setItem(key, this.serialize());
    this.emit("projects");
    return key;
  }

  deleteLocalProject(key) {
    localStorage.removeItem(key);
    this.emit("projects");
  }
}

export const store = new Store();

/* --------------------------------------------------------------------------
   Demo project — a small but real arrangement so the UI has something to say
   the moment it opens. Synthesized instruments only (no external samples).
   -------------------------------------------------------------------------- */

export function buildDemoProject() {
  const p = makeProject("Midnight Drive");
  p.bpm = 100;
  p.masterVolume = 0.8;

  const kick  = makeChannel("kick", "Kick", 0);
  const snare = makeChannel("snare", "Snare", 1);
  const hat   = makeChannel("hihat", "Hi-Hat", 2);
  const ohat  = makeChannel("ohat", "Open Hat", 3);
  const clap  = makeChannel("clap", "Clap", 4);
  const bass  = makeChannel("bass", "Bassline", 5);
  const lead  = makeChannel("lead", "Lead", 6);
  const pluck = makeChannel("pluck", "Plucks", 7);
  bass.volume = 0.75; lead.volume = 0.6; pluck.volume = 0.5;
  p.channels.push(kick, snare, hat, ohat, clap, bass, lead, pluck);

  const patA = makePattern("Beat A", 0);
  const patB = makePattern("Beat B", 1);
  const patM = makePattern("Melody", 2);
  p.patterns.push(patA, patB, patM);

  const seq = (arr, marks) => { for (const m of marks) arr[m] = 1; return arr; };
  patA.steps[kick.id]  = seq(new Array(16).fill(0), [0, 6, 10]);
  patA.steps[snare.id] = seq(new Array(16).fill(0), [4, 12]);
  patA.steps[hat.id]   = seq(new Array(16).fill(0), [2, 6, 10, 14]);
  patA.steps[clap.id]  = seq(new Array(16).fill(0), [4, 12]);
  patB.steps[kick.id]  = seq(new Array(16).fill(0), [0, 3, 6, 10]);
  patB.steps[snare.id] = seq(new Array(16).fill(0), [4, 12]);
  patB.steps[hat.id]   = seq(new Array(16).fill(0), [2, 4, 6, 8, 10, 12, 14]);
  patB.steps[ohat.id]  = seq(new Array(16).fill(0), [7, 15]);
  patB.steps[clap.id]  = seq(new Array(16).fill(0), [4, 12]);

  // Melody pattern: bass walks under a detuned-lead hook (A minor).
  const bassNotes = [
    { s: 0,  p: 45, d: 3, v: 0.9 }, { s: 4,  p: 45, d: 2, v: 0.8 },
    { s: 6,  p: 48, d: 2, v: 0.8 }, { s: 8,  p: 41, d: 3, v: 0.9 },
    { s: 12, p: 43, d: 4, v: 0.85 },
  ];
  const leadNotes = [
    { s: 0,  p: 69, d: 2, v: 0.85 }, { s: 2,  p: 72, d: 2, v: 0.8 },
    { s: 4,  p: 76, d: 4, v: 0.9 },  { s: 8,  p: 74, d: 2, v: 0.8 },
    { s: 10, p: 72, d: 2, v: 0.75 }, { s: 12, p: 69, d: 4, v: 0.9 },
  ];
  patM.notes[bass.id] = bassNotes.map((n) => ({ ...n }));
  patM.notes[lead.id] = leadNotes.map((n) => ({ ...n }));

  for (const pat of p.patterns)
    for (const ch of p.channels)
      if (!pat.steps[ch.id]) pat.steps[ch.id] = new Array(16).fill(0);

  // Arrangement: A / A / B / A with the melody from bar 4.
  const t1 = p.playlist.tracks[0], t2 = p.playlist.tracks[1];
  t1.clips.push({ id: uid("clip"), patternId: patA.id, startBar: 0, lengthBars: 1 });
  t1.clips.push({ id: uid("clip"), patternId: patA.id, startBar: 1, lengthBars: 1 });
  t1.clips.push({ id: uid("clip"), patternId: patB.id, startBar: 2, lengthBars: 1 });
  t1.clips.push({ id: uid("clip"), patternId: patA.id, startBar: 3, lengthBars: 1 });
  t2.clips.push({ id: uid("clip"), patternId: patM.id, startBar: 4, lengthBars: 2 });
  t2.clips.push({ id: uid("clip"), patternId: patM.id, startBar: 6, lengthBars: 2 });

  return p;
}
