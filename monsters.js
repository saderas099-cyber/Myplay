// ШІ 12 монстрів (виконується на хості). Кожен монстр має свій характер, слабкості та манеру полювання.
import { MONSTERS } from './data.js';
import { FC, FR } from './world.js';
import { TAU, angDiff, clamp, rr } from './util.js';

let NEXT = 1;
const REACH = 1.9;
export class Mon {
  constructor(type, x, z, ctl = null) {
    const d = MONSTERS[type]; this.id = NEXT++; this.type = type; this.d = d; this.x = x; this.z = z; this.y = 0; this.yaw = Math.random() * TAU; this.hp = d.hp; this.maxhp = d.hp; this.beh = d.beh; this.rad = d.size * .35;
    this.cd = 1; this.t = 0; this.st = 'idle'; this.tgt = null; this.stun = 0; this.speed = 0; this.ctl = ctl; this.vis = true; this.hidden = false; this.extra = {}; this.atk = 0; this.moveSp = 0; this.stuck = 0; this.side = 0; this.canDoor = ['collector', 'bear', 'antlers', 'granny', 'scarecrow', 'creaker', 'shade'].includes(type);
    this.mul = 1; this.fly = type === 'crows';
  }
  snap() { return [this.id, this.type, +this.x.toFixed(2), +this.y.toFixed(2), +this.yaw.toFixed(2), this.st, Math.round(this.hp), +this.moveSp.toFixed(1), this.hidden ? 1 : 0, this.atk > 0 ? 1 : 0]; }
}
export const D2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function spawnPoint(ctx, type) {
  const w = ctx.world, ps = ctx.players.filter(p => p.state === 'alive');
  if (type === 'granny') return { x: -.5, z: 20 };
  if (type === 'collector') return { x: FC.x + Math.sqrt(FR * FR - FC.z * FC.z) - 3, z: 1 };
  if (type === 'swamp') { const sw = w.puddles.filter(p => p.swamp); if (sw.length) { const s = sw[Math.floor(Math.random() * sw.length)]; return { x: s.x, z: s.z, swamp: s }; } }
  if (type === 'scarecrow') { const sc = w.structs.filter(s => s.obj && s.obj.children.length && s.ud && false); }
  for (let i = 0; i < 60; i++) {
    const a = Math.random() * TAU, r = FR - 3 - Math.random() * 6, x = FC.x + Math.cos(a) * r, z = FC.z + Math.sin(a) * r;
    if (w.reserved(x, z, 2) || w.cols.blocked(x, z, 1)) continue; if (ps.some(p => Math.hypot(p.x - x, p.z - z) < 26)) continue; return { x, z };
  }
  return { x: FC.x + FR - 6, z: FC.z };
}
export function makeMonster(ctx, type, ctl = null) {
  const sp = spawnPoint(ctx, type), m = new Mon(type, sp.x, sp.z, ctl); m.mul = ctx.diff.monsterMul; m.hp = m.maxhp = Math.round(m.d.hp * (ctx.mode === 'action' ? 1.3 : 1)); m.home = { x: sp.x, z: sp.z, swamp: sp.swamp };
  if (type === 'spider') { m.st = 'wait'; m.extra.y = 0; const t = ctx.world.treePts; if (t && t.length) { for (let i = 0; i < 40; i++) { const p = t[Math.floor(Math.random() * t.length)]; if (p.inner && !ctx.world.reserved(p.x, p.z, 4) && Math.abs(p.z) > 7) { m.x = p.x + 1.2; m.z = p.z; m.home = { x: m.x, z: m.z }; break; } } } }
  if (type === 'scarecrow') { m.st = 'pose'; const a = Math.random() * TAU, r = 10 + Math.random() * 36; for (let i = 0; i < 30; i++) { const x = FC.x + Math.cos(a + i) * r, z = FC.z + Math.sin(a + i) * r; if (!ctx.world.reserved(x, z, 3) && !ctx.world.cols.blocked(x, z, 1)) { m.x = x; m.z = z; break; } } m.home = { x: m.x, z: m.z }; }
  if (type === 'crows') { m.st = 'orbit'; m.y = 6; }
  if (type === 'granny') { m.st = 'dormant'; }
  if (type === 'swamp') { m.st = 'lurk'; m.hidden = true; }
  if (type === 'antlers') { m.st = 'watch'; m.extra.tp = 14; m.extra.mimic = 12; }
  if (type === 'wolf') { m.st = 'circle'; m.extra.ang = Math.random() * TAU; m.extra.dir = Math.random() < .5 ? 1 : -1; m.extra.charge = 0; }
  return m;
}
// ---------- допоміжні ----------
function nearest(m, ps, filter) { let b = null, bd = 1e9; for (const p of ps) { if (p.state !== 'alive' && p.state !== 'down') continue; if (filter && !filter(p)) continue; const d = D2(m, p); if (d < bd) { bd = d; b = p; } } return b ? { p: b, d: bd } : null; }
function face(m, tx, tz, dt, rate = 8) { const ty = Math.atan2(-(tx - m.x), -(tz - m.z)); m.yaw += angDiff(m.yaw, ty) * Math.min(1, dt * rate); }
function step(m, tx, tz, sp, dt, ctx, noTurn) {
  const dx = tx - m.x, dz = tz - m.z, d = Math.hypot(dx, dz); if (d < .05 || sp <= 0) { m.moveSp = 0; return d; }
  let ang = Math.atan2(dz, dx) + m.side; const sx = Math.cos(ang) * sp * dt, sz = Math.sin(ang) * sp * dt; let nx = m.x + sx, nz = m.z + sz;
  if (!m.fly) { if (m.canDoor) ctx.tryDoor(m); [nx, nz] = ctx.world.cols.resolve(nx, nz, m.rad); }
  const moved = Math.hypot(nx - m.x, nz - m.z); if (moved < sp * dt * .3) { m.stuck += dt; if (m.stuck > .4) { m.side = (Math.random() < .5 ? 1 : -1) * (.9 + Math.random() * .8); m.stuck = 0; m.sideT = .7; } } else { m.stuck = 0; }
  if (m.sideT > 0) { m.sideT -= dt; if (m.sideT <= 0) m.side = 0; }
  const cr = Math.hypot(nx - FC.x, nz - FC.z); if (cr > FR - 1.2) { const k = (FR - 1.2) / cr; nx = FC.x + (nx - FC.x) * k; nz = FC.z + (nz - FC.z) * k; }
  m.x = nx; m.z = nz; m.moveSp = moved / dt; if (!noTurn) face(m, m.x + Math.cos(ang), m.z + Math.sin(ang), dt, 10); return d;
}
function seenBy(m, ps, ctx, dist = 45) { for (const p of ps) { if (p.state !== 'alive' || p.bot) continue; const dx = m.x - p.x, dz = m.z - p.z, d = Math.hypot(dx, dz); if (d > dist) continue; const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw); if ((dx * fx + dz * fz) / (d || 1) < .42) continue; if (d > 3 && ctx.world.cols.ray(p.x, p.z, m.x, m.z, 1.5)) continue; return true; } return false; }
function lit(m, ps, range = 14, cone = .86) { for (const p of ps) { if (p.state !== 'alive' || !p.fl) continue; const dx = m.x - p.x, dz = m.z - p.z, d = Math.hypot(dx, dz); if (d > range) continue; const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw); if ((dx * fx + dz * fz) / (d || 1) > cone) return p; } return null; }
function hit(m, p, ctx, dmg, extra) { if (m.cd > 0 || p.state !== 'alive') return false; if (D2(m, p) > REACH + m.d.size * .3) return false; m.cd = m.type === 'bear' ? 2 : 1.25; m.atk = .45; ctx.hurt(p, dmg * m.mul * (ctx.diff.dmgMul || 1), m, extra); return true; }
function alone(p, ps) { return !ps.some(q => q !== p && q.state === 'alive' && Math.hypot(q.x - p.x, q.z - p.z) < 16); }
function wander(m, dt, ctx, sp) { m.extra.wx = m.extra.wx ?? m.x; m.extra.wz = m.extra.wz ?? m.z; if (Math.hypot(m.extra.wx - m.x, m.extra.wz - m.z) < 2 || (m.extra.wt = (m.extra.wt || 0) + dt) > 10) { m.extra.wt = 0; const a = Math.random() * TAU, r = 10 + Math.random() * 20; m.extra.wx = clamp(m.x + Math.cos(a) * r, FC.x - FR + 4, FC.x + FR - 4); m.extra.wz = clamp(m.z + Math.sin(a) * r, FC.z - FR + 4, FC.z + FR - 4); if (Math.hypot(m.extra.wx - FC.x, m.extra.wz - FC.z) > FR - 4) { m.extra.wx = FC.x; m.extra.wz = FC.z; } } step(m, m.extra.wx, m.extra.wz, sp, dt, ctx); }
const inHouse = p => p.inHouse;

// ---------- головний оновлювач ----------
export function updateMonster(m, dt, ctx) {
  const ps = ctx.players, hum = ps.filter(p => p.state === 'alive');
  m.t += dt; m.cd -= dt; m.atk -= dt; if (m.stun > 0) { m.stun -= dt; m.moveSp = 0; m.st = m.stun > 0 ? 'stun' : 'idle'; return; }
  if (m.ctl) return updateControlled(m, dt, ctx);
  const sp = m.d.speed * (.8 + .2 * m.mul);
  switch (m.beh) {
    case 'stalk': { // Вовк: кружляє на межі світла, кидається на одинаків/біжучих
      const n = nearest(m, hum); if (!n) { wander(m, dt, ctx, sp * .5); break; } const p = n.p, e = m.extra;
      if (m.st === 'retreat') { step(m, m.x + (m.x - p.x), m.z + (m.z - p.z), sp, dt, ctx); if (m.t > e.rt) { m.st = 'circle'; } break; }
      if (m.st === 'circle') { e.ang += e.dir * dt * (sp / 16) * .8; const R = 16 + Math.sin(m.t * .4) * 4, tx = p.x + Math.cos(e.ang) * R, tz = p.z + Math.sin(e.ang) * R; step(m, tx, tz, sp * .7, dt, ctx); face(m, p.x, p.z, dt, 4); if (m.t > 7 && (p.noise > .7 || alone(p, hum) || (!p.fl && ctx.night > .5)) && Math.random() < dt * .8) { m.st = 'charge'; ctx.sound('growl', m, { mon: 'wolf' }); e.charge = 0; } if (Math.random() < dt * .04) ctx.sound('growl', m, { mon: 'wolf', dur: 2 }); }
      else if (m.st === 'charge') { e.charge += dt; step(m, p.x, p.z, sp * 1.15, dt, ctx); if (hit(m, p, ctx, m.d.dmg)) { m.st = 'retreat'; m.t = 0; e.rt = 6 + Math.random() * 3; } else if (lit(m, [p], 9, .9) && Math.random() < dt * .4 || e.charge > 9) { m.st = 'circle'; m.t = 3; } }
      break; }
    case 'freeze': { // Скрипун: рухається тільки коли на нього не дивляться
      const n = nearest(m, hum); if (!n) { m.moveSp = 0; break; } const seen = seenBy(m, hum, ctx, 55); m.st = seen ? 'frozen' : 'hunt';
      if (!seen) { const boost = ctx.night > .6 ? 1.3 : 1; step(m, n.p.x, n.p.z, sp * boost, dt, ctx); hit(m, n.p, ctx, m.d.dmg); } else { m.moveSp = 0; if (Math.random() < dt * .25) ctx.sound('creak', m); face(m, n.p.x, n.p.z, dt, 12); }
      break; }
    case 'shade': { // Тінь: боїться променя ліхтаря
      const ls = lit(m, hum, 16, .8); if (ls) { m.st = 'flee'; m.t = 0; }
      if (m.st === 'flee') { const n = nearest(m, hum); if (n) step(m, m.x + (m.x - n.p.x), m.z + (m.z - n.p.z), sp * 1.1, dt, ctx); if (m.t > 2.5) m.st = 'hunt'; break; }
      const dark = nearest(m, hum, p => !p.fl && !p.inLight); const n = dark || nearest(m, hum); if (!n) { wander(m, dt, ctx, sp * .4); break; } m.st = 'hunt'; step(m, n.p.x, n.p.z, sp * (dark ? 1.25 : .7), dt, ctx); if (dark) hit(m, n.p, ctx, m.d.dmg);
      m.hidden = false; break; }
    case 'hound': { // Гончак: чує біг, постріли, гучні звуки
      let best = null, bd = 1e9; for (const p of hum) { const r = m.d.hear * (p.noise || 0); const d = D2(m, p); if (d < r && d < bd) { bd = d; best = p; } }
      let nz = null; for (const n of ctx.noises) { const d = Math.hypot(n.x - m.x, n.z - m.z); if (d < n.r && d < bd) { bd = d; nz = n; best = null; } }
      if (m.st === 'retreat') { if (m.t > 5) m.st = 'idle'; wander(m, dt, ctx, sp * .6); break; }
      if (best) { m.st = 'hunt'; m.extra.last = { x: best.x, z: best.z }; step(m, best.x, best.z, sp, dt, ctx); if (hit(m, best, ctx, m.d.dmg)) { m.st = 'retreat'; m.t = 0; } }
      else if (nz) { m.st = 'inv'; step(m, nz.x, nz.z, sp * .9, dt, ctx); }
      else if (m.extra.last && D2(m, m.extra.last) > 2) { step(m, m.extra.last.x, m.extra.last.z, sp * .7, dt, ctx); } else { m.st = 'idle'; wander(m, dt, ctx, sp * .35); }
      break; }
    case 'ambush': { // Павук: чекає на дереві над стежкою
      const e = m.extra; const n = nearest(m, hum);
      if (m.st === 'wait') { m.y = 3.4; m.hidden = false; m.moveSp = 0; if (n && D2(m, n.p) < 6.5 && n.p.state === 'alive') { m.st = 'drop'; m.t = 0; ctx.sound('growl', m, { mon: 'spider', dur: .8 }); } }
      else if (m.st === 'drop') { m.y = Math.max(0, m.y - dt * 14); if (n) step(m, n.p.x, n.p.z, sp * 1.2, dt, ctx); if (m.y <= 0 && n) { m.st = 'hunt'; m.t = 0; } }
      else if (m.st === 'hunt') { m.y = 0; if (n) { step(m, n.p.x, n.p.z, sp, dt, ctx); if (hit(m, n.p, ctx, m.d.dmg, { slow: 4 })) { } } if (m.t > 12) { m.st = 'climb'; } }
      else if (m.st === 'climb') { step(m, m.home.x, m.home.z, sp, dt, ctx); if (D2(m, m.home) < 1.5) { m.y += dt * 4; if (m.y >= 3.4) { m.st = 'wait'; } } }
      break; }
    case 'tank': { // Ведмідь: йде на їжу та шум, розганяється
      const food = nearest(m, hum, p => p.carriesFood); const n = food || nearest(m, hum, p => (p.noise || 0) > .3 && D2(m, p) < m.d.hear) || nearest(m, hum, () => D2(m, m) < 1e9 && true); if (!n || (!food && D2(m, n.p) > m.d.sight)) { wander(m, dt, ctx, sp * .4); m.st = 'roam'; break; }
      const d = n.d; if (m.st === 'wind') { m.moveSp = 0; face(m, n.p.x, n.p.z, dt, 8); if (m.t > 1.1) { m.st = 'rush'; m.t = 0; } }
      else if (m.st === 'rush') { step(m, n.p.x, n.p.z, sp * 2.1, dt, ctx); if (hit(m, n.p, ctx, m.d.dmg)) { m.st = 'roam'; m.t = 0; } if (m.t > 3) { m.st = 'roam'; m.t = 0; } }
      else { step(m, n.p.x, n.p.z, sp * .8, dt, ctx); if (d < 13 && m.t > 4) { m.st = 'wind'; m.t = 0; ctx.sound('growl', m, { mon: 'bear', dur: 1.2 }); } hit(m, n.p, ctx, m.d.dmg); }
      break; }
    case 'mimic': { // Опудало: стоїть як декор, оживає коли підійшли
      if (m.st === 'pose') { m.moveSp = 0; m.hidden = false; const n = nearest(m, hum); if (n && (n.d < 6.5 || (n.d < 14 && !seenBy(m, hum, ctx) && Math.random() < dt * .15))) { m.st = 'hunt'; m.t = 0; ctx.sound('creak', m); } }
      else if (m.st === 'hunt') { const n = nearest(m, hum); if (n) { step(m, n.p.x, n.p.z, sp, dt, ctx); hit(m, n.p, ctx, m.d.dmg); } if (m.t > 14 && !seenBy(m, hum, ctx)) { m.st = 'return'; } }
      else if (m.st === 'return') { step(m, m.home.x, m.home.z, sp * .7, dt, ctx); if (D2(m, m.home) < 1.2) m.st = 'pose'; }
      break; }
    case 'collector': { // Колектор: невблаганний, відчиняє двері
      const n = nearest(m, hum); if (!n) { wander(m, dt, ctx, sp * .5); break; } const p = n.p; m.st = 'hunt';
      const s = sp * (p.noise > .7 ? 1.35 : 1); step(m, p.x, p.z, s, dt, ctx); hit(m, p, ctx, m.d.dmg); if (Math.random() < dt * .08) ctx.sound('mumble', m);
      if (ctx.flares.some(f => Math.hypot(f.x - m.x, f.z - m.z) < 12)) { m.speed = 0.4; step(m, m.x - (p.x - m.x), m.z - (p.z - m.z), sp * .5, dt, ctx); }
      break; }
    case 'granny': { // Бабуся: полює лише в темряві будинку
      const inside = hum.filter(inHouse); const dark = inside.filter(p => !ctx.roomLit(p.x, p.z));
      if (dark.length) { const n = nearest(m, dark); m.st = 'hunt'; m.hidden = false; step(m, n.p.x, n.p.z, sp * (ctx.powerOn() ? .9 : 1.2), dt, ctx); hit(m, n.p, ctx, m.d.dmg); if (Math.random() < dt * .1) ctx.sound('creak', m); }
      else { m.st = 'dormant'; m.moveSp = 0; m.extra.tw = (m.extra.tw || 0) + dt; if (m.extra.tw > 14) { m.extra.tw = 0; const R = [[-.5, 20], [3, 14], [-4, 14], [5, 23.5], [2.7, 23.5], [-5, 22]], r = R[Math.floor(Math.random() * R.length)]; m.x = r[0]; m.z = r[1]; ctx.sound('knock', m); ctx.flicker && inside.length && ctx.flicker(); } m.hidden = inside.length === 0 || ctx.roomLit(m.x, m.z); }
      const q = ctx.world.house.ud.bounds; m.x = clamp(m.x, q.x0 + 1, q.x1 - 1); m.z = clamp(m.z, q.z0 + 1, q.z1 - 1); break; }
    case 'crows': { // Ворони: кружляють, крадуть речі
      const n = nearest(m, hum, p => !p.inHouse); m.y = 6 + Math.sin(m.t) * .6; if (!n) { wander(m, dt, ctx, sp * .4); break; }
      if (m.st === 'orbit') { m.extra.a = (m.extra.a || 0) + dt * 1.2; step(m, n.p.x + Math.cos(m.extra.a) * 7, n.p.z + Math.sin(m.extra.a) * 7, sp * .6, dt, ctx); if (m.t > 8 && Math.random() < dt * .5) { m.st = 'dive'; m.t = 0; ctx.sound('caw', m); } }
      else if (m.st === 'dive') { m.y = Math.max(1.4, m.y - dt * 9); step(m, n.p.x, n.p.z, sp, dt, ctx); if (D2(m, n.p) < 1.8) { if (n.p.inv && n.p.inv.length && Math.random() < .6) ctx.steal(n.p, m); else ctx.hurt(n.p, m.d.dmg * m.mul, m); m.st = 'flee'; m.t = 0; } if (m.t > 4) { m.st = 'orbit'; m.t = 0; } }
      else if (m.st === 'flee') { m.y += dt * 8; step(m, m.x + (m.x - n.p.x), m.z + (m.z - n.p.z), sp, dt, ctx); if (m.t > 4) { m.st = 'orbit'; m.t = 0; } }
      break; }
    case 'swamp': { // Болотник: чекає у багнюці й хапає
      const s = m.home.swamp, n = nearest(m, hum); if (!s) { break; } const e = m.extra;
      if (m.st === 'lurk') { m.hidden = true; m.x = s.x; m.z = s.z; if (n && Math.hypot(n.p.x - s.x, n.p.z - s.z) < s.r + 1.4) { m.st = 'rise'; m.t = 0; m.hidden = false; } }
      else if (m.st === 'rise') { m.hidden = false; if (m.t > .8) { m.st = 'grab'; m.t = 0; } }
      else if (m.st === 'grab') { if (n) { const dx = n.p.x - s.x, dz = n.p.z - s.z, d = Math.hypot(dx, dz); if (d < s.r + 2.4) { step(m, n.p.x, n.p.z, sp, dt, ctx); if (D2(m, n.p) < 2) { hit(m, n.p, ctx, m.d.dmg, { grab: 2.2, slow: 5 }); } } } const dd = Math.hypot(m.x - s.x, m.z - s.z); if (dd > s.r + 1.5) { m.x = s.x + (m.x - s.x) / dd * (s.r + 1.5); m.z = s.z + (m.z - s.z) / dd * (s.r + 1.5); } if (m.t > 8) { m.st = 'sink'; m.t = 0; } }
      else if (m.st === 'sink') { step(m, s.x, s.z, sp, dt, ctx); if (m.t > 3) { m.st = 'lurk'; } }
      break; }
    case 'antlers': { // Рогатий: спостерігає, імітує кроки, б'є самотніх
      const n = nearest(m, hum); if (!n) { m.moveSp = 0; break; } const e = m.extra, p = n.p;
      e.tp -= dt; e.mimic -= dt;
      if (e.mimic <= 0) { e.mimic = 12 + Math.random() * 12; const o = hum[Math.floor(Math.random() * hum.length)]; if (o) ctx.sound('step', { x: o.x + (Math.random() - .5) * 14, z: o.z + (Math.random() - .5) * 14, y: 0 }, { surface: 'grass', far: true }); }
      if (m.st === 'watch') { const R = 20; const d = n.d; if (d > R + 4) step(m, p.x, p.z, sp * .5, dt, ctx); else if (d < R - 5) step(m, m.x + (m.x - p.x), m.z + (m.z - p.z), sp * .4, dt, ctx); else m.moveSp = 0; face(m, p.x, p.z, dt, 5);
        if (e.tp <= 0 && !seenBy(m, hum, ctx, 70)) { e.tp = 22; const a = Math.atan2(m.z - p.z, m.x - p.x), r = Math.max(10, d - 6); m.x = p.x + Math.cos(a) * r; m.z = p.z + Math.sin(a) * r; }
        if ((alone(p, hum) && d < 26 && m.t > 14) || (ctx.hour > 21.5 && d < 20)) { m.st = 'charge'; m.t = 0; ctx.sound('growl', m, { mon: 'antlers', dur: 2 }); } }
      else if (m.st === 'charge') { step(m, p.x, p.z, sp * 1.25, dt, ctx); if (hit(m, p, ctx, m.d.dmg)) { m.st = 'watch'; m.t = 0; e.tp = 8; } if (m.t > 10) { m.st = 'watch'; m.t = 0; } }
      break; }
  }
  m.y = m.fly || m.st === 'wait' || m.st === 'drop' || m.st === 'climb' ? m.y : 0;
}
// монстр під керуванням гравця
function updateControlled(m, dt, ctx) {
  const p = ctx.players.find(q => q.id === m.ctl); if (!p || !p.inp) return; const i = p.inp, sp = m.d.speed * (i.sprint ? 1.15 : .8);
  const mx = i.mx || 0, mz = i.mz || 0, len = Math.hypot(mx, mz);
  if (len > .05) { const yaw = i.yaw; const dx = (mx * Math.cos(yaw) + mz * Math.sin(yaw)) / Math.max(1, len), dz = (-mx * Math.sin(yaw) + mz * Math.cos(yaw)) / Math.max(1, len); let nx = m.x + dx * sp * dt, nz = m.z + dz * sp * dt; if (m.canDoor) ctx.tryDoor(m); [nx, nz] = ctx.world.cols.resolve(nx, nz, m.rad); const cr = Math.hypot(nx - FC.x, nz - FC.z); if (cr > FR - 1.2) { const k = (FR - 1.2) / cr; nx = FC.x + (nx - FC.x) * k; nz = FC.z + (nz - FC.z) * k; } m.moveSp = Math.hypot(nx - m.x, nz - m.z) / dt; m.x = nx; m.z = nz; } else m.moveSp = 0;
  m.yaw = i.yaw; m.st = m.moveSp > 0.5 ? 'hunt' : 'idle'; p.x = m.x; p.z = m.z; p.y = 0; m.hidden = false;
  if (i.act && m.cd <= 0) { m.cd = 1.2; m.atk = .45; for (const q of ctx.players) if (q !== p && q.state === 'alive' && D2(m, q) < REACH + 1.2) ctx.hurt(q, m.d.dmg * (ctx.diff.dmgMul || 1), m); i.act = false; }
}
