/* ===========================================================================
   Misuc Neu — Piano Roll
   Canvas note editor for the selected melodic channel in the active pattern.
   Tools: draw / select-move / erase. Horizontal + vertical zoom, grid snap,
   a draggable velocity lane, piano keyboard gutter, and a live playhead.
   Notes live in pattern.notes[channelId] on the step grid, so playback is
   shared with the transport scheduler (no separate voice path).
   =========================================================================== */

import { store } from "./state.js";
import { engine } from "./audio.js";
import { transport } from "./transport.js";
import { ICON } from "./icons.js";
import { el, iconBtn, makeSegmented } from "./widgets.js";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const LO = 24, HI = 108;                       // playable midi range
const isBlack = (p) => [1, 3, 6, 8, 10].includes(p % 12);

export function buildPianoRoll(host) {
  host.innerHTML = "";
  const panel = el("div", "view-panel");

  /* ---- toolbar ---- */
  const toolbar = el("div", "view-toolbar");
  const channelLabel = el("div", "toolbar-group");
  channelLabel.appendChild(el("span", "label", "Channel"));
  const channelSel = el("select", "field");
  channelSel.setAttribute("aria-label", "Edit channel");
  channelLabel.appendChild(channelSel);

  const toolSeg = makeSegmented([
    { label: "✏ Draw", value: "draw", tip: "Draw notes (D)" },
    { label: "⬚ Select", value: "select", tip: "Select / move (S)" },
    { label: "⌫ Erase", value: "erase", tip: "Erase notes (E)" },
  ], store.edit.rollTool, (v) => { store.edit.rollTool = v; store.emit("roll"); });

  const snapGroup = el("div", "toolbar-group");
  snapGroup.appendChild(el("span", "label", "Snap"));
  const snapSel = el("select", "field");
  for (const [v, l] of [[1, "1/16"], [2, "1/8"], [4, "1/4"], [8, "1/2"], [16, "1/1"]]) {
    const o = el("option", null, l); o.value = v; snapSel.appendChild(o);
  }
  snapSel.value = store.edit.rollSnap;
  snapSel.addEventListener("change", () => { store.edit.rollSnap = parseInt(snapSel.value, 10); });
  snapGroup.appendChild(snapSel);

  const spacer = el("div", "spacer");
  const zin = iconBtn("🔍+", "Zoom in", "btn btn-icon sm");
  const zout = iconBtn("🔍−", "Zoom out", "btn btn-icon sm");
  const clearBtn = el("button", "btn", "Clear notes");

  toolbar.append(channelLabel, toolSeg, snapGroup, spacer, zout, zin, clearBtn);

  /* ---- canvas area ---- */
  const rollWrap = el("div", "roll-wrap");
  const keys = el("div", "roll-keys");
  const keysCv = el("canvas");
  keys.appendChild(keysCv);
  const noteHost = el("div", "roll-canvas-host");
  const noteCv = el("canvas");
  noteHost.appendChild(noteCv);
  rollWrap.append(keys, noteHost);

  const velHost = el("div", "vel-lane");
  const velCv = el("canvas");
  velHost.appendChild(velCv);

  panel.append(toolbar, rollWrap, velHost);
  host.appendChild(panel);

  /* ---- view state ---- */
  const view = { pxPerStep: 26, pxPerKey: 16, scrollX: 0, scrollY: 0, selected: null };
  let ctx, kctx, vctx;
  let dragging = null; // {mode:'draw'|'move'|'erase'|'vel'|'pan'|'resize', ...}

  function currentChannel() {
    const id = channelSel.value;
    return store.state.channels.find((c) => c.id === id);
  }
  function currentNotes() {
    const ch = currentChannel();
    const pat = store.activePatternObj();
    if (!ch || !pat) return null;
    if (!pat.notes[ch.id]) pat.notes[ch.id] = [];
    return pat.notes[ch.id];
  }
  const pat = () => store.activePatternObj();
  const stepsToX = (s) => s * view.pxPerStep - view.scrollX;
  const xToStep = (x) => (x + view.scrollX) / view.pxPerStep;
  const pitchToY = (p) => (HI - p) * view.pxPerKey - view.scrollY;
  const yToPitch = (y) => HI - Math.floor((y + view.scrollY) / view.pxPerKey);

  function layout() {
    const dpr = window.devicePixelRatio || 1;
    for (const cv of [noteCv, keysCv, velCv]) {
      const r = cv.getBoundingClientRect();
      cv.width = Math.max(1, r.width * dpr);
      cv.height = Math.max(1, r.height * dpr);
    }
    ctx = noteCv.getContext("2d");
    kctx = keysCv.getContext("2d");
    vctx = velCv.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (kctx) kctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (vctx) vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // default scroll to a comfortable octave around middle C
    if (view.scrollY === 0) view.scrollY = (HI - 76) * view.pxPerKey;
    draw();
  }

  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

  function draw() {
    if (!ctx) return;
    const W = noteCv.getBoundingClientRect().width, H = noteCv.getBoundingClientRect().height;
    const p = pat(); if (!p) return;
    ctx.clearRect(0, 0, W, H);

    // row backgrounds (black-key rows shaded) + horizontal key lines
    for (let pi = LO; pi <= HI; pi++) {
      const y = pitchToY(pi);
      if (y + view.pxPerKey < 0 || y > H) continue;
      if (isBlack(pi)) { ctx.fillStyle = css("--lane-alt"); ctx.fillRect(0, y, W, view.pxPerKey); }
      if (pi % 12 === 0) { ctx.fillStyle = css("--grid-line-2"); ctx.fillRect(0, y + view.pxPerKey - 1, W, 1); }
    }

    // vertical grid: step lines, beat, bar
    const totalSteps = p.lengthSteps;
    for (let s = 0; s <= totalSteps; s++) {
      const x = stepsToX(s);
      if (x < -2 || x > W) continue;
      if (s % 16 === 0) { ctx.fillStyle = css("--grid-line-2"); ctx.fillRect(x - 1, 0, 2, H); }
      else if (s % 4 === 0) { ctx.fillStyle = css("--grid-line-2"); ctx.fillRect(x, 0, 1, H); }
      else { ctx.fillStyle = css("--grid-line"); ctx.fillRect(x, 0, 1, H); }
    }

    // notes
    const notes = currentNotes() || [];
    const accent = css("--accent") || "#8f7bfa";
    const accentDeep = css("--accent-deep") || "#6c5ce7";
    for (const n of notes) {
      const x = stepsToX(n.s);
      const w = Math.max(4, n.d * view.pxPerStep - 2);
      const y = pitchToY(n.p) + 1;
      const h = view.pxPerKey - 2;
      if (x + w < 0 || x > W) continue;
      const grad = ctx.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, accent); grad.addColorStop(1, accentDeep);
      ctx.fillStyle = grad;
      roundRect(ctx, x, y, w, h, 3); ctx.fill();
      // velocity shading via top highlight
      ctx.fillStyle = `rgba(255,255,255,${0.15 + n.v * 0.35})`;
      roundRect(ctx, x, y, w, Math.min(3, h / 2), 2); ctx.fill();
      if (view.selected === n) {
        ctx.strokeStyle = css("--text-strong"); ctx.lineWidth = 2;
        roundRect(ctx, x, y, w, h, 3); ctx.stroke();
        // resize handle
        ctx.fillStyle = css("--text-strong");
        ctx.fillRect(x + w - 3, y, 3, h);
      }
    }

    // playhead
    if (transport.playing) {
      const px = stepsToX(transport.positionSteps() % totalSteps);
      if (px >= 0 && px <= W) {
        ctx.fillStyle = accent; ctx.fillRect(px - 1, 0, 2, H);
        ctx.fillStyle = "rgba(143,123,250,.10)"; ctx.fillRect(px, 0, W - px, H);
      }
    }

    drawKeys(H);
    drawVelocity();
  }

  function drawKeys(H) {
    if (!kctx) return;
    const r = keysCv.getBoundingClientRect();
    kctx.clearRect(0, 0, r.width, r.height);
    for (let pi = LO; pi <= HI; pi++) {
      const y = pitchToY(pi);
      if (y + view.pxPerKey < 0 || y > r.height) continue;
      kctx.fillStyle = isBlack(pi) ? css("--sh-dark") : css("--surface-hi");
      kctx.fillRect(0, y, r.width, view.pxPerKey - 1);
      if (pi % 12 === 0) {
        kctx.fillStyle = css("--text-dim");
        kctx.font = "9px var(--mono)";
        kctx.fillText(NOTE_NAMES[0] + (Math.floor(pi / 12) - 1), 4, y + view.pxPerKey - 4);
      }
    }
  }

  function drawVelocity() {
    if (!vctx) return;
    const r = velCv.getBoundingClientRect();
    vctx.clearRect(0, 0, r.width, r.height);
    const notes = currentNotes() || [];
    const accent = css("--accent") || "#8f7bfa";
    vctx.fillStyle = css("--grid-line");
    for (let s = 0; s <= (pat()?.lengthSteps || 16); s++) {
      const x = stepsToX(s);
      if (x >= 0 && x <= r.width) vctx.fillRect(x, 0, 1, r.height);
    }
    for (const n of notes) {
      const x = stepsToX(n.s);
      const w = Math.max(4, n.d * view.pxPerStep - 2);
      if (x + w < 0 || x > r.width) continue;
      const h = n.v * (r.height - 8);
      vctx.fillStyle = view.selected === n ? css("--text-strong") : accent;
      roundRect(vctx, x, r.height - h - 4, w, h, 2); vctx.fill();
    }
  }

  function roundRect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function hitNote(x, y) {
    const notes = currentNotes() || [];
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      const nx = stepsToX(n.s), nw = Math.max(4, n.d * view.pxPerStep - 2);
      const ny = pitchToY(n.p), nh = view.pxPerKey;
      if (x >= nx && x <= nx + nw && y >= ny && y <= ny + nh) return n;
    }
    return null;
  }

  function snapStep(s) {
    const snap = store.edit.rollSnap;
    return Math.max(0, Math.round(s / snap) * snap);
  }

  /* ---- pointer interaction ---- */
  noteCv.addEventListener("pointerdown", (e) => {
    const r = noteCv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const notes = currentNotes();
    if (!notes) return;
    noteCv.setPointerCapture(e.pointerId);
    const hit = hitNote(x, y);
    const tool = store.edit.rollTool;

    if (tool === "erase") {
      if (hit) { notes.splice(notes.indexOf(hit), 1); store.commit(); store.emit("roll"); draw(); }
      dragging = { mode: "erase" };
      return;
    }
    if (tool === "select") {
      if (hit) {
        view.selected = hit;
        store.select("note", null); store.emit("selection");
        const nx = stepsToX(hit.s);
        dragging = { mode: (x > nx + hit.d * view.pxPerStep - 8) ? "resize" : "move", note: hit,
          startX: x, startS: hit.s, startD: hit.d, startP: hit.p, startY: y };
      } else { view.selected = null; store.select("channel", channelSel.value); }
      store.emit("roll"); draw();
      return;
    }
    // draw tool
    if (hit) {
      view.selected = hit;
      dragging = { mode: "move", note: hit, startX: x, startS: hit.s, startD: hit.d, startP: hit.p, startY: y };
    } else {
      const p = snapStep(xToStep(x));
      const pitch = yToPitch(y);
      const n = { s: p, p: pitch, d: store.edit.rollSnap, v: 0.8 };
      notes.push(n);
      view.selected = n;
      dragging = { mode: "draw", note: n, startX: x };
      engine.triggerNote(currentChannel(), pitch, engine.ctx?.currentTime || 0, 0.2, n.v);
      store.emit("roll"); store.emit("selection"); draw();
    }
  });

  noteCv.addEventListener("pointermove", (e) => {
    const r = noteCv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (!dragging) { noteCv.style.cursor = store.edit.rollTool === "erase" ? "crosshair" : "default"; return; }
    if (dragging.mode === "erase") {
      const hit = hitNote(x, y);
      const notes = currentNotes();
      if (hit && notes) { notes.splice(notes.indexOf(hit), 1); draw(); }
      return;
    }
    const n = dragging.note;
    if (dragging.mode === "draw" || dragging.mode === "resize") {
      const endStep = snapStep(xToStep(x));
      n.d = Math.max(store.edit.rollSnap, endStep - n.s);
    } else if (dragging.mode === "move") {
      const dxSteps = Math.round((x - dragging.startX) / view.pxPerStep / store.edit.rollSnap) * store.edit.rollSnap;
      n.s = Math.max(0, Math.min((pat()?.lengthSteps || 16) - 1, dragging.startS + dxSteps));
      const dPitch = Math.round((dragging.startY - y) / view.pxPerKey);
      n.p = Math.max(LO, Math.min(HI, dragging.startP + dPitch));
    }
    draw();
  });

  noteCv.addEventListener("pointerup", () => {
    if (dragging && dragging.mode !== "erase") store.commit();
    dragging = null; store.emit("roll");
  });

  // velocity lane editing
  velCv.addEventListener("pointerdown", (e) => {
    const r = velCv.getBoundingClientRect();
    velCv.setPointerCapture(e.pointerId);
    const setVel = (clientX) => {
      const x = clientX - r.left;
      const notes = currentNotes() || [];
      const hit = notes.find((n) => {
        const nx = stepsToX(n.s); return x >= nx && x <= nx + Math.max(4, n.d * view.pxPerStep - 2);
      });
      if (hit) { hit.v = Math.max(0.05, Math.min(1, 1 - (e.clientY - r.top) / r.height)); draw(); }
    };
    setVel(e.clientX);
    dragging = { mode: "vel", move: setVel };
  });
  velCv.addEventListener("pointermove", (e) => { if (dragging?.mode === "vel") dragging.move(e.clientX); });
  velCv.addEventListener("pointerup", () => { if (dragging?.mode === "vel") { store.commit(); dragging = null; } });

  // zoom + pan
  noteHost.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      view.pxPerStep = Math.max(8, Math.min(80, view.pxPerStep * (e.deltaY < 0 ? 1.1 : 0.9)));
    } else if (e.shiftKey) {
      view.scrollX = Math.max(0, view.scrollX + e.deltaY);
    } else {
      view.scrollY = Math.max(0, view.scrollY + e.deltaY);
    }
    draw();
  }, { passive: false });
  zin.addEventListener("click", () => { view.pxPerStep = Math.min(80, view.pxPerStep * 1.2); draw(); });
  zout.addEventListener("click", () => { view.pxPerStep = Math.max(8, view.pxPerStep / 1.2); draw(); });
  clearBtn.addEventListener("click", () => {
    const notes = currentNotes();
    if (notes) { notes.length = 0; store.commit(); store.emit("roll"); draw(); }
  });

  channelSel.addEventListener("change", () => { store.select("channel", channelSel.value); view.selected = null; store.emit("roll"); });

  /* ---- channel list (melodic first) ---- */
  function fillChannels() {
    const prev = channelSel.value;
    channelSel.innerHTML = "";
    const chs = store.state.channels;
    if (!chs.length) { const o = el("option", null, "— add a channel —"); channelSel.appendChild(o); return; }
    for (const ch of chs) {
      const o = el("option", null, `${ch.name}${INSTRUMENTS_KIND(ch)}`);
      o.value = ch.id; channelSel.appendChild(o);
    }
    channelSel.value = prev && chs.some((c) => c.id === prev)
      ? prev
      : (chs.find((c) => c.instrument !== "kick" && c.instrument !== "snare" && c.instrument !== "hihat" && c.instrument !== "clap")?.id || chs[0].id);
  }

  function refresh() { fillChannels(); layout(); }
  store.on("state:replaced", refresh);
  store.on("channels", refresh);
  store.on("patterns", () => { layout(); });
  store.on("roll", () => { draw(); });

  refresh();
  const ro = new ResizeObserver(() => layout());
  ro.observe(noteHost); ro.observe(velHost); ro.observe(keys);

  let raf;
  const tick = () => { if (transport.playing) draw(); raf = requestAnimationFrame(tick); };
  raf = requestAnimationFrame(tick);
  host._cleanup = () => { cancelAnimationFrame(raf); ro.disconnect(); };
}

function INSTRUMENTS_KIND(ch) {
  const melodic = !["kick", "snare", "hihat", "ohat", "clap", "tom"].includes(ch.instrument);
  return melodic ? "  ♪" : "  ·";
}
