/* ===========================================================================
   Misuc Neu — application bootstrap
   Wires the shell: icon rail navigation, view switching, keyboard shortcuts,
   toast routing, autosave and first-run demo project. Views are built lazily
   the first time they're opened and kept alive afterwards.
   =========================================================================== */

import { store, buildDemoProject } from "./state.js";
import { engine } from "./audio.js";
import { transport } from "./transport.js";
import { initTheme } from "./header.js";
import { buildHeader } from "./header.js";
import { buildChannelRack } from "./channelrack.js";
import { buildPianoRoll } from "./pianoroll.js";
import { buildPlaylist } from "./playlist.js";
import { buildMixer } from "./mixer.js";
import { buildBrowser } from "./browser.js";
import { buildInspector } from "./inspector.js";
import { buildSettings } from "./settings.js";
import { ICON } from "./icons.js";
import { el, toast } from "./widgets.js";

const VIEWS = [
  { id: "rack",     label: "Rack",     icon: ICON.rack,     build: buildChannelRack, key: "1", hint: "Channel Rack — step sequencer & instruments" },
  { id: "roll",     label: "Roll",     icon: ICON.roll,     build: buildPianoRoll,   key: "2", hint: "Piano Roll — melodic note editor" },
  { id: "playlist", label: "Arrange",  icon: ICON.playlist, build: buildPlaylist,    key: "3", hint: "Playlist — arrange patterns into a song" },
  { id: "mixer",    label: "Mixer",    icon: ICON.mixer,    build: buildMixer,       key: "4", hint: "Mixer — levels, pan, tone & metering" },
  { id: "browser",  label: "Browser",  icon: ICON.browser,  build: buildBrowser,     key: "5", hint: "Browser — instruments & saved projects" },
  { id: "settings", label: "Setup",    icon: ICON.settings, build: buildSettings,    key: "6", hint: "Settings — appearance, audio & project I/O" },
];

export function boot() {
  initTheme();
  loadOrDemo();

  buildHeader(document.getElementById("header"));
  buildRail(document.getElementById("rail"));
  buildInspector(document.getElementById("inspector"));
  buildDock(document.getElementById("dock"));

  // create the view host containers
  const main = document.getElementById("main");
  const hosts = {};
  for (const v of VIEWS) {
    const h = el("section", "view");
    h.id = "view-" + v.id;
    main.appendChild(h);
    hosts[v.id] = h;
  }

  const built = new Set();
  let current = null;

  function show(id) {
    const v = VIEWS.find((x) => x.id === id);
    if (!v) return;
    if (!built.has(id)) { v.build(hosts[id]); built.add(id); }
    for (const x of VIEWS) hosts[x.id].classList.toggle("active", x.id === id);
    document.querySelectorAll(".rail-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === id));
    current = id;
    setHint(v.hint);
    store.emit("view", id);
  }

  // rail buttons call show()
  window.__misucShowView = show;

  // toast + hint routing
  store.on("toast", ({ msg, kind }) => toast(msg, kind));

  // keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "select" || tag === "textarea" || e.target.isContentEditable) {
      // allow Ctrl+S everywhere
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveShelf(); }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) { if (store.redo()) toast("Redo"); }
      else { if (store.undo()) toast("Undo"); }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); if (store.redo()) toast("Redo"); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveShelf(); return; }

    switch (e.key) {
      case " ": e.preventDefault(); transport.toggle(); break;
      case "r": case "R": transport.toggleRecord(); break;
      case "l": case "L": store.state.loopOn = !store.state.loopOn; store.commit(); store.emit("loop"); break;
      case "m": case "M": store.state.metronome = !store.state.metronome; store.commit(); store.emit("metronome"); break;
      case "d": case "D": if (current === "roll") { store.edit.rollTool = "draw"; store.emit("roll"); } break;
      case "s": case "S": if (current === "roll") { store.edit.rollTool = "select"; store.emit("roll"); } break;
      case "e": case "E": if (current === "roll") { store.edit.rollTool = "erase"; store.emit("roll"); } break;
      default: {
        const v = VIEWS.find((x) => x.key === e.key);
        if (v) show(v.id);
      }
    }
  });

  // unlock audio on first interaction (browser autoplay policy)
  const unlock = () => {
    engine.ensure();
    engine.setMaster(store.state.masterVolume);
    engine.syncMixer(store.state.channels);
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);

  // autosave every 15 s once the project has been touched
  setInterval(() => { try { store.saveLocal(); } catch { /* ignore */ } }, 15000);
  store.on("state:replaced", () => { try { store.saveLocal(); } catch { /* ignore */ } });

  // open the channel rack first
  show("rack");
}

function loadOrDemo() {
  let loaded = false;
  try { loaded = store.loadLocal(); } catch { loaded = false; }
  if (!loaded || !store.state.channels.length) {
    store.load(buildDemoProject());
  }
}

function saveShelf() {
  store.saveLocalProject();
  store.emit("projects");
  toast("Saved “" + store.state.name + "” to shelf", "ok");
}

function buildRail(host) {
  host.innerHTML = "";
  for (const v of VIEWS) {
    const b = el("button", "rail-btn");
    b.dataset.view = v.id;
    b.dataset.tip = v.hint;
    b.classList.add("tip-left");
    b.innerHTML = v.icon + `<span>${v.label}</span>`;
    b.addEventListener("click", () => window.__misucShowView(v.id));
    host.appendChild(b);
  }
  host.appendChild(el("div", "rail-spacer"));
  const inspToggle = el("button", "rail-btn");
  inspToggle.innerHTML = `${ICON.cursor}<span>Info</span>`;
  inspToggle.dataset.tip = "Toggle inspector";
  inspToggle.classList.add("tip-left");
  inspToggle.addEventListener("click", () => {
    document.getElementById("app").classList.toggle("inspector-hidden");
  });
  host.appendChild(inspToggle);
}

function buildDock(host) {
  host.innerHTML = "";
  const hint = el("div", "hint");
  hint.id = "dock-hint";
  const chips = el("div", "dock-chips");

  const modeChip = el("span", "chip", "PAT");
  const engineChip = el("span", "chip", "engine idle");
  const state = el("div", "engine-state");
  const led = el("div", "led ok");
  state.append(led, el("span", "label", "Misuc Neu"));

  chips.append(modeChip, engineChip);
  host.append(state, hint, chips);

  const sync = () => {
    modeChip.textContent = transport.mode === "song" ? "SONG" : "PAT";
    engineChip.textContent = engine.ready
      ? `engine ${engine.sampleRate / 1000}k · ${engine.baseLatencyMs.toFixed(0)}ms`
      : "engine idle";
    led.classList.toggle("on", transport.playing);
  };
  store.on("transport", sync);
  store.on("view", sync);
  setInterval(sync, 1000);
  sync();
}

export function setHint(html) {
  const h = document.getElementById("dock-hint");
  if (h) h.innerHTML = html;
}

boot();
