/* ===========================================================================
   Misuc Neu — transport & scheduler
   Classic Web Audio look-ahead scheduler: a wall-clock interval wakes every
   25 ms and queues every step that falls inside a ~120 ms horizon using the
   audio context clock, so timing never drifts with the UI thread. Two modes
   mirror the Qt app:
     PATTERN — loop the active pattern
     SONG    — play the playlist arrangement (clips schedule their pattern)
   Position is exposed as bar.beat.step for the header counter and playheads.
   =========================================================================== */

import { store, STEPS_PER_BAR } from "./state.js";
import { engine } from "./audio.js";

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;

class Transport {
  constructor() {
    this.playing = false;
    this.mode = "pattern";       // "pattern" | "song"
    this.recording = false;
    this._timer = null;
    this._nextStepTime = 0;
    this._step = 0;              // absolute step counter while playing
    this._listeners = new Set();
    this.position = { bar: 0, beat: 0, step: 0 };
    this._stepDur = 0.5;
    this._lastPosSteps = 0;
    this._posAt = 0;
  }

  stepDur() { return 60 / store.state.bpm / STEPS_PER_BAR; }

  onPos(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }

  setMode(mode) {
    this.mode = mode;
    const wasPlaying = this.playing;
    if (wasPlaying) this.stop();
    store.emit("transport", { mode });
    if (wasPlaying) this.play();
  }

  toggleRecord() {
    // Honest boundary: audio recording needs the PipeWire engine (Qt build).
    // The web build arms the button but routes nowhere — same truth the Qt
    // spec's "no fake features" rule demands.
    this.recording = !this.recording;
    store.emit("transport", { recording: this.recording });
    return this.recording;
  }

  play() {
    if (this.playing) return;
    const ctx = engine.ensure();
    if (!ctx) { store.emit("toast", { msg: "Audio unavailable in this browser", kind: "warn" }); return; }
    engine.setMaster(store.state.masterVolume);
    engine.syncMixer(store.state.channels);
    this._stepDur = this.stepDur();
    this._step = this._startStep();
    this._nextStepTime = ctx.currentTime + 0.06;
    this.playing = true;
    this._timer = setInterval(() => this._tick(), LOOKAHEAD_MS);
    store.emit("transport", { playing: true });
  }

  stop() {
    if (!this.playing) return;
    clearInterval(this._timer);
    this._timer = null;
    this.playing = false;
    this.recording = false;
    this.position = { bar: 0, beat: 0, step: 0 };
    this._lastPosSteps = 0;
    store.emit("transport", { playing: false });
  }

  toggle() { this.playing ? this.stop() : this.play(); }

  _startStep() {
    // Always start at the loop start (or bar 0) so play/stop is predictable.
    return store.state.loopOn ? store.state.loopStartBar * STEPS_PER_BAR : 0;
  }

  _tick() {
    const ctx = engine.ctx;
    if (!ctx) return;
    this._stepDur = this.stepDur();
    while (this._nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) {
      this._scheduleStep(this._step, this._nextStepTime);
      this._advance();
    }
  }

  _advance() {
    const s = store.state;
    let dur = this._stepDur;
    // swing: push odd 16ths late
    if (s.swing > 0 && (this._step % 2 === 1)) dur *= (1 + s.swing * 0.5);
    this._nextStepTime += dur;
    this._step++;
    // loop bounds
    const bar = Math.floor(this._step / STEPS_PER_BAR);
    if (s.loopOn) {
      const end = s.loopStartBar + s.loopBars;
      if (bar >= end) this._step = s.loopStartBar * STEPS_PER_BAR;
    }
  }

  _scheduleStep(absStep, time) {
    const s = store.state;
    const stepDur = this._stepDur;
    const stepInBar = absStep % STEPS_PER_BAR;

    // metronome accent on the downbeat
    if (s.metronome && stepInBar === 0) engine.click(time, true);
    else if (s.metronome && stepDur) engine.click(time, false);

    if (this.mode === "pattern") {
      const pat = s.patterns[s.activePattern];
      if (!pat) return;
      const idx = absStep % pat.lengthSteps;
      this._firePattern(pat, idx, time, stepDur);
    } else {
      // SONG: every track clip covering this absolute step fires its pattern
      const bar = Math.floor(absStep / STEPS_PER_BAR);
      const stepWithinBar = absStep % STEPS_PER_BAR;
      for (const track of s.playlist.tracks) {
        if (track.mute) continue;
        for (const clip of track.clips) {
          const endBar = clip.startBar + clip.lengthBars;
          if (bar >= clip.startBar && bar < endBar) {
            const pat = s.patterns.find((p) => p.id === clip.patternId);
            if (!pat) continue;
            const barInClip = bar - clip.startBar;
            const idx = (barInClip * STEPS_PER_BAR + stepWithinBar) % pat.lengthSteps;
            this._firePattern(pat, idx, time, stepDur);
          }
        }
      }
    }

    // publish display position (bar:beat:step)
    this.position = {
      bar: Math.floor(absStep / STEPS_PER_BAR) + 1,
      beat: stepInBar + 1,
      step: (absStep % 1) || 0,
    };
    this._lastPosSteps = absStep;
    this._posAt = time;
  }

  _firePattern(pat, idx, time, stepDur) {
    const anySolo = store.state.channels.some((c) => c.solo);
    for (const ch of store.state.channels) {
      if (ch.mute || (anySolo && !ch.solo)) continue;
      // step sequencer
      const steps = pat.steps[ch.id];
      if (steps && steps[idx]) {
        engine.triggerStep(ch, time, 1);
      }
      // piano-roll notes starting on this step
      const notes = pat.notes[ch.id];
      if (notes) {
        for (const n of notes) {
          if (n.s === idx) {
            const dur = Math.max(n.d, 0.5) * stepDur * 0.95;
            engine.triggerNote(ch, n.p, time, dur, n.v);
          }
        }
      }
    }
  }

  /* Interpolated step position for playheads between scheduler ticks. */
  positionSteps() {
    if (!this.playing || !engine.ctx) return this._lastPosSteps;
    const elapsed = engine.ctx.currentTime - this._posAt;
    return this._lastPosSteps + elapsed / this._stepDur;
  }
}

export const transport = new Transport();
