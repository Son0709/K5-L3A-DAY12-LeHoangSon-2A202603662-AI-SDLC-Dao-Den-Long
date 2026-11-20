// Browser client: game flow (menu -> night intro -> play -> result -> next night -> dawn), pause, settings, HUD,
// audio and input. All rules live in src/sim (shared with headless); this file only reads sim.view().
import { REVISION as THREE_REVISION } from "three";
import { createSim, NO_INPUT, type InputState, type OutLine } from "../sim/sim.ts";
import { mulberry32 } from "../sim/rng.ts";
import { parseScenario } from "../sim/parse.ts";
import { DT, T } from "../sim/tuning.ts";
import { createWorld } from "./scene.ts";
import * as audio from "./audio.ts";
import { loadSettings, saveSettings } from "./settings.ts";

const $ = <E extends HTMLElement>(id: string) => document.getElementById(id) as E;
const world = createWorld(document.body);
document.body.prepend(world.domElement);

type Phase = "menu" | "intro" | "playing" | "paused" | "result" | "dawn";
const NIGHTS = [
  { name: "Đảo Bến", quote: "Mây à, sương đen đã nuốt hết ánh sáng của đảo. Gom đom đóm, thắp lại năm ngọn đèn lồng trước khi trời sáng. Bóng Mực sợ ánh đèn, đừng để chúng chạm vào cháu." },
  { name: "Đảo Cau", quote: "Hai hòn đảo nối nhau bằng một cây cầu tre không lan can, nhìn xuống là biển mây đấy. Bục vàng sẽ tung cháu sang đảo bên kia. Coi chừng Gió Lạc, nó thích cướp đom đóm của người mang nhiều." },
  { name: "Đảo Chuông", quote: "Ba tầng đảo và bảy ngọn đèn. Cứ nửa phút lại có gió lớn, lá bay trước hai giây là dấu hiệu. Đi lối dốc, hoặc nhảy bục để lên tầng cao nhất. Ông tin ở cháu." },
];
const REASONS: Record<string, string> = { dawn: "Trời sáng mất rồi, sương đen vẫn còn trên đảo.", no_flames: "Ngọn lửa nhỏ của Mây đã tắt." };

let phase: Phase = "menu";
let night = 1;
let totalScore = 0;
let nightScore = 0;
let lastReason = "";
let settingsFrom: "menu" | "paused" = "menu";
let sim = createSim(parseScenario(undefined), 1, 1, () => {});
let k = 0;
let camYaw = 0;
let lastSecond = -1;
const settings = loadSettings();
audio.setVolume(settings.volume);
world.loadNight(sim.map);

// ---------------------------------------------------------------- input
const held = new Set<string>();
const latch = { jump: false, interact: false, pulse: false, dash: false };
const GAME_KEYS = new Set(["Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Escape", "Tab"]);

window.addEventListener("keydown", (e) => {
  audio.unlock();
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  if (e.repeat) return;
  held.add(e.code);
  if (phase === "playing") {
    if (e.code === "Space") { latch.jump = true; if (sim.view().player.grounded) audio.sfx("jump"); }
    if (e.code === "KeyE") latch.interact = true;
    if (e.code === "KeyF") latch.pulse = true;
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") latch.dash = true;
    if (e.code === "KeyR") beginNight(night);
  }
  if (e.code === "Escape" || e.code === "KeyP") togglePause();
  if (e.code === "Space" || e.code === "Enter") advance();
});
window.addEventListener("keyup", (e) => held.delete(e.code));
window.addEventListener("blur", () => { held.clear(); if (phase === "playing") togglePause(); });
let dragging = false;
world.domElement.addEventListener("pointerdown", () => { audio.unlock(); dragging = phase === "playing"; });
window.addEventListener("pointerup", () => (dragging = false));
window.addEventListener("pointermove", (e) => { if (dragging) camYaw += e.movementX * 0.3 * settings.sensitivity; });

function readInput(): InputState {
  const mx = (held.has("KeyD") ? 1 : 0) - (held.has("KeyA") ? 1 : 0);
  const mz = (held.has("KeyS") ? 1 : 0) - (held.has("KeyW") ? 1 : 0); // W = forward = -z at yaw 0
  return {
    mx, mz, yaw: camYaw,
    jump: held.has("Space") || latch.jump,
    interact: held.has("KeyE") || latch.interact,
    pulse: held.has("KeyF") || latch.pulse,
    dash: held.has("ShiftLeft") || held.has("ShiftRight") || latch.dash,
    pause: false, // pausing is handled by the client (the step loop simply stops)
  };
}
function worldDir(i: InputState) {
  const th = (i.yaw * Math.PI) / 180;
  let x = i.mx * Math.cos(th) + i.mz * Math.sin(th);
  let z = -i.mx * Math.sin(th) + i.mz * Math.cos(th);
  const len = Math.hypot(x, z);
  if (len > 1) { x /= len; z /= len; }
  return { x, z };
}

// ---------------------------------------------------------------- HUD
function toast(text: string, kind: "good" | "bad" = "good") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = text;
  $("toasts").appendChild(el);
  setTimeout(() => el.remove(), 2400);
}
function flashHurt() {
  const h = $("hurt");
  h.classList.add("on");
  setTimeout(() => h.classList.remove("on"), 250);
}
const fmtTime = (s: number) => `${Math.floor(Math.ceil(s) / 60)}:${String(Math.ceil(s) % 60).padStart(2, "0")}`;

function onEvent(line: OutLine) {
  const e = line as { name: string; data: Record<string, unknown> };
  const v = sim.view();
  switch (e.name) {
    case "mote_picked": audio.sfx("pickup"); break;
    case "deposit": toast(`Nạp ${e.data.amount} đom đóm vào đèn ${e.data.lantern_id} (+${Number(e.data.amount) * T.score.per_mote})`); break;
    case "lantern_lit": audio.sfx("light"); toast(`Đèn ${e.data.lantern_id} đã sáng! +${T.score.per_lantern}`); break;
    case "pulse": {
      audio.sfx("pulse");
      world.addPulse(v.player.x, v.player.y, v.player.z, T.pulse_radius);
      const n = (e.data.stunned_ids as string[]).length;
      if (n > 0) toast(`Mây tỏa sáng, ${n} Bóng Mực bị xua đi! +${n * T.score.per_stun}`);
      break;
    }
    case "dash": audio.sfx("dash"); break;
    case "player_hit": {
      audio.sfx("hit"); flashHurt();
      const d = Number(e.data.dropped), lost = Number(e.data.lost ?? 0);
      toast(e.data.by === "fall" ? `Mây rơi khỏi đảo! Mất ${lost} đom đóm` : `Bóng Mực chạm vào Mây! Còn ${e.data.flames} ngọn lửa${d > 0 ? `, rơi ${d} đom đóm` : ""}`, "bad");
      break;
    }
    case "shade_spawned": audio.sfx("spawn"); toast("Một Bóng Mực mới trôi ra từ sương…", "bad"); break;
    case "drifter_steal": toast(`Gió Lạc cướp ${e.data.amount} đom đóm!`, "bad"); break;
    case "drifter_drop": toast(`Gió Lạc làm rơi ${e.data.amount} đom đóm`); break;
    case "charm_picked": audio.sfx("light"); toast("Bùa Gió! Chạy nhanh hơn, lướt không hồi chiêu"); break;
    case "game_over": lastReason = String(e.data.reason); break;
  }
}

// The HUD is a DOM layer over the WebGL canvas. Touching the DOM every frame forces layout and repaint of that layer (it cost the
// benchmark about 40% of its frame rate and gave 30 ms hitches), so every write goes through these helpers and only happens when
// the value actually changed.
const domCache = new Map<string, string>();
const same = (key: string, value: string) => (domCache.get(key) === value ? true : (domCache.set(key, value), false));
const setHtml = (id: string, html: string) => { if (!same(`h:${id}`, html)) $(id).innerHTML = html; };
const setText = (id: string, text: string) => { if (!same(`t:${id}`, text)) $(id).textContent = text; };
const setShow = (id: string, show: boolean, display = "block") => { if (!same(`d:${id}`, String(show))) $(id).style.display = show ? display : "none"; };
const setClass = (id: string, cls: string, on: boolean) => { if (!same(`c:${id}:${cls}`, String(on))) $(id).classList.toggle(cls, on); };

function setCd(id: string, progress: number, ready: boolean, label: string, nope = false) {
  const el = $(id);
  const pv = String(Math.round(Math.max(0, Math.min(1, progress)) * 100) / 100);
  if (!same(`p:${id}`, pv)) el.style.setProperty("--p", pv);
  setClass(id, "ready", ready);
  setClass(id, "nope", nope);
  if (!same(`l:${id}`, label)) el.querySelector("b")!.textContent = label;
}

function updateHud(v: ReturnType<typeof sim.view>) {
  const p = v.player;
  setHtml("flames", Array.from({ length: T.flames }, (_, i) => `<span class="flame${i < p.flames ? "" : " off"}">●</span>`).join(""));
  setShow("charmBadge", p.charmLeft > 0);
  if (p.charmLeft > 0) setText("charmT", `${p.charmLeft.toFixed(1)}s`);

  setText("clock", fmtTime(v.timeLeft));
  setClass("clock", "danger", v.timeLeft <= 30);
  const lit = v.lanterns.filter((l) => l.lit).length;
  setText("lanternCount", `${lit}/${v.lanterns.length}`);
  setHtml("lanterns", v.lanterns.map((l) => `<span class="dot${l.lit ? " on" : ""}"></span>`).join(""));
  setText("score", `${v.score}`);
  setText("total", nightsWonLabel());

  setHtml("moteBar", Array.from({ length: p.capacity }, (_, i) => `<div class="cell${i < p.carried ? " on" : ""}"></div>`).join("") + `<span class="cap">${p.carried}/${p.capacity}</span>`);

  const dashReady = p.dashCooldownLeft <= 0 || p.charmLeft > 0;
  setCd("cdDash", dashReady ? 1 : 1 - p.dashCooldownLeft / T.dash_cooldown_s, dashReady, dashReady ? "Shift" : `${p.dashCooldownLeft.toFixed(1)}s`);
  const pulseReady = p.pulseCooldownLeft <= 0 && p.carried >= T.pulse_cost;
  setCd("cdPulse", p.pulseCooldownLeft > 0 ? 1 - p.pulseCooldownLeft / T.pulse_cooldown_s : 1, pulseReady,
    p.pulseCooldownLeft > 0 ? `${p.pulseCooldownLeft.toFixed(1)}s` : p.carried >= T.pulse_cost ? "F" : `cần ${T.pulse_cost}`, p.pulseCooldownLeft <= 0 && p.carried < T.pulse_cost);

  setShow("windBanner", v.wind.warning || v.wind.active);
  setClass("windBanner", "on", v.wind.active);
  setText("windBanner", v.wind.active ? "Gió đang thổi, bám chắc!" : "Gió mạnh sắp tới…");

  // interaction prompt for the nearest unlit lantern in reach
  let near: (typeof v.lanterns)[number] | undefined, nd = Infinity;
  for (const l of v.lanterns) {
    const d = Math.hypot(l.x - p.x, l.z - p.z);
    if (!l.lit && d <= T.interact_radius && d < nd) { near = l; nd = d; }
  }
  const showPrompt = phase === "playing" && !!near;
  setShow("prompt", showPrompt);
  if (showPrompt && near) setHtml("prompt", p.carried > 0 ? `<kbd>E</kbd> Nạp ánh sáng (${near.deposited}/${T.lantern_cost})` : `Đèn cần ${T.lantern_cost - near.deposited} đom đóm, hãy đi gom thêm`);

  // arrow to the nearest unlit lantern when it is off screen (moved with transform only, which does not trigger layout)
  let target: (typeof v.lanterns)[number] | undefined, td = Infinity;
  for (const l of v.lanterns) {
    const d = Math.hypot(l.x - p.x, l.z - p.z);
    if (!l.lit && d < td) { target = l; td = d; }
  }
  let arrowOn = false;
  if (phase === "playing" && target) {
    const s = world.project(target.x, target.y + 3, target.z);
    if (!(!s.behind && Math.abs(s.x) < 0.92 && Math.abs(s.y) < 0.86)) {
      let dx = s.x, dy = s.y;
      if (s.behind) { dx = -dx; dy = -dy; }
      const W = window.innerWidth, H = window.innerHeight, m = 70;
      const len = Math.hypot(dx, dy) || 1;
      const sx = dx / len, sy = -dy / len; // pixel space (y down)
      const kx = Math.abs(sx) > 1e-6 ? (W / 2 - m) / Math.abs(sx) : Infinity, ky = Math.abs(sy) > 1e-6 ? (H / 2 - m) / Math.abs(sy) : Infinity;
      const kk = Math.min(kx, ky);
      arrowOn = true;
      const tf = `translate(${Math.round(W / 2 + sx * kk - 14)}px, ${Math.round(H / 2 + sy * kk - 17)}px) rotate(${Math.atan2(sx, -sy).toFixed(2)}rad)`;
      if (!same("tf:arrow", tf)) $("arrow").style.transform = tf;
    }
  }
  setShow("arrow", arrowOn);

  // countdown beeps in the last 10 seconds
  const sec = Math.ceil(v.timeLeft);
  if (phase === "playing" && sec <= 10 && sec !== lastSecond && sec > 0) audio.sfx("countdown");
  lastSecond = sec;
}
const nightsWonLabel = () => (totalScore > 0 ? `Tổng: ${totalScore + sim.view().score}` : "");

// ---------------------------------------------------------------- overlays
const S = T.score;
function showCard(html: string) { $("card").innerHTML = html; $("overlay").classList.remove("hidden"); }
function hideCard() { $("overlay").classList.add("hidden"); }
const btn = (act: string, label: string, alt = false) => `<button data-act="${act}"${alt ? ' class="alt"' : ""}>${label}</button>`;

function showMenu() {
  phase = "menu";
  $("hud").classList.add("hidden");
  showCard(`
    <h1>Đảo Đèn Lồng</h1>
    <h2>Ba đêm để thắp lại ánh sáng cho biển mây</h2>
    <div class="keys">
      <kbd>W A S D</kbd><span>đi lại</span>
      <kbd>Space</kbd><span>nhảy</span>
      <kbd>Shift</kbd><span>lướt (14 m/s, hồi 1.5 s)</span>
      <kbd>E</kbd><span>nạp đom đóm vào đèn gần nhất</span>
      <kbd>F</kbd><span>tỏa sáng, xua Bóng Mực (tốn ${T.pulse_cost} đom đóm)</span>
      <kbd>← →</kbd><span>xoay camera (hoặc kéo chuột)</span>
      <kbd>Esc</kbd><span>tạm dừng</span>
    </div>
    <p>Giữ cho đảo sáng tới bình minh: đèn hao dầu dần, hãy châm thêm đom đóm. Điểm: +${S.per_mote}/đom đóm nạp, +${S.per_lantern}/lần thắp đầu, +${S.per_relight}/lần thắp lại, +${S.per_stun}/Bóng Mực bị xua. Thắng ở bình minh thêm +${S.per_lantern_dawn} và số dầu mỗi đèn còn sáng, +${S.per_flame_left}/ngọn lửa còn lại.</p>
    <div class="menu">${btn("start", "Bắt đầu")}${btn("settings", "Cài đặt", true)}</div>`);
}

function showIntro(n: number) {
  phase = "intro";
  night = n;
  $("hud").classList.add("hidden");
  const d = NIGHTS[n - 1];
  showCard(`
    <h2>Đêm ${n}</h2>
    <h1>${d.name}</h1>
    <div class="quote">“${d.quote}”<br><span style="opacity:.7">— Ông Đăng</span></div>
    <div class="cta">Nhấn Space để bắt đầu</div>`);
}

function showPause() {
  phase = "paused";
  showCard(`
    <h1>Tạm dừng</h1>
    <h2>Đêm ${night} · ${NIGHTS[night - 1].name}</h2>
    <div class="menu">${btn("resume", "Tiếp tục")}${btn("restart", "Chơi lại Đêm", true)}${btn("settings", "Cài đặt", true)}${btn("menu", "Về menu", true)}</div>`);
}

function showSettings() {
  showCard(`
    <h1>Cài đặt</h1>
    <div class="row"><span>Âm lượng</span><input id="vol" type="range" min="0" max="100" value="${Math.round(settings.volume * 100)}"><span id="volv">${Math.round(settings.volume * 100)}%</span></div>
    <div class="row"><span>Độ nhạy chuột</span><input id="sens" type="range" min="20" max="200" value="${Math.round(settings.sensitivity * 100)}"><span id="sensv">${Math.round(settings.sensitivity * 100)}%</span></div>
    <p style="opacity:.7">Cài đặt được lưu lại cho lần chơi sau.</p>
    <div class="menu">${btn("back", "Quay lại")}</div>`);
  $<HTMLInputElement>("vol").addEventListener("input", (e) => {
    settings.volume = Number((e.target as HTMLInputElement).value) / 100;
    $("volv").textContent = `${Math.round(settings.volume * 100)}%`;
    audio.setVolume(settings.volume); audio.unlock(); audio.sfx("pickup");
    saveSettings(settings);
  });
  $<HTMLInputElement>("sens").addEventListener("input", (e) => {
    settings.sensitivity = Number((e.target as HTMLInputElement).value) / 100;
    $("sensv").textContent = `${Math.round(settings.sensitivity * 100)}%`;
    saveSettings(settings);
  });
}

function showResult() {
  phase = "result";
  const v = sim.view();
  const won = v.state === "won";
  const lit = v.lanterns.filter((l) => l.lit).length;
  if (won) {
    totalScore += v.score;
    if (night < 3) {
      showCard(`<h1>Đêm ${night} hoàn thành!</h1><h2>${NIGHTS[night - 1].name} đã sáng rực.</h2>
        <p>Điểm đêm này: <span class="big">${v.score}</span></p><p>Tổng điểm: <b>${totalScore}</b> · Ngọn lửa còn lại ${v.player.flames} · Thời gian còn ${fmtTime(v.timeLeft)}</p>
        <div class="menu">${btn("next", `Đêm kế tiếp: ${NIGHTS[night].name}`)}${btn("menu", "Về menu", true)}</div>`);
    } else {
      showCard(`<h1>Đêm 3 hoàn thành!</h1><h2>Chỉ còn một chút nữa là bình minh…</h2>
        <p>Điểm đêm này: <span class="big">${v.score}</span></p>
        <div class="menu">${btn("dawn", "Đón Bình Minh")}</div>`);
    }
  } else {
    showCard(`<h1>Đêm chưa kết thúc…</h1><h2>${REASONS[lastReason] ?? "Mây đã thua đêm nay."}</h2>
      <p>Đèn đã thắp ${lit}/${v.lanterns.length} · Điểm ${v.score}</p>
      <div class="menu">${btn("retry", `Chơi lại Đêm ${night}`)}${btn("menu", "Về menu", true)}</div>`);
  }
}

function showDawn() {
  phase = "dawn";
  $("hud").classList.add("hidden");
  showCard(`<h1>Bình Minh</h1><h2>Ba hòn đảo đã sáng đèn. Biển mây ấm lên trong ánh vàng.</h2>
    <p>Tổng điểm</p><p><span class="big" style="font-size:48px">${totalScore}</span></p>
    <div class="menu">${btn("menu", "Về menu")}</div>`);
  audio.sfx("win");
}

// ---------------------------------------------------------------- flow
function prepareNight(n: number) {
  night = n;
  const seed = (Date.now() ^ Math.floor(Math.random() * 2 ** 32)) >>> 0; // seed chosen here; the sim itself stays pure
  lastReason = "";
  sim = createSim(parseScenario(undefined), seed, n, onEvent);
  k = 0;
  lastSecond = -1;
  latch.jump = latch.interact = latch.pulse = latch.dash = false;
  world.loadNight(sim.map);
  world.reset();
  $("toasts").innerHTML = "";
  camYaw = 180; // camera behind Mây, who starts facing +Z (towards the first lantern)
}
function beginNight(n: number) { prepareNight(n); phase = "playing"; $("hud").classList.remove("hidden"); hideCard(); }
function newGame() { totalScore = 0; prepareNight(1); showIntro(1); }

function togglePause() {
  if (phase === "playing") showPause();
  else if (phase === "paused") { phase = "playing"; hideCard(); }
  else if ($("card").querySelector("#vol")) act("back"); // settings screen: Esc goes back
}
function advance() {
  if (phase === "menu") act("start");
  else if (phase === "intro") { phase = "playing"; $("hud").classList.remove("hidden"); hideCard(); }
  else if (phase === "result") act(sim.view().state === "won" ? (night < 3 ? "next" : "dawn") : "retry");
}

function act(a: string | undefined) {
  audio.unlock();
  switch (a) {
    case "start": newGame(); break;
    case "settings": settingsFrom = phase === "paused" ? "paused" : "menu"; showSettings(); break;
    case "back": if (settingsFrom === "paused") showPause(); else showMenu(); break;
    case "resume": togglePause(); break;
    case "restart": case "retry": beginNight(night); break;
    case "next": prepareNight(night + 1); showIntro(night); break;
    case "dawn": showDawn(); break;
    case "menu": prepareNight(1); showMenu(); break;
  }
}
$("card").addEventListener("click", (e) => act((e.target as HTMLElement).closest<HTMLElement>("[data-act]")?.dataset.act));

// ---------------------------------------------------------------- main loop (fixed 60 Hz logic step)
let acc = 0, last = performance.now(), t = 0;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now; t += dt;
  if (held.has("ArrowLeft")) camYaw -= 110 * settings.sensitivity * dt;
  if (held.has("ArrowRight")) camYaw += 110 * settings.sensitivity * dt;

  const input = readInput();
  if (phase === "playing") {
    acc += dt;
    while (acc >= DT && sim.isPlaying()) {
      sim.step(k++, readInput());
      latch.jump = latch.interact = latch.pulse = latch.dash = false;
      acc -= DT;
    }
    if (!sim.isPlaying()) {
      const won = sim.view().state === "won";
      audio.sfx(won ? "win" : "lose");
      showResult();
    }
  } else acc = 0;
  const v = sim.view();
  world.update(v, T.safe_radius, t, dt, camYaw, phase === "playing" ? worldDir(input) : { x: 0, z: 0 }, phase !== "menu");
  if (phase === "playing" || phase === "paused" || phase === "result") updateHud(v);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- benchmark scene (Ticket-04), driven by scripts/bench.ts
// ?bench=1&seed=42&duration=30: Night 1 with full lighting and effects, 200 wandering shades, 100 motes, L1-L3 lit with fuel 100;
// no damage, pickups, fuel burn, spawns or end of night; Mây stands still at the origin; the camera orbits at r=30 m, y=15 m,
// counter-clockwise, 15 s per lap. 3 s warm-up (not measured), then `duration` s measured.
function startBench(seed: number, durationS: number) {
  hideCard();
  $("hud").classList.remove("hidden");
  const rng = mulberry32(seed);
  const rot = rng() * Math.PI * 2;
  // golden-angle spiral: evenly spread over the island, rotated by the seed
  const spread = (n: number, shift: number) => Array.from({ length: n }, (_, i) => {
    const r = 38 * Math.sqrt((i + 0.5) / n), a = rot + shift + i * 2.399963;
    return [r * Math.cos(a), r * Math.sin(a)] as const;
  });
  const sc = parseScenario(undefined);
  sc.randomMotes = false; sc.randomShades = false; sc.randomDrifters = false;
  sc.shades = spread(Number(params.get("shades") ?? 200), 0).map(([x, z]) => ({ pos: [x, 1, z] as [number, number, number] })); // ?shades=N is for diagnostics only
  sc.motes = spread(100, 1.7).map(([x, z]) => ({ pos: [x, 0, z] as [number, number, number] }));
  sc.lanterns = ["L1", "L2", "L3"].map((id) => ({ id, lit: true, fuel: 100 }));
  sc.bench = true;
  sim = createSim(sc, seed, 1, () => {});
  world.loadNight(sim.map);
  world.reset();
  phase = "playing";

  const WARMUP_MS = 3000;
  const dts: number[] = [];
  const cpu = { sim: [] as number[], render: [] as number[], hud: [] as number[] }; // main-thread cost per frame, for diagnosing
  let t0 = -1, prevNow = 0, acc = 0, step = 0;
  const w = window as unknown as { __bench?: Record<string, unknown> };
  const finish = () => {
    const n = dts.length, sum = dts.reduce((a, b) => a + b, 0);
    const desc = [...dts].sort((a, b) => b - a);
    const kLow = Math.max(1, Math.ceil(0.01 * n));
    const worst = desc.slice(0, kLow).reduce((a, b) => a + b, 0) / kLow;
    const asc = [...dts].sort((a, b) => a - b);
    const gl = document.createElement("canvas").getContext("webgl");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    w.__bench = {
      done: true, frames: n, avg_fps: (1000 * n) / sum, p1_low_fps: 1000 / worst, frame_ms_p95: asc[Math.max(0, Math.ceil(0.95 * n) - 1)],
      gl_renderer: gl && ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "unknown", three: THREE_REVISION,
      cpu_ms: Object.fromEntries(Object.entries(cpu).map(([k, a]) => {
        const s = [...a].sort((x, y) => x - y);
        return [k, { avg: a.reduce((x, y) => x + y, 0) / Math.max(1, a.length), p99: s[Math.floor(0.99 * s.length)] ?? 0, max: s[s.length - 1] ?? 0 }];
      })),
      min_frame_ms: Math.min(...dts),
    };
  };
  const bframe = (now: number) => {
    if (t0 < 0) { t0 = now; prevNow = now; w.__bench = { ready: true, first_frame_epoch_ms: performance.timeOrigin + now }; }
    const dt = now - prevNow;
    prevNow = now;
    const elapsed = now - t0;
    (w as unknown as { __bench_progress?: number }).__bench_progress = elapsed; // lets scripts/bench.ts detect a stalled page
    const c0 = performance.now();
    acc += Math.min(dt, 100) / 1000;
    while (acc >= DT) { sim.step(step++, NO_INPUT); acc -= DT; }
    const c1 = performance.now();
    const a = (2 * Math.PI * (elapsed / 1000)) / 15; // counter-clockwise from +X, 15 s per lap, starting at (30,15,0)
    const view = sim.view();
    world.update(view, T.safe_radius, elapsed / 1000, dt / 1000, 0, { x: 0, z: 0 }, true, { x: 30 * Math.cos(a), y: 15, z: 30 * Math.sin(a) });
    const c2 = performance.now();
    if (!params.has("nohud")) updateHud(view);
    const c3 = performance.now();
    if (elapsed > WARMUP_MS && dt > 0) { dts.push(dt); cpu.sim.push(c1 - c0); cpu.render.push(c2 - c1); cpu.hud.push(c3 - c2); }
    if (elapsed >= WARMUP_MS + durationS * 1000) finish();
    else requestAnimationFrame(bframe);
  };
  requestAnimationFrame(bframe);
}

const params = new URLSearchParams(location.search);
if (params.has("bench")) {
  startBench(Number(params.get("seed") ?? 42), Number(params.get("duration") ?? 30));
} else {
  showMenu();
  const hash = /^#play(\d)?$/.exec(location.hash); // #play, #play2, #play3: skip the menu (screenshots, benchmarks)
  if (hash) beginNight(Number(hash[1] ?? 1));
  requestAnimationFrame(frame);
}
