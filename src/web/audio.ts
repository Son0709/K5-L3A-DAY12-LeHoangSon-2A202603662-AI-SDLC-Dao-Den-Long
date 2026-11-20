// Procedural audio (Web Audio). Everything is synthesised at runtime: no sound files, so nothing to license.
// Browsers only allow audio after a user gesture, so call unlock() from a key or click handler.
export type Sfx = "pickup" | "light" | "pulse" | "hit" | "jump" | "dash" | "win" | "lose" | "spawn" | "countdown";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicTimer: number | undefined;
let volume = 0.6;

const NOTES = [220, 261.63, 293.66, 329.63, 392, 440, 523.25]; // A minor pentatonic-ish, warm and calm

export function setVolume(v: number) {
  volume = v;
  if (master && ctx) master.gain.setTargetAtTime(v * 0.9, ctx.currentTime, 0.02);
}

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume * 0.9;
    master.connect(ctx.destination);
    startMusic();
  }
  if (ctx.state === "suspended") void ctx.resume();
}

function tone(freq: number, endFreq: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (endFreq !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur: number, filterFreq: number, vol: number, delay = 0) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + delay;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = buf;
  f.type = "bandpass"; f.frequency.value = filterFreq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export function sfx(name: Sfx) {
  if (!ctx || volume <= 0) return;
  switch (name) {
    case "pickup": tone(660, 990, 0.09, "sine", 0.25); break;
    case "light": [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, f, 0.35, "triangle", 0.22, i * 0.09)); break;
    case "pulse": tone(520, 180, 0.45, "sine", 0.3); noise(0.4, 1800, 0.18); break;
    case "hit": tone(150, 60, 0.28, "square", 0.22); noise(0.18, 400, 0.2); break;
    case "jump": tone(300, 620, 0.12, "sine", 0.2); break;
    case "dash": noise(0.16, 2500, 0.22); tone(700, 300, 0.14, "sawtooth", 0.06); break;
    case "win": [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, f, 0.5, "triangle", 0.25, i * 0.14)); break;
    case "lose": [392, 311.13, 233.08].forEach((f, i) => tone(f, f * 0.97, 0.55, "sine", 0.28, i * 0.28)); break;
    case "spawn": tone(110, 70, 0.4, "sawtooth", 0.08); tone(113, 72, 0.4, "sawtooth", 0.06); break;
    case "countdown": tone(880, 880, 0.06, "sine", 0.22); break;
  }
}

function startMusic() {
  if (!ctx || !master || musicTimer !== undefined) return;
  // slow pad: two detuned triangle oscillators with a gentle tremolo
  const pad = (f: number) => {
    const o = ctx!.createOscillator(), g = ctx!.createGain(), lfo = ctx!.createOscillator(), lg = ctx!.createGain();
    o.type = "triangle"; o.frequency.value = f; g.gain.value = 0.05;
    lfo.frequency.value = 0.15; lg.gain.value = 0.02;
    lfo.connect(lg).connect(g.gain);
    o.connect(g).connect(master!);
    o.start(); lfo.start();
  };
  pad(110); pad(164.81); pad(220.5);
  let step = 0;
  musicTimer = window.setInterval(() => {
    if (!ctx || ctx.state !== "running" || volume <= 0) return;
    const n = NOTES[(step * 3 + (step % 4 === 3 ? 2 : 0)) % NOTES.length];
    tone(n, n, 1.6, "sine", 0.07);
    if (step % 4 === 0) tone(n / 2, n / 2, 2.4, "triangle", 0.05);
    step++;
  }, 900);
}
