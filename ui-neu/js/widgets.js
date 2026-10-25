/* ===========================================================================
   Misuc Neu — reusable widget behaviours
   Knobs (vertical drag + wheel, dbl-click reset), faders, segmented
   controls, icon buttons, popovers and toasts. Every widget is unopinionated
   about the model: it reports changes through callbacks so views own state.
   =========================================================================== */

export function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

/* ------------------------------- KNOB ------------------------------------ */
/* opts: {min,max,value,step,format,onInput(value, committing)} */
export function attachKnob(node, opts) {
  const { min = 0, max = 1, format = (v) => Math.round(v * 100) + "%" } = opts;
  let value = opts.value ?? min;
  const angle = () => -135 + ((value - min) / (max - min)) * 270;
  const paint = () => {
    node.style.setProperty("--knob-angle", angle() + "deg");
    const val = node.querySelector(".knob-val");
    if (val) val.textContent = format(value);
  };

  const set = (v, committing) => {
    const snapped = opts.step ? Math.round(v / opts.step) * opts.step : v;
    value = Math.min(max, Math.max(min, snapped));
    paint();
    opts.onInput?.(value, committing);
  };

  let dragging = false, startY = 0, startVal = 0;
  node.addEventListener("pointerdown", (e) => {
    dragging = true; startY = e.clientY; startVal = value;
    node.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  node.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const fine = e.shiftKey ? 0.25 : 1;
    const range = max - min;
    set(startVal - ((e.clientY - startY) / 150) * range * fine, false);
  });
  node.addEventListener("pointerup", (e) => {
    if (!dragging) return;
    dragging = false;
    node.releasePointerCapture(e.pointerId);
    opts.onInput?.(value, true);
  });
  node.addEventListener("wheel", (e) => {
    e.preventDefault();
    set(value + (e.deltaY < 0 ? 1 : -1) * (max - min) * (e.shiftKey ? 0.01 : 0.04), true);
  }, { passive: false });
  node.addEventListener("dblclick", () => set(opts.value ?? (min + max) / 2, true));

  paint();
  node._setKnob = (v) => { value = v; paint(); };
  return node;
}

export function makeKnob(opts) {
  const n = el("div", "knob" + (opts.small ? " sm" : ""));
  n.appendChild(el("span", "knob-val"));
  n.setAttribute("role", "slider");
  return attachKnob(n, opts);
}

/* ------------------------------- FADER ----------------------------------- */
/* Vertical fader. opts: {min,max,value,format,onInput} */
export function attachFader(node, opts) {
  const { min = 0, max = 1 } = opts;
  let value = opts.value ?? min;
  const fill = node.querySelector(".fill");
  const paint = () => {
    const pct = ((value - min) / (max - min)) * 100;
    node.style.setProperty("--fader-fill", pct + "%");
    if (fill) fill.style.height = pct + "%";
  };
  const setFromY = (clientY, committing) => {
    const r = node.getBoundingClientRect();
    const pad = 6;
    const usable = r.height - pad * 2;
    const ratio = 1 - Math.min(1, Math.max(0, (clientY - r.top - pad) / usable));
    value = min + ratio * (max - min);
    paint();
    opts.onInput?.(value, committing);
  };
  let dragging = false;
  node.addEventListener("pointerdown", (e) => {
    dragging = true; node.setPointerCapture(e.pointerId); setFromY(e.clientY, false);
  });
  node.addEventListener("pointermove", (e) => { if (dragging) setFromY(e.clientY, false); });
  node.addEventListener("pointerup", (e) => {
    if (!dragging) return;
    dragging = false; node.releasePointerCapture(e.pointerId); opts.onInput?.(value, true);
  });
  node.addEventListener("wheel", (e) => {
    e.preventDefault();
    value = Math.min(max, Math.max(min, value + (e.deltaY < 0 ? 1 : -1) * (max - min) * 0.03));
    paint(); opts.onInput?.(value, true);
  }, { passive: false });
  paint();
  node._setFader = (v) => { value = v; paint(); };
  return node;
}

export function makeFader(opts) {
  const n = el("div", "fader");
  n.appendChild(el("div", "track"));
  n.appendChild(el("div", "fill"));
  n.appendChild(el("div", "cap"));
  return attachFader(n, opts);
}

/* ----------------------------- SEGMENTED --------------------------------- */
export function makeSegmented(items, initial, onPick) {
  const wrap = el("div", "segmented");
  const btns = items.map((it) => {
    const b = el("button", null, it.label);
    b.dataset.value = it.value;
    if (it.tip) b.dataset.tip = it.tip;
    b.addEventListener("click", () => {
      btns.forEach((x) => x.classList.toggle("on", x === b));
      onPick(it.value);
    });
    wrap.appendChild(b);
    return b;
  });
  const sel = (v) => btns.forEach((b) => b.classList.toggle("on", b.dataset.value === v));
  sel(initial);
  wrap._select = sel;
  return wrap;
}

/* --------------------------- ICON BUTTON --------------------------------- */
export function iconBtn(svg, tip, cls = "btn btn-icon") {
  const b = el("button", cls, svg);
  if (tip) b.dataset.tip = tip;
  return b;
}

/* ------------------------------ POPOVER ---------------------------------- */
/* Anchored floating menu. Returns close(). Click-outside + Esc dismiss. */
export function popover(anchor, build, { align = "left" } = {}) {
  closePopover();
  const pop = el("div", "popover");
  build(pop, () => closePopover());
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  const pr = pop.getBoundingClientRect();
  let left = align === "right" ? r.right - pr.width : r.left;
  left = Math.max(8, Math.min(left, window.innerWidth - pr.width - 8));
  let top = r.bottom + 8;
  if (top + pr.height > window.innerHeight - 8) top = r.top - pr.height - 8;
  pop.style.left = left + "px";
  pop.style.top = Math.max(8, top) + "px";

  const onDoc = (e) => { if (!pop.contains(e.target) && !anchor.contains(e.target)) closePopover(); };
  const onKey = (e) => { if (e.key === "Escape") closePopover(); };
  setTimeout(() => {
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
  }, 0);
  window._misucPopover = { node: pop, onDoc, onKey };
  return pop;
}
export function closePopover() {
  const p = window._misucPopover;
  if (!p) return;
  document.removeEventListener("pointerdown", p.onDoc);
  document.removeEventListener("keydown", p.onKey);
  p.node.remove();
  window._misucPopover = null;
}

/* ------------------------------- TOAST ----------------------------------- */
export function toast(msg, kind = "") {
  const host = document.getElementById("toast-host");
  if (!host) return;
  const t = el("div", "toast " + kind, `<span class="dot"></span><span></span>`);
  t.lastChild.textContent = msg;
  host.appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 240); }, 2600);
}
