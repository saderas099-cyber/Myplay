import { THREE, B, RB, C, S, CONE, G, rot, PL, V3 } from './geo.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M, P, glass, chrome } from './mats.js';
import { canvasTex } from './tex.js';
import { applyWind } from './wind.js';
import { rng, TAU, vnoise } from './util.js';
import { gfx } from './settings.js';

const merge = gs => mergeGeometries(gs.map(g => g.index ? g : g.toNonIndexed()).map(g => { if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; }), false);
function jitter(geo, r, amt) { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = (vnoise(x * 2.1 + 7, z * 2.1 + y) - .5) * amt; p.setXYZ(i, x + n * Math.sign(x), y + (r() - .5) * amt * .4, z + n * Math.sign(z)); } geo.computeVertexNormals(); return geo; }
function bend(a, b, rA, rB) { return new THREE.CylinderGeometry(rA, rB, 1, 6, 1); }

// ---------- дерева (для InstancedMesh) ----------
export function buildTreeSpecs() {
  const specs = [], g = gfx(), lowp = g.tex === false;
  const mk = (name, trunkGeo, crownGeo, trunkMat, crownMat, h, r, wt) => {
    applyWind(trunkMat.clone ? trunkMat : trunkMat, { amp: .012, flutter: 0, hScale: 1 / h });
    if (crownMat) applyWind(crownMat, { amp: .05, flutter: .9, hScale: 1 / h });
    specs.push({ name, trunkGeo, crownGeo, trunkMat, crownMat, h, r, wt });
  };
  const barkM = M('bark', { rx: 1, ry: 3, rough: .95 }), needleM = M('needles', { rx: 3, ry: 3, rough: .9, side: THREE.DoubleSide }), leafM = M('leaves', { rx: 2, ry: 2, rough: .8, side: THREE.DoubleSide }), birchM = M('birch', { rx: 1, ry: 4, rough: .8 });
  const barkW = barkM.clone(), needleW = needleM.clone(), leafW = leafM.clone(), birchW = birchM.clone();
  const conifer = (seed, h, layers, R, name, wt) => {
    const r = rng(seed), parts = [];
    const trunk = new THREE.CylinderGeometry(.1 + h * .005, .2 + h * .01, h * .95, 8, 5); trunk.translate(0, h * .475, 0);
    for (let i = 0; i < layers; i++) {
      const t = i / (layers - 1), rad = R * (1.0 - t * .86) + .15, hh = h * (.16 + .06 * (1 - t)), y = h * .22 + t * h * .72;
      const cone = new THREE.ConeGeometry(rad, hh * 1.7, lowp ? 7 : 11, 3, true); cone.translate(0, y + hh * .3, 0);
      jitter(cone, r, rad * .26); const p = cone.attributes.position; for (let k = 0; k < p.count; k++) { const yy = p.getY(k); const dr = (y + hh * .3 - yy); if (dr > 0) p.setY(k, yy - dr * .12); } cone.computeVertexNormals(); parts.push(cone);
      if (!lowp && i < layers - 2) for (let b = 0; b < 4; b++) { const br = new THREE.CylinderGeometry(.012, .035, rad * .85, 4); br.rotateZ(Math.PI / 2 - .25); br.translate(rad * .42, 0, 0); br.rotateY(r() * TAU); br.translate(0, y + hh * .1, 0); parts.push(br); }
    }
    const crown = merge(parts.map(p => p.clone()));
    mk(name, trunk, crown, barkW, needleW, h, .3 + h * .012, wt);
  };
  conifer(11, 11, 8, 2.1, 'pine1', 3); conifer(23, 15, 9, 2.5, 'pine2', 3); conifer(37, 8.5, 7, 1.7, 'pine3', 2);
  conifer(51, 13, 12, 1.75, 'spruce1', 3); conifer(63, 17, 14, 2.0, 'spruce2', 2);
  const birch = (seed, h, name, wt) => {
    const r = rng(seed), trunk = new THREE.CylinderGeometry(.07, .14, h * .85, 7, 6); trunk.translate(0, h * .425, 0); const bends = trunk.attributes.position; for (let i = 0; i < bends.count; i++) bends.setX(i, bends.getX(i) + Math.sin(bends.getY(i) * .9 + seed) * .1);
    const parts = []; for (let i = 0; i < (lowp ? 4 : 7); i++) { const s = new THREE.IcosahedronGeometry(1.0 + r() * .7, lowp ? 0 : 1); jitter(s, r, .4); s.scale(1, .85, 1); s.translate((r() - .5) * 2.0, h * (.62 + r() * .35), (r() - .5) * 2.0); parts.push(s); }
    mk(name, trunk, merge(parts), birchW, leafW, h, .3, wt);
  };
  birch(71, 8, 'birch1', 2); birch(83, 10.5, 'birch2', 2);
  const oak = (seed, h, name, wt) => {
    const r = rng(seed), trunk = new THREE.CylinderGeometry(.3, .5, h * .55, 8, 4); trunk.translate(0, h * .275, 0);
    const parts = []; for (let i = 0; i < (lowp ? 5 : 9); i++) { const s = new THREE.IcosahedronGeometry(1.6 + r() * 1.2, lowp ? 0 : 1); jitter(s, r, .6); s.translate((r() - .5) * 4, h * (.6 + r() * .35), (r() - .5) * 4); parts.push(s); }
    for (let i = 0; i < 3; i++) { const br = new THREE.CylinderGeometry(.08, .16, 2.4, 5); br.rotateZ(.9); br.translate(.8, h * .5, 0); br.rotateY(i * 2.1 + r()); trunk.userData.br = 1; parts.length; }
    mk(name, trunk, merge(parts), barkW, leafW, h, .55, wt);
  };
  oak(91, 9, 'oak1', 1);
  const dead = (seed, h, name, wt) => {
    const r = rng(seed), parts = [], trunk = new THREE.CylinderGeometry(.08, .22, h, 6, 5); trunk.translate(0, h / 2, 0); parts.push(trunk);
    for (let i = 0; i < 9; i++) { const l = 1.2 + r() * 1.6, br = new THREE.CylinderGeometry(.012, .055, l, 4); br.translate(0, l / 2, 0); br.rotateZ(.7 + r() * .6); br.rotateY(r() * TAU); br.translate(0, h * (.35 + r() * .6), 0); parts.push(br); }
    mk(name, merge(parts), null, barkW, null, h, .25, wt);
  };
  dead(101, 7, 'dead1', 1); dead(103, 5.5, 'dead2', 1);
  return specs;
}

// ---------- дрібні рослини / камені ----------
export function rockGeo(seed, detail = 2) { const r = rng(seed), g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = .78 + vnoise(x * 1.7 + seed, z * 1.7 + y * 1.3) * .5; p.setXYZ(i, x * n, y * n * .72, z * n); } g.computeVertexNormals(); return g; }
export function bushGeo(seed) { const r = rng(seed), parts = []; for (let i = 0; i < 5; i++) { const s = new THREE.IcosahedronGeometry(.45 + r() * .25, 1); jitter(s, r, .2); s.translate((r() - .5) * .8, .35 + r() * .3, (r() - .5) * .8); parts.push(s); } return merge(parts); }
export function fernGeo(seed) { const r = rng(seed), parts = []; for (let i = 0; i < 9; i++) { const q = new THREE.PlaneGeometry(.18, .9, 1, 3); const p = q.attributes.position; for (let k = 0; k < p.count; k++) { const y = p.getY(k) + .45; p.setY(k, y); p.setZ(k, y * y * .35); } q.rotateX(-.5 - r() * .5); q.rotateY(i / 9 * TAU + r() * .4); parts.push(q); } return merge(parts); }
export function bladeGeo() { // пучок трави: 3 перехрещені стрічки зі звуженням
  const parts = []; for (let i = 0; i < 3; i++) { const q = new THREE.PlaneGeometry(.1, 1, 1, 3), p = q.attributes.position; for (let k = 0; k < p.count; k++) { const y = p.getY(k) + .5, w = p.getX(k) * (1 - y * .85); p.setX(k, w); p.setY(k, y); p.setZ(k, y * y * .12); } q.rotateY(i * Math.PI / 3); parts.push(q); } const g = merge(parts); return g;
}

// ---------- предмети ----------
const mat = {
  metal: () => P(0x8d9195, { rough: .45, metal: .85 }), rust: () => M('rust', { rx: 1, ry: 1 }), cop: () => P(0xb36a3a, { rough: .35, metal: .9 }), wood: () => M('planks', { rx: 1, ry: 1 }), red: () => P(0xb3261e, { rough: .5 }),
};
function label(t, bg = '#fff', fg = '#000') { return canvasTex(128, 128, (g, w, h) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.fillText(t, 64, 76); }); }
export function buildItem(id) {
  const g = new THREE.Group(), R = rng(id.length * 131 + id.charCodeAt(0));
  const add = (...o) => { for (const x of o) g.add(x); return g; };
  switch (id) {
    case 'can': add(C(.04, .04, .11, 14, P(0xb9bcc0, { rough: .3, metal: .9 }), 0, .055, 0), C(.0415, .0415, .05, 14, P(0xb3261e), 0, .055, 0)); break;
    case 'bottle': add(C(.035, .035, .2, 12, glass(0x9fd0e8, .45), 0, .1, 0), C(.014, .02, .04, 10, glass(0x9fd0e8, .45), 0, .22, 0), C(.017, .017, .02, 10, P(0x2f6fe0), 0, .245, 0)); rot(g, 0, 0, Math.PI / 2); g.position.y = .035; break;
    case 'tire': { const t = new THREE.Mesh(new THREE.TorusGeometry(.26, .11, 12, 24), P(0x121212, { rough: .95 })); t.rotation.x = Math.PI / 2; t.position.y = .11; t.castShadow = true; add(t, C(.2, .2, .02, 16, P(0x3a3a3a), 0, .05, 0)); break; }
    case 'scrap': for (let i = 0; i < 4; i++) { const b = B(.12 + R() * .25, .02 + R() * .06, .1 + R() * .2, mat.rust(), (R() - .5) * .3, .05 + i * .035, (R() - .5) * .3); b.rotation.y = R() * 3; add(b); } add(rot(C(.02, .02, .4, 6, mat.rust(), 0, .06, 0), 1.4, 0, 1)); break;
    case 'pipe': add(rot(C(.03, .03, .6, 12, mat.cop(), 0, .04, 0), 0, 0, Math.PI / 2), rot(C(.03, .03, .3, 12, mat.cop(), .3, .04, .15), Math.PI / 2, 0, 0)); break;
    case 'cable': { const sp = new THREE.Group(); sp.add(C(.2, .2, .03, 18, mat.wood(), 0, .12, 0), C(.2, .2, .03, 18, mat.wood(), 0, -.02, 0), C(.12, .12, .14, 18, P(0xe0762a, { rough: .6 }), 0, .05, 0)); sp.position.y = .13; sp.rotation.x = Math.PI / 2; sp.children.forEach(c => c.position.y += 0); add(sp); g.position.y = 0; break; }
    case 'battery': add(RB(.3, .2, .18, .02, P(0x1c1f24, { rough: .5 }), 0, .1, 0), C(.025, .025, .04, 8, P(0xaaaaaa, { metal: 1 }), -.1, .22, 0), C(.025, .025, .04, 8, P(0xaaaaaa, { metal: 1 }), .1, .22, 0), B(.05, .003, .03, P(0xc8402f), -.1, .245, 0)); break;
    case 'radiator': add(RB(.45, .35, .05, .01, P(0x2a2c30, { rough: .6, metal: .6 }), 0, .2, 0)); for (let i = -9; i <= 9; i++) add(B(.01, .3, .04, P(0x8a8e92, { metal: .8, rough: .4 }), i * .022, .2, 0)); add(C(.03, .03, .08, 8, P(0x8a8e92), 0, .4, 0)); g.rotation.x = -.3; break;
    case 'engine': add(RB(.5, .3, .36, .03, P(0x6c7074, { rough: .5, metal: .8 }), 0, .18, 0)); for (let i = 0; i < 4; i++) add(C(.06, .06, .1, 10, P(0x55595d, { metal: .8, rough: .45 }), -.18 + i * .12, .38, 0)); add(rot(C(.05, .05, .2, 10, P(0x3a3d40, { metal: .8 }), 0, .18, .25), Math.PI / 2, 0, 0)); break;
    case 'porcini': add(C(.035, .05, .1, 10, P(0xe8dcc0, { rough: .8 }), 0, .05, 0), S(.07, P(0x6e4a2a, { rough: .6 }), 0, .11, 0, 1, .55, 1)); break;
    case 'chanter': for (let i = 0; i < 3; i++) { const c = CONE(.05, .1, 10, P(0xe3a62a, { rough: .7 }), (i - 1) * .06, .06, (i % 2) * .04); c.rotation.x = Math.PI; c.position.y = .09; add(c, C(.012, .016, .06, 6, P(0xe3a62a), (i - 1) * .06, .03, (i % 2) * .04)); } break;
    case 'amanita': { add(C(.025, .035, .1, 10, P(0xf0ece0), 0, .05, 0)); const cap = S(.07, P(0xc02218, { rough: .45 }), 0, .11, 0, 1, .6, 1); add(cap); for (let i = 0; i < 7; i++) { const a = i * 2.4; add(S(.01, P(0xffffff), Math.cos(a) * .045, .13 + (i % 2) * .005, Math.sin(a) * .045)); } break; }
    case 'blueberry': case 'raspberry': { const c = id === 'blueberry' ? 0x2c3a8a : 0xb3224a; add(PL(.2, .2, P(0x3f6a2a, { rough: .9 }), 0, .01, 0, -Math.PI / 2, 0)); for (let i = 0; i < 14; i++) add(S(.02, P(c, { rough: .4 }), (R() - .5) * .12, .025 + R() * .02, (R() - .5) * .12)); break; }
    case 'honey': add(C(.06, .06, .14, 16, glass(0xd9972a, .8), 0, .07, 0), C(.062, .062, .03, 16, P(0x7a5a2a), 0, .155, 0), C(.058, .058, .1, 16, P(0xe0a030, { emissive: 0x6a3a00, ei: .3 }), 0, .06, 0)); break;
    case 'paintW': case 'paintR': case 'paintG': { const c = { paintW: 0xf0f0ea, paintR: 0xc0281e, paintG: 0x2f7a3a }[id]; const b = C(.14, .14, .2, 18, P(0x9aa0a4, { rough: .45, metal: .8 }), 0, .1, 0), t = C(.135, .135, .02, 18, P(c, { rough: .3 }), 0, .205, 0), band = C(.1405, .1405, .06, 18, P(c, { rough: .5 }), 0, .12, 0), h = new THREE.Mesh(new THREE.TorusGeometry(.12, .006, 6, 16, Math.PI), P(0x777777, { metal: 1 })); h.position.y = .2; add(b, t, band, h); break; }
    case 'varnish': add(RB(.2, .26, .12, .02, P(0xb08a24, { rough: .5, metal: .4 }), 0, .13, 0), C(.025, .025, .05, 10, P(0x222222), .06, .28, 0)); break;
    case 'clock': { const tx = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#e8e2cf'; c.beginPath(); c.arc(64, 64, 60, 0, 7); c.fill(); c.strokeStyle = '#222'; c.lineWidth = 3; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; c.beginPath(); c.moveTo(64 + Math.sin(a) * 50, 64 - Math.cos(a) * 50); c.lineTo(64 + Math.sin(a) * 58, 64 - Math.cos(a) * 58); c.stroke(); } c.lineWidth = 5; c.beginPath(); c.moveTo(64, 64); c.lineTo(64, 24); c.stroke(); c.beginPath(); c.moveTo(64, 64); c.lineTo(92, 74); c.stroke(); }); add(RB(.22, .3, .1, .02, mat.wood(), 0, .15, 0), C(.095, .095, .02, 24, new THREE.MeshStandardMaterial({ map: tx, roughness: .4 }), 0, .17, .055)); g.children[1].rotation.x = Math.PI / 2; break; }
    case 'spoon': add(S(.025, P(0xd8dadc, { rough: .15, metal: 1 }), 0, .01, -.07, 1, .3, 1.5), B(.012, .006, .14, P(0xd8dadc, { rough: .15, metal: 1 }), 0, .01, .02)); break;
    case 'brooch': add(C(.03, .03, .008, 20, P(0xd4af37, { rough: .25, metal: 1 }), 0, .006, 0), S(.014, P(0x1a8a5a, { rough: .1, metal: .3 }), 0, .016, 0)); break;
    case 'coin': add(C(.02, .02, .004, 20, P(0xc9a24a, { rough: .3, metal: 1 }), 0, .004, 0)); break;
    case 'icon': { const tx = canvasTex(128, 160, (c, w, h) => { c.fillStyle = '#5a3a1a'; c.fillRect(0, 0, w, h); c.fillStyle = '#c9a24a'; c.beginPath(); c.arc(64, 60, 26, 0, 7); c.fill(); c.fillStyle = '#7a1a1a'; c.fillRect(34, 92, 60, 50); c.strokeStyle = '#d4af37'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8); }); add(RB(.2, .26, .025, .005, new THREE.MeshStandardMaterial({ map: tx, roughness: .5 }), 0, .13, 0)); g.rotation.x = -.15; break; }
    case 'samovar': add(C(.09, .12, .22, 18, P(0xb8883a, { rough: .25, metal: 1 }), 0, .17, 0), S(.1, P(0xb8883a, { rough: .25, metal: 1 }), 0, .3, 0, 1, .6, 1), C(.05, .06, .06, 14, P(0xb8883a, { metal: 1, rough: .3 }), 0, .38, 0), C(.1, .1, .06, 14, P(0xb8883a, { metal: 1, rough: .3 }), 0, .03, 0), rot(C(.012, .012, .08, 6, P(0x333333), .14, .2, 0), 0, 0, Math.PI / 2)); break;
    case 'saw': add(B(.4, .06, .004, P(0xaab0b4, { metal: .9, rough: .3 }), 0, .03, 0), RB(.1, .05, .03, .01, mat.wood(), -.22, .04, 0)); break;
    case 'hammer': add(C(.012, .014, .3, 8, mat.wood(), 0, .02, 0), B(.1, .04, .04, P(0x6a6e72, { metal: 1, rough: .35 }), .12, .04, 0)); g.children[0].rotation.z = Math.PI / 2; break;
    case 'axe': add(rot(C(.014, .016, .5, 8, mat.wood(), 0, .02, 0), 0, 0, Math.PI / 2), B(.1, .1, .02, P(0x7a7e82, { metal: 1, rough: .35 }), .2, .06, 0)); break;
    case 'gascan': add(RB(.34, .4, .13, .02, P(0xb3261e, { rough: .5 }), 0, .2, 0), B(.1, .02, .12, P(0xb3261e), -.08, .42, 0), rot(C(.025, .025, .1, 8, P(0x222222), .1, .45, 0), 0, 0, -.5), B(.2, .015, .012, P(0x992018), 0, .3, .07)); break;
    case 'gen_fuel': add(RB(.34, .4, .13, .02, P(0xd0a020, { rough: .5 }), 0, .2, 0), B(.1, .02, .12, P(0xd0a020), -.08, .42, 0), rot(C(.025, .025, .1, 8, P(0x222222), .1, .45, 0), 0, 0, -.5)); break;
    case 'repair': add(RB(.3, .12, .2, .02, P(0x2b4f8a, { rough: .5 }), 0, .06, 0), B(.1, .02, .03, P(0xcccccc, { metal: 1 }), 0, .125, 0)); break;
    case 'medkit': add(RB(.28, .2, .1, .02, P(0xf2f2ee, { rough: .5 }), 0, .1, 0), B(.14, .04, .102, P(0xc8201a), 0, .1, 0), B(.04, .14, .102, P(0xc8201a), 0, .1, 0)); break;
    case 'batteryAA': add(RB(.1, .06, .05, .01, P(0xe0c020, { rough: .5 }), 0, .03, 0), C(.01, .01, .02, 6, P(0x222222), -.03, .07, 0)); break;
    case 'chest': add(RB(.6, .32, .38, .03, mat.wood(), 0, .16, 0), B(.62, .05, .4, P(0x3a3a3a, { metal: .8, rough: .5 }), 0, .1, 0), B(.62, .05, .4, P(0x3a3a3a, { metal: .8, rough: .5 }), 0, .26, 0), B(.07, .1, .02, P(0xc9a24a, { metal: 1, rough: .3 }), 0, .26, .2)); break;
    case 'flare': add(C(.02, .02, .2, 10, P(0xc8201a, { rough: .5 }), 0, .1, 0), C(.018, .018, .03, 10, P(0x222222), 0, .21, 0)); break;
    case 'parcel': add(B(.34, .24, .26, P(0xb08a58, { rough: .9 }), 0, .12, 0), B(.05, .242, .262, P(0xd8c8a0), 0, .12, 0)); break;
    case 'photo': add(B(.2, .003, .24, P(0xf0eee0), 0, .01, 0), B(.17, .004, .15, P(0x44543a), 0, .012, -.02)); break;
    default: add(B(.2, .2, .2, P(0xff00ff), 0, .1, 0));
  }
  g.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
  const w = new THREE.Group(); w.add(g); return w;
}

// ---------- тварини ----------
export function buildAnimal(kind) {
  const g = new THREE.Group(), br = P(0x6b4a2e, { rough: .9 }), red = P(0xb0602a, { rough: .9 }), grey = P(0x6a6a66, { rough: .9 }), dk = P(0x161412), wh = P(0xe8e2d4);
  const leg = (m, x, z, l = .4, r = .03) => { const lg = C(r, r * .8, l, 6, m, x, l / 2, z); return lg; };
  const legs = [];
  switch (kind) {
    case 'deer': { const body = RB(.45, .45, 1.0, .12, br, 0, 1.0, 0); g.add(body); for (const [x, z] of [[-.15, .4], [.15, .4], [-.15, -.4], [.15, -.4]]) { const l = leg(br, x, z, 1.0, .04); l.position.y = .5; g.add(l); legs.push(l); } const neck = rot(C(.08, .12, .55, 8, br, 0, 1.4, -.55), -.6, 0, 0); g.add(neck); g.add(S(.12, br, 0, 1.65, -.78, 1, .9, 1.4), B(.03, .03, .03, dk, -.05, 1.68, -.9), B(.03, .03, .03, dk, .05, 1.68, -.9)); for (const s of [-1, 1]) { g.add(rot(C(.01, .015, .35, 5, P(0xcfc6a8), s * .08, 1.85, -.75), 0, 0, s * .4), rot(C(.008, .01, .2, 5, P(0xcfc6a8), s * .15, 1.98, -.75), 0, 0, s * .8)); } g.add(S(.07, wh, 0, 1.0, .5, 1, 1, 1)); break; }
    case 'fox': g.add(RB(.2, .2, .5, .08, red, 0, .3, 0), S(.1, red, 0, .36, -.32, 1, .9, 1.3), rot(C(.0, .06, .18, 6, red, -.05, .46, -.33), 0, 0, 0), rot(C(.0, .06, .18, 6, red, .05, .46, -.33), 0, 0, 0), S(.09, red, 0, .3, .42, 1, 1, 2.2), S(.06, wh, 0, .3, .62, 1, 1, 1.5)); for (const [x, z] of [[-.07, .15], [.07, .15], [-.07, -.15], [.07, -.15]]) { const l = leg(dk, x, z, .22, .02); g.add(l); legs.push(l); } break;
    case 'hare': g.add(S(.14, grey, 0, .22, 0, 1, 1, 1.5), S(.08, grey, 0, .3, -.24), RB(.03, .22, .02, .01, grey, -.03, .46, -.22), RB(.03, .22, .02, .01, grey, .03, .46, -.22), S(.035, wh, 0, .22, .22)); break;
    case 'hedgehog': g.add(S(.14, P(0x4a3a2a, { rough: 1 }), 0, .12, 0, 1, .8, 1.3), S(.05, P(0xb89a78), 0, .08, -.18, 1, 1, 1.5), S(.012, dk, 0, .09, -.25)); break;
    case 'owl': g.add(S(.12, P(0x8a7a62), 0, .3, 0, 1, 1.3, 1), S(.1, P(0x8a7a62), 0, .5, 0), S(.03, P(0xf0c020), -.04, .52, -.08), S(.03, P(0xf0c020), .04, .52, -.08), CONE(.015, .04, 5, P(0x3a2a1a), 0, .48, -.1)); g.children[g.children.length - 1].rotation.x = -Math.PI / 2; break;
    case 'badger': g.add(RB(.3, .28, .7, .1, grey, 0, .26, 0), S(.12, wh, 0, .27, -.4, 1, .9, 1.4), B(.03, .27, .3, dk, -.05, .3, -.36), B(.03, .27, .3, dk, .05, .3, -.36)); for (const [x, z] of [[-.1, .2], [.1, .2], [-.1, -.2], [.1, -.2]]) { const l = leg(dk, x, z, .16, .03); g.add(l); legs.push(l); } break;
    case 'raven': g.add(S(.08, P(0x0c0c10, { rough: .4 }), 0, .2, 0, 1, 1, 1.5), S(.05, P(0x0c0c10), 0, .27, -.14), CONE(.015, .05, 5, P(0x222222), 0, .27, -.2)); g.children[g.children.length - 1].rotation.x = -Math.PI / 2; break;
    case 'boar': g.add(RB(.5, .5, 1.0, .15, P(0x3a2f28, { rough: 1 }), 0, .6, 0), S(.2, P(0x3a2f28), 0, .62, -.6, 1, 1, 1.3), CONE(.012, .12, 5, wh, -.1, .55, -.82), CONE(.012, .12, 5, wh, .1, .55, -.82)); for (const [x, z] of [[-.16, .35], [.16, .35], [-.16, -.35], [.16, -.35]]) { const l = leg(dk, x, z, .45, .045); g.add(l); legs.push(l); } break;
  }
  g.userData.legs = legs; g.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
  return g;
}
