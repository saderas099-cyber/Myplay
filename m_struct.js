import { THREE, B, RB, C, S, CONE, G, rot, PL, V3, extrude, shapeOf } from './geo.js';
import { M, P, glass } from './mats.js';
import { canvasTex } from './tex.js';
import { rng, TAU } from './util.js';

const box = (x, z, hx, hz, yaw = 0) => ({ t: 'b', x, z, hx, hz, yaw });
const circ = (x, z, r) => ({ t: 'c', x, z, r });
const ret = (obj, cols = [], loot = [], ud = {}) => { obj.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); return { obj, cols, loot, ud }; };

export function chainTex() {
  return canvasTex(128, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(160,166,170,0.95)'; g.lineWidth = 2.2; for (let i = -2; i < 10; i++) { g.beginPath(); g.moveTo(i * 16, 0); g.lineTo(i * 16 + 128, 128); g.stroke(); g.beginPath(); g.moveTo(i * 16 + 128, 0); g.lineTo(i * 16, 128); g.stroke(); } });
}
export function buildFence(cx, cz, radius, hAt, gates = []) {
  const grp = new THREE.Group(), n = Math.round(radius * TAU / 3.0), H = 2.6, tx = chainTex(); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(3 / .5, H / .5);
  const meshM = new THREE.MeshStandardMaterial({ map: tx, transparent: true, alphaTest: .35, side: THREE.DoubleSide, roughness: .5, metalness: .7 });
  const postM = P(0x6a6e72, { rough: .55, metal: .7 }), wireM = new THREE.LineBasicMaterial({ color: 0x8a8e92 });
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(.045, .055, H + .6, 6), postM, n); posts.castShadow = true;
  const dummy = new THREE.Object3D(), panels = [], wires = [], barbs = [];
  for (let i = 0; i < n; i++) {
    const a0 = i / n * TAU, a1 = (i + 1) / n * TAU, x0 = cx + Math.cos(a0) * radius, z0 = cz + Math.sin(a0) * radius, x1 = cx + Math.cos(a1) * radius, z1 = cz + Math.sin(a1) * radius, y0 = hAt(x0, z0), y1 = hAt(x1, z1);
    dummy.position.set(x0, y0 + (H + .6) / 2 - .1, z0); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); posts.setMatrixAt(i, dummy.matrix);
    const len = Math.hypot(x1 - x0, z1 - z0), pl = new THREE.Mesh(new THREE.PlaneGeometry(len, H), meshM); pl.position.set((x0 + x1) / 2, (y0 + y1) / 2 + H / 2, (z0 + z1) / 2); pl.rotation.y = -Math.atan2(z1 - z0, x1 - x0); grp.add(pl);
    // перекладини + колючий дріт
    for (let k = 0; k < 3; k++) { const yy = H + .12 + k * .12; wires.push(new THREE.Vector3(x0, y0 + yy, z0), new THREE.Vector3(x1, y1 + yy, z1)); for (let b = 0; b < 5; b++) { const t = (b + .5) / 5; barbs.push(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + yy, z0 + (z1 - z0) * t); } }
    wires.push(new THREE.Vector3(x0, y0 + H, z0), new THREE.Vector3(x1, y1 + H, z1), new THREE.Vector3(x0, y0 + .05, z0), new THREE.Vector3(x1, y1 + .05, z1));
    const arm = rot(B(.04, .5, .04, postM, x0, y0 + H + .25, z0), 0, 0, 0); arm.rotation.z = 0; grp.add(arm);
  }
  grp.add(posts);
  grp.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wires), wireM));
  const bg = new THREE.BufferGeometry(); const bp = new Float32Array(barbs.length * 6); for (let i = 0; i < barbs.length / 3; i++) { bp.set([barbs[i * 3] - .03, barbs[i * 3 + 1] - .03, barbs[i * 3 + 2], barbs[i * 3] + .03, barbs[i * 3 + 1] + .03, barbs[i * 3 + 2]], i * 6); } bg.setAttribute('position', new THREE.BufferAttribute(bp, 3)); grp.add(new THREE.LineSegments(bg, wireM));
  grp.traverse(c => { if (c.isMesh) c.receiveShadow = true; });
  return grp;
}
export function buildGate() { // залізні ворота (декор) на дорозі
  const g = new THREE.Group(), m = P(0x2c3034, { rough: .5, metal: .7 });
  for (const s of [-1, 1]) { g.add(B(.3, 3.4, .3, m, s * 3.4, 1.7, 0)); for (let i = 0; i < 8; i++) g.add(B(.05, 2.4, .05, m, s * (.35 + i * .38), 1.3, 0)); g.add(B(3, .08, .08, m, s * 1.9, 2.4, 0), B(3, .08, .08, m, s * 1.9, .4, 0)); }
  g.add(B(7.1, .25, .25, m, 0, 3.4, 0));
  return ret(g, [box(-3.4, 0, .3, .3), box(3.4, 0, .3, .3)]);
}
export function buildTower() {
  const g = new THREE.Group(), wood = M('planks', { rx: 1, ry: 1 }), met = P(0x4a4e50, { rough: .6, metal: .6 }), H = 7.4;
  for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) { const l = C(.1, .12, H + .6, 6, wood, x * .85, H / 2, z * .85); l.rotation.set(z * .02, 0, -x * .02); g.add(l); }
  for (let lv = 1; lv <= 3; lv++) { const y = lv * 2; for (const [a, b, c, d] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) { const len = Math.hypot(c - a, d - b) * 1.1; const br = B(len, .08, .06, wood, (a + c) * .5 * 1.0, y, (b + d) * .5 * 1.0); br.rotation.y = Math.atan2(-(d - b), c - a); g.add(br); } const dg = B(3.2, .08, .06, wood, 0, y + 1, -1.1); dg.rotation.z = .6; g.add(dg); }
  g.add(B(3.2, .2, 3.2, wood, 0, H, 0)); for (const s of [-1, 1]) { g.add(B(.08, 1.1, 3.2, wood, s * 1.55, H + .65, 0), B(3.2, 1.1, .08, wood, 0, H + .65, s * 1.55)); }
  const roof = CONE(2.7, 1.5, 4, M('corrug', { rx: 2, ry: 2 }), 0, H + 2.7, 0); roof.rotation.y = Math.PI / 4; g.add(roof); for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) g.add(B(.1, 2, .1, wood, x, H + 1.1, z));
  g.add(B(.08, H, .08, wood, 0.0, H / 2, 1.9), B(.08, H, .08, wood, .5, H / 2, 1.9)); for (let i = 0; i < 18; i++) g.add(B(.5, .05, .05, wood, .25, .3 + i * .4, 1.9));
  g.add(B(.9, .55, .7, P(0x3b4a32), -.8, H + .4, -.8));
  const ud = { ladderBase: V3(.25, 0, 2.2), top: V3(0, H + .1, 0), H };
  return ret(g, [box(-1, -1, .2, .2), box(1, -1, .2, .2), box(-1, 1, .2, .2), box(1, 1, .2, .2)], [V3(0, H + .3, 0), V3(.9, H + .3, -.9)], ud);
}
export function buildHut() {
  const g = new THREE.Group(), wall = M('planks', { rx: 2, ry: 1, color: 0x9a8a78 }), roof = M('shingle', { rx: 2, ry: 2 }), W = 4.2, D = 3.2, H = 2.3;
  g.add(B(W + .2, .2, D + .2, M('concrete'), 0, .1, 0), B(W, .06, D, M('floor', { rx: 2, ry: 2 }), 0, .22, 0));
  g.add(B(W, H, .15, wall, 0, H / 2 + .2, -D / 2), B(.15, H, D, wall, -W / 2, H / 2 + .2, 0), B(.15, H, D, wall, W / 2, H / 2 + .2, 0));
  g.add(B(W * .35, H, .15, wall, -W * .325, H / 2 + .2, D / 2), B(W * .35, H, .15, wall, W * .325, H / 2 + .2, D / 2), B(W * .3, .5, .15, wall, 0, H - .05 + .2, D / 2));
  for (const s of [-1, 1]) { const r = B(W + .6, .1, D / 2 + .5, roof, 0, H + .7, s * (D / 4 + .1)); r.rotation.x = s * .55 * -1; r.position.y = H + .55 + .2; g.add(r); }
  g.add(B(W + .7, .12, .2, M('planks'), 0, H + 1.0, 0));
  const door = B(.06, 1.9, .9, wall, 0, 1.15, 0); door.rotation.y = .9; door.position.set(-.5, 1.15, D / 2 + .2); g.add(door);
  g.add(B(.9, .8, .06, glass(0x334455, .4), 1.2, 1.4, -D / 2 + .1), B(1.1, .05, .1, wall, 1.2, 1.85, -D / 2 + .1), B(1.1, .05, .1, wall, 1.2, .95, -D / 2 + .1));
  g.add(RB(1.2, .5, .6, .03, M('planks'), -1.2, .5, -1), RB(.9, .1, 1.5, .02, P(0x5a4a3a), 1.2, .4, -.3), B(.8, .5, .6, M('planks'), 1.5, .5, 1.0));
  g.add(C(.15, .15, 1.2, 10, P(0x5a5a5a, { metal: .5 }), 1.6, H + 1.0, -.8));
  return ret(g, [box(0, -D / 2, W / 2, .1), box(-W / 2, 0, .1, D / 2), box(W / 2, 0, .1, D / 2), box(-W * .325, D / 2, W * .175, .1), box(W * .325, D / 2, W * .175, .1)], [V3(-1.2, .8, -1), V3(1.0, .8, 1.0), V3(0, .3, 0)], { enterable: true });
}
export function buildUnfinished(kind, seed = 1) {
  const g = new THREE.Group(), r = rng(seed), cols = [], loot = [];
  if (kind === 0) { // цегляні стіни
    const bm = M('brick', { rx: 3, ry: 1 }), cm = M('concrete', { rx: 2, ry: 1 });
    g.add(B(7, .3, 5.5, cm, 0, .15, 0));
    const walls = [[0, -2.6, 7, .25, 2.2], [-3.4, 0, .25, 5.2, 1.5], [3.4, .6, .25, 3.8, 2.4], [-1.8, 2.6, 3, .25, 1.0]];
    for (const [x, z, w, d, h] of walls) { g.add(B(w, h, d, bm, x, .3 + h / 2, z)); cols.push(box(x, z, w / 2, d / 2)); }
    for (let i = 0; i < 6; i++) g.add(C(.012, .012, 2.5, 6, P(0x7a4a2a, { rough: .8, metal: .5 }), -3 + i * 1.2, 1.6, -2.7 + r() * .1));
    for (let i = 0; i < 12; i++) g.add(B(.22, .07, .1, bm, 4.6 + (i % 4) * .24, .05 + Math.floor(i / 4) * .08, 1.5 + r() * .1));
    g.add(B(1.6, .3, 1.0, M('planks'), 2.4, .15, 3.4), B(.5, .5, .5, P(0xd0d0cc), 1.0, .55, 0)); loot.push(V3(-1, .35, 0), V3(4.6, .45, 1.5));
  } else if (kind === 1) { // бетонний каркас
    const cm = M('concrete', { rx: 2, ry: 2 });
    g.add(B(6, .35, 6, cm, 0, .17, 0));
    for (const [x, z] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6], [0, -2.6]]) { g.add(B(.45, 3.4, .45, cm, x, 2.0, z)); cols.push(box(x, z, .25, .25)); for (const dx of [-.15, .15]) g.add(C(.012, .012, 1.1, 6, P(0x7a4a2a, { rough: .9 }), x + dx, 4.2, z + .1)); }
    g.add(B(6, .3, 6, cm, 0, 3.9, 0)); g.add(B(1, .12, 1, P(0x4a4a4a, { rough: .7 }), 0, .4, 0)); for (let i = 0; i < 4; i++) g.add(C(.08, .08, 1.2, 8, P(0x6a6a6a), -1.2 + i * .15, .35, 1.5)); loot.push(V3(0, .45, 1), V3(-2, .45, 1));
  } else { // дерев'яний каркас
    const wd = M('planks', { rx: 1, ry: 1 });
    g.add(B(6, .2, 4.4, M('concrete'), 0, .1, 0));
    for (let i = 0; i < 6; i++) { g.add(B(.12, 2.6, .12, wd, -2.8 + i * 1.12, 1.5, -2.0)); g.add(B(.12, 2.6, .12, wd, -2.8 + i * 1.12, 1.5, 2.0)); }
    g.add(B(6, .12, .12, wd, 0, 2.8, -2.0), B(6, .12, .12, wd, 0, 2.8, 2.0), B(.12, .12, 4, wd, -2.8, 2.8, 0), B(.12, .12, 4, wd, 2.8, 2.8, 0), B(6, .1, .08, wd, 0, 1.5, -2.0));
    const br = B(3, .1, .08, wd, -1.5, 1.6, -2.0); br.rotation.z = .8; g.add(br);
    for (let i = 0; i < 5; i++) g.add(B(.12, .12, 3.2, wd, 4.2, .15 + i * .13, -1.0 + (i % 2) * .05)); g.add(rot(B(3.2, .06, .3, wd, -2.0, .5, 2.6), 0, .2, 0));
    cols.push(box(0, -2, 3, .12), box(0, 2, 3, .12)); loot.push(V3(0, .3, 0), V3(4.2, .5, -1));
  }
  return ret(g, cols, loot);
}
export function buildWreck(seed = 1) {
  const g = new THREE.Group(), rm = M('rust', { rx: 2, ry: 1, color: 0xcc9966 }), dk = P(0x181818), gl = glass(0x556655, .25);
  g.add(RB(1.8, .6, 4.2, .12, rm, 0, .65, 0), RB(1.6, .55, 2.0, .15, rm, 0, 1.15, .3), B(1.5, .02, .02, dk, 0, 1.12, -.7));
  for (const [x, z] of [[-.9, -1.4], [.9, -1.4], [-.9, 1.4], [.9, 1.4]]) { const w = rot(C(.32, .32, .22, 14, P(0x141414, { rough: .95 }), x, .27, z), 0, 0, Math.PI / 2); w.position.y = x < 0 && z < 0 ? .25 : .32; g.add(w); }
  g.add(B(1.2, .04, .8, gl, 0, 1.45, .3)); const hood = B(1.6, .05, 1.4, rm, 0, 1.0, -1.5); hood.rotation.x = -.55; hood.position.y = 1.35; hood.position.z = -1.9; g.add(hood);
  g.rotation.z = .05; return ret(g, [box(0, 0, 1.0, 2.2)], [V3(0, 1.0, -1.4), V3(1.5, .2, .6), V3(0, 1.5, .4)]);
}
export function buildWell() { const g = new THREE.Group(), st = M('rock', { rx: 2, ry: 1 }); g.add(C(.95, 1.05, 1.0, 14, st, 0, .5, 0), C(.7, .7, 1.02, 14, P(0x0a0a0a), 0, .5, 0)); g.add(B(.1, 2.0, .1, M('planks'), -.9, 1.9, 0), B(.1, 2.0, .1, M('planks'), .9, 1.9, 0), C(.04, .04, 1.9, 8, M('planks'), 0, 2.4, 0)); g.children[g.children.length - 1].rotation.z = Math.PI / 2; const r = B(2.4, .08, 1.5, M('shingle', { rx: 1, ry: 1 }), 0, 3.1, .5); r.rotation.x = .5; g.add(r); const r2 = B(2.4, .08, 1.5, M('shingle'), 0, 3.1, -.5); r2.rotation.x = -.5; g.add(r2); return ret(g, [circ(0, 0, 1.1)], [V3(1.5, .2, 0)]); }
export function buildTent() { const g = new THREE.Group(), cl = P(0x3a5a3c, { rough: 1, side: THREE.DoubleSide }); const sh = shapeOf([[-1, 0], [0, 1.3], [1, 0]]); const t = extrude(sh, 2.2, cl, 0); t.position.z = -1.1; g.add(t); g.add(B(.7, .02, .6, P(0x2a2a2a), 0, .06, 1.2), B(1, .15, .5, P(0x6a4a3a), -1.6, .1, .5)); const bag = S(.35, P(0x6a2a2a), 1.4, .25, .8, 1, .7, 1.4); g.add(bag); return ret(g, [box(0, 0, 1.0, 1.1)], [V3(1.4, .3, .8), V3(0, .2, 1.4)]); }
export function buildCampfire() { const g = new THREE.Group(), st = M('rock'); for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, s = S(.18, st, Math.cos(a) * .7, .1, Math.sin(a) * .7, 1, .7, 1); g.add(s); } for (let i = 0; i < 4; i++) g.add(rot(C(.07, .07, .9, 6, P(0x1a1410, { rough: 1 }), 0, .12, 0), 1.3, i * 1.57 + .3, 0)); g.add(C(.55, .6, .04, 14, P(0x120e0a), 0, .02, 0)); const lg = rot(B(.3, .3, 1.8, M('planks'), 1.8, .2, .4), 0, .4, 0); g.add(lg); return ret(g, [], [V3(1, .2, -1)]); }
export function buildSign() { const g = new THREE.Group(); g.add(B(.1, 2, .1, M('planks'), 0, 1, 0)); const tx = canvasTex(256, 96, (c, w, h) => { c.fillStyle = '#e3c36a'; c.fillRect(0, 0, w, h); c.fillStyle = '#222'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.fillText('← ВИХІД НЕМАЄ', 128, 58); }); g.add(B(1.3, .5, .05, new THREE.MeshStandardMaterial({ map: tx, roughness: .8 }), .2, 1.8, 0)); g.rotation.z = .04; return ret(g, [circ(0, 0, .15)]); }
export function buildBarrels() { const g = new THREE.Group(); const cs = [0x2f5a8a, 0x8a2f2a, 0x3a3a3a]; for (let i = 0; i < 3; i++) { const b = C(.3, .3, .9, 14, P(cs[i], { rough: .5, metal: .5 }), (i - 1) * .7, .45, (i % 2) * .4); g.add(b, C(.31, .31, .04, 14, P(0x777777, { metal: .8 }), (i - 1) * .7, .6, (i % 2) * .4), C(.31, .31, .04, 14, P(0x777777, { metal: .8 }), (i - 1) * .7, .2, (i % 2) * .4)); } return ret(g, [circ(-.7, 0, .35), circ(0, .4, .35), circ(.7, 0, .35)], [V3(0, .9, .4)]); }
export function buildHay() { const g = new THREE.Group(); g.add(rot(C(.6, .6, 1.2, 16, P(0xc8a84a, { rough: 1 }), 0, .6, 0), 0, 0, 0)); g.add(C(.62, .62, .02, 16, P(0x9a7a30), 0, 1.15, 0)); return ret(g, [circ(0, 0, .7)]); }
export function buildOuthouse() { const g = new THREE.Group(), w = M('planks', { rx: 1, ry: 1, color: 0x8a7a6a }); g.add(B(1.3, 2.2, 1.3, w, 0, 1.1, 0), B(1.6, .1, 1.6, M('corrug'), 0, 2.3, 0)); const d = B(.06, 1.8, .7, w, -.4, .95, .7); d.rotation.y = .5; g.add(d); g.add(B(.3, .05, .1, P(0x222222), 0, 1.6, .66)); return ret(g, [box(0, 0, .7, .7)], [V3(0, .2, 1.3)]); }
export function buildPole() { const g = new THREE.Group(); g.add(C(.15, .2, 9, 8, M('bark'), 0, 4.5, 0), B(2.2, .12, .12, M('planks'), 0, 8.4, 0), B(1.6, .1, .1, M('planks'), 0, 7.6, 0)); for (const x of [-1, 0, 1]) g.add(C(.05, .05, .15, 6, P(0xdddddd, { rough: .2 }), x, 8.55, 0)); return ret(g, [circ(0, 0, .25)]); }
export function buildTank() { const g = new THREE.Group(), m = M('rust', { rx: 2, ry: 2 }); g.add(C(1.3, 1.3, 2.6, 16, m, 0, 3.2, 0), CONE(1.35, .6, 16, m, 0, 4.8, 0)); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(C(.07, .07, 2.2, 6, m, x, 1.1, z)); g.add(C(.04, .04, 3.4, 6, m, 1.3, 3.2, 0)); return ret(g, [circ(0, 0, 1.4)], [V3(0, .2, 2)]); }
export function buildScarecrow() { const g = new THREE.Group(); g.add(B(.08, 2.0, .08, M('planks'), 0, 1.0, 0), B(1.4, .08, .08, M('planks'), 0, 1.6, 0)); g.add(RB(.45, .7, .25, .1, P(0x6a5a3a, { rough: 1 }), 0, 1.3, 0)); g.add(S(.16, P(0xc8b88a, { rough: 1 }), 0, 1.85, 0)); g.add(C(.2, .2, .02, 14, P(0x4a3a22), 0, 1.98, 0), C(.1, .12, .15, 12, P(0x4a3a22), 0, 2.07, 0)); return ret(g, [circ(0, 0, .3)]); }
export function buildLog() { const g = new THREE.Group(); const l = rot(C(.28, .3, 3.2, 10, M('bark', { rx: 1, ry: 2 }), 0, .3, 0), 0, 0, Math.PI / 2); g.add(l); g.add(rot(C(.27, .27, .01, 10, P(0xc9a86a), 1.6, .3, 0), 0, 0, Math.PI / 2)); return ret(g, [box(0, 0, 1.6, .3)]); }
export function buildStump() { const g = new THREE.Group(); g.add(C(.3, .42, .6, 10, M('bark', { rx: 1, ry: 1 }), 0, .3, 0), C(.29, .29, .02, 10, P(0xc9a86a), 0, .6, 0)); return ret(g, [circ(0, 0, .4)], [V3(0, .65, 0)]); }
export function buildAnthill() { const g = new THREE.Group(), m = M('dirt', { rx: 1, ry: 1, color: 0xb89870 }); g.add(CONE(.75, .9, 10, m, 0, .45, 0)); for (let i = 0; i < 14; i++) { const a = i * 2.4, rr = .3 + i * .05; g.add(S(.012, P(0x120e0c), Math.cos(a) * rr, .08 + (.6 - rr) * .5, Math.sin(a) * rr)); } return ret(g, [circ(0, 0, .6)]); }
export function buildMushDecor() { const g = new THREE.Group(), r = rng(7); for (let i = 0; i < 5; i++) { const s = .5 + r() * .8, x = (r() - .5) * .7, z = (r() - .5) * .7; g.add(C(.02 * s, .03 * s, .1 * s, 6, P(0xe8e0d0), x, .05 * s, z), S(.05 * s, P(0xb33a2a, { rough: .5 }), x, .11 * s, z, 1, .6, 1)); } return ret(g); }
export function buildFlowers(seed = 1) { const g = new THREE.Group(), r = rng(seed), cs = [0xf2e24a, 0xe8e8f0, 0xb04ae0, 0xe05a5a]; const c = cs[Math.floor(r() * cs.length)]; for (let i = 0; i < 9; i++) { const x = (r() - .5) * 1.2, z = (r() - .5) * 1.2; g.add(C(.006, .006, .35, 4, P(0x3c6a2c), x, .17, z), S(.04, P(c, { rough: .6 }), x, .36, z, 1, .6, 1)); } return ret(g); }
