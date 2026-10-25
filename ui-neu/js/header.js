/* ===========================================================================
   Misuc Neu — header (brand, project name, transport pod, master cluster)
   The transport pod is the single place playback is driven: play/pause/stop/
   record, pattern↔song mode, loop, metronome, BPM stepper and the bar:beat:
   step counter. Everything reads/writes through store + transport + engine.
   =========================================================================== */

import { store } from "./state.js";
import { engine } from "./audio.js";
import { transport } from "./transport.js";
import { ICON } from "./icons.js";
import { el, iconBtn, attachKnob, makeSegmented } from "./widgets.js";

export function buildHeader(host) {
  host.innerHTML = "";

  /* ---- brand ---- */
  const brand = el("div", "brand");
  const mark = el("div", "brand-mark", ICON.logo);
  const bt = el("div", "brand-text");
  bt.appendChild(el("div", "brand-name", "MISUC"));
  const nameInput = el("input", "project-name");
  nameInput.value = store.state.name;
  nameInput.setAttribute("aria-label", "Project name");
  nameInput.addEventListener("change", () => {
    store.state.name = nameInput.value.trim() || "Untitled";
    nameInput.value = store.state.name;
    store.commit();
    store.emit("project");
  });
  bt.appendChild(nameInput);
  brand.append(mark, bt);

  /* ---- transport ---- */
  const tp = el("div", "transport");

  const btnStop = iconBtn(ICON.stop, "Stop  (Space)", "btn btn-icon primary");
  const btnPlay = iconBtn(ICON.play, "Play / Pause  (Space)", "btn btn-icon primary");
  btnPlay.id = "btn-play";
  const btnRew = iconBtn(ICON.rewind, "Back to start");
  const btnRec = iconBtn(ICON.rec, "Record — needs PipeWire engine", "btn btn-icon danger");
  btnRec.id = "btn-rec";

  const modeSeg = makeSegmented(
    [{ label: "PAT", value: "pattern", tip: "Loop active pattern" },
     { label: "SONG", value: "song", tip: "Play playlist arrangement" }],
    transport.mode,
    (v) => transport.setMode(v));

  const btnLoop = iconBtn(ICON.loop, "Loop region", "btn btn-icon toggle");
  const btnMetro = iconBtn(ICON.metro, "Metronome", "btn btn-icon toggle");

  const pos = el("div", "pos-display mono");
  pos.innerHTML = `001:1:0<span class="pos-sub">BAR : BEAT</span>`;

  const bpmStepper = el("div", "stepper");
  const bpmDown = el("button", null, "−");
  const bpmUp = el("button", null, "+");
  const bpmInput = el("input");
  bpmInput.value = store.state.bpm;
  bpmInput.inputMode = "numeric";
  bpmInput.setAttribute("aria-label", "Tempo BPM");
  const setBpm = (v) => {
    store.state.bpm = Math.max(20, Math.min(300, Math.round(v)));
    bpmInput.value = store.state.bpm;
    store.commit();
    store.emit("bpm");
  };
  bpmDown.addEventListener("click", () => setBpm(store.state.bpm - 1));
  bpmUp.addEventListener("click", () => setBpm(store.state.bpm + 1));
  bpmInput.addEventListener("change", () => setBpm(parseFloat(bpmInput.value) || 120));
  bpmInput.addEventListener("wheel", (e) => { e.preventDefault(); setBpm(store.state.bpm + (e.deltaY < 0 ? 1 : -1)); }, { passive: false });
  bpmStepper.append(bpmDown, bpmInput, bpmUp);

  const d1 = el("div", "divider");
  const d2 = el("div", "divider");

  const main = el("div", "transport-main");
  main.append(btnRew, btnPlay, btnStop, btnRec);

  tp.append(main, d1, modeSeg, d2, btnLoop, btnMetro, pos, bpmStepper);

  /* ---- right cluster ---- */
  const right = el("div", "header-right");

  const masterCluster = el("div", "master-cluster");
  const mMeters = el("div", "master-meters");
  const mFillL = el("div", "meter"); mFillL.style.height = "34px";
  const mL = el("div", "meter-fill"); mFillL.appendChild(mL);
  const mFillR = el("div", "meter"); mFillR.style.height = "34px";
  const mR = el("div", "meter-fill"); mFillR.appendChild(mR);
  mMeters.append(mFillL, mFillR);
  const masterKnob = makeMasterKnob();
  masterCluster.append(mMeters, masterKnob);

  const themeBtn = el("button", "theme-toggle", ICON.moon);
  themeBtn.dataset.tip = "Toggle light / dark";

  right.append(masterCluster, themeBtn);

  host.append(brand, tp, right);

  /* ---- wiring ---- */
  btnPlay.addEventListener("click", () => transport.toggle());
  btnStop.addEventListener("click", () => transport.stop());
  btnRew.addEventListener("click", () => { transport.stop(); });
  btnRec.addEventListener("click", () => {
    const armed = transport.toggleRecord();
    btnRec.classList.toggle("armed", armed);
    store.emit("toast", {
      msg: armed ? "Recording armed — capture requires the PipeWire engine (Qt build)"
                 : "Recording disarmed",
      kind: armed ? "warn" : "",
    });
  });
  btnLoop.addEventListener("click", () => {
    store.state.loopOn = !store.state.loopOn;
    store.commit(); store.emit("loop");
  });
  btnMetro.addEventListener("click", () => {
    store.state.metronome = !store.state.metronome;
    store.commit(); store.emit("metronome");
  });
  themeBtn.addEventListener("click", () => toggleTheme(themeBtn));

  // keep control chrome in sync with state
  const sync = () => {
    btnPlay.innerHTML = transport.playing ? ICON.pause : ICON.play;
    btnPlay.classList.toggle("playing", transport.playing);
    btnPlay.dataset.tip = transport.playing ? "Pause  (Space)" : "Play  (Space)";
    btnLoop.classList.toggle("on", store.state.loopOn);
    btnMetro.classList.toggle("on", store.state.metronome);
    bpmInput.value = store.state.bpm;
    nameInput.value = store.state.name;
  };
  store.on("transport", sync);
  store.on("loop", sync);
  store.on("metronome", sync);
  store.on("bpm", sync);
  store.on("project", sync);
  store.on("state:replaced", sync);
  store.on("theme", () => themeBtn.innerHTML =
    document.documentElement.dataset.theme === "dark" ? ICON.moon : ICON.sun);
  sync();
  themeBtn.innerHTML = document.documentElement.dataset.theme === "dark" ? ICON.moon : ICON.sun;

  // meter + position animation loop
  let lastBeat = -1;
  const raf = () => {
    // master meters
    const peak = engine.masterPeak();
    const pct = Math.min(100, peak * 100);
    mL.style.height = pct + "%";
    mR.style.height = Math.min(100, peak * (0.85 + Math.random() * 0.3) * 100) + "%";
    // position counter
    if (transport.playing) {
      const p = transport.position;
      pos.innerHTML =
        `${String(p.bar).padStart(3, "0")}:${p.beat}:${String(p.step).padStart(2, "0")}` +
        `<span class="pos-sub">BAR : BEAT</span>`;
    }
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
}

function makeMasterKnob() {
  const wrap = el("div");
  wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:4px";
  const k = el("div", "knob sm");
  k.appendChild(el("span", "knob-val"));
  attachKnob(k, {
    min: 0, max: 1, value: store.state.masterVolume,
    format: (v) => Math.round(v * 100),
    onInput: (v, committing) => {
      store.state.masterVolume = v;
      engine.setMaster(v);
      if (committing) { store.commit(); store.emit("master"); }
    },
  });
  k.dataset.tip = "Master volume";
  wrap.append(k, el("span", "label", "MASTER"));
  return wrap;
}

/* ------------------------------- theme ---------------------------------- */
export function setTheme(mode) {
  document.documentElement.dataset.theme = mode;
  try { localStorage.setItem("misuc-neu:theme", mode); } catch { /* ignore */ }
  store.emit("theme", mode);
}
export function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  setTheme(next);
}
export function setAccent(name) {
  document.documentElement.dataset.accent = name;
  try { localStorage.setItem("misuc-neu:accent", name); } catch { /* ignore */ }
  store.emit("accent", name);
}
export function initTheme() {
  let t = "dark", a = "violet";
  try {
    t = localStorage.getItem("misuc-neu:theme") || "dark";
    a = localStorage.getItem("misuc-neu:accent") || "violet";
  } catch { /* ignore */ }
  document.documentElement.dataset.theme = t;
  document.documentElement.dataset.accent = a;
}
