/* ===========================================================================
   Misuc Neu — Inspector
   Context-sensitive right panel: shows project, channel, note or clip
   properties for the current selection. Edits write straight back to the
   model (with undo commits) and re-emit the relevant topic.
   =========================================================================== */

import { store, INSTRUMENTS, CHANNEL_COLORS } from "./state.js";
import { engine } from "./audio.js";
import { el, attachKnob, makeKnob } from "./widgets.js";

export function buildInspector(host) {
  function render() {
    host.innerHTML = "";
    const sel = store.selection;
    if (sel.type === "channel") return renderChannel(host, sel.id);
    if (sel.type === "note") return renderNote(host);
    if (sel.type === "clip") return renderClip(host, sel.id);
    renderProject(host);
  }

  store.on("selection", render);
  store.on("state:replaced", render);
  store.on("channels", render);
  store.on("roll", render);
  store.on("bpm", render);
  render();
}

function head(title, icon) {
  const h = el("div", "insp-head");
  h.appendChild(el("div", "icon", icon));
  h.appendChild(el("div", "label", title));
  return h;
}

function row(label, control) {
  const r = el("div", "insp-row");
  r.appendChild(el("span", "label", label));
  r.appendChild(control);
  return r;
}

function kv(k, v) {
  const r = el("div", "insp-kv");
  r.appendChild(el("span", "dim", k));
  r.appendChild(el("b", null, String(v)));
  return r;
}

function renderProject(host) {
  const s = store.state;
  host.appendChild(head("Project", "🎼"));
  const g = el("div", "insp-group");
  const nameIn = el("input", "field"); nameIn.value = s.name;
  nameIn.addEventListener("change", () => { s.name = nameIn.value.trim() || "Untitled"; store.commit(); store.emit("project"); });
  g.appendChild(row("Name", nameIn));

  const bpmIn = el("input", "field"); bpmIn.value = s.bpm; bpmIn.type = "number";
  bpmIn.addEventListener("change", () => { s.bpm = Math.max(20, Math.min(300, +bpmIn.value || 120)); store.commit(); store.emit("bpm"); });
  g.appendChild(row("Tempo", bpmIn));

  g.appendChild(el("div", "insp-sep"));
  g.appendChild(kv("Channels", s.channels.length));
  g.appendChild(kv("Patterns", s.patterns.length));
  g.appendChild(kv("Tracks", s.playlist.tracks.length));
  const clips = s.playlist.tracks.reduce((n, t) => n + t.clips.length, 0);
  g.appendChild(kv("Clips", clips));
  host.appendChild(g);

  const tip = el("div", "insp-empty");
  tip.innerHTML = `<div class="big">🎚</div><div>Select a channel, note or clip to inspect its properties.</div>`;
  host.appendChild(tip);
}

function renderChannel(host, id) {
  const ch = store.state.channels.find((c) => c.id === id);
  if (!ch) return renderProject(host);
  host.appendChild(head("Channel", INSTRUMENTS[ch.instrument]?.icon || "🎹"));

  const g = el("div", "insp-group");
  const nameIn = el("input", "field"); nameIn.value = ch.name;
  nameIn.addEventListener("change", () => { ch.name = nameIn.value.trim() || ch.name; store.commit(); store.emit("channels"); });
  g.appendChild(row("Name", nameIn));

  const instSel = el("select", "field");
  for (const [iid, info] of Object.entries(INSTRUMENTS)) {
    const o = el("option", null, info.name); o.value = iid; instSel.appendChild(o);
  }
  instSel.value = ch.instrument;
  instSel.addEventListener("change", () => {
    ch.instrument = instSel.value;
    ch.name = ch.name === "" ? INSTRUMENTS[ch.instrument].name : ch.name;
    store.commit(); store.emit("channels");
  });
  g.appendChild(row("Sound", instSel));

  g.appendChild(el("div", "insp-sep"));

  const vol = makeKnob({ min: 0, max: 1, value: ch.volume, format: (v) => Math.round(v * 100) + "%",
    onInput: (v, c) => { ch.volume = v; engine.setChannelParams(ch, store.state.channels.some((x) => x.solo)); if (c) store.commit(); } });
  g.appendChild(row("Volume", vol));

  const pan = makeKnob({ min: -1, max: 1, value: ch.pan, format: (v) => (Math.abs(v) < 0.02 ? "C" : (v < 0 ? "L" : "R") + Math.round(Math.abs(v) * 100)),
    onInput: (v, c) => { ch.pan = v; engine.setChannelParams(ch); if (c) store.commit(); } });
  g.appendChild(row("Pan", pan));

  const tone = makeKnob({ min: 0, max: 1, value: ch.tone, format: (v) => Math.round(v * 100) + "%",
    onInput: (v, c) => { ch.tone = v; engine.setChannelParams(ch); if (c) store.commit(); } });
  g.appendChild(row("Tone", tone));

  g.appendChild(el("div", "insp-sep"));
  // colour swatches
  const sw = el("div", "accent-swatches");
  for (const c of CHANNEL_COLORS) {
    const b = el("button", "swatch-btn" + (ch.color === c ? " on" : ""));
    b.style.background = c; b.style.color = c;
    b.addEventListener("click", () => { ch.color = c; store.commit(); store.emit("channels"); });
    sw.appendChild(b);
  }
  g.appendChild(row("Colour", sw));

  g.appendChild(el("div", "insp-sep"));
  const del = el("button", "btn danger", "Delete channel");
  del.addEventListener("click", () => { store.removeChannel(id); store.emit("toast", { msg: "Channel deleted" }); });
  g.appendChild(del);

  host.appendChild(g);
}

function renderNote(host) {
  host.appendChild(head("Note", "♪"));
  const g = el("div", "insp-group");
  g.appendChild(el("div", "dim", "A note is selected in the piano roll. Drag to move, drag its right edge to resize, or drag in the velocity lane below to change dynamics."));
  g.appendChild(el("div", "insp-sep"));
  g.appendChild(kv("Tip", "Erase tool = ⌫"));
  host.appendChild(g);
}

function renderClip(host, id) {
  let clip, track;
  for (const t of store.state.playlist.tracks) {
    const c = t.clips.find((x) => x.id === id);
    if (c) { clip = c; track = t; break; }
  }
  if (!clip) return renderProject(host);
  const pat = store.state.patterns.find((p) => p.id === clip.patternId);
  host.appendChild(head("Clip", "🎞"));
  const g = el("div", "insp-group");
  g.appendChild(kv("Pattern", pat ? pat.name : "?"));
  g.appendChild(kv("Track", track.name));
  const startIn = el("input", "field"); startIn.type = "number"; startIn.value = clip.startBar;
  startIn.addEventListener("change", () => { clip.startBar = Math.max(0, +startIn.value || 0); store.commit(); store.emit("selection"); });
  g.appendChild(row("Start bar", startIn));
  const lenIn = el("input", "field"); lenIn.type = "number"; lenIn.value = clip.lengthBars;
  lenIn.addEventListener("change", () => { clip.lengthBars = Math.max(1, +lenIn.value || 1); store.commit(); store.emit("selection"); });
  g.appendChild(row("Length", lenIn));
  host.appendChild(g);
}
