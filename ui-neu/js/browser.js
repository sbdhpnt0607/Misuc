/* ===========================================================================
   Misuc Neu — Browser
   Left-panel style content browser: search + categorised instruments (click
   to audition, + to add a channel) and the saved-projects shelf (load /
   delete documents stored in localStorage). Categories mirror the Qt browser.
   =========================================================================== */

import { store, INSTRUMENTS } from "./state.js";
import { engine } from "./audio.js";
import { el, iconBtn } from "./widgets.js";
import { ICON } from "./icons.js";

export function buildBrowser(host) {
  host.innerHTML = "";
  const panel = el("div", "view-panel");

  const search = el("div", "browser-search");
  const searchField = el("input", "field");
  searchField.placeholder = "Search instruments, projects…";
  search.appendChild(searchField);

  const well = el("div", "well");
  const wrap = el("div", "browser-wrap");
  well.appendChild(wrap);

  panel.append(search, well);
  host.appendChild(panel);

  function render() {
    const q = searchField.value.trim().toLowerCase();
    wrap.innerHTML = "";

    /* ---- instruments ---- */
    const sec = el("div", "browser-section");
    sec.appendChild(el("h3", null, `${ICON.rack}<span class="label">Instruments</span>`));
    for (const [id, info] of Object.entries(INSTRUMENTS)) {
      if (q && !(info.name.toLowerCase().includes(q) || info.desc.toLowerCase().includes(q))) continue;
      const item = el("div", "browser-item");
      item.innerHTML =
        `<div class="icon">${info.icon}</div>` +
        `<div class="meta"><b>${info.name}</b><span>${info.desc}</span></div>`;
      const acts = el("div", "acts");
      const play = iconBtn(ICON.play, "Audition", "btn btn-icon sm");
      play.addEventListener("click", (e) => { e.stopPropagation(); audition(id); });
      const add = iconBtn(ICON.plus, "Add channel", "btn btn-icon sm");
      add.addEventListener("click", (e) => {
        e.stopPropagation();
        store.addChannel(id);
        store.emit("toast", { msg: `Added ${info.name} channel`, kind: "ok" });
      });
      acts.append(play, add);
      item.appendChild(acts);
      item.addEventListener("click", () => audition(id));
      sec.appendChild(item);
    }
    wrap.appendChild(sec);

    /* ---- projects ---- */
    const proj = el("div", "browser-section");
    const ph = el("h3", null, `${ICON.save}<span class="label">Projects</span>`);
    proj.appendChild(ph);
    const saved = store.listLocal().filter((p) => !q || p.name.toLowerCase().includes(q));
    if (!saved.length) {
      proj.appendChild(el("div", "dim", "No saved projects yet — use Save in Settings."));
    }
    for (const s of saved) {
      const item = el("div", "browser-item");
      item.innerHTML = `<div class="icon">🎼</div>` +
        `<div class="meta"><b>${escapeHtml(s.name)}</b><span>${s.channels} channels · ${s.bpm} BPM</span></div>`;
      const acts = el("div", "acts");
      const load = el("button", "btn btn-icon sm", "⤓"); load.dataset.tip = "Load";
      load.addEventListener("click", (e) => {
        e.stopPropagation();
        try {
          store.load(JSON.parse(localStorage.getItem(s.key)));
          store.emit("toast", { msg: `Loaded ${s.name}`, kind: "ok" });
        } catch { store.emit("toast", { msg: "Could not load project", kind: "warn" }); }
      });
      const del = iconBtn(ICON.trash, "Delete", "btn btn-icon sm");
      del.addEventListener("click", (e) => { e.stopPropagation(); store.deleteLocalProject(s.key); render(); });
      acts.append(load, del);
      item.appendChild(acts);
      item.addEventListener("click", () => load.click());
      proj.appendChild(item);
    }
    wrap.appendChild(proj);
  }

  function audition(id) {
    if (!engine.ensure()) { store.emit("toast", { msg: "Audio unavailable", kind: "warn" }); return; }
    const fake = { id: "__audition", instrument: id, volume: 0.9, pan: 0, tone: 1, mute: false, solo: false };
    const anySolo = false;
    engine.setChannelParams(fake, anySolo);
    if (["kick", "snare", "hihat", "ohat", "clap", "tom"].includes(id)) {
      engine.triggerStep(fake, engine.ctx.currentTime, 1);
    } else {
      engine.triggerNote(fake, 60, engine.ctx.currentTime, 0.4, 0.9);
      engine.triggerNote(fake, 64, engine.ctx.currentTime + 0.001, 0.4, 0.9);
    }
  }

  searchField.addEventListener("input", render);
  store.on("projects", render);
  store.on("state:replaced", render);
  render();
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
