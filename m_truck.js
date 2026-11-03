import { THREE, B, RB, C, S, PL, G, rot, extrude, shapeOf, V3 } from './geo.js';
import { M, P, glass, chrome, rubber } from './mats.js';
import { canvasTex } from './tex.js';
import { gfx } from './settings.js';
import { CAR_PAINTS, VEHICLES } from './data.js';

function paintMat(color) {
  const g = gfx();
  if (g.shadows >= 2) return new THREE.MeshPhysicalMaterial({ color, roughness: 0.38, metalness: 0.45, clearcoat: 1, clearcoatRoughness: 0.08 });
  return new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.4, flatShading: !g.tex });
}
function decalTex(kind) {
  if (kind === 'flame') return canvasTex(256, 256, (g, w, h) => { const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, '#ffcf3a'); gr.addColorStop(.5, '#ff6a1a'); gr.addColorStop(1, '#b01010'); g.fillStyle = gr; for (let i = 0; i < 5; i++) { const x = 20 + i * 52; g.beginPath(); g.moveTo(x, h); g.bezierCurveTo(x - 30, h * .6, x + 40, h * .45, x + 10, 20 + (i % 2) * 40); g.bezierCurveTo(x + 40, h * .5, x + 70, h * .7, x + 40, h); g.fill(); } });
  if (kind === 'skull') return canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#e8e4d6'; g.beginPath(); g.ellipse(128, 110, 70, 76, 0, 0, 7); g.fill(); g.fillRect(96, 160, 64, 50); g.fillStyle = '#111'; g.beginPath(); g.ellipse(100, 112, 18, 22, 0, 0, 7); g.ellipse(156, 112, 18, 22, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(128, 134); g.lineTo(118, 156); g.lineTo(138, 156); g.fill(); for (let i = 0; i < 5; i++) g.fillRect(100 + i * 12, 176, 5, 28); });
  if (kind === 'pine') return canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#e6e2cf'; for (let k = 0; k < 3; k++) { const cx = 60 + k * 70, s = 1 - k * .1; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(cx, 40 + i * 34 + k * 20); g.lineTo(cx - 36 * s + i * 4, 90 + i * 34 + k * 20); g.lineTo(cx + 36 * s - i * 4, 90 + i * 34 + k * 20); g.fill(); } g.fillRect(cx - 4, 190 + k * 20, 8, 28); } });
  return null;
}

export function buildPickup(opts = {}) {
  const veh = VEHICLES.find(v => v.id === (opts.vehicle || 'pickup')) || VEHICLES[0];
  const paintHex = opts.paint ?? veh.body ?? (CAR_PAINTS.find(p => p.id === opts.paintId)?.color ?? 0xb3261e);
  const body = paintMat(paintHex), dark = P(0x111214, { rough: 0.6 }), trim = P(0x1c1d20, { rough: 0.5 }), ch = chrome(), gl = glass(0x2f6aa8, 0.5), gl2 = glass(0x2f6aa8, 0.38);
  const cloth = M('fabric', { rx: 1, ry: 1, color: 0x6e6e72 }), leather = P(0x2c2824, { rough: 0.6 });
  const root = new THREE.Group(); const T = new THREE.Group(); root.add(T);
  const ud = root.userData; ud.paintMat = body; ud.doors = []; ud.wheels = []; ud.lights = [];
  // --- нижній корпус (профіль з боку) ---
  const prof = shapeOf([[0, .62], [0, .98], [.06, 1.08], [.3, 1.13], [1.4, 1.17], [2.0, 1.22], [2.0, .62], [4.0, .62], [4.0, .72], [5.8, .72], [5.8, .62]]);
  const lower = extrude(prof, 1.78, body, 0.05); lower.geometry.translate(0, 0, -.89); lower.geometry.rotateY(-Math.PI / 2); lower.geometry.translate(0, 0, -2.9); T.add(lower);
  // гріль, фари, бампери
  T.add(B(1.5, .34, .06, dark, 0, .9, -2.97), B(1.34, .05, .03, ch, 0, 1.0, -3.0), B(1.34, .05, .03, ch, 0, .9, -3.0), B(1.34, .05, .03, ch, 0, .8, -3.0));
  for (let i = -3; i <= 3; i++) T.add(B(.03, .3, .03, ch, i * .2, .9, -3.01));
  for (const s of [-1, 1]) {
    const hl = G(C(.15, .15, .1, 20, ch), C(.125, .125, .12, 20, P(0xfff3c8, { emissive: 0xffe9a0, ei: .8, rough: .1 })), S(.13, glass(0xcfd8e8, .35), 0, 0, 0, 1, 1, .5)); rot(hl, Math.PI / 2, 0, 0); hl.position.set(s * .68, .93, -2.93); T.add(hl);
    T.add(B(.2, .08, .06, P(0xffa300, { emissive: 0xff8800, ei: .3 }), s * .82, .78, -2.95));
    const tl = B(.18, .3, .06, P(0x8b0d0d, { emissive: 0xff1a1a, ei: .35 }), s * .8, .95, 2.93); T.add(tl);
    const spot = new THREE.SpotLight(0xfff0cf, 0, 60, .55, .6, 1.2); spot.position.set(s * .68, .95, -2.9); spot.target.position.set(s * .68, .6, -14); T.add(spot, spot.target); ud.lights.push(spot);
  }
  T.add(RB(1.98, .16, .22, .07, ch, 0, .66, -3.0), RB(1.98, .16, .2, .07, ch, 0, .68, 2.98), B(1.7, .05, .12, dark, 0, .76, -2.9));
  T.add(RB(1.2, .02, .4, .01, P(0x090909), 0, 1.2, -1.8)); // вентиляція капоту
  const plate = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#e8e4d0'; g.fillRect(0, 0, w, h); g.strokeStyle = '#222'; g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10); g.fillStyle = '#1a2a50'; g.fillRect(8, 8, 28, h - 16); g.fillStyle = '#111'; g.font = 'bold 66px monospace'; g.textAlign = 'center'; g.fillText('ЛІС 07', 148, 88); });
  T.add(PL(.5, .25, new THREE.MeshStandardMaterial({ map: plate, roughness: .5 }), 0, .66, 3.1, 0, 0), rot(PL(.5, .25, new THREE.MeshStandardMaterial({ map: plate, roughness: .5 }), 0, .55, -3.1), 0, Math.PI, 0));
  // підлога/підрамник
  T.add(B(1.5, .22, 5.3, dark, 0, .5, 0), C(.04, .04, 1.9, 8, dark, 0, .38, -1.75), rot(C(.04, .04, 1.9, 8, dark, 0, .38, 1.75), 0, 0, Math.PI / 2), rot(C(.035, .035, 2.2, 8, ch, .5, .42, 2.0), Math.PI / 2, 0, 0));
  // колеса
  const tireMat = rubber();
  for (const [x, z] of [[-.98, -1.75], [.98, -1.75], [-.98, 1.75], [.98, 1.75]]) {
    const w = new THREE.Group(), spin = new THREE.Group(); w.add(spin);
    const tire = C(.42, .42, .3, 28, tireMat, 0, 0, 0); rot(tire, 0, 0, Math.PI / 2); spin.add(tire);
    const tor = new THREE.Mesh(new THREE.TorusGeometry(.39, .06, 10, 28), tireMat); tor.rotation.y = Math.PI / 2; tor.position.x = x < 0 ? -.08 : .08; spin.add(tor);
    for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, b = B(.31, .035, .075, tireMat, 0, Math.sin(a) * .425, Math.cos(a) * .425); b.rotation.x = -a; spin.add(b); }
    const rim = C(.26, .26, .32, 22, ch, 0, 0, 0); rot(rim, 0, 0, Math.PI / 2); spin.add(rim);
    const face = C(.2, .24, .04, 22, P(0x5a5d60, { rough: .3, metal: .9 }), x < 0 ? -.17 : .17, 0, 0); rot(face, 0, 0, Math.PI / 2); spin.add(face);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, n = C(.022, .022, .05, 6, ch, x < 0 ? -.2 : .2, Math.sin(a) * .11, Math.cos(a) * .11); rot(n, 0, 0, Math.PI / 2); spin.add(n); }
    const hub = C(.07, .07, .06, 12, ch, x < 0 ? -.2 : .2, 0, 0); rot(hub, 0, 0, Math.PI / 2); spin.add(hub);
    w.position.set(x, .42, z); T.add(w); ud.wheels.push(spin);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(.5, .05, 8, 26, Math.PI), body); arch.rotation.y = Math.PI / 2; arch.rotation.z = 0; arch.position.set(x < 0 ? -.92 : .92, .42, z); arch.castShadow = true; T.add(arch);
    T.add(B(.04, .3, .22, tireMat, x < 0 ? -.93 : .93, .38, z + (z < 0 ? .5 : .52)));
  }
  // --- кабіна: стійки, дах, скло ---
  const roofY = 1.92; T.add(RB(1.84, .07, 1.4, .03, body, 0, roofY, .38));
  const ang = Math.atan2(.6, .72), L = Math.hypot(.6, .72);
  for (const s of [-1, 1]) {
    const ap = B(.07, L, .08, body, s * .9, 1.56, -.6); ap.rotation.x = ang; T.add(ap);
    T.add(B(.08, .74, .08, body, s * .91, 1.56, .18), B(.08, .74, .08, body, s * .91, 1.56, 1.1));
    const cp = B(.07, .76, .09, body, s * .9, 1.56, 1.15); cp.rotation.x = -.1; T.add(cp);
    T.add(B(.06, .05, 1.4, body, s * .91, 1.88, .38));
  }
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(1.76, L), gl); ws.position.set(0, 1.56, -.6); ws.rotation.x = ang; ws.renderOrder = 2; T.add(ws);
  T.add(PL(1.5, .5, gl2, 0, 1.58, 1.23, 0, Math.PI)); // заднє скло
  T.add(B(1.7, .28, .6, leather, 0, 1.0, -.65)); // панель приладів
  const dash = B(1.6, .06, .35, P(0x101010), 0, 1.16, -.62); T.add(dash);
  const gauges = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#080808'; g.fillRect(0, 0, w, h); for (let i = 0; i < 3; i++) { const cx = 42 + i * 86; g.strokeStyle = '#d8d4c0'; g.lineWidth = 3; g.beginPath(); g.arc(cx, 34, 24, 0, 7); g.stroke(); g.strokeStyle = '#c8402f'; g.beginPath(); g.moveTo(cx, 34); g.lineTo(cx + 12 + i * 3, 22); g.stroke(); } });
  const dp = PL(.5, .125, new THREE.MeshStandardMaterial({ map: gauges, roughness: .4 }), -.45, 1.08, -.43, -.15, Math.PI); T.add(dp);
  // кермо
  const sw = new THREE.Group(); sw.add(new THREE.Mesh(new THREE.TorusGeometry(.17, .022, 8, 24), leather)); const sp = B(.32, .02, .02, leather); sw.add(sp, rot(B(.32, .02, .02, leather), 0, 0, Math.PI / 2)); sw.position.set(-.45, 1.17, -.46); sw.rotation.x = -1.1; T.add(sw); ud.wheel = sw;
  T.add(C(.04, .04, .35, 8, dark, -.45, 1.05, -.58)); T.add(RB(.14, .16, .3, .03, dark, 0, .88, -.1));  // консоль
  // сидіння
  const seat = (x, z, back = true) => { const g = new THREE.Group(); g.add(RB(.5, .16, .5, .06, cloth, 0, .08, 0)); if (back) { g.add(RB(.5, .62, .12, .05, cloth, 0, .46, .26)); g.add(RB(.28, .18, .08, .04, cloth, 0, .88, .27)); } g.position.set(x, .72, z); return g; };
  for (const x of [-.45, .45]) T.add(seat(x, -.12), seat(x, .72));
  T.add(B(1.7, .02, 1.9, P(0x202020, { rough: 1 }), 0, .63, .25));
  // --- двері ---
  const doorDefs = [[-1, -.85, 1.0, true], [1, -.85, 1.0, true], [-1, .2, .85, false], [1, .2, .85, false]];
  for (const [s, z0, w, mirror] of doorDefs) {
    const hinge = new THREE.Group(); hinge.position.set(s * .93, 0, z0); const d = new THREE.Group(); hinge.add(d);
    d.add(B(.07, .6, w, body, 0, .92, w / 2), B(.04, .04, w - .02, ch, s * .04, .9, w / 2));
    d.add(B(.07, .72, .07, body, 0, 1.56, .035), B(.07, .72, .07, body, 0, 1.56, w - .035), B(.07, .06, w, body, 0, 1.9, w / 2), B(.07, .05, w, body, 0, 1.22, w / 2));
    const pane = PL(w - .1, .66, gl, s * .01, 1.56, w / 2, 0, Math.PI / 2); d.add(pane);
    d.add(RB(.05, .045, .17, .02, ch, s * .06, 1.14, w - .16));
    if (mirror) { d.add(RB(.07, .17, .22, .03, body, s * .13, 1.44, .05), PL(.2, .14, glass(0xaabbcc, .7), s * .17, 1.44, .05, 0, s * Math.PI / 2)); }
    d.userData = { s, w, open: false, t: 0 }; T.add(hinge); ud.doors.push(d);
  }
  // --- кузов (відкритий) ---
  T.add(B(.07, .55, 1.8, body, -.88, .99, 2.0), B(.07, .55, 1.8, body, .88, .99, 2.0), B(1.78, .55, .07, body, 0, 1.0, 1.12));
  for (const s of [-1, 1]) { T.add(RB(.3, .24, .62, .06, trim, s * .7, .85, 1.75)); T.add(B(.09, .04, 1.8, ch, s * .88, 1.28, 2.0)); }
  T.add(B(1.7, .02, 1.78, P(0x1a1a1c, { rough: .9 }), 0, .735, 2.0));
  for (let i = -3; i <= 3; i++) T.add(B(.03, .012, 1.76, P(0x0d0d0e), i * .22, .745, 2.0));
  const tg = new THREE.Group(); tg.position.set(0, .72, 2.9); tg.add(B(1.74, .5, .06, body, 0, .25, 0), B(1.2, .04, .02, ch, 0, .42, .04), RB(.2, .05, .04, .02, ch, 0, .36, .05)); T.add(tg); ud.tailgate = tg; ud.tgOpen = true; tg.rotation.x = Math.PI / 2;
  T.add(B(1.74, .04, .1, dark, 0, .96, 1.07)); // ручки в кузові
  // димова труба, дзеркала дальнього, багажник
  T.add(rot(C(.04, .04, .5, 10, ch, -.55, .45, 2.8), Math.PI / 2, 0, 0));
  // декалі
  if (opts.decal && opts.decal !== 'none') {
    const dm = (tx) => new THREE.MeshStandardMaterial({ map: tx, transparent: true, roughness: .5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    if (opts.decal === 'stripe') { for (const x of [-.18, .18]) { T.add(rot(PL(.2, 3.6, dm(null) && P(0xf0f0ec, { rough: .4 }), x, 1.22, -1.1), -Math.PI / 2, 0, 0)); } }
    else { const t = decalTex(opts.decal); if (t) { const m = dm(t); if (opts.decal === 'skull') T.add(rot(PL(.9, .9, m, 0, 1.23, -1.75), -Math.PI / 2, 0, 0)); else for (const s of [-1, 1]) T.add(rot(PL(1.4, 1.4, m, s * .95, .98, -.1), 0, s * Math.PI / 2, 0)); } }
  }
  // сидіння для гравців (локальні координати)
  ud.seats = [
    { p: V3(-.45, .8, -.12), kind: 'chair', door: 0 }, { p: V3(.45, .8, -.12), kind: 'chair', door: 1 },
    { p: V3(-.45, .8, .72), kind: 'chair', door: 2 }, { p: V3(.45, .8, .72), kind: 'chair', door: 3 },
    { p: V3(-.5, .73, 1.65), kind: 'floor' }, { p: V3(.5, .73, 1.65), kind: 'floor' }, { p: V3(-.5, .73, 2.35), kind: 'floor' }, { p: V3(.5, .73, 2.35), kind: 'floor' },
  ];
  ud.exits = [V3(-1.9, 0, -.35), V3(1.9, 0, -.35), V3(-1.9, 0, .6), V3(1.9, 0, .6), V3(-.5, 0, 4.3), V3(.5, 0, 4.3), V3(-1.3, 0, 4.3), V3(1.3, 0, 4.3)];
  ud.setPaint = hex => { body.color.setHex(hex); };
  ud.setLights = on => { for (const l of ud.lights) l.intensity = on ? 90 : 0; };
  ud.setDoor = (i, open) => { ud.doors[i].userData.open = open; };
  ud.setTailgate = open => { ud.tgOpen = open; };
  ud.update = (dt, speed = 0) => {
    for (const w of ud.wheels) w.rotation.x -= speed * dt / .42;
    for (const d of ud.doors) { const u = d.userData, tgt = u.open ? 1 : 0; u.t += (tgt - u.t) * Math.min(1, dt * 7); d.parent.rotation.y = -u.s * u.t * 1.15; }
    const tt = ud.tgOpen ? Math.PI / 2 : 0; ud.tailgate.rotation.x += (tt - ud.tailgate.rotation.x) * Math.min(1, dt * 6);
  };
  ud.L = 5.8; ud.W = 2.0;
  return root;
}
