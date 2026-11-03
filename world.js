import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { gfx } from './settings.js';
import { rng, fbm, vnoise, smooth, clamp, lerp, TAU, nextFrame } from './util.js';
import { M, P } from './mats.js';
import { texClone } from './tex.js';
import { Colliders } from './collide.js';
import { applyWind, windU } from './wind.js';
import { buildTreeSpecs, rockGeo, bushGeo, fernGeo, bladeGeo, buildAnimal } from './m_nature.js';
import * as ST from './m_struct.js';
import { buildHouse, buildCrate, buildGenerator } from './m_house.js';

export const FC = { x: 0, z: 15 }, FR = 62, HOUSE_Z = 17.5;
const DOWN = new THREE.Vector3(0, -1, 0);

export class World {
  constructor(scene, seed) {
    this.scene = scene; this.seed = seed; this.R = rng(seed); this.cols = new Colliders(8);
    this.occ = []; this.structs = []; this.towers = []; this.huts = []; this.lootSpots = []; this.puddles = []; this.animals = []; this.doors = []; this.lights = []; this.updaters = [];
    this.hour = 7; this.weather = 'clear'; this.wet = 0; this.rainAmt = 0; this.flash = 0; this.g = gfx();
  }
  // ---------- рельєф ----------
  terrainH(x, z) {
    const r = Math.hypot(x - FC.x, z - FC.z);
    let h = (fbm(x * .018 + 11, z * .018 + 7, 4) - .5) * 9 + (fbm(x * .07 + 3, z * .07 + 5, 3) - .5) * 1.7;
    const fRoad = smooth(3.5, 13, Math.abs(z)), fHouse = smooth(11, 21, Math.hypot(x * .75, z - HOUSE_Z)), fPath = smooth(2, 8, Math.hypot(x - 1.8, (z - 6.5) * .5));
    const f = Math.min(fRoad, fHouse, fPath);
    h = h * f + smooth(58, 105, r) * 9 * (.6 + .6 * vnoise(x * .05, z * .05));
    return h;
  }
  reserved(x, z, pad = 0) {
    if (Math.abs(z) < 5.2 + pad) return true;
    if (x > -13 - pad && x < 13 + pad && z > 5 - pad && z < 34 + pad) return true;
    if (Math.hypot(x - FC.x, z - FC.z) > FR - 3.5 - pad * .3) return true;
    return false;
  }
  free(x, z, rad, pad = 0) {
    if (this.reserved(x, z, pad)) return false;
    for (const o of this.occ) { const d = Math.hypot(x - o.x, z - o.z); if (d < rad + o.r) return false; }
    return true;
  }
  inside(x, z, m = 1) { return Math.hypot(x - FC.x, z - FC.z) < FR - m; }
  place(res, x, z, yaw = 0, rad = 3, ly = null) {
    const y = this.terrainH(x, z); res.obj.position.set(x, y, z); res.obj.rotation.y = yaw; this.scene.add(res.obj);
    for (const c of res.cols || []) this.cols.addTransformed(c, x, z, yaw);
    const cs = Math.cos(yaw), sn = Math.sin(yaw); for (const l of res.loot || []) { const lx = l.x * cs + l.z * sn, lz = -l.x * sn + l.z * cs; this.lootSpots.push({ x: x + lx, z: z + lz, y: y + l.y, kind: 'struct', ref: res }); }
    this.occ.push({ x, z, r: rad }); return res;
  }
  // ---------- побудова ----------
  async build(progress = () => { }) {
    const g = this.g, R = this.R, scene = this.scene; let step = 0; const total = 11;
    const tick = async (label) => { step++; progress(step / total, label); await nextFrame(); };
    this.buildSky(); this.buildLights(); await tick('sky');
    this.buildTerrain(); this.buildRoad(); await tick('terrain');
    // будинок
    this.house = buildHouse(); this.house.obj.position.set(0, 0, 0); scene.add(this.house.obj); for (const c of this.house.cols) { this.cols.add(c); } this.doors = this.house.ud.doors; this.lights = this.house.ud.lights;
    this.occ.push({ x: 0, z: 18, r: 14 });
    this.crate = buildCrate(); this.crate.position.set(1.9, this.terrainH(1.9, 9), 9.0); scene.add(this.crate); this.cols.add({ t: 'b', x: 1.9, z: 9.0, hx: .6, hz: .4, yaw: 0 });
    this.gen = buildGenerator(false); this.gen.position.set(3.2, this.terrainH(3.2, 27.2), 27.2); scene.add(this.gen); this.cols.add({ t: 'c', x: 3.2, z: 27.2, r: .6 });
    this.pathMesh(); await tick('house');
    // огорожа та ворота
    this.fence = ST.buildFence(FC.x, FC.z, FR, (x, z) => this.terrainH(x, z)); scene.add(this.fence);
    for (const sx of [-1, 1]) { const gt = ST.buildGate(); const x = FC.x + sx * Math.sqrt(FR * FR - (0 - FC.z) ** 2); gt.obj.position.set(x, this.terrainH(x, 0), 0); gt.obj.rotation.y = Math.PI / 2; scene.add(gt.obj); }
    await tick('fence');
    this.buildTrees(); await tick('trees');
    this.buildStructures(); await tick('structures');
    this.buildDecor(); await tick('decor');
    this.buildPuddles(); this.buildRain(); this.buildAnimals(); await tick('misc');
    await this.buildGrass(); await tick('grass');
    this.finishLoot(); await tick('loot');
  }
  buildSky() {
    const g = this.g, scene = this.scene;
    this.sky = new Sky(); this.sky.scale.setScalar(4500); scene.add(this.sky);
    const u = this.sky.material.uniforms; u.turbidity.value = 4; u.rayleigh.value = 1.4; u.mieCoefficient.value = .006; u.mieDirectionalG.value = .82;
    this.sunDir = new THREE.Vector3();
    // зорі
    const sp = new Float32Array(1600 * 3); const r = rng(5); for (let i = 0; i < 1600; i++) { const a = r() * TAU, b = Math.acos(r() * .95), d = 3800; sp[i * 3] = Math.sin(b) * Math.cos(a) * d; sp[i * 3 + 1] = Math.cos(b) * d; sp[i * 3 + 2] = Math.sin(b) * Math.sin(a) * d; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false })); this.stars.material.size = 1.6; scene.add(this.stars);
    scene.fog = new THREE.FogExp2(0x9fb0b8, g.fog);
    if (g.env) { this.pmrem = new THREE.PMREMGenerator(this.renderer); this.envScene = new THREE.Scene(); this.envSky = new Sky(); this.envSky.scale.setScalar(4500); this.envScene.add(this.envSky); this.envT = 99; }
  }
  buildLights() {
    const g = this.g, scene = this.scene;
    this.hemi = new THREE.HemisphereLight(0xbfd4ee, 0x3a3a2a, .8); scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 3); this.sun.castShadow = g.shadows > 0;
    if (g.shadows > 0) { const s = this.sun.shadow; s.mapSize.set(g.shadowSize, g.shadowSize); const e = g.shadows > 1 ? 46 : 34; Object.assign(s.camera, { left: -e, right: e, top: e, bottom: -e, near: 1, far: 220 }); s.bias = -.0005; s.normalBias = .04; s.camera.updateProjectionMatrix(); }
    scene.add(this.sun, this.sun.target);
    this.moon = new THREE.DirectionalLight(0x6a86c0, 0); scene.add(this.moon, this.moon.target);
    this.flashLight = new THREE.DirectionalLight(0xcfe0ff, 0); this.flashLight.position.set(20, 80, 10); scene.add(this.flashLight);
  }
  buildTerrain() {
    const g = this.g, size = 300, seg = g.terr, geo = new THREE.PlaneGeometry(size, size, seg, seg); geo.rotateX(-Math.PI / 2); geo.translate(FC.x, 0, FC.z);
    const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), h = this.terrainH(x, z); p.setY(i, h);
      const n = fbm(x * .06 + 20, z * .06, 3), road = smooth(5.5, 3.2, Math.abs(z)), yard = smooth(15, 9, Math.hypot(x * .8, z - 18)), dirt = clamp(road * .9 + yard * .55 + smooth(.62, .8, fbm(x * .12, z * .12, 3)) * .6, 0, 1);
      c.setRGB(lerp(.62, .45, n), lerp(.78, .62, n), lerp(.4, .28, n)); const d = new THREE.Color(.48, .38, .28); c.lerp(d, dirt); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
    const t = texClone('grass', size / 5, size / 5);
    const mat = g.tex ? new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 2.2, vertexColors: true, roughness: 1 }) : new THREE.MeshLambertMaterial({ vertexColors: true, color: 0x6a8a44, flatShading: true });
    this.terrain = new THREE.Mesh(geo, mat); this.terrain.receiveShadow = true; this.scene.add(this.terrain);
  }
  buildRoad() {
    const scene = this.scene, len = 260, seg = 130, geo = new THREE.PlaneGeometry(len, 6.4, seg, 1); geo.rotateX(-Math.PI / 2); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, this.terrainH(p.getX(i), p.getZ(i)) + .03);
    geo.computeVertexNormals(); const t = texClone('asphalt', len / 5, 1.4); const mat = this.g.tex ? new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 1, roughness: .92 }) : new THREE.MeshLambertMaterial({ color: 0x2a2a2c, flatShading: true });
    const road = new THREE.Mesh(geo, mat); road.receiveShadow = true; scene.add(road); this.road = road;
    // розмітка
    const dash = new THREE.PlaneGeometry(2.4, .16); dash.rotateX(-Math.PI / 2); const dm = new THREE.MeshStandardMaterial({ color: 0xd9b43a, roughness: .7, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), n = 52, im = new THREE.InstancedMesh(dash, dm, n), o = new THREE.Object3D();
    for (let i = 0; i < n; i++) { const x = -128 + i * 5; o.position.set(x, this.terrainH(x, 0) + .06, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); } im.receiveShadow = true; scene.add(im);
    for (const z of [-2.9, 2.9]) { const e = new THREE.PlaneGeometry(len, .12, seg, 1); e.rotateX(-Math.PI / 2); const q = e.attributes.position; for (let i = 0; i < q.count; i++) q.setY(i, this.terrainH(q.getX(i), z) + .06); const m = new THREE.Mesh(e, new THREE.MeshStandardMaterial({ color: 0xb8b4a4, roughness: .9, transparent: true, opacity: .6, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, depthWrite: false })); m.position.z = z; scene.add(m); }
    this.roadMat = mat;
  }
  pathMesh() {
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector3(3.4 + (0.1 - 3.4) * t + Math.sin(t * 3.1) * .5, 0, 3.6 + (9.9 - 3.6) * t)); }
    const verts = [], uvs = [], idx = []; const w = .7;
    pts.forEach((p, i) => { const q = pts[Math.min(i + 1, pts.length - 1)], pr = pts[Math.max(i - 1, 0)], dx = q.x - pr.x, dz = q.z - pr.z, l = Math.hypot(dx, dz), nx = -dz / l, nz = dx / l; for (const s of [-1, 1]) { const x = p.x + nx * w * s, z = p.z + nz * w * s; verts.push(x, this.terrainH(x, z) + .05, z); uvs.push(s < 0 ? 0 : 1, i * .7); } if (i < pts.length - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const t = texClone('dirt', 1, 4); const m = new THREE.Mesh(geo, this.g.tex ? new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, color: 0xd8c0a0 }) : new THREE.MeshLambertMaterial({ color: 0x6b543a })); m.receiveShadow = true; this.scene.add(m);
    const st = M('rock', { rx: 1, ry: 1 }); for (let i = 1; i < 11; i += 2) { const p = pts[i]; const s = new THREE.Mesh(new THREE.CylinderGeometry(.28, .3, .06, 8), st); s.position.set(p.x + (i % 4 - 1.5) * .25, this.terrainH(p.x, p.z) + .06, p.z); s.receiveShadow = true; this.scene.add(s); }
    this.path = pts;
  }
  // ---------- ліс ----------
  buildTrees() {
    const g = this.g, R = rng(this.seed + 1), specs = buildTreeSpecs(), total = g.trees, inner = Math.floor(total * .55), outer = total - inner, scene = this.scene, wsum = specs.reduce((a, s) => a + s.wt, 0);
    const pts = [];
    const tryAdd = (rmin, rmax, n, collide) => { let tries = 0, got = 0; while (got < n && tries < n * 30) { tries++; const a = R() * TAU, r = Math.sqrt(R() * (rmax * rmax - rmin * rmin) + rmin * rmin), x = FC.x + Math.cos(a) * r, z = FC.z + Math.sin(a) * r; const cl = fbm(x * .05 + 9, z * .05 + 3, 3); if (R() > .35 + cl * 1.2) continue; if (collide && this.reserved(x, z, 1.2)) continue; if (!collide && Math.abs(z) < 4.5) continue; if (collide) { let ok = true; for (const q of pts) if ((q.x - x) ** 2 + (q.z - z) ** 2 < 2.2) { ok = false; break; } if (!ok) continue; } pts.push({ x, z, inner: collide }); got++; } };
    tryAdd(5, FR - 1.5, inner, true); tryAdd(FR + 1, 130, outer, false);
    const per = specs.map(() => []); for (const p of pts) { let r = R() * wsum, i = 0; for (; i < specs.length; i++) { r -= specs[i].wt; if (r <= 0) break; } per[Math.min(i, specs.length - 1)].push(p); }
    const o = new THREE.Object3D();
    specs.forEach((s, si) => {
      const list = per[si]; if (!list.length) return; const tm = new THREE.InstancedMesh(s.trunkGeo, s.trunkMat, list.length), cm = s.crownGeo ? new THREE.InstancedMesh(s.crownGeo, s.crownMat, list.length) : null;
      list.forEach((p, i) => { const sc = .8 + R() * .5, y = this.terrainH(p.x, p.z) - .15; o.position.set(p.x, y, p.z); o.rotation.set((R() - .5) * .05, R() * TAU, (R() - .5) * .05); o.scale.set(sc * (.9 + R() * .2), sc, sc * (.9 + R() * .2)); o.updateMatrix(); tm.setMatrixAt(i, o.matrix); if (cm) cm.setMatrixAt(i, o.matrix); if (p.inner) this.cols.add({ t: 'c', x: p.x, z: p.z, r: s.r * sc * .55 }); });
      for (const m of [tm, cm]) if (m) { m.castShadow = g.shadows > 0; m.receiveShadow = g.shadows > 1; m.frustumCulled = false; scene.add(m); }
    });
    this.treePts = pts;
  }
  // ---------- споруди й декор ----------
  buildStructures() {
    const R = rng(this.seed + 2), pr = this.g.props, find = (rad, tries = 80, pad = 2) => { for (let i = 0; i < tries; i++) { const a = R() * TAU, r = Math.sqrt(R()) * (FR - 8), x = FC.x + Math.cos(a) * r, z = FC.z + Math.sin(a) * r; if (this.free(x, z, rad, pad) && !this.cols.blocked(x, z, rad)) return [x, z]; } return null; };
    const put = (build, rad, yawR = TAU, cb) => { const pos = find(rad); if (!pos) return null; const res = build(); this.place(res, pos[0], pos[1], R() * yawR, rad); this.structs.push(res); cb && cb(res, pos); return res; };
    const nT = Math.min(3, 1 + R.int(0, 2)); for (let i = 0; i < nT; i++) put(() => ST.buildTower(), 5, TAU, (res, pos) => this.towers.push({ ...res, x: pos[0], z: pos[1] }));
    for (let i = 0; i < 1 + R.int(0, 1); i++) put(() => ST.buildHut(), 6, TAU, res => this.huts.push(res));
    const nU = 2 + R.int(0, 1); for (let i = 0; i < nU; i++) put(() => ST.buildUnfinished(R.int(0, 2), R.int(1, 99)), 6);
    for (let i = 0; i < 1 + R.int(0, 1); i++) put(() => ST.buildWreck(R.int(1, 9)), 3.5);
    put(() => ST.buildWell(), 3); const tent = put(() => ST.buildTent(), 3.5); if (tent) { const p = tent.obj.position; const cf = ST.buildCampfire(); const a = R() * TAU; this.place(cf, p.x + Math.cos(a) * 4, p.z + Math.sin(a) * 4, 0, 1.5); }
    put(() => ST.buildOuthouse(), 2.5); put(() => ST.buildTank(), 3); put(() => ST.buildSign(), 1.5, .5);
    const n = Math.round(pr * 1); for (let i = 0; i < 2; i++) put(() => ST.buildBarrels(), 2); for (let i = 0; i < 2; i++) put(() => ST.buildHay(), 1.5); for (let i = 0; i < 3; i++) put(() => ST.buildPole(), 1.2); for (let i = 0; i < 3; i++) put(() => ST.buildScarecrow(), 1.2);
    for (let i = 0; i < Math.round(8 * pr); i++) put(() => ST.buildAnthill(), 1.0);
    for (let i = 0; i < Math.round(10 * pr); i++) put(() => ST.buildLog(), 2); for (let i = 0; i < Math.round(8 * pr); i++) put(() => ST.buildStump(), 1.0);
    for (let i = 0; i < Math.round(12 * pr); i++) put(() => ST.buildFlowers(R.int(1, 99)), .8); for (let i = 0; i < Math.round(8 * pr); i++) put(() => ST.buildMushDecor(), .6);
  }
  buildDecor() {
    const R = rng(this.seed + 3), pr = this.g.props, scene = this.scene, o = new THREE.Object3D();
    const inst = (geo, mat, count, rad, scaleR, solid, wind, cast) => {
      const pts = []; let tries = 0; while (pts.length < count && tries < count * 25) { tries++; const a = R() * TAU, r = Math.sqrt(R()) * (FR - 2), x = FC.x + Math.cos(a) * r, z = FC.z + Math.sin(a) * r; if (this.reserved(x, z, .5)) continue; let bad = false; for (const q of this.occ) if (Math.hypot(x - q.x, z - q.z) < q.r * .8) { bad = true; break; } if (bad) continue; pts.push([x, z]); }
      if (!pts.length) return; const im = new THREE.InstancedMesh(geo, mat, pts.length); pts.forEach(([x, z], i) => { const s = scaleR[0] + R() * (scaleR[1] - scaleR[0]); o.position.set(x, this.terrainH(x, z) - .05, z); o.rotation.set(0, R() * TAU, 0); o.scale.set(s * (.85 + R() * .3), s * (.8 + R() * .4), s * (.85 + R() * .3)); o.updateMatrix(); im.setMatrixAt(i, o.matrix); if (solid && s > solid) this.cols.add({ t: 'c', x, z, r: rad * s }); if (solid && s > solid * 1.15 && R() < .5) this.lootSpots.push({ x, z, y: this.terrainH(x, z), kind: 'bush' }); });
      im.castShadow = cast && this.g.shadows > 0; im.receiveShadow = true; im.frustumCulled = false; scene.add(im); if (wind) applyWind(mat, wind);
    };
    const rockM = M('rock', { rx: 1, ry: 1, rough: 1 }); for (let k = 0; k < 3; k++) inst(rockGeo(10 + k * 7, this.g.tex ? 2 : 1), rockM, Math.round(14 * pr), .9, [.4, 1.7], .75, null, true);
    const bushM = M('leaves', { rx: 1, ry: 1, side: THREE.DoubleSide }).clone(); for (let k = 0; k < 2; k++) inst(bushGeo(40 + k), bushM, Math.round(36 * pr), .5, [.7, 1.5], 1.15, { amp: .05, flutter: .8, hScale: 1.2 }, false);
    if (this.g.tex) { const fm = new THREE.MeshStandardMaterial({ color: 0x4f7a34, side: THREE.DoubleSide, roughness: .9, map: texClone('leaves', 1, 1).map }); inst(fernGeo(5), fm, Math.round(90 * pr), .1, [.8, 1.6], 0, { amp: .08, flutter: 1.2, hScale: 1.1 }, false); }
  }
  async buildGrass() {
    const g = this.g; this.grassChunks = []; if (!g.grass) return;
    const R = rng(this.seed + 4), geo = bladeGeo(), CH = 14, o = new THREE.Object3D(), gm = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: .85, vertexColors: false });
    applyWind(gm, { amp: .18, flutter: .5, hScale: 1.0, grass: true });
    const col = new THREE.Color(); let n = 0;
    for (let cx = -FR; cx < FR; cx += CH) for (let cz = -FR + FC.z; cz < FR + FC.z; cz += CH) {
      const mx = cx + CH / 2, mz = cz + CH / 2; if (Math.hypot(mx - FC.x, mz - FC.z) > FR + 6) continue;
      const cnt = Math.floor(g.grass * CH * CH); const pts = [];
      for (let i = 0; i < cnt; i++) { const x = cx + R() * CH, z = cz + R() * CH; if (Math.hypot(x - FC.x, z - FC.z) > FR - 1) continue; if (Math.abs(z) < 3.8) continue; if (x > -8.5 && x < 8.5 && z > 8.5 && z < 27.5) continue; if (Math.hypot(x - 1.8, z - 6.5) < 2.2 && z < 10.5) continue; pts.push([x, z]); }
      if (!pts.length) continue;
      const im = new THREE.InstancedMesh(geo, gm, pts.length); pts.forEach(([x, z], i) => { const h = .35 + R() * .6; o.position.set(x, this.terrainH(x, z) - .02, z); o.rotation.set(0, R() * TAU, 0); o.scale.set(.8 + R() * .8, h, .8 + R() * .8); o.updateMatrix(); im.setMatrixAt(i, o.matrix); const k = R(); col.setRGB(.2 + k * .25, .38 + k * .3, .1 + k * .12); im.setColorAt(i, col); });
      im.instanceColor.needsUpdate = true; im.frustumCulled = false; im.receiveShadow = false; im.castShadow = false; this.scene.add(im); this.grassChunks.push({ m: im, x: mx, z: mz }); n++;
      if (n % 6 === 0) await nextFrame();
    }
  }
  buildPuddles() {
    const R = rng(this.seed + 5), n = Math.round(8 * this.g.props), mat = new THREE.MeshStandardMaterial({ color: 0x0c1418, roughness: .03, metalness: .9, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }); this.puddleMat = mat;
    let tries = 0; while (this.puddles.length < n && tries < 400) { tries++; const a = R() * TAU, r = Math.sqrt(R()) * (FR - 6), x = FC.x + Math.cos(a) * r, z = FC.z + Math.sin(a) * r; if (this.reserved(x, z, 1) || this.cols.blocked(x, z, 1.5)) continue; const s = 1.2 + R() * 1.8; const m = new THREE.Mesh(new THREE.CircleGeometry(1, 24), mat); m.rotation.x = -Math.PI / 2; m.scale.set(s * (1 + R() * .5), s, 1); m.position.set(x, this.terrainH(x, z) + .04, z); this.scene.add(m); this.puddles.push({ x, z, r: s }); this.occ.push({ x, z, r: s * .6 }); }
    // болотні плями (завжди вологі)
    const mud = M('mud', { rx: 1, ry: 1 }); for (let i = 0; i < Math.round(4 * this.g.props); i++) { const a = R() * TAU, r = Math.sqrt(R()) * (FR - 8), x = FC.x + Math.cos(a) * r, z = FC.z + Math.sin(a) * r; if (this.reserved(x, z, 1) || this.cols.blocked(x, z, 2)) continue; const m = new THREE.Mesh(new THREE.CircleGeometry(2.2, 20), new THREE.MeshStandardMaterial({ color: 0x1a1812, roughness: .15, metalness: .5, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })); m.rotation.x = -Math.PI / 2; m.position.set(x, this.terrainH(x, z) + .045, z); this.scene.add(m); this.puddles.push({ x, z, r: 2.2, swamp: true }); this.occ.push({ x, z, r: 2 }); }
  }
  buildRain() {
    const N = this.g.rainN; this.rainN = N; const pos = new Float32Array(N * 6); this.rainPos = pos; for (let i = 0; i < N; i++) { const x = (Math.random() - .5) * 40, y = Math.random() * 24, z = (Math.random() - .5) * 40; pos.set([x, y, z, x, y - .6, z], i * 6); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); this.rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xaab8c8, transparent: true, opacity: .0, depthWrite: false })); this.rain.frustumCulled = false; this.scene.add(this.rain);
  }
  buildAnimals() {
    const R = rng(this.seed + 6), kinds = ['deer', 'fox', 'hare', 'hedgehog', 'owl', 'badger', 'raven', 'boar'], n = Math.round(10 * Math.min(1.2, this.g.props));
    for (let i = 0; i < n; i++) { const k = kinds[i % kinds.length]; let x, z, t = 0; do { const a = R() * TAU, r = Math.sqrt(R()) * (FR - 8); x = FC.x + Math.cos(a) * r; z = FC.z + Math.sin(a) * r; t++; } while ((this.reserved(x, z, 3) || this.cols.blocked(x, z, 1)) && t < 40); const m = buildAnimal(k); m.position.set(x, this.terrainH(x, z), z); this.scene.add(m); this.animals.push({ kind: k, m, x, z, tx: x, tz: z, yaw: R() * TAU, wait: R() * 4, sp: 0 }); }
  }
  finishLoot() {
    // базові точки землі
    const R = rng(this.seed + 7); this.groundSpots = []; let tries = 0; while (this.groundSpots.length < 300 && tries < 3000) { tries++; const a = R() * TAU, r = Math.sqrt(R()) * (FR - 4), x = FC.x + Math.cos(a) * r, z = FC.z + Math.sin(a) * r; if (this.reserved(x, z, .5) || this.cols.blocked(x, z, .5)) continue; this.groundSpots.push({ x, z, y: this.terrainH(x, z), kind: 'ground' }); }
    for (const t of this.towers) { /* лише точки з m_struct */ }
  }
  // ---------- щокадрове оновлення ----------
  setSun() {
    const h = this.hour, a = (h - 6) / 12 * Math.PI, d = this.sunDir.set(Math.cos(a) * .9, Math.sin(a), .38).normalize(); this.elev = d.y; return d;
  }
  update(dt, cam, o = {}) {
    const g = this.g, h = this.hour, d = this.setSun(), e = d.y, day = smooth(-.05, .25, e), dusk = 1 - Math.abs(clamp(e / .3, -1, 1)), night = 1 - smooth(-.2, .05, e), rain = this.rainAmt;
    const weatherDark = 1 - rain * .55 - (this.weather === 'cloudy' ? .25 : 0) - (this.weather === 'fog' ? .3 : 0);
    // небо
    const su = this.sky.material.uniforms; su.sunPosition.value.copy(d); su.turbidity.value = lerp(3, 14, rain + (this.weather === 'cloudy' ? .5 : 0)); su.rayleigh.value = lerp(.3, 2.2, day) * (1 - rain * .4); su.mieCoefficient.value = .005 + rain * .02;
    this.stars.material.opacity = clamp(night * (1 - rain * .9), 0, 1); this.stars.position.copy(cam.position);
    this.sky.position.copy(cam.position);
    // сонце / місяць
    this.sun.position.copy(cam.position).addScaledVector(d, 120); this.sun.target.position.copy(cam.position);
    const warm = new THREE.Color(1, .55 + .45 * smooth(0, .5, e), .3 + .6 * smooth(0, .6, e)); this.sun.color.copy(warm);
    this.sun.intensity = Math.max(0, smooth(-.02, .2, e)) * 3.4 * weatherDark; this.sun.visible = this.sun.intensity > .01;
    if (g.shadows > 0) { const s = this.sun.shadow, sz = s.camera.right * 2 / g.shadowSize; this.sun.target.position.set(Math.round(cam.position.x / sz) * sz, 0, Math.round(cam.position.z / sz) * sz); this.sun.position.copy(this.sun.target.position).addScaledVector(d, 120); }
    this.moon.position.copy(cam.position).add(new THREE.Vector3(-d.x * 60, 80, -d.z * 60 + 20)); this.moon.target.position.copy(cam.position); this.moon.intensity = night * .55 * (1 - rain * .5);
    this.hemi.intensity = lerp(.12, .85, day) * (.7 + .3 * weatherDark) + night * .05;
    this.hemi.color.setRGB(lerp(.15, .75, day) + dusk * .25, lerp(.2, .83, day), lerp(.34, .93, day)); this.hemi.groundColor.setRGB(.18 * day + .03, .18 * day + .03, .12 * day + .03);
    // туман
    const fogCol = new THREE.Color().setRGB(lerp(.02, .62, day) + dusk * .22, lerp(.03, .69, day) + dusk * .08, lerp(.05, .72, day)).multiplyScalar(.5 + .5 * weatherDark);
    this.scene.fog.color.copy(fogCol); const fogMul = 1 + rain * 1.2 + (this.weather === 'fog' ? 2.6 : 0) + night * .8; this.scene.fog.density = g.fog * fogMul;
    if (this.scene.background !== null && !g.sky) this.scene.background = fogCol;
    // блискавка
    if (this.weather === 'storm' && Math.random() < dt * .08) { this.flash = 1; o.onThunder && setTimeout(o.onThunder, 400 + Math.random() * 2500); }
    this.flash = Math.max(0, this.flash - dt * 3.5); this.flashLight.intensity = this.flash * 6 * (Math.random() > .3 ? 1 : .3);
    // дощ / калюжі
    const target = (this.weather === 'rain' || this.weather === 'storm') ? 1 : 0; this.rainAmt += (target - this.rainAmt) * Math.min(1, dt * .35);
    this.wet = clamp(this.wet + (this.rainAmt > .3 ? dt * .03 : -dt * .004), 0, 1);
    this.puddleMat.opacity = this.wet * .85;
    this.rain.material.opacity = this.rainAmt * .38; this.rain.visible = this.rainAmt > .02;
    if (this.rain.visible) {
      const p = this.rainPos, c = cam.position, N = this.rainN, fall = 24 * dt, wx = windU.uWind.value.x * 4 * dt, wz = windU.uWind.value.y * 4 * dt;
      for (let i = 0; i < N; i++) { const k = i * 6; p[k + 1] -= fall; p[k] += wx; p[k + 2] += wz; if (p[k + 1] < -2) { p[k] = (Math.random() - .5) * 40; p[k + 1] = 18 + Math.random() * 6; p[k + 2] = (Math.random() - .5) * 40; } p[k + 3] = p[k] - wx * 3; p[k + 4] = p[k + 1] + .7; p[k + 5] = p[k + 2] - wz * 3; }
      this.rain.position.set(c.x, c.y - 4, c.z); this.rain.geometry.attributes.position.needsUpdate = true;
    }
    // вітер
    windU.uTime.value += dt; const wst = (this.weather === 'storm' ? 2.2 : this.weather === 'rain' ? 1.5 : this.weather === 'cloudy' ? 1.1 : .8); windU.uStrength.value += (wst - windU.uStrength.value) * dt * .3; windU.uGust.value = this.flash * .3;
    this.windLevel = windU.uStrength.value;
    // трава – видимість за відстанню
    if (this.grassChunks) { const R = g.grassR + 12; for (const c of this.grassChunks) c.m.visible = Math.hypot(c.x - cam.position.x, c.z - cam.position.z) < R; }
    // оточення (відблиски)
    if (g.env && this.pmrem) { this.envT += dt; if (this.envT > 20) { this.envT = 0; const eu = this.envSky.material.uniforms; for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) eu[k].value = su[k].value; eu.sunPosition.value.copy(d); const rt = this.pmrem.fromScene(this.envScene, 0, 1, 2000); if (this.envRT) this.envRT.dispose(); this.envRT = rt; this.scene.environment = rt.texture; this.scene.environmentIntensity = clamp(.15 + day * .85, .06, 1); } if (this.scene.environment) this.scene.environmentIntensity = clamp(.12 + day * .8, .05, 1); }
    this.day = day; this.night = night;
    // тварини
    for (const a of this.animals) this.updAnimal(a, dt, o.players || []);
    // кімнатні лампочки/ліхтарі
    this.exposure = lerp(.62, 1.0, day) * (1 - rain * .1);
  }
  updAnimal(a, dt, players) {
    let fx = 0, fz = 0, danger = 0; for (const p of players) { const dx = a.x - p.x, dz = a.z - p.z, d = Math.hypot(dx, dz); if (d < 11 && !p.dead) { fx += dx / d; fz += dz / d; danger = Math.max(danger, 1 - d / 11); } }
    if (danger > 0) { a.tx = a.x + fx * 8; a.tz = a.z + fz * 8; a.wait = 0; }
    else if (a.wait > 0) { a.wait -= dt; a.sp = 0; }
    else if (Math.hypot(a.tx - a.x, a.tz - a.z) < .6) { a.wait = 2 + Math.random() * 5; const ang = Math.random() * TAU; a.tx = a.x + Math.cos(ang) * 8; a.tz = a.z + Math.sin(ang) * 8; }
    const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz), flying = a.kind === 'raven' || a.kind === 'owl';
    if (d > .3 && a.wait <= 0) { const sp = (danger > 0 ? 6 : 1.2) * (flying ? .9 : 1); a.sp = sp; let nx = a.x + dx / d * sp * dt, nz = a.z + dz / d * sp * dt; [nx, nz] = this.cols.resolve(nx, nz, .4); if (!this.inside(nx, nz, 3)) { a.tx = FC.x; a.tz = FC.z + 8; } else { a.x = nx; a.z = nz; } const ty = Math.atan2(-dx, -dz); let df = ty - a.yaw; while (df > Math.PI) df -= TAU; while (df < -Math.PI) df += TAU; a.yaw += df * Math.min(1, dt * 6); } else a.sp = 0;
    a.m.position.set(a.x, this.terrainH(a.x, a.z) + (flying && danger > 0 ? 2 + Math.sin(performance.now() * .01) * .2 : 0), a.z); a.m.rotation.y = a.yaw;
    const lg = a.m.userData.legs; if (lg && lg.length) { a.ph = (a.ph || 0) + dt * a.sp * 3; lg.forEach((l, i) => { l.rotation.x = Math.sin(a.ph + (i % 2 ? 1 : 0) * 3.14) * .6 * Math.min(1, a.sp); }); }
    a.m.visible = Math.hypot(a.x - (players[0]?.x ?? 0), a.z - (players[0]?.z ?? 0)) < 70;
  }
  setCovered(v) { this.gen.userData.cover.visible = v; this.genCovered = v; }
}
