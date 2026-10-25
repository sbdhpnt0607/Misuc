/* ===========================================================================
   Misuc Neu — Channel Rack
   Pattern tabs + one row per channel: colour, editable name, mute/solo,
   a step grid sized to the pattern length (beat-grouped), and a per-row
   volume knob. "Add channel" opens the instrument picker. Steps toggle on
   click (and paint on drag); the grid lights the playing column live.
   =========================================================================== */

import { store, INSTRUMENTS } from "./state.js";
import { engine } from "./audio.js";
import { transport } from "./transport.js";
import { ICON } from "./icons.js";
import { el, iconBtn, attachKnob, popover } from "./widgets.js";

export function buildChannelRack(host) {
  host.innerHTML = "";

  const panel = el("div", "view-panel");
  const toolbar = el("div", "view-toolbar");
  const tabs = el("div", "pattern-tabs");
  const spacer = el("div", "spacer");

  const lenSel = el("select", "field");
  lenSel.setAttribute("aria-label", "Pattern length");
  for (const n of [16, 32, 64]) {
    const o = el("option", null, `${n} steps`); o.value = n; lenSel.appendChild(o);
  }
  lenSel.addEventListener("change", () => {
    store.setPatternLength(store.activePatternObj(), parseInt(lenSel.value, 10));
    render();
  });

  const addPatBtn = iconBtn(ICON.plus, "New pattern", "btn btn-icon");
  addPatBtn.addEventListener("click", () => { store.addPattern(); render(); });

  toolbar.append(tabs, spacer, lenSel, addPatBtn);

  const well = el("div", "well");
  const scroll = el("div", "rack-scroll");
  well.appendChild(scroll);

  panel.append(toolbar, well);
  host.appendChild(panel);

  function render() {
    // pattern tabs
    tabs.innerHTML = "";
    store.state.patterns.forEach((pat, i) => {
      const t = el("button", "pattern-tab" + (i === store.state.activePattern ? " active" : ""));
      const dot = el("span", "dot");
      dot.style.background = pat.color; dot.style.color = pat.color;
      const label = el("span", null, pat.name);
      t.append(dot, label);
      t.addEventListener("click", () => { store.state.activePattern = i; store.emit("patterns"); render(); });
      t.addEventListener("dblclick", () => renamePattern(pat, label));
      tabs.appendChild(t);
    });
    lenSel.value = store.activePatternObj()?.lengthSteps || 16;

    // rows
    scroll.innerHTML = "";
    const pat = store.activePatternObj();
    for (const ch of store.state.channels) {
      scroll.appendChild(buildRow(ch, pat));
    }
    // add-channel button
    const add = el("button", "rack-add", `${ICON.plus}<span>Add channel</span>`);
    add.querySelector("svg").style.width = "16px";
    add.querySelector("svg").style.height = "16px";
    add.querySelector("svg").style.fill = "currentColor";
    add.addEventListener("click", (e) => openInstrumentPicker(add, (inst) => {
      store.addChannel(inst); render();
      store.emit("toast", { msg: `Added ${INSTRUMENTS[inst].name}`, kind: "ok" });
    }));
    scroll.appendChild(add);
  }

  store.on("channels", render);
  store.on("patterns", render);
  store.on("steps", render);
  store.on("state:replaced", render);
  render();

  // live playhead column
  let raf;
  const tick = () => {
    const pat = store.activePatternObj();
    if (pat && transport.playing) {
      const col = Math.floor(transport.positionSteps()) % pat.lengthSteps;
      scroll.querySelectorAll(".step-cell.playing").forEach((c) => c.classList.remove("playing"));
      scroll.querySelectorAll(`.step-cell[data-col="${col}"]`).forEach((c) => c.classList.add("playing"));
    } else {
      scroll.querySelectorAll(".step-cell.playing").forEach((c) => c.classList.remove("playing"));
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  host._cleanup = () => cancelAnimationFrame(raf);
}

function buildRow(ch, pat) {
  const row = el("div", "rack-row");
  if (store.selection.type === "channel" && store.selection.id === ch.id) row.classList.add("selected");

  const dot = el("button", "color-dot");
  dot.style.background = ch.color; dot.style.color = ch.color;
  dot.dataset.tip = "Cycle colour";
  dot.addEventListener("click", () => {
    const colors = ["#8f7bfa","#22d3ee","#34d399","#ffb454","#ff5470","#60a5fa","#f472b6","#a3e635","#facc15","#c084fc"];
    const i = colors.indexOf(ch.color);
    ch.color = colors[(i + 1) % colors.length];
    store.commit(); store.emit("channels");
  });

  const name = el("input", "rack-name");
  name.value = ch.name;
  name.addEventListener("focus", () => store.select("channel", ch.id));
  name.addEventListener("change", () => { ch.name = name.value.trim() || ch.name; store.commit(); store.emit("channels"); });

  const mute = iconBtn("M", "Mute", "btn btn-icon sm");
  mute.textContent = ""; mute.innerHTML = "M";
  mute.classList.toggle("on-m", ch.mute);
  mute.addEventListener("click", () => {
    ch.mute = !ch.mute; mute.classList.toggle("on-m", ch.mute);
    engine.syncMixer(store.state.channels); store.commit();
  });

  const solo = iconBtn("S", "Solo", "btn btn-icon sm");
  solo.innerHTML = "S";
  solo.classList.toggle("on-s", ch.solo);
  solo.addEventListener("click", () => {
    ch.solo = !ch.solo; solo.classList.toggle("on-s", ch.solo);
    engine.syncMixer(store.state.channels); store.commit();
  });

  // step grid
  const grid = el("div", "step-grid");
  const len = pat.lengthSteps;
  grid.style.gridTemplateColumns = `repeat(${len}, minmax(0,1fr))`;
  const steps = pat.steps[ch.id] || (pat.steps[ch.id] = new Array(len).fill(0));
  let painting = false, paintVal = 0;
  for (let i = 0; i < len; i++) {
    const c = el("button", "step-cell" + (steps[i] ? " on" : "") + (i % 4 === 0 ? " beat" : ""));
    c.dataset.col = i;
    c.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      painting = true;
      paintVal = steps[i] ? 0 : 1;
      applyStep(i, paintVal, c);
      c.setPointerCapture?.(e.pointerId);
    });
    c.addEventListener("pointerenter", () => { if (painting) applyStep(i, paintVal, c); });
    c.addEventListener("pointerup", () => { if (painting) { painting = false; store.commit(); } });
    grid.appendChild(c);
    // beat grouping gap every 4
    if (i % 4 === 3 && i !== len - 1) {
      const sep = el("div", "step-group-sep");
      grid.appendChild(sep);
    }
  }
  window.addEventListener("pointerup", () => { if (painting) { painting = false; store.commit(); } });

  function applyStep(i, val, cell) {
    steps[i] = val;
    cell.classList.toggle("on", !!val);
    if (val) engine.triggerStep(ch, engine.ctx?.currentTime || 0, 1); // audible feedback
    store.emit("steps", { patternId: pat.id, channelId: ch.id, live: true });
  }

  const vol = el("div", "knob sm");
  vol.appendChild(el("span", "knob-val"));
  attachKnob(vol, {
    min: 0, max: 1, value: ch.volume, small: true,
    format: (v) => Math.round(v * 100),
    onInput: (v, committing) => {
      ch.volume = v; engine.setChannelParams(ch, store.state.channels.some((c) => c.solo));
      if (committing) store.commit();
    },
  });
  vol.dataset.tip = "Channel volume";

  row.append(dot, name, mute, solo, grid, vol, el("div"));
  row.addEventListener("pointerdown", (e) => {
    if (e.target === grid || grid.contains(e.target)) return;
    store.select("channel", ch.id);
  });
  return row;
}

function renamePattern(pat, labelEl) {
  const inp = el("input", "field");
  inp.value = pat.name;
  inp.style.width = "120px";
  labelEl.replaceWith(inp);
  inp.focus(); inp.select();
  const done = () => { pat.name = inp.value.trim() || pat.name; store.commit(); store.emit("patterns"); };
  inp.addEventListener("change", done);
  inp.addEventListener("blur", done);
}

/* Instrument picker popover (shared with the browser) */
export function openInstrumentPicker(anchor, onPick) {
  popover(anchor, (pop, close) => {
    for (const [id, info] of Object.entries(INSTRUMENTS)) {
      const b = el("button", null,
        `<span style="font-size:15px">${info.icon}</span>` +
        `<span style="flex:1"><b style="display:block">${info.name}</b>` +
        `<span style="font-size:10px;color:var(--text-dim)">${info.desc}</span></span>` +
        `<span class="kind">${info.kind}</span>`);
      b.addEventListener("click", () => { onPick(id); close(); });
      pop.appendChild(b);
    }
  });
}
