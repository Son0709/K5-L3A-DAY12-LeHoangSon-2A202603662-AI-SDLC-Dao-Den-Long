// 3D presentation only. Reads simulation state; contains no game rules.
// Palette: Ticket-02 "Bảng màu chuẩn".
import * as THREE from "three";
import type { createSim } from "../sim/sim.ts";
import type { MapDef } from "../sim/maps.ts";

type View = ReturnType<ReturnType<typeof createSim>["view"]>;

export const PAL = {
  sky: 0x0e1430, mist: 0x1b2350,
  grass: 0x2f5d50, sand: 0xc9b48a, wood: 0x6b4a2f, sea: 0x12384a,
  lampOn: 0xffb347, lampCore: 0xffe9b0, lampOff: 0x5b5f6e,
  moteCore: 0xfff6c2, moteHalo: 0xffe58a,
  shade: 0x120a1a, shadeEdge: 0x7a3cff, shadeStun: 0x3a3450,
  shirt: 0xe8e2d0, scarf: 0xc8102e, gold: 0xf2c14e, drifter: 0x8fa3b8,
};

function groundTexture(): THREE.CanvasTexture {
  const size = 1024, c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  g.fillStyle = "#2f5d50"; g.fillRect(0, 0, size, size); // exact palette grass as the base
  let s = 12345; // tiny LCG: stable look, unrelated to the simulation RNG
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 4500; i++) {
    g.fillStyle = `hsla(${150 + rnd() * 20},${28 + rnd() * 10}%,${28 + rnd() * 10}%,${0.12 + rnd() * 0.18})`;
    g.fillRect(rnd() * size, rnd() * size, 2 + rnd() * 4, 2 + rnd() * 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });

function makePlayer() {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.85, 16), std(PAL.shirt));
  body.position.y = 0.55;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 8, 16), std(PAL.scarf));
  scarf.rotation.x = Math.PI / 2; scarf.position.y = 0.98;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 20, 16), std(0xf1c9a5));
  head.position.y = 1.2;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.68, 0.38, 24), std(PAL.sand)); // nón lá
  hat.position.y = 1.52;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), std(PAL.wood));
  tip.position.y = 1.74;
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 4), std(PAL.wood));
  string.position.set(0.5, 1.33, 0);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), std(PAL.lampOn, { emissive: PAL.lampOn, emissiveIntensity: 2 }));
  lamp.position.set(0.5, 1.07, 0);
  const light = new THREE.PointLight(PAL.lampOn, 9, 14, 1.6);
  light.position.copy(lamp.position);
  grp.add(body, scarf, head, hat, tip, string, lamp, light);
  return grp;
}

function makeShade() {
  const grp = new THREE.Group();
  const mat = std(PAL.shade, { emissive: PAL.shadeEdge, emissiveIntensity: 0.55 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 16), mat);
  body.scale.set(1, 0.9, 1);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 16), mat);
  tail.rotation.x = Math.PI; tail.position.y = -0.75;
  const eyeMat = new THREE.MeshBasicMaterial({ color: PAL.shadeEdge });
  for (const sx of [-0.24, 0.24]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), eyeMat);
    eye.position.set(sx, 0.15, 0.58);
    grp.add(eye);
  }
  grp.add(body, tail);
  return { grp, mat };
}

function makeDrifter() {
  const geo = new THREE.PlaneGeometry(2.6, 0.5, 14, 1);
  const mat = new THREE.MeshStandardMaterial({ color: PAL.drifter, side: THREE.DoubleSide, roughness: 0.6, emissive: PAL.drifter, emissiveIntensity: 0.25, transparent: true, opacity: 0.92 });
  const mesh = new THREE.Mesh(geo, mat);
  const base = Float32Array.from(geo.attributes.position.array as ArrayLike<number>);
  const grp = new THREE.Group();
  grp.add(mesh);
  return { grp, mesh, mat, geo, base, heading: 0, lx: 0, lz: 0 };
}

function makeCharm() {
  const grp = new THREE.Group();
  const border = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.92, 0.04), std(PAL.gold, { emissive: PAL.gold, emissiveIntensity: 0.6 }));
  const card = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.06), std(PAL.scarf, { emissive: PAL.scarf, emissiveIntensity: 0.5 }));
  const light = new THREE.PointLight(PAL.scarf, 6, 8, 1.6);
  grp.add(border, card, light);
  return grp;
}

export function createWorld(host: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const bg = new THREE.Color(PAL.sky);
  scene.background = bg;
  scene.fog = new THREE.FogExp2(PAL.mist, 0.012);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
  const hemi = new THREE.HemisphereLight(0xb4bdf0, 0x1b2350, 1);
  const moon = new THREE.DirectionalLight(0xaab4ff, 2.2);
  moon.position.set(-20, 40, 10);
  scene.add(hemi, moon);

  const player = makePlayer();
  scene.add(player);

  const grassTex = groundTexture();
  let staticGroup = new THREE.Group();
  scene.add(staticGroup);
  const padMeshes: THREE.Mesh[] = [];

  const lanterns = new Map<string, { glow: THREE.Mesh; mat: THREE.MeshStandardMaterial; light: THREE.PointLight; ring: THREE.Mesh }>();
  const motes = new Map<string, THREE.Group>();
  const shades = new Map<string, { grp: THREE.Group; mat: THREE.MeshStandardMaterial }>();
  const drifters = new Map<string, ReturnType<typeof makeDrifter>>();
  const charms = new Map<string, THREE.Group>();
  const pulses: { mesh: THREE.Mesh; age: number }[] = [];

  const moteGeo = new THREE.SphereGeometry(0.13, 10, 8), haloGeo = new THREE.SphereGeometry(0.36, 10, 8);
  const moteMat = new THREE.MeshBasicMaterial({ color: PAL.moteCore });
  const haloMat = new THREE.MeshBasicMaterial({ color: PAL.moteHalo, transparent: true, opacity: 0.3, depthWrite: false });

  // wind leaves
  const LEAVES = 70;
  const leafMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.34, 0.18), new THREE.MeshBasicMaterial({ color: 0x9bbf6a, side: THREE.DoubleSide, transparent: true, opacity: 0 }), LEAVES);
  leafMesh.frustumCulled = false;
  scene.add(leafMesh);
  const leafSeed = Array.from({ length: LEAVES }, (_, i) => ({ ox: ((i * 37) % 40), oz: ((i * 53) % 40), oy: 0.5 + ((i * 17) % 30) / 6, ph: i * 1.7 }));
  const dummy = new THREE.Object3D();

  // ------------------------------------------------------------------ terrain per night
  function island(cx: number, r: number, depth = 2) {
    const sideMat = std(PAL.sand);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r - 1.5, depth, 72), [sideMat, std(PAL.grass, { map: grassTex }), sideMat]);
    top.position.set(cx, -depth / 2, 0);
    const under = new THREE.Mesh(new THREE.ConeGeometry(r - 1.5, 16, 40), std(0x4a3a2a, { flatShading: true }));
    under.rotation.x = Math.PI; under.position.set(cx, -depth - 8, 0);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.18, 6, 120), std(PAL.sand));
    rim.rotation.x = Math.PI / 2; rim.position.set(cx, 0.15, 0);
    staticGroup.add(top, under, rim);
  }

  function loadNight(map: MapDef) {
    scene.remove(staticGroup);
    staticGroup = new THREE.Group();
    scene.add(staticGroup);
    padMeshes.length = 0;
    for (const m of lanterns.values()) m.glow.parent?.removeFromParent();
    lanterns.clear();
    for (const g of charms.values()) scene.remove(g);
    charms.clear();

    // sea of clouds
    const sea = new THREE.Mesh(new THREE.CircleGeometry(420, 48), std(PAL.sea));
    sea.rotation.x = -Math.PI / 2; sea.position.y = -14;
    staticGroup.add(sea);
    const puff = std(0x1d5068, { transparent: true, opacity: 0.55, flatShading: true });
    for (let i = 0; i < 22; i++) {
      const a = i * 2.399, r = 70 + (i % 6) * 22;
      const m = new THREE.Mesh(new THREE.SphereGeometry(10 + (i % 4) * 4, 10, 8), puff);
      m.scale.y = 0.3; m.position.set(Math.sin(a) * r + (map.night === 2 ? 35 : 0), -12.5 - (i % 3) * 2, Math.cos(a) * r);
      staticGroup.add(m);
    }

    if (map.night === 1) island(0, 40);
    if (map.night === 2) {
      island(0, 28); island(70, 28);
      for (let i = 0; i < 18; i++) { // bamboo bridge, no rail
        const plank = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.12, 4), std(i % 2 ? PAL.wood : 0x7a5638));
        plank.position.set(26.5 + i, -0.07, 0);
        staticGroup.add(plank);
      }
      for (const z of [-2, 2]) { // two thin side beams (not a rail)
        const beam = new THREE.Mesh(new THREE.BoxGeometry(18, 0.12, 0.12), std(PAL.wood));
        beam.position.set(35, -0.18, z);
        staticGroup.add(beam);
      }
    }
    if (map.night === 3) {
      island(0, 45);
      const sand = std(PAL.sand), grass = std(PAL.grass, { map: grassTex });
      const shape = new THREE.Shape(); // tier 1: half annulus 12..24 on the z > 0 side
      shape.moveTo(12, 0); shape.lineTo(24, 0); shape.absarc(0, 0, 24, 0, Math.PI, false); shape.lineTo(-12, 0); shape.absarc(0, 0, 12, Math.PI, 0, true);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false, curveSegments: 48 });
      geo.rotateX(Math.PI / 2); geo.translate(0, 3, 0);
      staticGroup.add(new THREE.Mesh(geo, [grass, sand]));
      const t2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 48), [sand, grass, sand]);
      t2.position.y = 3;
      staticGroup.add(t2);
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 8, 24), sand);
      tower.position.y = 10;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.2, 24), std(PAL.wood));
      roof.position.y = 15.1;
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), std(PAL.gold, { emissive: PAL.gold, emissiveIntensity: 0.5 }));
      bell.position.y = 12.5;
      staticGroup.add(tower, roof, bell);
      for (const a of [30, 150]) { // 3 m wide ramps, foot r30 (y0) to top r24 (y3)
        const prof = new THREE.Shape();
        prof.moveTo(24, 0); prof.lineTo(30, 0); prof.lineTo(24, 3);
        const g = new THREE.ExtrudeGeometry(prof, { depth: 3, bevelEnabled: false });
        g.translate(0, 0, -1.5);
        const m = new THREE.Mesh(g, [sand, sand]);
        m.rotation.y = -(a * Math.PI) / 180;
        staticGroup.add(m);
      }
    }
    // jump pads
    for (const p of map.pads) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, 0.08, 32), std(PAL.gold, { emissive: PAL.gold, emissiveIntensity: 1.2 }));
      disc.position.set(p.x, p.y + 0.04, p.z);
      const ringM = new THREE.Mesh(new THREE.RingGeometry(p.r, p.r + 0.25, 32), new THREE.MeshBasicMaterial({ color: PAL.lampCore, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
      ringM.rotation.x = -Math.PI / 2; ringM.position.set(p.x, p.y + 0.06, p.z);
      staticGroup.add(disc, ringM);
      padMeshes.push(ringM);
    }
  }

  function ensureLantern(id: string, x: number, y: number, z: number, safeR: number) {
    let v = lanterns.get(id);
    if (v) return v;
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 2.4, 10), std(PAL.wood));
    post.position.y = 1.2;
    const mat = std(PAL.lampOff, { emissive: PAL.lampOff, emissiveIntensity: 0.2, roughness: 0.6 });
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 16), mat);
    glow.scale.y = 1.25; glow.position.y = 3.0;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.35, 12), std(PAL.wood));
    cap.position.y = 3.85;
    const light = new THREE.PointLight(PAL.lampOn, 0, 30, 1.5);
    light.position.y = 3;
    const ring = new THREE.Mesh(new THREE.RingGeometry(safeR - 0.2, safeR, 64), new THREE.MeshBasicMaterial({ color: PAL.lampOn, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; ring.visible = false;
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
  const tmp = new THREE.Vector3();

  return {
    domElement: renderer.domElement,
    loadNight,
    /** Drop all per-game objects (call when a night starts or restarts). */
    reset() {
      for (const g of motes.values()) scene.remove(g);
      for (const s of shades.values()) scene.remove(s.grp);
      for (const d of drifters.values()) scene.remove(d.grp);
      for (const p of pulses) scene.remove(p.mesh);
      motes.clear(); shades.clear(); drifters.clear(); pulses.length = 0;
      camInit = false;
    },
    addPulse(x: number, y: number, z: number, radius: number) {
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64), new THREE.MeshBasicMaterial({ color: PAL.gold, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
      mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, y + 0.1, z);
      mesh.userData.radius = radius;
      scene.add(mesh);
      pulses.push({ mesh, age: 0 });
    },
    /** Screen position of a world point: ndc in [-1,1], `behind` when the point is behind the camera. */
    project(x: number, y: number, z: number) {
      tmp.set(x, y, z).project(camera);
      const behind = tmp.z > 1;
      return { x: tmp.x, y: tmp.y, behind };
    },
    update(v: View, safeRadius: number, t: number, dt: number, camYawDeg: number, moveDir: { x: number; z: number }, started: boolean) {
      // lanterns (lit ones glow, unlit are grey)
      const lit = v.lanterns.filter((l) => l.lit).length;
      for (const l of v.lanterns) {
        const lv = ensureLantern(l.id, l.x, l.y, l.z, safeRadius);
        const k = l.lit ? 1 : l.deposited / 10;
        lv.mat.color.setHex(l.lit ? PAL.lampCore : PAL.lampOff);
        lv.mat.emissive.setHex(l.lit ? PAL.lampOn : PAL.lampOff);
        lv.mat.emissiveIntensity = l.lit ? 2.2 + 0.25 * Math.sin(t * 7 + l.x) : 0.2 + 1.2 * k;
        lv.light.color.setHex(l.lit ? PAL.lampOn : PAL.lampOff);
        lv.light.intensity = l.lit ? 70 + 8 * Math.sin(t * 6 + l.z) : 2 + 12 * k;
        lv.ring.visible = l.lit;
      }
      // ambient grows with progress: 0.15 + 0.55 x (lit / total), scaled to three's physical light units
      const progress = v.lanterns.length ? lit / v.lanterns.length : 0;
      // (three >= r155 no longer scales lights by pi, so the factor is large; 12 keeps the dark start readable)
      hemi.intensity = (0.15 + 0.55 * progress) * 12;
      (scene.fog as THREE.FogExp2).density = 0.013 - 0.004 * progress;

      // motes (dropped ones blink when about to expire)
      const seen = new Set<string>();
      v.motes.forEach((m, i) => {
        seen.add(m.id);
        let g = motes.get(m.id);
        if (!g) {
          g = new THREE.Group();
          g.add(new THREE.Mesh(moteGeo, moteMat), new THREE.Mesh(haloGeo, haloMat));
          scene.add(g); motes.set(m.id, g);
        }
        g.position.set(m.x, m.y + 0.9 + 0.18 * Math.sin(t * 2 + i), m.z);
        g.visible = !(m.ttl !== null && m.ttl < 120 && Math.floor(t * 8) % 2 === 0);
      });
      for (const [id, g] of motes) if (!seen.has(id)) { scene.remove(g); motes.delete(id); }

      // shades
      const seenS = new Set<string>();
      for (const s of v.shades) {
        seenS.add(s.id);
        let sv = shades.get(s.id);
        if (!sv) { const m = makeShade(); scene.add(m.grp); shades.set(s.id, m); sv = m; }
        sv.grp.position.set(s.x, s.y + 0.15 * Math.sin(t * 3 + s.x), s.z);
        sv.grp.rotation.y = s.stunned ? t * 6 : Math.atan2(v.player.x - s.x, v.player.z - s.z);
        sv.mat.color.setHex(s.stunned ? PAL.shadeStun : PAL.shade);
        sv.mat.emissive.setHex(s.stunned ? PAL.shadeStun : PAL.shadeEdge);
        sv.mat.emissiveIntensity = s.stunned ? 0.4 : s.state === "spawning" ? 0.2 + 0.3 * Math.sin(t * 10) ** 2 : 0.55;
      }
      for (const [id, s] of shades) if (!seenS.has(id)) { scene.remove(s.grp); shades.delete(id); }

      // drifters (Gió Lạc): grey-blue ribbons
      const seenD = new Set<string>();
      for (const d of v.drifters) {
        seenD.add(d.id);
        let dv = drifters.get(d.id);
        if (!dv) { dv = makeDrifter(); dv.lx = d.x; dv.lz = d.z; scene.add(dv.grp); drifters.set(d.id, dv); }
        if (Math.hypot(d.x - dv.lx, d.z - dv.lz) > 1e-4) dv.heading = Math.atan2(d.x - dv.lx, d.z - dv.lz);
        dv.lx = d.x; dv.lz = d.z;
        dv.grp.position.set(d.x, d.y, d.z);
        dv.grp.rotation.y = dv.heading + Math.PI / 2;
        const pos = dv.geo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          const x = dv.base[i * 3];
          pos.setZ(i, Math.sin(x * 2.4 + t * 7) * 0.22 * (0.4 + Math.abs(x) / 1.3));
        }
        pos.needsUpdate = true;
        dv.mat.emissive.setHex(d.stolen > 0 ? PAL.scarf : PAL.drifter);
        dv.mat.emissiveIntensity = d.stolen > 0 ? 0.5 : 0.25;
      }
      for (const [id, d] of drifters) if (!seenD.has(id)) { scene.remove(d.grp); drifters.delete(id); }

      // charms (Bùa Gió)
      for (const c of v.charms) {
        let g = charms.get(c.id);
        if (!g) { g = makeCharm(); scene.add(g); charms.set(c.id, g); }
        g.visible = c.available;
        g.position.set(c.x, c.y + 1.2 + 0.15 * Math.sin(t * 2.5), c.z);
        g.rotation.y = t * 1.5;
      }
      for (const r of padMeshes) (r.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.35 * Math.sin(t * 4);

      // player
      const p = v.player;
      player.position.set(p.x, p.y, p.z);
      player.visible = !p.out && !(p.invulnLeft > 0 && Math.floor(t * 14) % 2 === 0);
      const moving = Math.hypot(moveDir.x, moveDir.z) > 0.01;
      if (moving) {
        let d = Math.atan2(moveDir.x, moveDir.z) - player.rotation.y;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        player.rotation.y += d * Math.min(1, dt * 14);
        if (p.grounded) player.position.y += Math.abs(Math.sin(t * 12)) * 0.07;
      }

      // pulse rings
      for (let i = pulses.length - 1; i >= 0; i--) {
        const e = pulses[i];
        e.age += dt;
        const k = e.age / 0.5;
        e.mesh.scale.setScalar(Math.max(0.01, k * (e.mesh.userData.radius as number)));
        (e.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
        if (k >= 1) { scene.remove(e.mesh); pulses.splice(i, 1); }
      }

      // wind leaves: warned 2 s ahead, then streaming across the screen while it blows
      const w = v.wind;
      const showLeaves = w.active || w.warning;
      (leafMesh.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.lerp((leafMesh.material as THREE.MeshBasicMaterial).opacity, showLeaves ? (w.active ? 0.9 : 0.5) : 0, Math.min(1, dt * 4));
      const wd = (w.dirDeg * Math.PI) / 180, wdx = Math.cos(wd), wdz = Math.sin(wd);
      for (let i = 0; i < LEAVES; i++) {
        const s = leafSeed[i];
        const travel = t * (w.active ? 9 : 5);
        const u = (((s.ox + wdx * travel) % 40) + 40) % 40 - 20, vv = (((s.oz + wdz * travel) % 40) + 40) % 40 - 20;
        dummy.position.set(p.x + u, p.y + s.oy + Math.sin(t * 3 + s.ph) * 0.4, p.z + vv);
        dummy.rotation.set(t * 3 + s.ph, -wd, t * 2 + s.ph);
        dummy.updateMatrix();
        leafMesh.setMatrixAt(i, dummy.matrix);
      }
      leafMesh.instanceMatrix.needsUpdate = true;

      // camera: third person, behind the movement-forward direction of cam_yaw
      const th = (camYawDeg * Math.PI) / 180;
      const want = tmp.set(p.x + Math.sin(th) * 9.5, p.y + 5.2, p.z + Math.cos(th) * 9.5).clone();
      if (!camInit || !started) { camPos.copy(want); camInit = true; }
      else camPos.lerp(want, 1 - Math.exp(-9 * dt));
      camera.position.copy(camPos);
      camera.lookAt(p.x, p.y + 1.3, p.z);

      renderer.render(scene, camera);
    },
  };
}
