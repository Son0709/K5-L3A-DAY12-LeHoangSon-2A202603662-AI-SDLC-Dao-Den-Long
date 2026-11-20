// 3D presentation only. Reads simulation state; contains no game rules.
import * as THREE from "three";
import type { createSim } from "../sim/sim.ts";
import { ISLAND_R, T } from "../sim/tuning.ts";

type View = ReturnType<ReturnType<typeof createSim>["view"]>;

const WARM = 0xffa640;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

function groundTexture(): THREE.CanvasTexture {
  const size = 1024, c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "#35585a"); grad.addColorStop(1, "#243a48");
  g.fillStyle = grad; g.fillRect(0, 0, size, size);
  let s = 12345; // tiny LCG: stable look, unrelated to the simulation RNG
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = `hsla(${130 + rnd() * 60},35%,${28 + rnd() * 22}%,${0.25 + rnd() * 0.4})`;
    g.fillRect(rnd() * size, rnd() * size, 2 + rnd() * 4, 2 + rnd() * 4);
  }
  g.strokeStyle = "rgba(255,190,110,0.10)"; g.lineWidth = 3;
  for (const f of [0.25, 0.5, 0.75]) { g.beginPath(); g.arc(size / 2, size / 2, f * size / 2, 0, Math.PI * 2); g.stroke(); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePlayer() {
  const grp = new THREE.Group();
  const mat = (color: number, emissive = 0x000000, ei = 0) => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: ei, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.85, 16), mat(0x3b7ea1));
  body.position.y = 0.55;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 20, 16), mat(0xf1c9a5));
  head.position.y = 1.2;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.68, 0.38, 24), mat(0xd9b26f)); // nón lá
  hat.position.y = 1.52;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), mat(0xb88a4a));
  tip.position.y = 1.74;
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 4), mat(0x6b4a2a));
  string.position.set(0.5, 1.33, 0);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), mat(0xffd27a, WARM, 2));
  lamp.position.set(0.5, 1.07, 0);
  const light = new THREE.PointLight(0xffb060, 9, 14, 1.6);
  light.position.copy(lamp.position);
  grp.add(body, head, hat, tip, string, lamp, light);
  return grp;
}

function makeShade() {
  const grp = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x140a26, emissive: 0x3a1470, emissiveIntensity: 0.7, roughness: 1 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 16), mat);
  body.scale.set(1, 0.9, 1);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 16), mat);
  tail.rotation.x = Math.PI; tail.position.y = -0.75;
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff7ad9 });
  for (const sx of [-0.24, 0.24]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), eyeMat);
    eye.position.set(sx, 0.15, 0.58);
    grp.add(eye);
  }
  grp.add(body, tail);
  return { grp, mat };
}

export function createWorld(host: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const bgDark = new THREE.Color(0x0b0820), bgWarm = new THREE.Color(0x24163f);
  scene.background = bgDark.clone();
  scene.fog = new THREE.FogExp2(0x0b0820, 0.016);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);

  const hemi = new THREE.HemisphereLight(0x8b7bd8, 0x1b1236, 1.6);
  const moon = new THREE.DirectionalLight(0x9aa8ff, 1.1);
  moon.position.set(-20, 40, 10);
  scene.add(hemi, moon);

  // island, rock underside, rim and sea of clouds
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x3a2f4f, roughness: 1 });
  const island = new THREE.Mesh(
    new THREE.CylinderGeometry(ISLAND_R, ISLAND_R - 1.5, 2, 64),
    [sideMat, new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1 }), sideMat],
  );
  island.position.y = -1;
  const under = new THREE.Mesh(new THREE.ConeGeometry(ISLAND_R - 1.5, 16, 40), new THREE.MeshStandardMaterial({ color: 0x2a2140, roughness: 1, flatShading: true }));
  under.rotation.x = Math.PI; under.position.y = -10;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(ISLAND_R, 0.18, 6, 120), new THREE.MeshStandardMaterial({ color: 0x7a68b0, roughness: 1 }));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.15;
  scene.add(island, under, rim);
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0x5a4f8a, transparent: true, opacity: 0.55, flatShading: true, roughness: 1 });
  for (let i = 0; i < 16; i++) {
    const a = i * 2.399, r = 55 + (i % 5) * 18;
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(10 + (i % 4) * 4, 10, 8), cloudMat);
    cloud.scale.y = 0.3;
    cloud.position.set(Math.sin(a) * r, -12 - (i % 3) * 3, Math.cos(a) * r);
    scene.add(cloud);
  }

  const player = makePlayer();
  scene.add(player);

  const lanterns = new Map<string, { glow: THREE.Mesh; mat: THREE.MeshStandardMaterial; light: THREE.PointLight; ring: THREE.Mesh }>();
  const motes = new Map<string, THREE.Group>();
  const shades = new Map<string, { grp: THREE.Group; mat: THREE.MeshStandardMaterial }>();
  const pulses: { mesh: THREE.Mesh; age: number }[] = [];

  const moteGeo = new THREE.SphereGeometry(0.13, 10, 8), haloGeo = new THREE.SphereGeometry(0.36, 10, 8);
  const moteMat = new THREE.MeshBasicMaterial({ color: 0xffe27a });
  const haloMat = new THREE.MeshBasicMaterial({ color: 0xffd45a, transparent: true, opacity: 0.28, depthWrite: false });

  function ensureLantern(id: string, x: number, z: number) {
    let v = lanterns.get(id);
    if (v) return v;
    const grp = new THREE.Group();
    grp.position.set(x, 0, z);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 2.4, 10), new THREE.MeshStandardMaterial({ color: 0x4a3526, roughness: 1 }));
    post.position.y = 1.2;
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a6ad0, emissive: 0x6a3ab0, emissiveIntensity: 0.25, roughness: 0.6 });
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 16), mat);
    glow.scale.y = 1.25; glow.position.y = 3.0;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.35, 12), new THREE.MeshStandardMaterial({ color: 0x4a3526, roughness: 1 }));
    cap.position.y = 3.85;
    const light = new THREE.PointLight(0xffb060, 0, 30, 1.5);
    light.position.y = 3;
    const ring = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.2, T.safe_radius, 64), new THREE.MeshBasicMaterial({ color: WARM, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; ring.visible = false;
    grp.add(post, glow, cap, light, ring);
    scene.add(grp);
    v = { glow, mat, light, ring };
    lanterns.set(id, v);
    return v;
  }

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  const camPos = new THREE.Vector3(0, 6, 10);
  let camInit = false;

  return {
    domElement: renderer.domElement,
    /** Drop all per-game objects (call when a new game starts). */
    reset() {
      for (const g of motes.values()) scene.remove(g);
      for (const s of shades.values()) scene.remove(s.grp);
      for (const p of pulses) scene.remove(p.mesh);
      motes.clear(); shades.clear(); pulses.length = 0;
      camInit = false;
    },
    addPulse(x: number, z: number) {
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
      mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, 0.1, z);
      scene.add(mesh);
      pulses.push({ mesh, age: 0 });
    },
    /** moveDir: world-space movement direction of the player this frame (for facing). */
    update(v: View, t: number, dt: number, camYawDeg: number, moveDir: { x: number; z: number }, hasStarted: boolean) {
      // lanterns
      const lit = v.lanterns.filter((l) => l.lit).length;
      for (const l of v.lanterns) {
        const lv = ensureLantern(l.id, l.x, l.z);
        const k = l.lit ? 1 : l.deposited / T.lantern_cost;
        lv.mat.color.setHex(l.lit ? 0xffc470 : 0x8a6ad0);
        lv.mat.emissive.setHex(l.lit ? WARM : 0x6a3ab0);
        lv.mat.emissiveIntensity = l.lit ? 2.2 + 0.25 * Math.sin(t * 7 + l.x) : 0.25 + 1.3 * k;
        lv.light.color.setHex(l.lit ? 0xffb060 : 0x9a70ff);
        lv.light.intensity = l.lit ? 70 + 8 * Math.sin(t * 6 + l.z) : 3 + 14 * k;
        lv.ring.visible = l.lit;
      }
      // the island brightens as lanterns are lit
      hemi.intensity = 1.6 + 0.45 * lit;
      (scene.fog as THREE.FogExp2).density = 0.016 - 0.0022 * lit;
      (scene.background as THREE.Color).copy(bgDark).lerp(bgWarm, lit / T.lantern_count_night1);

      // motes
      const seen = new Set<string>();
      v.motes.forEach((m, i) => {
        seen.add(m.id);
        let g = motes.get(m.id);
        if (!g) {
          g = new THREE.Group();
          g.add(new THREE.Mesh(moteGeo, moteMat), new THREE.Mesh(haloGeo, haloMat));
          scene.add(g); motes.set(m.id, g);
        }
        g.position.set(m.x, 0.9 + 0.18 * Math.sin(t * 2 + i), m.z);
      });
      for (const [id, g] of motes) if (!seen.has(id)) { scene.remove(g); motes.delete(id); }

      // shades
      const seenS = new Set<string>();
      for (const s of v.shades) {
        seenS.add(s.id);
        let sv = shades.get(s.id);
        if (!sv) { const m = makeShade(); scene.add(m.grp); shades.set(s.id, m); sv = m; }
        sv.grp.position.set(s.x, 1.1 + 0.15 * Math.sin(t * 3 + s.x), s.z);
        sv.grp.rotation.y = s.stunned ? t * 6 : Math.atan2(v.player.x - s.x, v.player.z - s.z);
        sv.mat.color.setHex(s.stunned ? 0x6a6aa8 : 0x140a26);
        sv.mat.emissive.setHex(s.stunned ? 0x9aa0e0 : 0x3a1470);
        sv.mat.emissiveIntensity = s.stunned ? 0.8 : 0.7;
      }
      for (const [id, s] of shades) if (!seenS.has(id)) { scene.remove(s.grp); shades.delete(id); }

      // player
      const p = v.player;
      player.position.set(p.x, p.y, p.z);
      const moving = Math.hypot(moveDir.x, moveDir.z) > 0.01;
      if (moving) {
        const target = Math.atan2(moveDir.x, moveDir.z);
        let d = target - player.rotation.y;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        player.rotation.y += d * Math.min(1, dt * 14);
        player.position.y += Math.abs(Math.sin(t * 12)) * 0.07;
      }
      player.visible = !(p.invulnLeft > 0 && Math.floor(t * 14) % 2 === 0);

      // pulse rings
      for (let i = pulses.length - 1; i >= 0; i--) {
        const e = pulses[i];
        e.age += dt;
        const k = e.age / 0.5;
        e.mesh.scale.setScalar(Math.max(0.01, k * T.pulse_radius));
        (e.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
        if (k >= 1) { scene.remove(e.mesh); pulses.splice(i, 1); }
      }

      // camera: third person, behind the movement-forward direction of cam_yaw
      const th = (camYawDeg * Math.PI) / 180;
      const dist = 9.5, height = 5.2;
      const want = new THREE.Vector3(p.x + Math.sin(th) * dist, p.y + height, p.z + Math.cos(th) * dist);
      if (!camInit || !hasStarted) { camPos.copy(want); camInit = true; }
      else camPos.lerp(want, 1 - Math.exp(-9 * dt));
      camera.position.copy(camPos);
      camera.lookAt(p.x, p.y + 1.3, p.z);

      renderer.render(scene, camera);
    },
  };
}
