/* ===========================================================================
   Misuc Neu — headless boot + interaction test
   Runs the REAL shipped ES modules in a jsdom DOM, stubbing only browser-only
   APIs (Web Audio, canvas 2D). Exercises the actual code paths: app.boot(),
   buildHeader/Rail/views, the store model, the transport scheduler and the
   audio graph. Run with:  node tests/boot.test.mjs   (needs `npm i jsdom`).
   =========================================================================== */

import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} ${extra}`); }
};

/* ----------------------------- browser stubs ----------------------------- */

function mockAudioParam() {
  return {
    value: 0,
    setValueAtTime() { return this; },
    exponentialRampToValueAtTime() { return this; },
    linearRampToValueAtTime() { return this; },
    setTargetAtTime() { return this; },
    cancelScheduledValues() { return this; },
  };
}
function mockNode(extra = {}) {
  const n = { connect: (t) => t, disconnect() {}, ...extra };
  return n;
}
function mockAudioContext() {
  const ctx = {
    currentTime: 0,
    sampleRate: 48000,
    baseLatency: 0.01,
    state: "running",
    destination: mockNode(),
    resume() { this.state = "running"; return Promise.resolve(); },
    createGain: () => mockNode({ gain: mockAudioParam() }),
    createStereoPanner: () => mockNode({ pan: mockAudioParam() }),
    createBiquadFilter: () => mockNode({ frequency: mockAudioParam(), Q: mockAudioParam(), type: "" }),
    createDynamicsCompressor: () => mockNode({
      threshold: mockAudioParam(), knee: mockAudioParam(), ratio: mockAudioParam(),
      attack: mockAudioParam(), release: mockAudioParam(),
    }),
    createOscillator: () => mockNode({
      frequency: mockAudioParam(), detune: mockAudioParam(), type: "", start() {}, stop() {},
    }),
    createBufferSource: () => mockNode({ buffer: null, loop: false, start() {}, stop() {} }),
    createAnalyser: () => mockNode({
      fftSize: 1024,
      getFloatTimeDomainData(arr) { for (let i = 0; i < arr.length; i++) arr[i] = 0; },
    }),
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
  };
  return ctx;
}

function mockCanvasContext() {
  const gradient = { addColorStop() {} };
  const noop = () => {};
  return new Proxy({
    canvas: null,
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    measureText: () => ({ width: 10 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    save: noop, restore: noop,
  }, {
    get(t, prop) {
      if (prop in t) return t[prop];
      // any unknown method -> no-op; any unknown prop -> undefined (assignable)
      return noop;
    },
    set() { return true; },
  });
}

const dom = new JSDOM(readFileSync(join(root, "index.html"), "utf8"), {
  url: "http://localhost/",
  pretendToBeVisual: true,
});
const { window } = dom;

// canvas 2D
window.HTMLCanvasElement.prototype.getContext = function () {
  const c = mockCanvasContext(); c.canvas = this; return c;
};
// element sizing (jsdom reports 0; give canvases a box so layout math is sane)
Object.defineProperty(window.HTMLElement.prototype, "getBoundingClientRect", {
  value() { return { width: 800, height: 400, top: 0, left: 0, right: 800, bottom: 400, x: 0, y: 0 }; },
  configurable: true,
});
window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
window.AudioContext = mockAudioContext;
window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
window.cancelAnimationFrame = (id) => clearTimeout(id);
if (!window.PointerEvent) window.PointerEvent = window.MouseEvent;
window.HTMLElement.prototype.setPointerCapture = function () {};
window.HTMLElement.prototype.releasePointerCapture = function () {};

// publish as globals so the ES modules resolve them (some Node globals such as
// `navigator` are getter-only — defineProperty + try/catch keeps it robust)
for (const k of ["window", "document", "navigator", "localStorage", "getComputedStyle",
  "HTMLElement", "HTMLCanvasElement", "Element", "Node", "Event", "MouseEvent",
  "requestAnimationFrame", "cancelAnimationFrame", "ResizeObserver", "AudioContext",
  "Blob", "FileReader", "performance", "CustomEvent", "KeyboardEvent"]) {
  if (window[k] === undefined) continue;
  try { globalThis[k] = window[k]; }
  catch {
    try { Object.defineProperty(globalThis, k, { value: window[k], configurable: true, writable: true }); }
    catch { /* getter-only Node global (e.g. navigator) — leave Node's own */ }
  }
}
globalThis.confirm = () => true;

/* ------------------------------- run boot -------------------------------- */

console.log("\nMisuc Neu — boot + interaction test\n");

const errors = [];
process.on("uncaughtException", (e) => errors.push(e));
process.on("unhandledRejection", (e) => errors.push(e));

await import(join(root, "js", "app.js"));

const doc = window.document;
const $ = (s) => doc.querySelector(s);
const $$ = (s) => [...doc.querySelectorAll(s)];

ok("app boots without throwing", errors.length === 0, errors.map(String).join("; "));
ok("header built (brand + transport + play button)", !!$("#brand, .brand") && !!$("#btn-play"));
ok("transport play button exists", !!$("#btn-play"));
ok("BPM stepper present with demo tempo", !!$(".stepper input"));

const railBtns = $$(".rail-btn");
ok("rail has 6 workspace buttons + inspector toggle", railBtns.length >= 7, `got ${railBtns.length}`);

// default view = channel rack with the 8 demo channels
const rackRows = $$(".rack-row");
ok("channel rack rendered 8 demo channels", rackRows.length === 8, `got ${rackRows.length}`);
ok("step cells rendered (16-step demo pattern)", $$(".step-cell").length >= 8 * 16);

/* ------------------------- model + interaction --------------------------- */

const { store } = await import(join(root, "js", "state.js"));
const { transport } = await import(join(root, "js", "transport.js"));
const { engine } = await import(join(root, "js", "audio.js"));

ok("demo project loaded with channels", store.state.channels.length === 8);
ok("demo project has 3 patterns", store.state.patterns.length === 3);
ok("demo playlist has clips", store.state.playlist.tracks.some((t) => t.clips.length > 0));

// toggle a step through the real store API
const ch0 = store.state.channels[0];
const pat = store.activePatternObj();
const before = pat.steps[ch0.id][0];
store.toggleStep(pat.id, ch0.id, 0);
ok("toggleStep flips a step", pat.steps[ch0.id][0] !== before);
ok("undo reverts the step", (store.undo(), store.activePatternObj().steps[store.state.channels[0].id][0] === before));
store.redo();

// add + remove a channel
const n0 = store.state.channels.length;
const added = store.addChannel("pluck", "Test Pluck");
ok("addChannel grows the rack", store.state.channels.length === n0 + 1);
ok("new channel gets a step lane in every pattern",
  store.state.patterns.every((p) => Array.isArray(p.steps[added.id])));
store.removeChannel(added.id);
ok("removeChannel shrinks the rack", store.state.channels.length === n0);

// transport: play must engage the engine and set playing
engine.ensure();
transport.play();
ok("transport.play sets playing + creates audio ctx", transport.playing === true && engine.ready === true);
ok("channel audio node created on demand", !!engine.channelNode(store.state.channels[0].id));
engine.triggerStep(store.state.channels[0], engine.ctx.currentTime, 1);
ok("triggerStep runs without throwing", true);
transport.stop();
ok("transport.stop clears playing", transport.playing === false);

// theme + accent
const { setTheme, setAccent } = await import(join(root, "js", "header.js"));
setTheme("light");
ok("setTheme('light') flips data-theme", doc.documentElement.dataset.theme === "light");
setAccent("cyan");
ok("setAccent('cyan') flips data-accent", doc.documentElement.dataset.accent === "cyan");
setTheme("dark");

// persistence through the real localStorage path
store.state.name = "Test Song";
const key = store.saveLocalProject();
ok("saveLocalProject writes a shelf entry", store.listLocal().some((p) => p.key === key));
store.deleteLocalProject(key);
ok("deleteLocalProject removes it", !store.listLocal().some((p) => p.key === key));

// view switching: click each rail button, confirm its view builds
const viewIds = ["rack", "roll", "playlist", "mixer", "browser", "settings"];
for (const id of viewIds) {
  const btn = railBtns.find((b) => b.dataset.view === id);
  btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const host = doc.querySelector("#view-" + id);
  ok(`view '${id}' builds and activates`, !!host && host.classList.contains("active"));
}
ok("mixer rendered strips for all channels + master",
  doc.querySelectorAll("#view-mixer .strip").length >= store.state.channels.length + 1);
ok("settings rendered cards", doc.querySelectorAll("#view-settings .settings-card").length >= 4);
ok("browser listed instruments", doc.querySelectorAll("#view-browser .browser-item").length >= 8);

ok("no errors during interactions", errors.length === 0, errors.map(String).join("; "));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
