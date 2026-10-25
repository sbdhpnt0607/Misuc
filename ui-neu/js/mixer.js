/* ===========================================================================
   Misuc Neu — Mixer
   One neumorphic strip per channel: colour bar, name, pan + tone knobs, a
   vertical fader beside a live peak meter, mute/solo. A sticky master strip
   carries the master fader + meter. Meters are driven by the engine's
   per-channel analysers through a single rAF loop.
   =========================================================================== */

import { store } from "./state.js";
import { engine } from "./audio.js";
import { ICON } from "./icons.js";
import { el, iconBtn, attachKnob, attachFader } from "./widgets.js";

export function buildMixer(host) {
  host.innerHTML = "";
  const panel = el("div", "view-panel");

  const toolbar = el("div", "view-toolbar");
  toolbar.appendChild(el("span", "label", "Mixer"));
  const spacer = el("div", "spacer");
  const meterScale = el("span", "chip", "peak · dBFS");
  toolbar.append(spacer, meterScale);

  const well = el("div", "well");
  const scroll = el("div", "mixer-scroll");
  well.appendChild(scroll);

  panel.append(toolbar, well);
  host.appendChild(panel);

  const meters = [];   // {id, fill, peak, led}

  function dbFromGain(g) {
    if (g <= 0.0001) return "-∞";
    const db = 20 * Math.log10(g);
    return (db > 0 ? "+" : "") + db.toFixed(1);
  }

  function buildStrip(ch, isMaster = false) {
    const strip = el("div", "strip" + (isMaster ? " master" : ""));
    const anySolo = () => store.state.channels.some((c) => c.solo);

    const color = el("div", "strip-color");
    color.style.background = ch.color; color.style.color = ch.color;
    const name = el("div", "strip-name", isMaster ? "MASTER" : ch.name);

    const knobs = el("div", "strip-knobs");
    if (!isMaster) {
      const pan = el("div", "knob sm"); pan.appendChild(el("span", "knob-val"));
      attachKnob(pan, { min: -1, max: 1, value: ch.pan, format: (v) => (Math.abs(v) < 0.02 ? "C" : (v < 0 ? "L" : "R") + Math.round(Math.abs(v) * 100)),
        onInput: (v, c) => { ch.pan = v; engine.setChannelParams(ch, anySolo()); if (c) store.commit(); } });
      pan.dataset.tip = "Pan";
      const tone = el("div", "knob sm"); tone.appendChild(el("span", "knob-val"));
      attachKnob(tone, { min: 0, max: 1, value: ch.tone, format: (v) => Math.round(v * 100),
        onInput: (v, c) => { ch.tone = v; engine.setChannelParams(ch, anySolo()); if (c) store.commit(); } });
      tone.dataset.tip = "Tone (lowpass)";
      knobs.append(pan, tone);
    } else {
      const lbl = el("span", "label", "OUT"); lbl.style.padding = "6px";
      knobs.appendChild(lbl);
    }

    const zone = el("div", "strip-fader-zone");
    const meter = el("div", "meter");
    const fill = el("div", "meter-fill");
    meter.appendChild(fill);
    const fader = el("div", "fader");
    fader.append(el("div", "track"), el("div", "fill"), el("div", "cap"));
    attachFader(fader, {
      min: 0, max: 1.2, value: isMaster ? store.state.masterVolume : ch.volume,
      onInput: (v, committing) => {
        if (isMaster) { store.state.masterVolume = Math.min(1, v); engine.setMaster(store.state.masterVolume); }
        else { ch.volume = v; engine.setChannelParams(ch, anySolo()); }
        dbLabel.textContent = dbFromGain(Math.min(1, v));
        if (committing) store.commit();
      },
    });
    zone.append(fader, meter);

    const dbLabel = el("div", "strip-db mono", dbFromGain(isMaster ? store.state.masterVolume : ch.volume));

    const btns = el("div", "strip-btns");
    if (!isMaster) {
      const m = el("button", "btn btn-icon sm" + (ch.mute ? " danger on" : ""), "M");
      m.dataset.tip = "Mute";
      m.addEventListener("click", () => { ch.mute = !ch.mute; m.classList.toggle("danger", ch.mute); m.classList.toggle("on", ch.mute); engine.syncMixer(store.state.channels); store.commit(); });
      const s = el("button", "btn btn-icon sm" + (ch.solo ? " ok on" : ""), "S");
      s.dataset.tip = "Solo";
      s.addEventListener("click", () => { ch.solo = !ch.solo; s.classList.toggle("ok", ch.solo); s.classList.toggle("on", ch.solo); engine.syncMixer(store.state.channels); store.commit(); });
      btns.append(m, s);
    } else {
      const led = el("div", "led danger");
      led.dataset.tip = "Master clip";
      btns.appendChild(led);
      meters.push({ id: "__master_led", led });
    }

    strip.append(color, name, knobs, zone, dbLabel, btns);
    if (!isMaster) strip.addEventListener("pointerdown", () => store.select("channel", ch.id));

    meters.push({ id: isMaster ? "__master" : ch.id, fill, peak: 0, isMaster });
    return strip;
  }

  function render() {
    scroll.innerHTML = "";
    meters.length = 0;
    for (const ch of store.state.channels) scroll.appendChild(buildStrip(ch));
    scroll.appendChild(buildStrip({ color: "#ffffff", id: "__master" }, true));
  }

  store.on("channels", render);
  store.on("state:replaced", render);
  render();

  // metering loop
  let raf;
  const tick = () => {
    for (const m of meters) {
      const raw = m.isMaster ? engine.masterPeak() : engine.channelPeak(m.id);
      // fast attack, slow release
      m.peak = raw > m.peak ? raw : m.peak * 0.90;
      if (m.fill) m.fill.style.height = Math.min(100, m.peak * 100) + "%";
      if (m.led) m.led.classList.toggle("on", m.isMaster && m.peak > 0.99);
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  host._cleanup = () => cancelAnimationFrame(raf);
}
