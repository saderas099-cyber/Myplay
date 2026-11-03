import { THREE, B, RB, C, S, CONE, G, rot, PL, V3, extrude, shapeOf } from './geo.js';
import { M, P, glass } from './mats.js';
import { canvasTex } from './tex.js';

const box = (x, z, hx, hz, yaw = 0, extra = {}) => ({ t: 'b', x, z, hx, hz, yaw, ...extra });
const WH = 2.9, TH = .25;

export function buildHouse() {
  const g = new THREE.Group(), cols = [], doors = [], lights = [], switches = [], windows = [], ud = { doors, lights, switches };
  const side = M('sidingW', { rx: 6, ry: 1, color: 0xd8d0c0 }), side2 = M('sidingW', { rx: 6, ry: 1, color: 0xb8b09c }), wp = M('wallpaper', { rx: 3, ry: 1 }), planks = M('planks', { rx: 4, ry: 1 }), floorM = M('floor', { rx: 4, ry: 4 }), tile = M('tile', { rx: 3, ry: 3 }), ceil = P(0xd9d3c4, { rough: 1 });
  const frame = P(0x5a4632, { rough: .7 }), white = P(0xe6e2d6, { rough: .6 }), glassM = glass(0x88a0b0, .3), curtain = M('fabric', { rx: 1, ry: 1, color: 0xd8c8a8, side: THREE.DoubleSide });
  // ---- підлога/фундамент
  g.add(B(14.6, .3, 15.6, M('concrete', { rx: 4, ry: 4 }), 0, .0, 17.5), B(14, .05, 14.8, floorM, 0, .16, 17.5));
  for (const [x0, z0, x1, z1, m] of [[1.5, 10.2, 6.9, 17.5, tile], [4, 20.5, 6.9, 24.9, tile], [1.5, 22, 4, 24.9, tile]]) g.add(B(x1 - x0, .02, z1 - z0, m, (x0 + x1) / 2, .2, (z0 + z1) / 2));
  g.add(B(3.2, .015, 2.4, M('carpet', { rx: 2, ry: 2 }), -4.5, .21, 21.5), B(2.6, .015, 4.5, M('carpet', { rx: 1, ry: 2, color: 0xb09870 }), 0, .21, 13.5));
  // ---- стіни
  function wall(x1, z1, x2, z2, holes, mIn, mOut = side, th = TH) {
    const horiz = Math.abs(z2 - z1) < .01, len = horiz ? Math.abs(x2 - x1) : Math.abs(z2 - z1), x0 = Math.min(x1, x2), zz0 = Math.min(z1, z2), hs = [...holes].sort((a, b) => a.c - b.c), pieces = [];
    const put = (u0, u1, y0, y1) => { if (u1 - u0 < .01) return; const w = u1 - u0, h = y1 - y0, cu = (u0 + u1) / 2, cy = (y0 + y1) / 2; const m = mOut; const bx = horiz ? B(w, h, th, m, x0 + cu, cy, z1) : B(th, h, w, m, x1, cy, zz0 + cu); g.add(bx); if (mIn !== m && mIn) { const sd = horiz ? 1 : 1; const iw = horiz ? PL(w, h, mIn, x0 + cu, cy, z1 + (z1 > 17.5 ? -th / 2 - .005 : th / 2 + .005), 0, z1 > 17.5 ? Math.PI : 0) : PL(w, h, mIn, x1 + (x1 > 0 ? -th / 2 - .005 : th / 2 + .005), cy, zz0 + cu, 0, x1 > 0 ? -Math.PI / 2 : Math.PI / 2); iw.material = mIn; g.add(iw); } };
    let cur = 0;
    for (const h of hs) { const u0 = h.c - h.w / 2, u1 = h.c + h.w / 2, y0 = h.y0 ?? 0, y1 = h.y1 ?? 2.15; put(cur, u0, 0, WH); if (y0 > 0) put(u0, u1, 0, y0); put(u0, u1, y1, WH); cur = u1;
      if (y0 > 0) { // вікно: скло, рама, фіранка
        const cx = horiz ? x0 + h.c : x1, cz = horiz ? z1 : zz0 + h.c, ww = h.w, wh = y1 - y0;
        const gl = horiz ? B(ww, wh, .03, glassM, cx, (y0 + y1) / 2, cz) : B(.03, wh, ww, glassM, cx, (y0 + y1) / 2, cz); g.add(gl); windows.push(gl);
        const fr = (w, hh, d, x, y, z) => g.add(B(w, hh, d, frame, x, y, z)); const fy = (y0 + y1) / 2;
        if (horiz) { fr(ww + .1, .06, th + .08, cx, y0, cz); fr(ww + .1, .06, th + .08, cx, y1, cz); fr(.05, wh, th + .06, cx - ww / 2, fy, cz); fr(.05, wh, th + .06, cx + ww / 2, fy, cz); fr(.03, wh, th + .06, cx, fy, cz); const sgn = cz > 17.5 ? -1 : 1; g.add(PL(ww * .4, wh * 1.05, curtain, cx - ww * .3, fy, cz + sgn * .16, 0, 0), PL(ww * .4, wh * 1.05, curtain, cx + ww * .3, fy, cz + sgn * .16, 0, 0)); }
        else { fr(th + .08, .06, ww + .1, cx, y0, cz); fr(th + .08, .06, ww + .1, cx, y1, cz); fr(th + .06, wh, .05, cx, fy, cz - ww / 2); fr(th + .06, wh, .05, cx, fy, cz + ww / 2); fr(th + .06, wh, .03, cx, fy, cz); const sgn = cx > 0 ? -1 : 1; g.add(PL(ww * .4, wh * 1.05, curtain, cx + sgn * .16, fy, cz - ww * .3, 0, Math.PI / 2), PL(ww * .4, wh * 1.05, curtain, cx + sgn * .16, fy, cz + ww * .3, 0, Math.PI / 2)); }
      }
    }
    put(cur, len, 0, WH);
    // колізії: розриваємо тільки на дверях/проходах (y0==0)
    const gaps = hs.filter(h => (h.y0 ?? 0) === 0), segs = []; let c0 = 0; for (const h of gaps) { segs.push([c0, h.c - h.w / 2]); c0 = h.c + h.w / 2; } segs.push([c0, len]);
    for (const [a, b] of segs) if (b - a > .02) cols.push(horiz ? box(x0 + (a + b) / 2, z1, (b - a) / 2, th / 2) : box(x1, zz0 + (a + b) / 2, th / 2, (b - a) / 2));
  }
  const win = (c, w = 1.3, y0 = .95, y1 = 2.1) => ({ c, w, y0, y1 });
  // зовнішні
  wall(-7, 10, 7, 10, [{ c: 7, w: 1.1, y0: 0, y1: 2.2 }, win(2.6), win(11.4)], wp);
  wall(-7, 25, 7, 25, [win(2.5), win(7), win(11.5)], wp);
  wall(-7, 10, -7, 25, [win(4, 1.4), win(11, 1.4)], wp);
  wall(7, 10, 7, 25, [win(3, 1.4), win(10.5, 1.4)], wp);
  // внутрішні
  const iw = (x1, z1, x2, z2, holes) => wall(x1, z1, x2, z2, holes, wp, wp, .18);
  iw(-1.5, 10.125, -1.5, 17.5, [{ c: 4.4, w: 1.0, y0: 0, y1: 2.15 }]);
  iw(1.5, 10.125, 1.5, 17.5, [{ c: 3.25, w: 4.6, y0: 1.0, y1: 2.9 }]);
  iw(-7, 17.5, -1.5, 17.5, []); iw(1.5, 17.5, 7, 17.5, []);
  iw(4, 20.5, 4, 25, [{ c: 2.0, w: 1.0, y0: 0, y1: 2.15 }]); iw(4, 20.5, 7, 20.5, []);
  iw(1.5, 22, 4, 22, [{ c: 1.25, w: .95, y0: 0, y1: 2.15 }]); iw(1.5, 22, 1.5, 25, []);
  // стелі
  g.add(B(14.2, .1, 15, ceil, 0, WH + .05, 17.5));
  // ---- дах
  const rm = M('shingle', { rx: 5, ry: 3 });
  for (const s of [-1, 1]) { const rp = B(15.4, .14, 9.1, rm, 0, WH + 1.55, 17.5 + s * 3.9); rp.rotation.x = s * -.42; rp.position.y = WH + 1.35 + 0; g.add(rp); }
  g.add(B(15.5, .2, .35, P(0x2a2420), 0, WH + 2.43, 17.5)); const gabS = shapeOf([[-7.2, 0], [7.2, 0], [0, 0]]);
  for (const x of [-7, 7]) { const tri = extrude(shapeOf([[-7.5, 0], [7.5, 0], [0, 2.8]]), .2, side2, 0); tri.rotation.y = Math.PI / 2; tri.position.set(x - .1, WH + 0, 17.5); tri.scale.set(.93, 1, 1); g.add(tri); }
  const chim = B(.9, 3.6, .9, M('brick', { rx: 1, ry: 3 }), 5.2, WH + 2.0, 19.5); g.add(chim, B(1.1, .15, 1.1, M('concrete'), 5.2, WH + 3.8, 19.5)); cols.push(box(5.2, 19.5, .5, .5));
  // ---- ґанок
  g.add(B(5, .25, 2.2, planks, 0, .12, 8.9), B(4.6, .22, .5, planks, 0, .0, 8.0), B(1.2, .12, .5, planks, 0, -.06, 7.5));
  for (const x of [-2.3, 2.3]) { g.add(B(.14, 2.9, .14, frame, x, 1.55, 7.9), B(.06, .8, .06, frame, x, .6, 7.9)); }
  g.add(B(5.1, .1, 2.6, M('shingle', { rx: 2, ry: 1 }), 0, 2.95, 8.9)); g.add(B(4.7, .06, .06, frame, 0, .85, 7.85), B(.06, .06, 2.0, frame, -2.3, .85, 8.9), B(.06, .06, 2.0, frame, 2.3, .85, 8.9));
  for (let i = 0; i < 10; i++) g.add(B(.04, .7, .04, frame, -2.2 + i * .49, .55, 7.85));
  cols.push(box(-2.3, 7.9, .1, .1), box(2.3, 7.9, .1, .1));
  const lamp = G(C(.07, .07, .16, 8, P(0x222222), 0, 0, 0), S(.09, P(0xfff0c0, { emissive: 0xffe0a0, ei: 0 }), 0, -.1, 0)); lamp.position.set(-1.0, 2.5, 9.78); g.add(lamp);
  // ---- двері
  function door(id, x, z, w, axis, hingeSide, openDir, matD = planks, locked = false) { // axis 'x' – стіна вздовж X
    const hinge = new THREE.Group(), d = new THREE.Group(); hinge.add(d); const h = 2.1;
    const panel = axis === 'x' ? B(w, h, .06, matD, hingeSide * w / 2, h / 2 + .17, 0) : B(.06, h, w, matD, 0, h / 2 + .17, hingeSide * w / 2);
    d.add(panel); const hd = RB(.05, .05, .14, .02, P(0xc8a458, { metal: 1, rough: .3 }), 0, 1.15, 0); if (axis === 'x') hd.position.set(hingeSide * (w - .12), 1.1, .06); else hd.position.set(.06, 1.1, hingeSide * (w - .12)); d.add(hd);
    if (id === 'front') { d.add(B(w * .6, .6, .07, glass(0x99aabb, .5), hingeSide * w / 2, 1.7, 0)); }
    hinge.position.set(axis === 'x' ? x - hingeSide * w / 2 : x, 0, axis === 'x' ? z : z - hingeSide * w / 2); g.add(hinge);
    const dr = { id, hinge, d, open: false, t: 0, axis, w, hs: hingeSide, dir: openDir, pos: V3(x, 1.1, z), col: axis === 'x' ? box(x, z, w / 2, .06, 0, { door: id }) : box(x, z, .06, w / 2, 0, { door: id }) };
    cols.push(dr.col); doors.push(dr); return dr;
  }
  door('front', 0, 10, 1.1, 'x', 1, 1); door('bed', -1.5, 14.5, 1.0, 'z', 1, -1); door('wc', 4, 22.5, 1.0, 'z', 1, 1); door('pantry', 2.75, 22, .95, 'x', 1, 1);
  // ---- меблі
  const furn = (obj, c) => { g.add(obj); if (c) cols.push(c); };
  // кухня
  furn(RB(.7, .9, 6.0, .02, M('planks', { rx: 1, ry: 1, color: 0xb8a88a }), 6.5, .65, 13.3), box(6.5, 13.3, .35, 3.0)); g.add(B(.74, .05, 6.04, P(0x3a3a3a, { rough: .4 }), 6.5, 1.12, 13.3));
  furn(RB(.65, 1.9, .75, .03, white, 6.5, 1.1, 10.7), box(6.5, 10.7, .35, .4)); g.add(B(.02, .6, .03, P(0x888888, { metal: 1 }), 6.15, 1.5, 10.5));
  furn(RB(.65, .9, .7, .02, P(0xc8c8c4, { rough: .4, metal: .3 }), 6.4, .65, 11.6), null); for (const dz of [-.18, .18]) for (const dx of [-.1, .1]) g.add(C(.09, .09, .02, 14, P(0x111111), 6.3 + dx, 1.13, 11.6 + dz));
  const sink = B(.5, .1, .6, P(0xb0b4b8, { metal: .8, rough: .3 }), 6.45, 1.1, 13.9); g.add(sink, rot(C(.02, .02, .3, 8, P(0xb0b4b8, { metal: 1 }), 6.7, 1.28, 13.9), 0, 0, 0));
  for (let i = 0; i < 5; i++) g.add(B(.38, .7, 1.0, M('planks', { rx: 1, ry: 1, color: 0x9a8a6a }), 6.7, 2.0, 10.9 + i * 1.12));
  furn(RB(.8, .95, 3.6, .05, M('planks', { color: 0xa8987a }), 2.2, .68, 14.4), box(2.2, 14.4, .4, 1.8)); g.add(B(.9, .05, 3.7, P(0x2a2a2a, { rough: .4 }), 2.2, 1.17, 14.4));
  const tab = (x, z, w, d, h = .75) => { const t = G(B(w, .06, d, planks, 0, h, 0)); for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.add(B(.06, h, .06, frame, sx * (w / 2 - .06), h / 2, sz * (d / 2 - .06))); t.position.set(x, .18, z); return t; };
  const chair = (x, z, ry) => { const c = G(B(.42, .05, .42, planks, 0, .45, 0), B(.42, .5, .05, planks, 0, .7, .2)); for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.add(B(.04, .45, .04, frame, sx * .18, .22, sz * .18)); c.position.set(x, .18, z); c.rotation.y = ry; return c; };
  furn(tab(4.2, 14.2, 1.3, .9), box(4.2, 14.2, .65, .45)); g.add(chair(4.2, 13.4, 0), chair(4.2, 15.0, Math.PI), chair(5.1, 14.2, -Math.PI / 2));
  g.add(RB(.18, .22, .18, .03, P(0xc8c0a0), 4.2, .95, 14.2), C(.06, .06, .1, 10, P(0x3a6aa0), 4.4, .98, 14.0));
  // спальня
  const bed = G(RB(2.1, .35, 1.5, .05, planks, 0, .25, 0), RB(1.95, .22, 1.4, .1, M('fabric', { color: 0xc8c4b8 }), 0, .55, 0), RB(.5, .12, .4, .05, white, -.7, .72, .3), RB(.5, .12, .4, .05, white, -.7, .72, -.3), RB(.1, .8, 1.5, .03, planks, -1.02, .6, 0), RB(1.0, .06, 1.42, .03, M('fabric', { color: 0x7a8a6a }), .4, .68, 0)); bed.position.set(-5.8, .18, 13.6); furn(bed, box(-5.8, 13.6, 1.05, .75));
  furn(RB(.5, .55, .5, .03, planks, -6.4, .45, 11.6), box(-6.4, 11.6, .25, .25)); const blamp = G(C(.05, .06, .02, 8, P(0x222222), 0, 0, 0), C(.015, .015, .25, 6, P(0x222222), 0, .13, 0), CONE(.12, .16, 12, P(0xe8d8b0, { emissive: 0xffd890, ei: 0 }), 0, .3, 0)); blamp.position.set(-6.4, .75, 11.6); g.add(blamp); ud.bedLamp = blamp.children[2];
  furn(RB(.65, 2.1, 1.3, .03, planks, -2.5, 1.2, 17.0), box(-2.5, 17.0, .35, .65));
  // стіл з комп'ютером (навпроти ліжка)
  const desk = G(B(.8, .05, 1.7, planks, 0, .75, 0), B(.05, .75, 1.6, frame, .36, .37, 0), B(.05, .75, 1.6, frame, -.36, .37, 0), B(.7, .5, .5, frame, 0, .45, .55)); desk.position.set(-2.05, .18, 11.95); furn(desk, box(-2.05, 11.95, .45, .9));
  const screenTex = canvasTex(256, 192, (c, w, h) => { c.fillStyle = '#0c1a14'; c.fillRect(0, 0, w, h); c.fillStyle = '#7fbf8a'; c.font = '16px monospace'; c.fillText('ЛІСОВИЙ РИНОК v2.1', 20, 40); c.fillText('> введіть пароль_', 20, 80); });
  const scr = new THREE.MeshStandardMaterial({ map: screenTex, emissive: 0x1a5a3a, emissiveMap: screenTex, emissiveIntensity: 0, roughness: .3 }); ud.screenMat = scr;
  const mon = G(RB(.5, .38, .06, .02, P(0x1a1a1a, { rough: .4 }), 0, 0, 0), new THREE.Mesh(new THREE.PlaneGeometry(.44, .32), scr), B(.06, .16, .06, P(0x1a1a1a), 0, -.26, 0), B(.22, .02, .16, P(0x1a1a1a), 0, -.34, 0)); mon.children[1].position.z = .032; mon.position.set(-1.88, 1.2, 11.95); mon.rotation.y = -Math.PI / 2 + Math.PI; mon.rotation.y = -Math.PI / 2; g.add(mon);
  const kb = RB(.18, .02, .46, .01, P(0x2a2a2a), -2.2, .98, 11.95); g.add(kb); g.add(RB(.12, .03, .07, .02, P(0x2a2a2a), -2.25, .985, 12.45));
  furn(chair(-2.75, 11.95, Math.PI / 2), null);
  ud.laptop = { pos: V3(-2.55, 1.0, 11.95), screen: scr, standPos: V3(-3.0, 0, 11.95) };
  // головна кімната
  const sofa = G(RB(2.3, .45, .9, .1, M('fabric', { color: 0x8a6a4a }), 0, .3, 0), RB(2.3, .6, .22, .08, M('fabric', { color: 0x8a6a4a }), 0, .75, .38), RB(.22, .55, .9, .08, M('fabric', { color: 0x8a6a4a }), -1.1, .55, 0), RB(.22, .55, .9, .08, M('fabric', { color: 0x8a6a4a }), 1.1, .55, 0)); sofa.position.set(-4.5, .18, 24.0); sofa.rotation.y = Math.PI; furn(sofa, box(-4.5, 24.0, 1.2, .5));
  furn(tab(-4.5, 21.3, 1.1, .6, .45), box(-4.5, 21.3, .55, .3)); furn(RB(.8, .8, .8, .1, M('fabric', { color: 0x6a4a3a }), -2.0, .6, 22.5), box(-2.0, 22.5, .4, .4));
  const tv = G(RB(.8, .08, .5, .02, planks, 0, .4, 0), RB(.7, .55, .55, .04, P(0x3a3028, { rough: .6 }), 0, .85, 0), new THREE.Mesh(new THREE.PlaneGeometry(.52, .4), P(0x0c0e0c, { rough: .1 }))); tv.children[2].position.set(0, .88, -.28); tv.children[2].rotation.y = Math.PI; tv.position.set(-4.5, .18, 18.4); furn(tv, box(-4.5, 18.4, .45, .3));
  furn(RB(.4, 2.2, 1.8, .03, planks, -6.6, 1.3, 20.5), box(-6.6, 20.5, .25, .9)); for (let i = 0; i < 6; i++) g.add(B(.3, .3, .12 + (i % 3) * .08, P([0x6a2a2a, 0x2a4a6a, 0x3a5a2a][i % 3], { rough: .8 }), -6.6, .6 + (i % 4) * .5, 20.0 + i * .22));
  furn(tab(1.0, 20.4, 1.6, 1.0), box(1.0, 20.4, .8, .5)); for (const [x, z, r] of [[0.3, 19.6, 0], [1.7, 19.6, 0], [0.3, 21.2, Math.PI], [1.7, 21.2, Math.PI]]) g.add(chair(x, z, r));
  const stove = G(RB(.6, .9, .6, .04, P(0x1e1e20, { rough: .5, metal: .6 }), 0, .45, 0), rot(C(.08, .08, 2.2, 10, P(0x1e1e20, { metal: .6 }), 0, 1.9, 0), 0, 0, 0)); stove.position.set(5.8, .18, 18.9); furn(stove, box(5.8, 18.9, .35, .35));
  // портрет бабусі та годинник
  const portrait = canvasTex(128, 160, (c, w, h) => { c.fillStyle = '#4a3a28'; c.fillRect(0, 0, w, h); c.fillStyle = '#b0a090'; c.beginPath(); c.ellipse(64, 70, 30, 38, 0, 0, 7); c.fill(); c.fillStyle = '#d8d8d4'; c.beginPath(); c.ellipse(64, 40, 34, 26, 0, 0, 7); c.fill(); c.fillStyle = '#222'; c.fillRect(50, 66, 6, 4); c.fillRect(72, 66, 6, 4); c.fillStyle = '#3a2a2a'; c.fillRect(0, 118, w, 42); c.strokeStyle = '#7a5a2a'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8); });
  g.add(PL(.55, .7, new THREE.MeshStandardMaterial({ map: portrait, roughness: .7 }), 0, 1.7, 24.85, 0, Math.PI));
  g.add(rot(C(.22, .22, .06, 20, P(0x5a4632), -6.85, 2.1, 17.5), 0, 0, Math.PI / 2));
  // туалет
  const wc = G(RB(.4, .4, .6, .1, white, 0, .3, 0), RB(.4, .5, .18, .05, white, 0, .65, .3)); wc.position.set(6.4, .18, 23.5); wc.rotation.y = 0; furn(wc, box(6.4, 23.5, .25, .35)); furn(RB(.5, .2, .4, .05, white, 5.2, 1.0, 24.65), null); g.add(B(.04, .9, .04, white, 5.2, .55, 24.65));
  // комора
  for (const [x0, z0, w, d] of [[1.8, 24.6, 2.0, .35], [1.85, 23.0, .35, 1.6]]) for (let i = 0; i < 4; i++) { g.add(B(w, .04, d, planks, x0 + w / 2, .55 + i * .55, z0 - d / 2 + .2)); if (i < 3) for (let k = 0; k < Math.floor(Math.max(w, d) / .3); k++) g.add(C(.05, .05, .15 + (k % 3) * .04, 8, glass([0xa04020, 0x30803a, 0xc0a020][k % 3], .8), w > d ? x0 + .15 + k * .3 : x0, .65 + i * .55 + .08, w > d ? z0 : z0 + .15 + k * .3)); }
  cols.push(box(2.8, 24.5, 1.0, .2), box(2.0, 23.8, .2, .8));
  // ---- освітлення (кімнатні лампи)
  const rooms = [['hall', 0, 12.5], ['kitchen', 4.5, 13], ['bed', -4.2, 13.8], ['main', 0, 21.5], ['wc', 5.5, 22.6], ['pantry', 2.75, 23.5]];
  for (const [n, x, z] of rooms) {
    const bulb = G(C(.015, .015, .15, 6, P(0x222222), 0, .1, 0), S(.09, P(0xfff0c8, { emissive: 0xffe2a0, ei: 0 }), 0, -.02, 0)); bulb.position.set(x, WH - .1, z); g.add(bulb);
    const L = new THREE.PointLight(0xffd9a0, 0, n === 'main' ? 12 : 8, 1.6); L.position.set(x, WH - .35, z); g.add(L); lights.push({ room: n, light: L, bulb: bulb.children[1], on: true, base: n === 'main' ? 14 : 9 });
  }
  const sw = (n, x, z, ry) => { const s = G(B(.1, .14, .03, P(0xe8e4d8), 0, 0, 0), B(.02, .05, .03, P(0x8a8a86), 0, 0, .015)); s.position.set(x, 1.3, z); s.rotation.y = ry; g.add(s); switches.push({ room: n, pos: V3(x, 1.3, z) }); };
  sw('hall', 0.9, 10.3, 0); sw('kitchen', 1.65, 17.3, Math.PI / 2); sw('bed', -1.65, 15.3, -Math.PI / 2); sw('main', 0, 17.3, 0); sw('wc', 4.15, 21.0, -Math.PI / 2); sw('pantry', 2.0, 22.1, 0);
  ud.lamp = lamp.children[1]; ud.porchLight = new THREE.PointLight(0xffd9a0, 0, 10, 1.8); ud.porchLight.position.set(-1.0, 2.4, 9.2); g.add(ud.porchLight);
  g.traverse(c => { if (c.isMesh && !c.userData.noShadow) { c.castShadow = true; c.receiveShadow = true; } });
  // розміри/позиції для гри
  ud.crate = V3(1.9, 0, 9.0); ud.spawnNear = V3(0, 0, 8.0); ud.genPos = V3(3.2, 0, 27.0); ud.bounds = { x0: -7.2, x1: 7.2, z0: 9.9, z1: 25.2 };
  ud.insideTest = (x, z) => x > -6.9 && x < 6.9 && z > 10.1 && z < 24.9;
  return { obj: g, cols, ud };
}

export function buildCrate() {
  const g = new THREE.Group(), wd = M('planks', { rx: 1, ry: 1, color: 0xb59a74 });
  g.add(B(1.2, .06, .8, wd, 0, .03, 0)); for (const s of [-1, 1]) { g.add(B(1.2, .6, .06, wd, 0, .33, s * .4), B(.06, .6, .8, wd, s * .6, .33, 0)); }
  for (const x of [-.45, .45]) g.add(B(.08, .62, .84, P(0x3a3a3a, { metal: .6 }), x, .33, 0)); g.add(B(1.2, .04, .08, P(0x2a2a2a), 0, .66, .4));
  const lid = new THREE.Group(); lid.add(B(1.2, .05, .8, wd, 0, 0, .4)); lid.position.set(0, .66, -.4); lid.rotation.x = -1.7; g.add(lid); g.userData.lid = lid;
  const lab = canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#b59a74'; c.fillRect(0, 0, w, h); c.fillStyle = '#1a1a1a'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.fillText('СКУПКА', 128, 44); });
  g.add(PL(.9, .22, new THREE.MeshStandardMaterial({ map: lab, roughness: .8 }), 0, .35, .435, 0, 0));
  g.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
  return g;
}
export function buildGenerator(covered) {
  const g = new THREE.Group(), body = P(0xc8561e, { rough: .5, metal: .3 }), dark = P(0x1a1a1c, { rough: .5, metal: .5 });
  const frame = new THREE.Group();
  for (const [x, z] of [[-.4, -.3], [.4, -.3], [-.4, .3], [.4, .3]]) frame.add(C(.015, .015, .62, 6, dark, x, .31, z));
  frame.add(B(.9, .02, .7, dark, 0, .02, 0), B(.9, .02, .7, dark, 0, .62, 0)); g.add(frame);
  g.add(RB(.75, .42, .5, .05, body, 0, .3, 0), RB(.3, .3, .3, .04, dark, -.2, .62, 0), C(.1, .1, .1, 12, dark, .2, .62, .1), B(.2, .1, .02, P(0x222222), .0, .38, .26));
  g.add(C(.035, .035, .25, 8, P(0x555555, { metal: 1 }), .38, .5, -.25)); const fuelCap = C(.05, .05, .05, 10, P(0xe0c020), .2, .74, .1); g.add(fuelCap);
  const led = S(.015, P(0x00ff00, { emissive: 0x00ff00, ei: 1 }), .25, .38, .26); g.add(led); g.userData.led = led;
  const cov = G(B(1.3, .06, 1.1, M('corrug', { rx: 1, ry: 1 }), 0, 1.15, 0), B(.05, 1.15, .05, dark, -.6, .58, -.5), B(.05, 1.15, .05, dark, .6, .58, -.5), B(.05, 1.15, .05, dark, -.6, .58, .5), B(.05, 1.15, .05, dark, .6, .58, .5)); cov.visible = !!covered; g.add(cov); g.userData.cover = cov;
  g.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
  return g;
}
