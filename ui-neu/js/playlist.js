/* ===========================================================================
   Misuc Neu — Playlist (arrangement)
   Track lanes on the left, a bar ruler on top, and pattern clips painted onto
   the grid. Tools: paint (place the selected pattern), select/move, erase.
   The loop region is dragged on the ruler. Clips schedule their pattern in
   SONG mode, so this is the real arrangement the transport plays back.
   =========================================================================== */

import { store, STEPS_PER_BAR } from "./state.js";
import { transport } from "./transport.js";
import { ICON } from "./icons.js";
import { el, iconBtn, makeSegmented } from "./widgets.js";

const PX_PER_BAR = 96;
const TRACK_H = 48;
const RULER_H = 26;

export function buildPlaylist(host) {
  host.innerHTML = "";
  const panel = el("div", "view-panel");

  /* ---- toolbar ---- */
  const toolbar = el("div", "view-toolbar");
  const toolSeg = makeSegmented([
    { label: "🖌 Paint", value: "paint", tip: "Place pattern clips" },
    { label: "⬚ Select", value: "select", tip: "Move / select clips" },
    { label: "⌫ Erase", value: "erase", tip: "Delete clips" },
  ], store.edit.plTool, (v) => { store.edit.plTool = v; });

  const patGroup = el("div", "toolbar-group");
  patGroup.appendChild(el("span", "label", "Pattern"));
  const patSel = el("select", "field");
  patSel.setAttribute("aria-label", "Pattern to paint");
  patGroup.appendChild(patSel);

  const spacer = el("div", "spacer");
  const gotoMode = el("button", "btn", "▶ Play arrangement");
  gotoMode.addEventListener("click", () => { transport.setMode("song"); transport.play(); });

  toolbar.append(toolSeg, patGroup, spacer, gotoMode);

  /* ---- body ---- */
  const body = el("div", "pl-body");
  const head = el("div", "pl-tracks-head");
  const cvHost = el("div", "pl-canvas-host");
  const cv = el("canvas");
  cvHost.appendChild(cv);
  body.append(head, cvHost);

  const plWrap = el("div", "pl-wrap");
  plWrap.append(toolbar);
  const panelInner = el("div", "view-panel");
  panelInner.style.flex = "1";
  panelInner.append(toolbar, body);
  host.appendChild(panelInner);

  let ctx, dragging = null;
  const view = { scrollX: 0 };
  const totalBars = 32;

  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

  function layout() {
    const dpr = window.devicePixelRatio || 1;
    const r = cvHost.getBoundingClientRect();
    cv.width = Math.max(1, r.width * dpr);
    cv.height = Math.max(1, r.height * dpr);
    ctx = cv.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function fillPatterns() {
    const prev = patSel.value;
    patSel.innerHTML = "";
    for (const p of store.state.patterns) {
      const o = el("option", null, p.name); o.value = p.id; patSel.appendChild(o);
    }
    const def = store.state.patterns[store.edit.plPattern] ? store.state.patterns[store.edit.plPattern].id : store.state.patterns[0]?.id;
    patSel.value = prev && store.state.patterns.some((p) => p.id === prev) ? prev : (def || "");
    store.edit.plPattern = 0;
  }

  function buildHeads() {
    head.innerHTML = "";
    // spacer aligned with ruler
    const rulerSpacer = el("div");
    rulerSpacer.style.height = RULER_H + "px";
    rulerSpacer.style.flex = "none";
    head.appendChild(rulerSpacer);
    for (const track of store.state.playlist.tracks) {
      const h = el("div", "pl-track-head");
      h.style.height = TRACK_H + "px";
      const nameIn = el("input");
      nameIn.value = track.name;
      nameIn.addEventListener("change", () => { track.name = nameIn.value.trim() || track.name; store.commit(); });
      const m = el("button", "mini" + (track.mute ? " on-m" : ""), "M");
      m.dataset.tip = "Mute track";
      m.addEventListener("click", () => { track.mute = !track.mute; m.classList.toggle("on-m", track.mute); store.commit(); });
      h.append(nameIn, m);
      head.appendChild(h);
    }
  }

  function trackY(i) { return RULER_H + i * TRACK_H; }
  function barX(b) { return b * PX_PER_BAR - view.scrollX; }
  function xToBar(x) { return (x + view.scrollX) / PX_PER_BAR; }

  function draw() {
    if (!ctx) return;
    const W = cvHost.getBoundingClientRect().width, H = cvHost.getBoundingClientRect().height;
    ctx.clearRect(0, 0, W, H);

    // ruler background
    ctx.fillStyle = css("--surface");
    ctx.fillRect(0, 0, W, RULER_H);

    // bar grid + ruler numbers
    for (let b = 0; b <= totalBars; b++) {
      const x = barX(b);
      if (x < -2 || x > W) continue;
      ctx.fillStyle = b % 4 === 0 ? css("--grid-line-2") : css("--grid-line");
      ctx.fillRect(x, 0, 1, H);
      if (b % 2 === 0) {
        ctx.fillStyle = css("--text-dim");
        ctx.font = "10px var(--mono)";
        ctx.fillText(String(b + 1), x + 4, 16);
      }
    }

    // loop region
    if (store.state.loopOn) {
      const x0 = barX(store.state.loopStartBar);
      const x1 = barX(store.state.loopStartBar + store.state.loopBars);
      ctx.fillStyle = css("--accent-soft") || "rgba(143,123,250,.25)";
      ctx.fillRect(x0, 0, x1 - x0, RULER_H);
      ctx.fillStyle = css("--accent");
      ctx.fillRect(x0, 0, 2, RULER_H);
      ctx.fillRect(x1 - 2, 0, 2, RULER_H);
    }

    // track lanes
    for (let i = 0; i < store.state.playlist.tracks.length; i++) {
      const y = trackY(i);
      if (i % 2) { ctx.fillStyle = css("--lane-alt"); ctx.fillRect(0, y, W, TRACK_H); }
      ctx.fillStyle = css("--grid-line");
      ctx.fillRect(0, y + TRACK_H - 1, W, 1);
    }

    // clips
    for (let i = 0; i < store.state.playlist.tracks.length; i++) {
      const track = store.state.playlist.tracks[i];
      for (const clip of track.clips) {
        const pat = store.state.patterns.find((p) => p.id === clip.patternId);
        if (!pat) continue;
        const x = barX(clip.startBar);
        const w = clip.lengthBars * PX_PER_BAR - 3;
        const y = trackY(i) + 4;
        const h = TRACK_H - 8;
        const grad = ctx.createLinearGradient(0, y, 0, y + h);
        grad.addColorStop(0, pat.color); grad.addColorStop(1, css("--accent-deep"));
        ctx.globalAlpha = track.mute ? 0.35 : 1;
        ctx.fillStyle = grad;
        roundRect(ctx, x, y, w, h, 5); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(255,255,255,.9)";
        ctx.font = "600 11px var(--font)";
        ctx.fillText(pat.name, x + 6, y + h / 2 + 4, w - 10);
        // mini step preview
        ctx.fillStyle = "rgba(255,255,255,.25)";
        const firstCh = store.state.channels[0];
        const steps = firstCh ? pat.steps[firstCh.id] : null;
        if (steps) {
          const cw = w / steps.length;
          for (let s = 0; s < steps.length; s++) {
            if (steps[s]) ctx.fillRect(x + s * cw, y + h - 5, Math.max(1, cw - 1), 3);
          }
        }
      }
    }

    // playhead
    if (transport.playing) {
      const bar = transport.positionSteps() / STEPS_PER_BAR;
      const px = barX(bar);
      if (px >= 0 && px <= W) {
        ctx.fillStyle = css("--accent");
        ctx.fillRect(px - 1, 0, 2, H);
      }
    }
  }

  function roundRect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  function trackIndexAt(y) {
    if (y < RULER_H) return -1;
    return Math.floor((y - RULER_H) / TRACK_H);
  }

  function clipAt(x, y) {
    const ti = trackIndexAt(y);
    if (ti < 0) return null;
    const track = store.state.playlist.tracks[ti];
    const bar = xToBar(x);
    for (const clip of track.clips) {
      if (bar >= clip.startBar && bar < clip.startBar + clip.lengthBars) return { clip, track, ti };
    }
    return null;
  }

  cv.addEventListener("pointerdown", (e) => {
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    cv.setPointerCapture(e.pointerId);
    const tool = store.edit.plTool;

    if (y < RULER_H) {
      // loop region drag
      const startBar = Math.max(0, Math.floor(xToBar(x)));
      dragging = { mode: "loop", startBar };
      store.state.loopOn = true;
      return;
    }

    if (tool === "erase") {
      const hit = clipAt(x, y);
      if (hit) { hit.track.clips = hit.track.clips.filter((c) => c !== hit.clip); store.commit(); draw(); }
      return;
    }

    if (tool === "select") {
      const hit = clipAt(x, y);
      if (hit) {
        store.select("clip", hit.clip.id);
        dragging = { mode: "move", hit, startBar: xToBar(x), origStart: hit.clip.startBar, origTrack: hit.ti };
        store.emit("selection");
      }
      return;
    }

    // paint
    const ti = trackIndexAt(y);
    if (ti < 0) return;
    const patId = patSel.value || store.state.patterns[0]?.id;
    if (!patId) { store.emit("toast", { msg: "No pattern to paint", kind: "warn" }); return; }
    const pat = store.state.patterns.find((p) => p.id === patId);
    const startBar = Math.max(0, Math.floor(xToBar(x)));
    const lengthBars = Math.max(1, Math.round(pat.lengthSteps / STEPS_PER_BAR));
    const track = store.state.playlist.tracks[ti];
    // avoid overlap
    if (track.clips.some((c) => startBar < c.startBar + c.lengthBars && startBar + lengthBars > c.startBar)) {
      store.emit("toast", { msg: "Clip overlaps an existing one", kind: "warn" }); return;
    }
    const clip = { id: "clip" + Math.random().toString(36).slice(2), patternId: patId, startBar, lengthBars };
    track.clips.push(clip);
    store.select("clip", clip.id);
    store.commit(); draw(); store.emit("selection");
  });

  cv.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left;
    if (dragging.mode === "loop") {
      const b = Math.max(0, Math.floor(xToBar(x)));
      store.state.loopStartBar = Math.min(dragging.startBar, b);
      store.state.loopBars = Math.max(1, Math.abs(b - dragging.startBar) + 1);
      draw();
    } else if (dragging.mode === "move") {
      const dBar = Math.round(xToBar(x) - dragging.startBar);
      const newStart = Math.max(0, dragging.origStart + dBar);
      dragging.hit.clip.startBar = newStart;
      draw();
    }
  });

  cv.addEventListener("pointerup", () => {
    if (dragging) { store.commit(); dragging = null; draw(); }
  });

  cvHost.addEventListener("wheel", (e) => {
    if (e.shiftKey) { e.preventDefault(); view.scrollX = Math.max(0, view.scrollX + e.deltaY); draw(); }
  }, { passive: false });

  function refresh() { fillPatterns(); buildHeads(); layout(); }
  store.on("state:replaced", refresh);
  store.on("patterns", () => { fillPatterns(); draw(); });
  store.on("channels", () => draw());

  refresh();
  const ro = new ResizeObserver(() => layout());
  ro.observe(cvHost);

  let raf;
  const tick = () => { if (transport.playing) draw(); raf = requestAnimationFrame(tick); };
  raf = requestAnimationFrame(tick);
  host._cleanup = () => { cancelAnimationFrame(raf); ro.disconnect(); };
}
