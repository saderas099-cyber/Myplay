// Логіка хоста: дні, монстри, боти, економіка, кінець гри
import * as THREE from 'three';
import { Game, roomAt } from './game.js';
import { GUNS } from './game2.js';
import { ITEMS, SHOP, PHOTO, MONSTERS, MONSTER_KEYS, DIFFS, REWARD, NEWS, KIND_LABEL, LOOT_PER_DAY, DIG_SPOTS } from './data.js';
import { net } from './net.js';
import { audio } from './audio.js';
import { Mon, makeMonster, updateMonster, D2 } from './monsters.js';
import { rng, clamp, money, TAU, wait, angDiff } from './util.js';
import { marketFor, unitValue, shopPrice, nextUid, rollLoot, rollDigs, digReward } from './economy.js';
import { addTokens, saveP, P as PR } from './settings.js';
import { V3 } from './geo.js';
import { inp, take, pollKeys } from './input.js';
import { FC, FR } from './world.js';

const DAY_MIN = 8.5, HOUR_END = 23.0;
const FOOD = new Set(['porcini', 'chanter', 'amanita', 'blueberry', 'raspberry', 'honey']);

Object.assign(Game.prototype, {
  hostInit(firstMon) {
    const S = this.S, W = this.world, cfg = this.cfg, R = this.R = rng(this.seed ^ 0x9e3779b9);
    this.H = { monsters: [], noises: [], flares: [], night: false, waiting: false, readySet: new Set(), snapT: 0, genT: 0, weatherT: 0, firstMon, bleed: new Map(), photos: new Map(), ended: false, spawnedToday: false, revengeBonus: 0 };
    S.gen = { on: false, fuel: 3, broken: false, cover: false }; S.carFuel = 0; S.market = marketFor(this.seed, 1); S.weather = 'clear'; S.hour = 6.5; S.digs = rollDigs(R, W);
    const list = rollLoot(R, W, cfg.diff, 1, cfg.rareMul || 1, []); this.emit({ k: 'spawn', list });
    this.emit({ k: 'weather', w: 'clear' });
    // боти та монстр-гравець
    for (const p of S.players.values()) { if (p.bot) { p.ai = { st: 'collect', tgt: null, stuck: 0, lx: 0, lz: 0 }; } }
    if (cfg.mode === 'monster') { const humans = [...S.players.values()].filter(p => !p.bot); let mp = cfg.monsterWho === 'random' ? humans[Math.floor(R() * humans.length)] : humans.find(p => p.id === 'p0') || humans[0]; if (mp) { mp.monster = true; const t = firstMon || 'wolf'; const m = makeMonster(this.ctx(), t, mp.id); m.hp = m.maxhp = Math.round(m.maxhp * 1.4); this.H.monsters.push(m); mp.mtype = t; } }
  },
  checkAllLoaded() { const humans = [...this.S.players.values()].filter(p => !p.bot && p.id !== this.myId).map(p => p.id); if (humans.every(id => this.loadedSet.has(id)) || this.loadWait > 25) this.goRun(); else { clearTimeout(this._lw); this._lw = setTimeout(() => { this.loadWait += 2; this.checkAllLoaded(); }, 2000); } },
  goRun() { if (this._went) return; this._went = true; clearTimeout(this._lw); if (net.online) net.send({ t: 'go', firstMon: this.H.firstMon }); this.intro(this.H.firstMon); setTimeout(() => { this._went = false; }, 1000); },
  ctx() {
    const S = this.S, W = this.world, self = this;
    return { players: [...S.players.values()].filter(p => !p.monster), world: W, diff: this.cfg.diff, mode: this.cfg.mode, night: W.night || 0, hour: S.hour, noises: this.H.noises, flares: this.H.flares,
      sound: (name, m, o) => this.emit({ k: 'sound', name, x: m.x, y: m.y || 0, z: m.z, o: o || {} }), hurt: (p, d, src, ex) => this.hurt(p, d, src, ex), roomLit: (x, z) => this.roomLit(x, z), powerOn: () => this.powerOn(),
      tryDoor: m => { for (const d of W.doors) { if (!d.open && Math.hypot(d.pos.x - m.x, d.pos.z - m.z) < 1.7 && !(self.S.doors[d.id])) { self.emit({ k: 'door', id: d.id, open: true }); self.emit({ k: 'sound', name: 'knock', x: d.pos.x, z: d.pos.z }); } } },
      steal: (p, m) => { const u = p.inv[Math.floor(Math.random() * p.inv.length)]; if (!u) return; self.emit({ k: 'stolen', u, pid: p.id, x: m.x + (Math.random() - .5) * 30, z: m.z + (Math.random() - .5) * 30, y: 0 }); const it = S.items.get(u); const q = self.world.cols.resolve(it.x, it.z, .3); it.y = W.terrainH(it.x, it.z); },
      flicker: () => this.emit({ k: 'flicker' }) };
  },
  // ----- шкода й смерть -----
  hurt(p, dmg, src, ex = {}) {
    if (p.state !== 'alive') return; dmg = Math.round(dmg); p.hp = Math.max(0, p.hp - dmg);
    this.emit({ k: 'hurt', pid: p.id, hp: p.hp, dmg, mid: src && src.id, slow: ex.slow, grab: ex.grab });
    if (p.hp <= 0) {
      const hc = this.cfg.diff.hardcore || this.cfg.mode === 'hardcore'; p.state = hc ? 'dead' : 'down'; this.H.bleed.set(p.id, 0);
      this.emit({ k: 'down', pid: p.id, dead: hc });
      if (hc) this.dropAll(p);
      this.checkAllDead();
    }
  },
  dropAll(p) { for (const u of [...p.inv]) { const it = this.S.items.get(u); if (it) this.emit({ k: 'drop', u, x: p.x + (Math.random() - .5) * 1.5, y: this.world.terrainH(p.x, p.z), z: p.z + (Math.random() - .5) * 1.5 }); } },
  checkAllDead() {
    const S = this.S, surv = [...S.players.values()].filter(p => !p.monster);
    if (surv.length && surv.every(p => p.state !== 'alive')) { if (surv.every(p => p.state === 'dead') || surv.every(p => p.state !== 'alive')) setTimeout(() => this.finish(false, this.cfg.mode === 'monster' ? 'Монстр переміг: усіх вбито' : 'Усіх гравців вбито', true), 2500); }
  },
  // ----- команди від гравців -----
  exec(pid, c) {
    const S = this.S, p = S.players.get(pid), W = this.world, diff = this.cfg.diff; if (!p) return;
    const near = (x, z, r) => Math.hypot(p.x - x, p.z - z) < r;
    switch (c.k) {
      case 'pick': { const it = S.items.get(c.u); if (!it || it.loc !== 'w' || p.state !== 'alive') return; if (p.inv.length >= 4 + (S.owned.has('bag') ? 2 : 0)) return; if (!near(it.x, it.z, 5)) return; this.emit({ k: 'take', u: c.u, pid }); break; }
      case 'drop': { const it = S.items.get(c.u); if (!it || it.by !== pid || it.loc !== 'h') return; const [x, z] = W.cols.resolve(c.x, c.z, .3); const inside = this.inHouseXZ(x, z); this.emit({ k: 'drop', u: c.u, x, z, y: inside ? .2 : W.terrainH(x, z) }); break; }
      case 'crate': { const it = S.items.get(c.u); if (!it || it.by !== pid || it.loc !== 'h' || !near(1.9, 9, 5)) return; this.emit({ k: 'crate', u: c.u, pid }); break; }
      case 'door': S.doors[c.id] !== undefined || (S.doors[c.id] = false); this.emit({ k: 'door', id: c.id, open: !S.doors[c.id] }); break;
      case 'light': this.emit({ k: 'light', room: c.room, on: S.lights[c.room] === false }); break;
      case 'gen': {
        const g = S.gen; const base = { k: 'gen', on: g.on, fuel: g.fuel, broken: g.broken, cover: g.cover, who: pid };
        if (c.op === 'toggle') { if (g.broken) return; if (g.fuel <= 0) return this.emit({ ...base, note: 'Генератор без палива', who: pid }); const on = !g.on; const rain = S.weather === 'rain' || S.weather === 'storm'; this.emit({ ...base, on, note: on && rain && !g.cover ? 'Під дощем без накриття генератор може зламатись!' : null }); }
        else if (c.op === 'fuel') { const it = S.items.get(c.u); if (!it || it.by !== pid || it.id !== 'gen_fuel') return; const add = Math.min(10 - g.fuel, it.lit || 5); this.emit({ k: 'gone', u: c.u }); this.emit({ ...base, fuel: g.fuel + add, note: `Залито ${add.toFixed(1)} л` }); }
        else if (c.op === 'repair') { const it = S.items.get(c.u); if (!it || it.by !== pid || it.id !== 'repair') return; this.emit({ k: 'gone', u: c.u }); this.emit({ ...base, broken: false, note: 'Генератор полагоджено' }); }
        break; }
      case 'carfuel': { const it = S.items.get(c.u); if (!it || it.by !== pid || !ITEMS[it.id].fuel) return; const liters = it.id === 'gascan5' ? 5 : (it.lit || 1); this.emit({ k: 'gone', u: c.u }); this.emit({ k: 'carfuel', total: Math.min(diff.carFuel + 5, S.carFuel + liters) }); break; }
      case 'buy': this.doBuy(pid, c.id); break;
      case 'pay': { const left = Math.max(0, S.debt - S.paid), amt = Math.min(c.amt, S.cash, left); if (amt <= 0) return; this.emit({ k: 'cash', cash: S.cash - amt, paid: S.paid + amt, note: S.paid + amt >= S.debt ? 'Борг повністю погашено! Заправте машину й виїжджайте' : `Сплачено ${money(amt)}` }); break; }
      case 'dig': { const d = S.digs[c.i]; if (!d || d.done || !S.owned.has('shovel') || !near(d.x, d.z, 4)) return; const R = rng(Date.now() & 0xffff), rew = digReward(R, diff); const list = rew.map((r, i) => ({ u: nextUid(), id: r.id, x: d.x + (i - .5) * .5, y: d.y, z: d.z + .3 * i, val: r.val || Math.round((ITEMS[r.id].v || 0) * (.9 + R() * .2)), lit: 0 })); this.emit({ k: 'dig', i: c.i, pid, list }); break; }
      case 'photo': { const key = pid + c.kind + S.day; if (this.H.photos.has(key) || !S.owned.has('camera') || !PHOTO[c.kind]) { if (pid === this.myId) this.msg('Цю тварину сьогодні вже фотографували', 2); return; } this.H.photos.set(key, 1); const val = Math.round(PHOTO[c.kind].v * (.9 + Math.random() * .3)); const u = nextUid(); this.emit({ k: 'spawn', list: [{ u, id: 'photo', x: p.x, y: p.y, z: p.z, val, lit: 0, kind: c.kind }] }); this.emit({ k: 'photo', pid, kind: c.kind, val }); if (p.inv.length < 4 + (S.owned.has('bag') ? 2 : 0)) this.emit({ k: 'take', u, pid }); break; }
      case 'use': {
        const it = S.items.get(c.u); if (!it || it.by !== pid) return;
        if (c.what === 'medkit') { const t = S.players.get(c.target); if (!t) return; if (t.state === 'down') { this.emit({ k: 'gone', u: c.u }); t.state = 'alive'; t.hp = Math.round(t.maxhp * .5); this.H.bleed.delete(t.id); this.emit({ k: 'revive', pid: t.id, hp: t.hp }); } else if (t.state === 'alive' && t.hp < t.maxhp) { this.emit({ k: 'gone', u: c.u }); t.hp = Math.min(t.maxhp, t.hp + Math.round(t.maxhp * .6)); this.emit({ k: 'heal', pid: t.id, hp: t.hp }); } }
        else if (c.what === 'flare') { this.emit({ k: 'gone', u: c.u }); this.emit({ k: 'flare', x: c.x, z: c.z }); this.H.flares.push({ x: c.x, z: c.z, t: 25 }); for (const m of this.H.monsters) if (!m.ctl && ['wolf', 'hound', 'bear', 'spider', 'shade', 'swamp', 'granny', 'creaker'].includes(m.type) && Math.hypot(m.x - c.x, m.z - c.z) < 16) m.stun = 3.5; }
        else if (c.what === 'aa') { this.emit({ k: 'gone', u: c.u }); }
        break; }
      case 'shoot': this.doShoot(p, c); break;
      case 'leave': this.tryLeave(p); break;
      case 'ready': if (this.H.waiting) { this.H.readySet.add(pid); this.checkReady(); } break;
    }
  },
  doBuy(pid, id) {
    const S = this.S, e = SHOP.find(s => s.id === id), diff = this.cfg.diff; if (!e) return; const price = shopPrice(e, diff);
    if (S.cash < price) return this.emit({ k: 'sound', name: 'click' });
    const buy = o => this.emit({ k: 'buy', cash: S.cash - price, ...o });
    if (e.kind === 'item') buy({ parcel: e.give, msg: `Куплено: ${e.name}. Посилка буде на ґанку вранці` });
    else if (e.kind === 'perm') { if (S.owned.has(e.id)) return; const gun = GUNS[e.id]; buy({ owned: e.id, ammo: gun ? 12 : 0, msg: `Куплено: ${e.name}` }); }
    else if (e.kind === 'ammo') buy({ ammo: 12, msg: '+12 набоїв кожному' });
    else if (e.id === 'revive') { const dead = [...S.players.values()].find(p => p.state === 'dead' || p.state === 'down'); if (!dead) return this.emit({ k: 'buy', cash: S.cash, msg: 'Немає кого повертати' }); buy({}); dead.state = 'alive'; dead.hp = dead.maxhp; this.H.bleed.delete(dead.id); this.emit({ k: 'revive', pid: dead.id, hp: dead.hp, x: 0.5, z: 8.5 }); }
  },
  doShoot(p, c) {
    const g = GUNS[c.kind]; if (!g || !this.S.owned.has(c.kind) || p.state !== 'alive') return; if (p.ammo <= 0 && p.id !== this.myId) return; if (p.id !== this.myId) p.ammo--;
    this.emit({ k: 'shot', pid: p.id, kind: c.kind, x: p.x, z: p.z }); this.H.noises.push({ x: p.x, z: p.z, r: 60, t: 4 });
    const o = c.o, d = c.d; let dmgTotal = new Map();
    for (let i = 0; i < g.pellets; i++) {
      const dx = d[0] + (Math.random() - .5) * g.spread * 2, dy = d[1] + (Math.random() - .5) * g.spread * 2, dz = d[2] + (Math.random() - .5) * g.spread * 2, l = Math.hypot(dx, dy, dz);
      for (const m of this.H.monsters) { if (m.ctl || m.hidden && m.type !== 'granny') continue; const mx = m.x - o[0], my = (m.y + m.d.size * .7) - o[1], mz = m.z - o[2], t = (mx * dx + my * dy + mz * dz) / l; if (t < 0 || t > 55) continue; const px = o[0] + dx / l * t - m.x, py = o[1] + dy / l * t - (m.y + m.d.size * .7), pz = o[2] + dz / l * t - m.z; if (Math.hypot(px, pz) < m.d.size * .45 && Math.abs(py) < m.d.size * .75) { if (this.world.cols.ray(o[0], o[2], m.x, m.z, 1.5) && t > 3) continue; dmgTotal.set(m, (dmgTotal.get(m) || 0) + g.dmg * (t > 20 && c.kind === 'shotgun' ? .4 : 1)); } }
    }
    for (const [m, dm] of dmgTotal) { m.hp -= dm; if (m.d.hp < 200 || dm > 60) m.stun = Math.max(m.stun, .25); if (m.type === 'crows' && dm > 20) m.st = 'flee'; this.emit({ k: 'mhit', id: m.id, hp: Math.max(0, m.hp), x: m.x, z: m.z }); if (m.hp <= 0) this.killMonster(m, p); }
  },
  killMonster(m, by) {
    const S = this.S, revenge = S.paid >= S.debt; const bonus = revenge ? Math.round(150 * this.cfg.diff.priceMul + 80 * (MONSTER_KEYS.indexOf(m.type) % 4)) : 0;
    this.emit({ k: 'mdead', id: m.id, type: m.type, x: m.x, z: m.z, bonus }); if (bonus) this.emit({ k: 'cash', cash: S.cash + bonus, paid: S.paid }); this.H.revengeBonus += bonus;
    this.H.monsters = this.H.monsters.filter(q => q !== m); S.mons.delete(m.id); if (m.ctl) { const cp = S.players.get(m.ctl); if (cp) { cp.monster = false; } }
    if (revenge) { this.H.killed = (this.H.killed || 0) + 1; if (this.H.monsters.filter(q => !q.ctl).length === 0 && this.H.night) { this.emit({ k: 'mon', text: 'Монстр переможений! Можна їхати.' }); } }
  },
  tryLeave(p) {
    const S = this.S, need = this.cfg.diff.carFuel; if (S.paid < S.debt) return this.emit({ k: 'mon', text: `Борг не погашено: ${money(S.debt - S.paid)}` }); if (S.carFuel + 1e-6 < need) return this.emit({ k: 'mon', text: `Не вистачає пального: ${S.carFuel.toFixed(1)}/${need} л` });
    this.finish(true, 'Ви виїхали з лісу');
  },
  // ----- цикл хоста -----
  hostTick(dt) {
    const S = this.S, H = this.H, W = this.world, cfg = this.cfg, diff = cfg.diff; if (!this.running || H.ended) return;
    const hours = 17 / (DAY_MIN * 60);
    if (!H.waiting) S.hour += dt * hours * (cfg.mode === 'endless' ? 1 : 1);
    W.hour = S.hour;
    // погода
    H.weatherT -= dt; if (H.weatherT <= 0) { H.weatherT = 70 + Math.random() * 90; const r = Math.random(), w = S.day === 1 && S.hour < 8 ? 'clear' : r < .4 ? 'clear' : r < .6 ? 'cloudy' : r < .75 ? 'fog' : r < .93 ? 'rain' : 'storm'; if (w !== S.weather) this.emit({ k: 'weather', w }); }
    // сутінки й монстри
    const duskH = 17.8 - ['easy', 'normal', 'hard', 'nightmare', 'hardcore'].indexOf(diff.id) * .6;
    if (!H.night && S.hour >= duskH && cfg.mode !== 'monster') { H.night = true; this.spawnNight(); }
    if (cfg.mode === 'monster' && !H.night) { H.night = true; }
    // монстр-гравець
    this.ctxCache = this.ctx(); const ctx = this.ctxCache;
    for (const m of H.monsters) { updateMonster(m, dt, ctx); const mp = S.players.get(m.ctl); if (mp) { mp.x = m.x; mp.z = m.z; mp.y = m.y; } }
    // життя монстрів-ботів: розійтися при ранковому
    for (const n of H.noises) n.t -= dt; H.noises = H.noises.filter(n => n.t > 0); for (const f of H.flares) f.t -= dt; H.flares = H.flares.filter(f => f.t > 0);
    // синхронізуємо вигляд монстрів
    const seen = new Set(); for (const m of H.monsters) { seen.add(m.id); let v = S.mons.get(m.id); if (!v) { v = { id: m.id, type: m.type }; S.mons.set(m.id, v); } v.x = m.x; v.z = m.z; v.y = m.y; v.yaw = m.yaw; v.st = m.st; v.hp = m.hp; v.moveSp = m.moveSp; v.hidden = m.hidden; v.atk = m.atk > 0 ? 1 : 0; }
    for (const id of [...S.mons.keys()]) if (!seen.has(id)) S.mons.delete(id);
    // генератор під дощем
    const rain = S.weather === 'rain' || S.weather === 'storm';
    if (rain && S.gen.on && !S.gen.cover && !S.gen.broken) { H.genT += dt; if (H.genT > 22) { H.genT = 0; if (Math.random() < .42) this.emit({ k: 'gen', on: false, fuel: S.gen.fuel, broken: true, cover: false }); } } else H.genT = 0;
    // кровотеча поранених
    for (const [id, t] of H.bleed) { const p = S.players.get(id); if (!p || p.state !== 'down') { H.bleed.delete(id); continue; } H.bleed.set(id, t + dt); if (t > 50) { H.bleed.delete(id); p.state = 'dead'; this.emit({ k: 'down', pid: id, dead: true }); this.dropAll(p); this.checkAllDead(); } }
    this.updateBots(dt);
    // «в світлі» для Тіні
    for (const p of S.players.values()) { p.inLight = this.roomLit(p.x, p.z) || Math.hypot(p.x - -1, p.z - 9.2) < 4 && this.powerOn(); }
    // кінець дня
    if (S.hour >= HOUR_END && !H.waiting) this.endDay();
    // снапшот
    H.snapT += dt; if (net.online && H.snapT > .08) { H.snapT = 0; net.send(this.buildSnap()); }
  },
  buildSnap() {
    const S = this.S, p = [...S.players.values()].map(q => [q.id, +q.x.toFixed(2), +q.y.toFixed(2), +q.z.toFixed(2), +q.yaw.toFixed(2), +q.pitch.toFixed(2), q.hold, q.fl ? 1 : 0, q.hp, q.state, +(q.speed || 0).toFixed(1), q.monster ? 1 : 0, q.inv]);
    return { t: 'snap', h: +S.hour.toFixed(3), day: S.day, w: S.weather, gen: { fuel: +S.gen.fuel.toFixed(2) }, p, m: this.H.monsters.map(m => { const a = m.snap(); a.push(+m.z.toFixed(2)); return a; }) };
  },
  spawnNight() {
    const S = this.S, H = this.H, diff = this.cfg.diff, R = this.R; this.emit({ k: 'dusk' });
    let n = diff.monstersPerNight + (S.day >= 5 ? 1 : 0) + (this.cfg.mode === 'action' ? 1 : 0); n = Math.min(n, 4); if (this.cfg.mode === 'monster') n = 0;
    const pool = MONSTER_KEYS.slice(); const picks = []; if (S.day === 1 && H.firstMon) { picks.push(H.firstMon); pool.splice(pool.indexOf(H.firstMon), 1); }
    while (picks.length < n && pool.length) picks.push(pool.splice(Math.floor(R() * pool.length), 1)[0]);
    for (const t of picks) { const m = makeMonster(this.ctx(), t); H.monsters.push(m); }
    this.emit({ k: 'mon', text: n > 1 ? `Вночі в лісі ${n} монстри...` : 'Вночі в лісі щось є...' });
  },
  checkReady() { const humans = [...this.S.players.values()].filter(p => !p.bot && p.state !== 'dead' || p.id === this.myId); if (humans.every(p => this.H.readySet.has(p.id) || p.bot)) this.afterSummary(); },
  // ----- кінець дня / новий день -----
  endDay() {
    const S = this.S, H = this.H, diff = this.cfg.diff; H.waiting = true; H.readySet = new Set(); H.night = false;
    for (const f of H.monsters) { } H.monsters = H.monsters.filter(m => m.ctl); // монстри зникають із ранком
    const lines = new Map(); let total = 0;
    for (const u of S.crate) { const it = S.items.get(u); if (!it) continue; const def = ITEMS[it.id]; const v = it.id === 'gascan' ? Math.round((it.lit || 0) * 9 * diff.priceMul) : it.id === 'gen_fuel' ? Math.round((it.lit || 0) * 7 * diff.priceMul) : unitValue(it, diff, S.market); const key = it.id === 'photo' ? 'photo:' + (it.kind || '') : it.id; let L = lines.get(key); if (!L) { L = { name: it.id === 'photo' ? `Фото: ${PHOTO[it.kind]?.name || ''}` : def.name, n: 0, kg: 0, lit: 0, total: 0 }; lines.set(key, L); } L.n++; L.kg += def.kg; L.lit += it.lit || 0; L.total += v; total += v; it.loc = 'x'; }
    S.crate = []; this.emit({ k: 'sound', name: 'cash' });
    let cash = S.cash + total, paid = S.paid; S.stats.earned += total;
    const last = this.cfg.mode !== 'endless' && S.day >= this.cfg.days;
    if ((last || this.cfg.mode === 'monster') && paid < S.debt) { const pay = Math.min(cash, S.debt - paid); cash -= pay; paid += pay; }
    this.emit({ k: 'cash', cash, paid }); const s = { k: 'summary', day: S.day, lines: [...lines.values()], earned: total, cash, left: Math.max(0, S.debt - paid), debt: S.debt, last, auto: last };
    this.emit(s); H.lastSummary = s;
    clearTimeout(H.rt); H.rt = setTimeout(() => this.afterSummary(), 40000);
  },
  afterSummary() {
    const S = this.S, H = this.H; if (!H.waiting || H.ended) return; clearTimeout(H.rt); H.waiting = false; H.readySet = new Set();
    if (H.lastSummary.last) { const ok = S.paid >= S.debt && S.carFuel + 1e-6 >= this.cfg.diff.carFuel; if (S.paid >= S.debt && ok) return this.finish(true, 'Ви виїхали з лісу'); return this.finish(false, S.paid < S.debt ? 'Борг не погашено: колектори знищили машину' : 'У машині немає пального: монстр розбив її', true); }
    if (this.cfg.mode === 'endless') { S.debt = Math.round(S.debt * 1.15); }
    this.newDay();
  },
  newDay() {
    const S = this.S, H = this.H, W = this.world, R = this.R, diff = this.cfg.diff; const day = S.day + 1; H.photos.clear(); H.bleed.clear(); H.noises = []; H.flares = []; H.spawnedToday = false;
    const parcels = S.parcel.splice(0); S.market = marketFor(this.seed, day); const spawnList = [];
    // посилки на ґанку
    parcels.forEach((g, i) => { const id = g === 'gascan5' ? 'gascan5' : g; const def = ITEMS[id]; if (!def) return; spawnList.push({ u: nextUid(), id, x: -1.6 + i * .5, y: .2, z: 8.8, val: 0, lit: id === 'gascan5' ? 5 : id === 'gen_fuel' ? 5 : 0 }); });
    const existing = [...S.items.values()].filter(i => i.loc === 'w'); const loot = rollLoot(R, W, diff, day, this.cfg.rareMul || 1, existing).slice(0, Math.max(14, Math.round(LOOT_PER_DAY * diff.lootMul) - Math.floor(existing.length * .5)));
    const digs = rollDigs(R, W); const pos = {}; let k = 0;
    for (const p of S.players.values()) { if (p.state === 'down') { p.state = 'alive'; p.hp = Math.round(p.maxhp * .4); } if (p.state === 'alive') { p.hp = Math.min(p.maxhp, p.hp + Math.round(p.maxhp * .35)); } pos[p.id] = [-1.5 + (k++) * .7, 7.8]; if (p.ai) { p.ai.st = 'collect'; } }
    const w = S.day >= 1 ? ['clear', 'clear', 'cloudy', 'rain', 'fog'][Math.floor(R() * 5)] : 'clear'; S.digs = S.digs.filter(d => !d.done).concat(digs).slice(-5);
    this.emit({ k: 'newday', day, hour: 6.0, weather: w, spawn: spawnList.concat(loot), digs: S.digs, market: S.market, pos, news: NEWS[Math.floor(R() * NEWS.length)] });
    if (this.cfg.mode === 'monster') { const mp = [...S.players.values()].find(p => p.monster); if (mp && !H.monsters.some(m => m.ctl === mp.id)) { const m = makeMonster(this.ctx(), mp.mtype || 'wolf', mp.id); H.monsters.push(m); } }
    if (net.online) net.send(this.buildSnap());
  },
  applyNewDay(ev) {
    const S = this.S, W = this.world; S.day = ev.day; S.hour = ev.hour; S.weather = ev.weather; S.market = ev.market; S.digs = ev.digs; S.crate = [];
    for (const it of ev.spawn) { it.loc = 'w'; S.items.set(it.u, it); }
    for (const [id, p] of Object.entries(ev.pos)) { const q = S.players.get(id); if (!q) continue; q.x = p[0]; q.z = p[1]; q.y = W.terrainH(p[0], p[1]); if (q.state !== 'dead') { q.state = 'alive'; } if (id === this.myId && q.state !== 'dead') { this.local.spawn(p[0], p[1], 0); this.local.fl = false; this.local.stamina = 100; this.spectating = false; } }
    this.ui.closeSummary(); this.ui.dayCard(ev.day); audio.play('tick'); setTimeout(() => audio.play('bell'), 900); setTimeout(() => { this.ui.dayCard(null); this.ui.fade(false); this.phase = 'play'; this.running = true; this.msg(ev.news, 6); }, 2600);
    W.hour = ev.hour; for (const m of this.monViews.values()) this.scene.remove(m.obj); this.monViews.clear(); S.mons.clear();
    for (const [u, v] of this.itemViews) { }
  },
  showSummary(ev) { this.phase = 'summary'; this.running = false; this.ui.fade(true); this.ui.showSummary(ev, this); audio.play('cash'); },
  showOver(ev) { this.phase = 'summary'; this.running = false; this.ui.closeAll(); this.ui.showOver(ev, this); },
  finish(win, reason, forced = false) {
    const S = this.S, H = this.H; if (H.ended) return; H.ended = true; this.running = false;
    const mp = [...S.players.values()].find(p => p.monster); const ev = { k: 'over', win, reason, debtLeft: Math.max(0, S.debt - S.paid), day: S.day, earned: S.stats.earned, mode: this.cfg.mode, monsterPlayer: mp ? mp.id : null, bonus: H.revengeBonus };
    if (this.cfg.mode === 'monster') { const surv = [...S.players.values()].filter(p => !p.monster); ev.monsterWin = !win; }
    this.emit(ev);
  },
  // ----- боти -----
  updateBots(dt) {
    const S = this.S, W = this.world, H = this.H; const items = () => [...S.items.values()].filter(i => i.loc === 'w' && ITEMS[i.id].kind !== 'fuel' && i.val > 0);
    for (const p of S.players.values()) {
      if (!p.bot || p.state !== 'alive' || !p.ai) continue; const a = p.ai; let tx = null, tz = null, sp = 3.3;
      const mon = H.monsters.find(m => !m.hidden && Math.hypot(m.x - p.x, m.z - p.z) < 16);
      if (mon || S.hour > 18.6) { a.st = 'home'; } else if (a.st === 'home') a.st = 'collect';
      if (a.st === 'home') { tx = 0; tz = 14.5; sp = mon ? 5.2 : 3.4; if (this.inHouseXZ(p.x, p.z) && Math.hypot(p.x, p.z - 14.5) < 2) { tx = null; } }
      else if (a.st === 'collect') {
        if (p.inv.length >= 3) a.st = 'deliver'; else { if (!a.tgt || !S.items.get(a.tgt) || S.items.get(a.tgt).loc !== 'w') { let b = null, bd = 1e9; for (const it of items()) { const d = Math.hypot(it.x - p.x, it.z - p.z); if (d < bd && !this.claimed(it.u, p.id)) { bd = d; b = it; } } a.tgt = b ? b.u : null; if (!b && p.inv.length) a.st = 'deliver'; } const it = a.tgt && S.items.get(a.tgt); if (it) { tx = it.x; tz = it.z; if (Math.hypot(it.x - p.x, it.z - p.z) < 1.4) { this.emit({ k: 'take', u: it.u, pid: p.id }); a.tgt = null; } } }
      }
      else if (a.st === 'deliver') { tx = 1.9; tz = 8.2; if (Math.hypot(1.9 - p.x, 8.4 - p.z) < 2.2) { for (const u of [...p.inv]) this.emit({ k: 'crate', u, pid: p.id }); a.st = 'collect'; } }
      if (tx == null) { p.speed = 0; continue; }
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz); if (d > .2) { let nx = p.x + dx / d * sp * dt, nz = p.z + dz / d * sp * dt; [nx, nz] = W.cols.resolve(nx, nz, .35); const moved = Math.hypot(nx - p.x, nz - p.z); if (moved < sp * dt * .3) { a.stuck += dt; if (a.stuck > 1.2) { a.stuck = 0; a.tgt = null; nx += (Math.random() - .5) * 3; nz += (Math.random() - .5) * 3; } } else a.stuck = 0; p.x = nx; p.z = nz; p.y = W.terrainH(nx, nz); p.yaw = Math.atan2(-dx, -dz); p.speed = moved / dt; p.hold = p.inv.length ? S.items.get(p.inv[0])?.id || '' : ''; }
      for (const door of W.doors) if (Math.hypot(door.pos.x - p.x, door.pos.z - p.z) < 1.8 && !S.doors[door.id] && this.inHouseXZ(p.x, p.z) !== undefined) { if (a.st === 'home') this.emit({ k: 'door', id: door.id, open: true }); }
    }
  },
  claimed(u, me) { for (const p of this.S.players.values()) if (p.bot && p.id !== me && p.ai && p.ai.tgt === u) return true; return false; },
  // ----- клієнтські режими: спостереження та керування монстром -----
  spectate(dt) {
    const S = this.S, st = this.stage, alive = [...S.players.values()].filter(p => p.state === 'alive' && p.id !== this.myId); this.spectating = true; if (!alive.length) return;
    this.specI = (this.specI || 0); if (take('next')) this.specI++; if (take('prev')) this.specI--; const t = alive[((this.specI % alive.length) + alive.length) % alive.length]; this.specT = t;
    const L = this.local; L.yaw -= inp.lookX * .0024; L.pitch = clamp(L.pitch - inp.lookY * .0024, -1, 1); inp.lookX = inp.lookY = 0; const cy = L.yaw, d = 4.2; st.cam.position.set(t.x + Math.sin(cy) * d, t.y + 2.2 + L.pitch * 2, t.z + Math.cos(cy) * d); st.cam.lookAt(t.x, t.y + 1.4, t.z); this.ui.prompt(`Спостерігаєте за ${t.name} (◀ ▶ перемкнути)`);
  },
  monsterControl(dt) {
    const S = this.S, me = this.me, st = this.stage, L = this.local; const mon = this.H ? this.H.monsters.find(m => m.ctl === this.myId) : [...S.mons.values()].find(m => m.ctl === this.myId); const mv = this.monViews;
    L.yaw -= inp.lookX * .0024 * 1; L.pitch = clamp(L.pitch - inp.lookY * .0024, -.5, 1.0); inp.lookX = inp.lookY = 0;
    pollKeys();
    this.monInp = { mx: inp.mx, mz: inp.mz, yaw: L.yaw, sprint: inp.sprint, act: !!take('fire') || !!take('interact') };
    if (this.isHost) { me.inp = this.monInp; }
    const pos = mon || me; const g = this.world.terrainH(pos.x, pos.z); const d = 4.5 * (mon?.d?.size || 1.2), sz = (mon?.d?.size || 1.4);
    st.cam.position.set(pos.x + Math.sin(L.yaw) * d, g + sz * 1.3 + L.pitch * 3, pos.z + Math.cos(L.yaw) * d); st.cam.lookAt(pos.x, g + sz * .9, pos.z); this.ui.prompt('Ви — монстр: ЛКМ/ДІЯ — атакувати, шукайте гравців');
  },
});
