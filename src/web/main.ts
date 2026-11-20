// Browser client: input, fixed 60 Hz loop, HUD and overlays. Rules live in src/sim (shared with headless).
import { createSim, type InputState, type OutLine } from "../sim/sim.ts";
import { parseScenario } from "../sim/parse.ts";
import { DT, T } from "../sim/tuning.ts";
import { createWorld } from "./scene.ts";

const $ = <E extends HTMLElement>(id: string) => document.getElementById(id) as E;
const world = createWorld(document.body);
document.body.prepend(world.domElement);

type Phase = "menu" | "playing" | "over";
let phase: Phase = "menu";
let sim = createSim(parseScenario(undefined), 1, () => {});
let k = 0;
let camYaw = 0;
let lastReason = "";

// ---------------------------------------------------------------- input
const held = new Set<string>();
const latch = { jump: false, interact: false, pulse: false };
const GAME_KEYS = new Set(["Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

window.addEventListener("keydown", (e) => {
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  if (e.repeat) return;
  held.add(e.code);
  if (e.code === "Space") latch.jump = true;
  if (e.code === "KeyE") latch.interact = true;
  if (e.code === "KeyF") latch.pulse = true;
  if (e.code === "KeyR" || (phase !== "playing" && (e.code === "Space" || e.code === "Enter"))) start();
});
window.addEventListener("keyup", (e) => held.delete(e.code));
window.addEventListener("blur", () => held.clear());
let dragging = false;
world.domElement.addEventListener("pointerdown", () => (dragging = true));
window.addEventListener("pointerup", () => (dragging = false));
window.addEventListener("pointermove", (e) => { if (dragging) camYaw += e.movementX * 0.3; });

function readInput(): InputState {
  const mx = (held.has("KeyD") ? 1 : 0) - (held.has("KeyA") ? 1 : 0);
  const mz = (held.has("KeyS") ? 1 : 0) - (held.has("KeyW") ? 1 : 0); // W = forward = -z at yaw 0
  return {
    mx, mz, yaw: camYaw,
    jump: held.has("Space") || latch.jump,
    interact: held.has("KeyE") || latch.interact,
    pulse: held.has("KeyF") || latch.pulse,
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
function onEvent(line: OutLine) {
  const e = line as { name: string; data: Record<string, unknown> };
  const v = sim.view();
  switch (e.name) {
    case "mote_picked": toast(`+${T.score.per_mote} đom đóm`); break;
    case "deposit": toast(`Nạp ${e.data.amount} đom đóm vào đèn ${e.data.lantern_id}`); break;
    case "lantern_lit": toast(`Đèn ${e.data.lantern_id} đã sáng! +${T.score.per_lantern}`); break;
    case "pulse": {
      world.addPulse(v.player.x, v.player.z);
      const n = (e.data.stunned_ids as string[]).length;
      toast(n > 0 ? `Mây tỏa sáng, ${n} Bóng Mực bị xua đi! +${n * T.score.per_stun}` : "Mây tỏa sáng");
      break;
    }
    case "player_hit": {
      flashHurt();
      const d = Number(e.data.dropped);
      toast(`Bóng Mực chạm vào Mây! Còn ${e.data.flames} ngọn lửa${d > 0 ? `, rơi ${d} đom đóm` : ""}`, "bad");
      break;
    }
    case "shade_spawned": toast("Một Bóng Mực mới trôi ra từ sương…", "bad"); break;
    case "game_over": lastReason = String(e.data.reason); break;
  }
}

const fmtTime = (s: number) => `${Math.floor(Math.ceil(s) / 60)}:${String(Math.ceil(s) % 60).padStart(2, "0")}`;

function updateHud(v: ReturnType<typeof sim.view>) {
  const p = v.player;
  $("flames").innerHTML = Array.from({ length: T.flames }, (_, i) => `<span class="flame${i < p.flames ? "" : " off"}">●</span>`).join(" ");
  $("carried").textContent = `${p.carried}/${T.carry_capacity}`;
  $("carriedBar").style.width = `${(100 * p.carried) / T.carry_capacity}%`;
  const lit = v.lanterns.filter((l) => l.lit).length;
  $("lanterns").innerHTML = v.lanterns.map((l) => `<span class="dot${l.lit ? " on" : ""}"></span>`).join("") + ` <b>${lit}/${v.lanterns.length}</b>`;
  $("time").textContent = fmtTime(v.timeLeft);
  $("score").textContent = `${v.score} điểm`;
  $("pulse").textContent = p.pulseCooldownLeft > 0 ? `${p.pulseCooldownLeft.toFixed(1)}s` : p.carried >= T.pulse_cost ? `sẵn sàng (-${T.pulse_cost})` : `cần ${T.pulse_cost} đom đóm`;

  // interaction prompt
  let near: (typeof v.lanterns)[number] | undefined;
  for (const l of v.lanterns) if (!l.lit && Math.hypot(l.x - p.x, l.z - p.z) <= T.interact_radius) near = l;
  const pr = $("prompt");
  if (phase === "playing" && near) {
    pr.style.display = "block";
    pr.textContent = p.carried > 0 ? `Nhấn E để nạp đèn (${near.deposited}/${T.lantern_cost})` : `Đèn cần ${T.lantern_cost - near.deposited} đom đóm, hãy đi gom thêm`;
  } else pr.style.display = "none";
}

// ---------------------------------------------------------------- overlays
function showCard(html: string) { $("card").innerHTML = html; $("overlay").classList.remove("hidden"); }
function hideCard() { $("overlay").classList.add("hidden"); }
const S = T.score;

function menuCard() {
  showCard(`
    <h1>Đảo Đèn Lồng</h1>
    <h2>Đêm 1 · Đảo Bến</h2>
    <p>Sương đen đã nuốt hết ánh sáng của đảo. Mây, người giữ đèn nhỏ tuổi, phải gom đom đóm và thắp lại ${T.lantern_count_night1} Đèn Lồng Lớn trước khi trời sáng.
    Bóng Mực sợ ánh sáng: chúng không dám vào gần đèn đã thắp.</p>
    <div class="keys">
      <kbd>W A S D</kbd><span>đi lại</span>
      <kbd>Space</kbd><span>nhảy</span>
      <kbd>E</kbd><span>nạp đom đóm vào đèn gần nhất</span>
      <kbd>F</kbd><span>tỏa sáng, xua Bóng Mực (tốn ${T.pulse_cost} đom đóm)</span>
      <kbd>← →</kbd><span>xoay camera (hoặc kéo chuột)</span>
      <kbd>R</kbd><span>chơi lại</span>
    </div>
    <p>Điểm: +${S.per_mote}/đom đóm, +${S.per_lantern}/đèn, +${S.per_stun}/Bóng Mực bị xua. Thắng thêm +${S.per_second_left}/giây còn lại và +${S.per_flame_left}/ngọn lửa còn lại.</p>
    <div class="cta">Nhấn Space để bắt đầu</div>`);
}
function endCard(v: ReturnType<typeof sim.view>) {
  const won = v.state === "won";
  const msg = won ? "Mọi ngọn đèn đã sáng. Hòn đảo lại ấm áp." : lastReason === "dawn" ? "Trời sáng mất rồi, sương đen vẫn còn trên đảo." : "Ngọn lửa nhỏ của Mây đã tắt.";
  const lit = v.lanterns.filter((l) => l.lit).length;
  showCard(`
    <h1>${won ? "Đảo đã sáng rực!" : "Đêm chưa kết thúc…"}</h1>
    <h2>${msg}</h2>
    <p>Điểm: <b style="color:#ffd27a;font-size:28px">${v.score}</b></p>
    <p>Đèn đã thắp ${lit}/${v.lanterns.length} · Ngọn lửa còn lại ${v.player.flames} · Thời gian còn ${fmtTime(v.timeLeft)}</p>
    <div class="cta">Nhấn R để chơi lại</div>`);
}

// ---------------------------------------------------------------- game lifecycle
function start() {
  const seed = (Date.now() ^ Math.floor(Math.random() * 2 ** 32)) >>> 0; // seed chosen here; the sim itself stays pure
  lastReason = "";
  sim = createSim(parseScenario(undefined), seed, onEvent);
  k = 0;
  latch.jump = latch.interact = latch.pulse = false;
  world.reset();
  $("toasts").innerHTML = "";
  phase = "playing";
  hideCard();
}

let acc = 0, last = performance.now(), t = 0;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now; t += dt;
  if (held.has("ArrowLeft")) camYaw -= 110 * dt;
  if (held.has("ArrowRight")) camYaw += 110 * dt;

  const input = readInput();
  if (phase === "playing") {
    acc += dt;
    while (acc >= DT && sim.isPlaying()) {
      sim.step(k++, readInput());
      latch.jump = latch.interact = latch.pulse = false;
      acc -= DT;
    }
    if (!sim.isPlaying()) { phase = "over"; endCard(sim.view()); }
  }
  const v = sim.view();
  world.update(v, t, dt, camYaw, phase === "playing" ? worldDir(input) : { x: 0, z: 0 }, phase !== "menu");
  updateHud(v);
  requestAnimationFrame(frame);
}

menuCard();
if (location.hash === "#play") start(); // skip the menu (used for automated screenshots and demos)
requestAnimationFrame(frame);
