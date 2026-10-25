/* ===========================================================================
   Misuc Neu — Web Audio engine
   Real synthesis (no samples, nothing faked): every instrument is built from
   oscillators + noise + filters + envelopes. Each channel gets gain -> pan ->
   lowpass(tone) -> analyser, summed into a master bus with a brickwall-style
   limiter (DynamicsCompressor at -1 dBFS ceiling, mirroring the Qt engine's
   live==export limiter) and a master analyser for metering.

   The Qt build routes through PipeWire instead; the UI contract (triggerStep
   / triggerNote / setChannelParams / master / meters) is identical, so the
   QML port reuses the same view code against the C++ engine.
   =========================================================================== */

import { INSTRUMENTS } from "./state.js";

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

class Engine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.masterAnalyser = null;
    this.limiter = null;
    this.channels = new Map();   // id -> {gain, pan, tone, analyser, peak}
    this._noise = null;
    this.testOsc = null;
  }

  get ready() { return !!this.ctx; }

  /* Lazily create the context — browsers require a user gesture first. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC({ latencyHint: "interactive" });
    this.ctx = ctx;

    // noise buffer (2 s of white noise, reused everywhere)
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this._noise = buf;

    // master chain: sum -> limiter -> analyser -> out
    this.master = ctx.createGain();
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.05;
    this.masterAnalyser = ctx.createAnalyser();
    this.masterAnalyser.fftSize = 1024;
    this.master.connect(this.limiter).connect(this.masterAnalyser).connect(ctx.destination);
    return ctx;
  }

  get sampleRate() { return this.ctx ? this.ctx.sampleRate : 0; }
  get baseLatencyMs() { return this.ctx ? (this.ctx.baseLatency || 0) * 1000 : 0; }

  /* --------------------------- channel chain ---------------------------- */

  channelNode(id) {
    const ctx = this.ensure();
    if (!ctx) return null;
    let node = this.channels.get(id);
    if (!node) {
      const gain = ctx.createGain();
      const pan = ctx.createStereoPanner();
      const tone = ctx.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.value = 20000;
      tone.Q.value = 0.7;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      gain.connect(tone).connect(pan).connect(analyser).connect(this.master);
      node = { gain, pan, tone, analyser, peak: 0, _buf: new Float32Array(analyser.fftSize) };
      this.channels.set(id, node);
    }
    return node;
  }

  dropChannel(id) {
    const n = this.channels.get(id);
    if (n) { try { n.gain.disconnect(); } catch { /* already */ } this.channels.delete(id); }
  }

  setChannelParams(ch) {
    const n = this.channelNode(ch.id);
    if (!n || !this.ctx) return;
    const t = this.ctx.currentTime;
    const anySolo = arguments.length > 1 ? arguments[1] : null;
    const muted = ch.mute || (anySolo && !ch.solo);
    n.gain.gain.setTargetAtTime(muted ? 0 : ch.volume, t, 0.01);
    n.pan.pan.setTargetAtTime(ch.pan, t, 0.01);
    n.tone.frequency.setTargetAtTime(200 + ch.tone * 19800, t, 0.02);
  }

  syncMixer(channels) {
    const anySolo = channels.some((c) => c.solo);
    for (const ch of channels) this.setChannelParams(ch, anySolo);
  }

  setMaster(v) {
    if (this.master && this.ctx)
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01);
  }

  /* ----------------------------- instruments ---------------------------- */

  _env(param, t, peak, attack, decay) {
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    param.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  _noiseSrc(t, dur) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise;
    src.loop = true;
    src.start(t);
    src.stop(t + dur + 0.02);
    return src;
  }

  /* Trigger one drum step (velocity 0..1) at absolute context time. */
  triggerStep(channel, time, vel = 1) {
    const ctx = this.ensure();
    if (!ctx) return;
    const n = this.channelNode(channel.id);
    const t = Math.max(time, ctx.currentTime);
    const out = n.gain;
    const v = 0.25 + vel * 0.75;

    switch (channel.instrument) {
      case "kick": {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(45, t + 0.11);
        this._env(g.gain, t, v, 0.002, 0.3);
        o.connect(g).connect(out);
        o.start(t); o.stop(t + 0.35);
        const c = this._noiseSrc(t, 0.02), cg = ctx.createGain(), hp = ctx.createBiquadFilter();
        hp.type = "highpass"; hp.frequency.value = 2500;
        this._env(cg.gain, t, v * 0.4, 0.001, 0.02);
        c.connect(hp).connect(cg).connect(out);
        break;
      }
      case "snare": {
        const ns = this._noiseSrc(t, 0.2), ng = ctx.createGain(), bp = ctx.createBiquadFilter();
        bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 0.8;
        this._env(ng.gain, t, v * 0.8, 0.001, 0.18);
        ns.connect(bp).connect(ng).connect(out);
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = "triangle";
        o.frequency.setValueAtTime(190, t);
        this._env(og.gain, t, v * 0.5, 0.001, 0.09);
        o.connect(og).connect(out);
        o.start(t); o.stop(t + 0.12);
        break;
      }
      case "hihat":
      case "ohat": {
        const open = channel.instrument === "ohat";
        const ns = this._noiseSrc(t, open ? 0.4 : 0.08);
        const g = ctx.createGain(), hp = ctx.createBiquadFilter();
        hp.type = "highpass"; hp.frequency.value = 7200;
        this._env(g.gain, t, v * 0.5, 0.001, open ? 0.35 : 0.05);
        ns.connect(hp).connect(g).connect(out);
        break;
      }
      case "clap": {
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass"; bp.frequency.value = 1300; bp.Q.value = 1.2;
        const g = ctx.createGain();
        bp.connect(g).connect(out);
        for (let i = 0; i < 3; i++) {
          const ns = this._noiseSrc(t + i * 0.011, 0.05);
          const gg = ctx.createGain();
          this._env(gg.gain, t + i * 0.011, v * 0.45, 0.001, 0.04);
          ns.connect(gg).connect(bp);
        }
        const tail = this._noiseSrc(t + 0.03, 0.2), tg = ctx.createGain();
        this._env(tg.gain, t + 0.03, v * 0.4, 0.002, 0.16);
        tail.connect(tg).connect(bp);
        break;
      }
      case "tom": {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(130, t);
        o.frequency.exponentialRampToValueAtTime(70, t + 0.2);
        this._env(g.gain, t, v * 0.9, 0.002, 0.25);
        o.connect(g).connect(out);
        o.start(t); o.stop(t + 0.3);
        break;
      }
      default:
        this.triggerNote(channel, 60, time, 0.2, vel); // melodic fallback
    }
  }

  /* Trigger a pitched note (piano-roll / melodic channels). */
  triggerNote(channel, pitch, time, durSec, vel = 1) {
    const ctx = this.ensure();
    if (!ctx) return;
    const n = this.channelNode(channel.id);
    const t = Math.max(time, ctx.currentTime);
    const out = n.gain;
    const f = midiToFreq(pitch);
    const v = (0.18 + vel * 0.6);
    const inst = channel.instrument;

    const mk = (type, freq, detune = 0) => {
      const o = ctx.createOscillator();
      o.type = type; o.frequency.value = freq; o.detune.value = detune;
      o.start(t); o.stop(t + durSec + 0.6);
      return o;
    };

    if (inst === "bass") {
      const o = mk("sawtooth", f), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(180 + vel * 500, t);
      lp.frequency.exponentialRampToValueAtTime(140, t + Math.min(durSec, 0.3));
      lp.Q.value = 6;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.01);
      g.gain.setValueAtTime(v, t + durSec * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + durSec + 0.08);
      o.connect(lp).connect(g).connect(out);
    } else if (inst === "lead") {
      const g = ctx.createGain(), lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 2400; lp.Q.value = 1;
      this._env(g.gain, t, v * 0.8, 0.01, durSec + 0.15);
      mk("square", f, -6).connect(lp);
      mk("square", f, 6).connect(lp);
      lp.connect(g).connect(out);
    } else if (inst === "pluck") {
      const o = mk("triangle", f), g = ctx.createGain();
      this._env(g.gain, t, v * 0.9, 0.004, 0.35);
      o.connect(g).connect(out);
    } else if (inst === "pad") {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v * 0.4, t + 0.25);
      g.gain.setValueAtTime(v * 0.4, t + durSec);
      g.gain.exponentialRampToValueAtTime(0.0001, t + durSec + 0.5);
      mk("sawtooth", f, -8).connect(g);
      mk("sawtooth", f, 8).connect(g);
      g.connect(out);
    } else {
      // generic sine voice for anything else pitched
      const o = mk("sine", f), g = ctx.createGain();
      this._env(g.gain, t, v * 0.7, 0.008, durSec + 0.1);
      o.connect(g).connect(out);
    }
  }

  /* Metronome accent/normal click. */
  click(time, accent) {
    const ctx = this.ensure();
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = accent ? 1600 : 1100;
    this._env(g.gain, time, accent ? 0.35 : 0.2, 0.001, 0.04);
    o.connect(g).connect(this.master);
    o.start(time); o.stop(time + 0.06);
  }

  /* 440 Hz test tone — same diagnostic the Qt audio page offers. */
  toggleTestTone(on) {
    const ctx = this.ensure();
    if (!ctx) return false;
    if (on && !this.testOsc) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = 440;
      g.gain.value = 0.08;
      o.connect(g).connect(this.master);
      o.start();
      this.testOsc = { o, g };
      return true;
    }
    if (!on && this.testOsc) {
      this.testOsc.g.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      const ref = this.testOsc;
      setTimeout(() => { try { ref.o.stop(); } catch { /* done */ } }, 200);
      this.testOsc = null;
    }
    return false;
  }

  /* ------------------------------ metering ------------------------------ */

  /* Peak (0..1) for a channel since last call, with quick decay handled by
     callers. Returns null before the engine exists. */
  channelPeak(id) {
    const n = this.channels.get(id);
    if (!n) return 0;
    n.analyser.getFloatTimeDomainData(n._buf);
    let peak = 0;
    for (let i = 0; i < n._buf.length; i += 2) {
      const a = Math.abs(n._buf[i]);
      if (a > peak) peak = a;
    }
    return Math.min(peak, 1.2);
  }

  masterPeak() {
    if (!this.masterAnalyser) return 0;
    if (!this._mbuf) this._mbuf = new Float32Array(this.masterAnalyser.fftSize);
    this.masterAnalyser.getFloatTimeDomainData(this._mbuf);
    let peak = 0;
    for (let i = 0; i < this._mbuf.length; i += 2) {
      const a = Math.abs(this._mbuf[i]);
      if (a > peak) peak = a;
    }
    return Math.min(peak, 1.2);
  }
}

export const engine = new Engine();
export { INSTRUMENTS };
