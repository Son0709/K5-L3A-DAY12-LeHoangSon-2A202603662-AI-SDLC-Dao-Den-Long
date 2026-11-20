// Browser client: game flow (menu -> night intro -> play -> result -> next night -> dawn), pause, settings, HUD,
// audio and input. All rules live in src/sim (shared with headless); this file only reads sim.view().
import { createSim, type InputState, type OutLine } from "../sim/sim.ts";
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

function setCd(el: HTMLElement, progress: number, ready: boolean, label: string, nope = false) {
  el.style.setProperty("--p", String(Math.max(0, Math.min(1, progress))));
  el.classList.toggle("ready", ready);
  el.classList.toggle("nope", nope);
  el.querySelector("b")!.textContent = label;
}

function updateHud(v: ReturnType<typeof sim.view>) {
  const p = v.player;
  $("flames").innerHTML = Array.from({ length: T.flames }, (_, i) => `<span class="flame${i < p.flames ? "" : " off"}">●</span>`).join("");
  const charm = $("charmBadge");
  charm.style.display = p.charmLeft > 0 ? "block" : "none";
  if (p.charmLeft > 0) $("charmT").textContent = `${p.charmLeft.toFixed(1)}s`;

  const clock = $("clock");
  clock.textContent = fmtTime(v.timeLeft);
  clock.classList.toggle("danger", v.timeLeft <= 30);
  const lit = v.lanterns.filter((l) => l.lit).length;
  $("lanternCount").textContent = `${lit}/${v.lanterns.length}`;
  $("lanterns").innerHTML = v.lanterns.map((l) => `<span class="dot${l.lit ? " on" : ""}"></span>`).join("");
  $("score").textContent = `${v.score}`;
  $("total").textContent = nightsWonLabel();

  $("moteBar").innerHTML = Array.from({ length: p.capacity }, (_, i) => `<div class="cell${i < p.carried ? " on" : ""}"></div>`).join("") + `<span class="cap">${p.carried}/${p.capacity}</span>`;

  const dashReady = p.dashCooldownLeft <= 0 || p.charmLeft > 0;
  setCd($("cdDash"), dashReady ? 1 : 1 - p.dashCooldownLeft / T.dash_cooldown_s, dashReady, dashReady ? "Shift" : `${p.dashCooldownLeft.toFixed(1)}s`);
  const pulseReady = p.pulseCooldownLeft <= 0 && p.carried >= T.pulse_cost;
  setCd($("cdPulse"), p.pulseCooldownLeft > 0 ? 1 - p.pulseCooldownLeft / T.pulse_cooldown_s : 1, pulseReady,
    p.pulseCooldownLeft > 0 ? `${p.pulseCooldownLeft.toFixed(1)}s` : p.carried >= T.pulse_cost ? "F" : `cần ${T.pulse_cost}`, p.pulseCooldownLeft <= 0 && p.carried < T.pulse_cost);

  const wb = $("windBanner");
  wb.style.display = v.wind.warning || v.wind.active ? "block" : "none";
  wb.classList.toggle("on", v.wind.active);
  wb.textContent = v.wind.active ? "Gió đang thổi, bám chắc!" : "Gió mạnh sắp tới…";

  // interaction prompt for the nearest unlit lantern in reach
  let near: (typeof v.lanterns)[number] | undefined, nd = Infinity;
  for (const l of v.lanterns) {
    const d = Math.hypot(l.x - p.x, l.z - p.z);
    if (!l.lit && d <= T.interact_radius && d < nd) { near = l; nd = d; }
  }
  const pr = $("prompt");
  if (phase === "playing" && near) {
    pr.style.display = "block";
    pr.innerHTML = p.carried > 0 ? `<kbd>E</kbd> Nạp ánh sáng (${near.deposited}/${T.lantern_cost})` : `Đèn cần ${T.lantern_cost - near.deposited} đom đóm, hãy đi gom thêm`;
  } else pr.style.display = "none";

  // arrow to the nearest unlit lantern when it is off screen
  const arrow = $("arrow");
  let target: (typeof v.lanterns)[number] | undefined, td = Infinity;
  for (const l of v.lanterns) {
    const d = Math.hypot(l.x - p.x, l.z - p.z);
    if (!l.lit && d < td) { target = l; td = d; }
  }
  if (phase === "playing" && target) {
    const s = world.project(target.x, target.y + 3, target.z);
    const onScreen = !s.behind && Math.abs(s.x) < 0.92 && Math.abs(s.y) < 0.86;
    if (onScreen) arrow.style.display = "none";
    else {
      let dx = s.x, dy = s.y;
      if (s.behind) { dx = -dx; dy = -dy; }
      const W = window.innerWidth, H = window.innerHeight, m = 70;
      const len = Math.hypot(dx, dy) || 1;
      const sx = dx / len, sy = -dy / len; // pixel space (y down)
      const kx = Math.abs(sx) > 1e-6 ? (W / 2 - m) / Math.abs(sx) : Infinity, ky = Math.abs(sy) > 1e-6 ? (H / 2 - m) / Math.abs(sy) : Infinity;
      const kk = Math.min(kx, ky);
      arrow.style.display = "block";
      arrow.style.left = `${W / 2 + sx * kk - 14}px`;
      arrow.style.top = `${H / 2 + sy * kk - 17}px`;
      arrow.style.transform = `rotate(${Math.atan2(sx, -sy)}rad)`;
    }
  } else arrow.style.display = "none";

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

showMenu();
const hash = /^#play(\d)?$/.exec(location.hash); // #play, #play2, #play3: skip the menu (screenshots, benchmarks)
if (hash) beginNight(Number(hash[1] ?? 1));
requestAnimationFrame(frame);
