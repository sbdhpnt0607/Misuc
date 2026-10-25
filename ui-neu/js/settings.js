/* ===========================================================================
   Misuc Neu — Settings
   Appearance (theme, accent — mirrors the Qt ThemeEngine presets), audio
   diagnostics (sample rate, latency, 440 Hz test tone), project I/O
   (save/load/export/import/clear) and the keyboard-shortcut reference.
   =========================================================================== */

import { store } from "./state.js";
import { engine } from "./audio.js";
import { setTheme, setAccent } from "./header.js";
import { el, toast } from "./widgets.js";
import { ICON } from "./icons.js";

const ACCENTS = ["violet", "cyan", "emerald", "amber", "crimson"];

export function buildSettings(host) {
  host.innerHTML = "";
  const panel = el("div", "view-panel");
  const scroll = el("div", "settings-scroll");
  panel.appendChild(scroll);
  host.appendChild(panel);

  /* ---- appearance ---- */
  const app = card("🎨", "Appearance");
  const themeRow = el("div", "settings-row");
  themeRow.appendChild(el("span", "label", "Theme"));
  const themeBtns = el("div", "segmented");
  for (const [label, val] of [["🌙 Dark", "dark"], ["☀ Light", "light"]]) {
    const b = el("button", null, label);
    b.dataset.value = val;
    if (document.documentElement.dataset.theme === val) b.classList.add("on");
    b.addEventListener("click", () => {
      setTheme(val);
      themeBtns.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    });
    themeBtns.appendChild(b);
  }
  themeRow.appendChild(themeBtns);
  app.appendChild(themeRow);

  const accentRow = el("div", "settings-row");
  accentRow.appendChild(el("span", "label", "Accent"));
  const sw = el("div", "accent-swatches");
  const colors = { violet: "#8f7bfa", cyan: "#22d3ee", emerald: "#34d399", amber: "#ffb454", crimson: "#ff5470" };
  for (const a of ACCENTS) {
    const b = el("button", "swatch-btn" + (document.documentElement.dataset.accent === a ? " on" : ""));
    b.style.background = colors[a]; b.style.color = colors[a];
    b.addEventListener("click", () => {
      setAccent(a);
      sw.querySelectorAll(".swatch-btn").forEach((x) => x.classList.toggle("on", x === b));
    });
    sw.appendChild(b);
  }
  accentRow.appendChild(sw);
  app.appendChild(accentRow);
  scroll.appendChild(app);

  /* ---- audio ---- */
  const audio = card("🔊", "Audio");
  const sr = el("div", "settings-row"); sr.appendChild(el("span", "label", "Sample rate"));
  const srVal = el("span", "mono strong", "—"); sr.appendChild(srVal); audio.appendChild(sr);
  const lat = el("div", "settings-row"); lat.appendChild(el("span", "label", "Base latency"));
  const latVal = el("span", "mono strong", "—"); lat.appendChild(latVal); audio.appendChild(lat);
  const toneRow = el("div", "settings-row"); toneRow.appendChild(el("span", "label", "440 Hz test tone"));
  const toneBtn = el("button", "btn", "Off");
  let toneOn = false;
  toneBtn.addEventListener("click", () => {
    toneOn = engine.toggleTestTone(!toneOn);
    toneBtn.textContent = toneOn ? "On" : "Off";
    toneBtn.classList.toggle("accent", toneOn);
  });
  toneRow.appendChild(toneBtn); audio.appendChild(toneRow);
  const initBtn = el("button", "btn accent", "Start audio engine");
  initBtn.addEventListener("click", () => { engine.ensure(); refreshAudio(); });
  audio.appendChild(initBtn);
  audio.appendChild(el("div", "dim", "Web Audio preview engine. The Qt build routes through PipeWire with a −1 dBFS brickwall limiter (live == export)."));
  scroll.appendChild(audio);

  function refreshAudio() {
    srVal.textContent = engine.sampleRate ? engine.sampleRate.toLocaleString() + " Hz" : "not started";
    latVal.textContent = engine.ready ? engine.baseLatencyMs.toFixed(1) + " ms" : "—";
  }
  refreshAudio();
  engine.ensure && setTimeout(refreshAudio, 400);

  /* ---- project ---- */
  const proj = card("📁", "Project");
  const saveRow = el("div", "settings-row");
  const saveBtn = el("button", "btn", "💾 Save to shelf");
  saveBtn.addEventListener("click", () => {
    const key = store.saveLocalProject();
    store.emit("projects");
    toast("Saved “" + store.state.name + "”", "ok");
  });
  saveRow.appendChild(saveBtn);
  const expBtn = el("button", "btn", "⤓ Export .json");
  expBtn.addEventListener("click", () => {
    const blob = new Blob([store.serialize()], { type: "application/json" });
    const a = el("a"); a.href = URL.createObjectURL(blob);
    a.download = (store.state.name.replace(/[^\w-]+/g, "_") || "misuc") + ".misuc.json";
    a.click(); URL.revokeObjectURL(a.href);
    toast("Exported project", "ok");
  });
  saveRow.appendChild(expBtn);
  proj.appendChild(saveRow);

  const impRow = el("div", "settings-row");
  const impBtn = el("button", "btn", "⤒ Import .json");
  const fileIn = el("input"); fileIn.type = "file"; fileIn.accept = ".json,application/json"; fileIn.style.display = "none";
  impBtn.addEventListener("click", () => fileIn.click());
  fileIn.addEventListener("change", () => {
    const f = fileIn.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try { store.load(JSON.parse(rd.result)); toast("Imported project", "ok"); }
      catch { toast("Invalid project file", "warn"); }
    };
    rd.readAsText(f);
  });
  impRow.append(impBtn, fileIn);
  const clearBtn = el("button", "btn danger", "New empty project");
  clearBtn.addEventListener("click", () => {
    if (confirm("Start a new empty project? Unsaved changes are lost.")) {
      const { makeProject } = require_state();
      store.load(makeProject("Untitled"));
      toast("New project", "ok");
    }
  });
  impRow.appendChild(clearBtn);
  proj.appendChild(impRow);
  scroll.appendChild(proj);

  /* ---- shortcuts ---- */
  const keys = card("⌨", "Keyboard");
  const list = el("div", "kbd-list");
  for (const [k, d] of [
    ["Space", "Play / stop"], ["R", "Toggle record arm"], ["L", "Toggle loop"],
    ["M", "Toggle metronome"], ["1–5", "Switch workspace"], ["D / S / E", "Roll tools: draw / select / erase"],
    ["Ctrl+Z", "Undo"], ["Ctrl+Shift+Z", "Redo"], ["Ctrl+S", "Save to shelf"],
  ]) {
    list.appendChild(el("span", "kbd", k));
    list.appendChild(el("span", "dim", d));
  }
  keys.appendChild(list);
  scroll.appendChild(keys);

  /* ---- about ---- */
  const about = card("ℹ", "About");
  about.appendChild(el("div", "strong", "Misuc Neu UI"));
  about.appendChild(el("div", "dim", "A neumorphic re-imagining of the Misuc workspace — channel rack, piano roll, playlist, mixer and browser. This web build is a design + interaction prototype with a real Web Audio synth engine; the shipping app renders the same layout in Qt 6 / QML against the PipeWire engine."));
  scroll.appendChild(about);
}

function card(icon, title) {
  const c = el("div", "settings-card");
  c.appendChild(el("h3", null, `<span class="icon">${icon}</span>${title}`));
  return c;
}

/* tiny helper to avoid a circular import for the "new project" action */
function require_state() {
  return { makeProject: (name) => ({
    version: 1, name, bpm: 120, swing: 0, metronome: false,
    loopOn: false, loopStartBar: 0, loopBars: 4, masterVolume: 0.85,
    channels: [], patterns: [], activePattern: 0,
    playlist: { tracks: Array.from({ length: 8 }, (_, i) => ({
      id: "tr" + i, name: "Track " + (i + 1), mute: false,
      color: "#8f7bfa", clips: [],
    })) },
  }) };
}
