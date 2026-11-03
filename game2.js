// Дії гравця, команди, події, мережева синхронізація
import * as THREE from 'three';
import { Game, roomAt } from './game.js';
import { ITEMS, SHOP, PHOTO, MONSTERS, DIFFS, GAME_CUR } from './data.js';
import { net } from './net.js';
import { audio } from './audio.js';
import { inp, take, press } from './input.js';
import { buildItem } from './m_nature.js';
import { buildTool } from './player.js';
import { shopPrice, nextUid, unitValue } from './economy.js';
import { clamp, money, TAU, rr } from './util.js';
import { V3 } from './geo.js';
import { FC, FR } from './world.js';
import { S as SET } from './settings.js';

const GUNS = { revolver: { dmg: 38, pellets: 1, cd: .55, spread: .012, name: 'Револьвер' }, deagle: { dmg: 80, pellets: 1, cd: .8, spread: .01, name: 'Desert Eagle' }, shotgun: { dmg: 24, pellets: 6, cd: 1.1, spread: .06, name: 'Дробовик' } };
export { GUNS };
const FOOD = new Set(['porcini', 'chanter', 'amanita', 'blueberry', 'raspberry', 'honey']);

Object.assign(Game.prototype, {
  // ----- команди й події -----
  cmd(c) { if (this.isHost) this.exec(this.myId, c); else net.send({ t: 'cmd', c }); },
  emit(ev) { this.applyEvent(ev); if (net.online) net.send({ t: 'ev', ev }); },
  maxSlots() { return 4 + (this.S.owned.has('bag') ? 2 : 0); },
  toolList() { const o = this.S.owned, l = []; if (o.has('camera')) l.push('camera'); if (o.has('shovel')) l.push('shovel'); for (const g of ['revolver', 'shotgun', 'deagle']) if (o.has(g)) l.push(g); return l; },
  hotbar() {
    const me = this.me, tools = this.toolList(), n = this.maxSlots(), bar = [];
    for (const t of tools) bar.push({ type: 'tool', id: t, name: { camera: 'Фотоапарат', shovel: 'Лопата', revolver: 'Револьвер', deagle: 'Desert Eagle', shotgun: 'Дробовик' }[t] });
    for (let i = 0; i < n; i++) { const u = me.inv[i], it = u && this.S.items.get(u); bar.push(it ? { type: 'item', u, id: it.id, name: ITEMS[it.id].name, it } : { type: 'empty' }); }
    return bar;
  },
  selected() { const bar = this.hotbar(); this.local.sel = clamp(this.local.sel, 0, bar.length - 1); return bar[this.local.sel]; },
  refreshHeld() {
    const s = this.selected(), L = this.local, me = this.me; let key = '', obj = null;
    if (me.state !== 'alive') { L.setHeld(null, ''); me.hold = ''; return; }
    if (s.type === 'tool') { key = 't:' + s.id; obj = buildTool(s.id); obj.position.set(0, 0, 0); if (s.id === 'shovel') obj.position.set(.1, .1, 0); else if (s.id === 'camera') obj.position.set(0, .02, 0); else obj.rotation.set(0, 0, 0); }
    else if (s.type === 'item') { key = s.id; obj = buildItem(s.id); obj.scale.setScalar(1.1); obj.position.set(0, -.12, -.05); obj.rotation.set(.2, .5, 0); }
    L.setHeld(obj, key); me.hold = key;
  },
  handleActions(dt) {
    const L = this.local, me = this.me, S = this.S; if (this.ui.modalOpen()) { for (const a in inp.pressed) if (a !== 'menu' && a !== 'map') inp.pressed[a] = false; if (take('menu')) this.ui.closeTopModal(); if (take('map')) this.ui.closeTopModal(); return; }
    if (take('menu')) { this.ui.pauseMenu(this); return; }
    const bar = this.hotbar(); if (take('next')) L.sel = (L.sel + 1) % bar.length; if (take('prev')) L.sel = (L.sel + bar.length - 1) % bar.length;
    for (let i = 0; i < 9; i++) if (take('slot' + i)) L.sel = Math.min(i, bar.length - 1);
    this.refreshHeld();
    if (me.state === 'down') { this.prompt = null; this.ui.prompt('Ви поранені: чекайте на аптечку або повернення напарником'); take('interact'); return; }
    if (take('flash')) { if (L.flCharge > 0) { L.fl = !L.fl; audio.play('click', { vol: .6 }); } else this.msg('Ліхтар розряджений' + (S.owned.has('lamp') ? '' : ': зарядіть у будинку при ввімкненому генераторі')); }
    if (take('map')) this.ui.openMap(this);
    L.fireCd -= dt; const sel = this.selected();
    if (take('drop') && sel.type === 'item') this.cmd({ k: 'drop', u: sel.u, x: L.x - Math.sin(L.yaw) * 1.1, z: L.z - Math.cos(L.yaw) * 1.1 });
    const it = this.findInteract(); this.ui.prompt(it ? it.label : (this.hintPrompt || ''));
    if (take('interact') && it) it.run();
    if ((take('fire') || (inp.fire && sel.type === 'tool' && GUNS[sel.id] === undefined && false)) && L.fireCd <= 0) this.useSelected(sel);
  },
  useSelected(sel) {
    const L = this.local, me = this.me, S = this.S;
    if (sel.type === 'tool') {
      if (sel.id === 'camera') { L.fireCd = .8; this.takePhoto(); }
      else if (sel.id === 'shovel') { L.fireCd = .6; const d = this.nearDig(); if (d) this.cmd({ k: 'dig', i: d.i }); else { audio.play('swoosh', { vol: .5 }); this.msg('Тут нічого не знайдено. Шукайте хрестики на карті (M)', 3); } }
      else if (GUNS[sel.id]) {
        const g = GUNS[sel.id]; if (me.ammo <= 0) { audio.play('click'); this.msg('Немає набоїв: купіть у ноутбуці', 2); L.fireCd = .4; return; }
        L.fireCd = g.cd; me.ammo--; L.recoil = 1; L.shake = .5; const f = new THREE.Vector3(); this.stage.cam.getWorldDirection(f); const o = this.stage.cam.position;
        this.cmd({ k: 'shoot', kind: sel.id, o: [o.x, o.y, o.z], d: [f.x, f.y, f.z] }); this.sound('gunshot', null, { kind: sel.id, vol: 1 });
      }
    } else if (sel.type === 'item') {
      if (sel.id === 'medkit') { const tgt = this.nearDowned(); this.cmd({ k: 'use', what: 'medkit', u: sel.u, target: tgt ? tgt.id : this.myId }); L.fireCd = 1; }
      else if (sel.id === 'flare') { L.fireCd = 1; const f = new THREE.Vector3(); this.stage.cam.getWorldDirection(f); this.cmd({ k: 'use', what: 'flare', u: sel.u, x: L.x + f.x * 8, z: L.z + f.z * 8 }); }
      else if (FOOD.has(sel.id)) { this.msg('Це краще продати: гроші важливіші', 2); }
    }
  },
  nearDig() { const L = this.local; let best = null; this.S.digs.forEach((d, i) => { if (d.done) return; const dd = Math.hypot(d.x - L.x, d.z - L.z); if (dd < 2.2 && (!best || dd < best.dd)) best = { i, dd }; }); return best; },
  nearDowned() { const L = this.local; let b = null, bd = 3; for (const p of this.S.players.values()) { if (p.state === 'down' && p.id !== this.myId) { const d = Math.hypot(p.x - L.x, p.z - L.z); if (d < bd) { bd = d; b = p; } } } return b; },
  takePhoto() {
    const L = this.local, cam = this.stage.cam, f = new THREE.Vector3(); cam.getWorldDirection(f); audio.play('shutter'); this.ui.flash();
    let best = null, bd = 1e9; for (const a of this.world.animals) { const dx = a.x - L.x, dz = a.z - L.z, d = Math.hypot(dx, dz); if (d > 30 || d < 1) continue; const dot = (dx * f.x + dz * f.z) / (d * Math.hypot(f.x, f.z)); if (dot > .93 && d < bd && !this.world.cols.ray(L.x, L.z, a.x, a.z, 1.5)) { bd = d; best = a; } }
    if (best) this.cmd({ k: 'photo', kind: best.kind }); else this.msg('В кадрі нікого немає', 1.5);
  },
  // ----- пошук взаємодії -----
  findInteract() {
    const S = this.S, L = this.local, me = this.me, W = this.world, cam = this.stage.cam, f = new THREE.Vector3(); cam.getWorldDirection(f); const eye = cam.position; const sel = this.selected();
    let best = null, bs = 1e9;
    const cand = (pos, range, label, run, minDot = .72) => { const v = new THREE.Vector3().subVectors(pos, eye), d = v.length(); if (d > range) return; const dot = d < 1 ? 1 : v.dot(f) / d; if (dot < minDot) return; const sc = d * (2 - dot); if (sc < bs) { bs = sc; best = { label, run, d }; } };
    for (const [u, v] of this.itemViews) { const it = S.items.get(u); if (!it || it.loc !== 'w') continue; const p = v.position; const def = ITEMS[it.id]; cand(new THREE.Vector3(p.x, p.y + .15, p.z), 2.6, `[E] Підняти: ${def.name}${it.lit ? ' (' + it.lit + ' л)' : ''}`, () => { if (me.inv.length >= this.maxSlots()) return this.msg('Інвентар повний', 2); this.cmd({ k: 'pick', u }); }, .6); }
    for (const d of W.doors) cand(d.pos, 2.4, S.doors[d.id] ? '[E] Зачинити двері' : '[E] Відчинити двері', () => this.cmd({ k: 'door', id: d.id }));
    for (const s of W.house.ud.switches) cand(s.pos, 2.0, S.lights[s.room] === false ? '[E] Увімкнути світло' : '[E] Вимкнути світло', () => this.cmd({ k: 'light', room: s.room }));
    const crate = V3(1.9, .5, 9.0); const n = S.crate.length; cand(crate, 3, sel.type === 'item' ? `[E] Покласти в ящик: ${sel.name}` : `Ящик для продажу (речей: ${n}). Продаж вранці`, () => { if (sel.type === 'item') this.cmd({ k: 'crate', u: sel.u }); else this.msg('Візьміть річ у руки та покладіть сюди', 2); });
    const g = S.gen; cand(V3(3.2, .6, 27.2), 3, g.broken ? (this.hasItem('repair') ? '[E] Полагодити генератор' : 'Генератор зламаний: потрібен ремкомплект') : (sel.type === 'item' && sel.id === 'gen_fuel' ? `[E] Залити паливо (+${sel.it.lit} л). У баку ${g.fuel.toFixed(1)} л` : `[E] ${g.on ? 'Вимкнути' : 'Увімкнути'} генератор (${g.fuel.toFixed(1)} л)`), () => {
      if (sel.type === 'item' && sel.id === 'gen_fuel') return this.cmd({ k: 'gen', op: 'fuel', u: sel.u });
      if (g.broken) { const r = me.inv.map(u => S.items.get(u)).find(i => i && i.id === 'repair'); return r ? this.cmd({ k: 'gen', op: 'repair', u: r.u }) : this.msg('Потрібен ремкомплект (ноутбук)', 2); }
      this.cmd({ k: 'gen', op: 'toggle' });
    });
    cand(W.house.ud.laptop.pos.clone().add(V3(.4, 0, 0)), 2.6, '[E] Використати комп’ютер', () => { if (this.laptopPower()) this.ui.openLaptop(this); else this.msg('Немає живлення. Увімкніть генератор у будинку ззаду', 3); }, .5);
    if (this.truck) {
      const fp = this.truck.localToWorld(V3(-1.0, 1.0, 1.9)); cand(fp, 2.6, sel.type === 'item' && ITEMS[sel.id]?.fuel ? `[E] Залити бензин у машину (+${sel.it.lit || 5} л). Бак: ${S.carFuel.toFixed(1)}/${this.diff.carFuel} л` : `Бак машини: ${S.carFuel.toFixed(1)}/${this.diff.carFuel} л (потрібно для виїзду)`, () => { if (sel.type === 'item' && ITEMS[sel.id].fuel) this.cmd({ k: 'carfuel', u: sel.u }); else this.msg('Візьміть каністру бензину в руки', 2); }, .5);
      const dp = this.truck.localToWorld(V3(-1.2, 1.2, -.3)); cand(dp, 2.8, S.paid >= S.debt ? '[E] Поїхати з лісу' : `Виїзд: борг не погашено (${money(S.debt - S.paid)})`, () => this.cmd({ k: 'leave' }), .5);
    }
    for (const t of W.towers) { const base = V3(t.x + (t.ud.ladderBase.x), W.terrainH(t.x, t.z) + 1.2, t.z + t.ud.ladderBase.z); if (!L.tower) cand(base, 2.6, '[E] Залізти на вишку', () => { L.tower = { x: t.x, z: t.z, H: W.terrainH(t.x, t.z) + t.ud.H }; L.x = t.x; L.z = t.z; audio.play('wood', { vol: .6 }); }, .4); else cand(V3(t.x, L.y + 1, t.z), 4, '[E] Злізти вниз', () => { L.x = t.x + t.ud.ladderBase.x + .3; L.z = t.z + t.ud.ladderBase.z + .4; L.tower = null; L.y = W.terrainH(L.x, L.z); }, 0); }
    for (const p of S.players.values()) if (p.state === 'down' && p.id !== this.myId) cand(V3(p.x, p.y + .5, p.z), 3, sel.type === 'item' && sel.id === 'medkit' ? `[E] Підняти ${p.name} аптечкою` : `${p.name} поранений: потрібна аптечка`, () => { if (sel.type === 'item' && sel.id === 'medkit') this.cmd({ k: 'use', what: 'medkit', u: sel.u, target: p.id }); else this.msg('Тримайте аптечку в руках', 2); }, .5);
    for (const [i, d] of S.digs.entries()) if (!d.done && S.owned.has('shovel') && sel.type === 'tool' && sel.id === 'shovel') cand(V3(d.x, d.y + .2, d.z), 2.4, '[E] Копати', () => this.cmd({ k: 'dig', i }), .3);
    this.hintPrompt = ''; return best;
  },
  hasItem(id) { return this.me.inv.some(u => this.S.items.get(u)?.id === id); },
  useAA() { const me = this.me, u = me.inv.find(u => S_.get(this.S.items, u)?.id === 'batteryAA'); if (!u) return false; this.cmd({ k: 'use', what: 'aa', u }); return true; },
  houseCharging(L) { return this.powerOn() && this.inHouseXZ(L.x, L.z) && !L.fl; },
  // ----- мережа: стан гравця -----
  sendState() {
    if (!net.online || this.role !== 'client') return; const me = this.me, L = this.local; if (!me) return;
    net.send({ t: 'in', x: +L.x.toFixed(2), y: +L.y.toFixed(2), z: +L.z.toFixed(2), yaw: +L.yaw.toFixed(3), pitch: +L.pitch.toFixed(2), hold: me.hold, fl: me.fl, noise: me.noise, sp: +(L.moveSp || 0).toFixed(1), inp: me.monster ? this.monInp : null });
  },
  clientTick(dt) { },
  onNet(from, d) {
    if (d.t === 'cmd' && this.isHost) return this.exec(from, d.c);
    if (d.t === 'in' && this.isHost) { const p = this.S.players.get(from); if (p && p.state !== 'dead' || p?.monster) { p.x = d.x; p.y = d.y; p.z = d.z; p.yaw = d.yaw; p.pitch = d.pitch; p.hold = d.hold; p.fl = d.fl; p.noise = d.noise; p.speed = d.sp; p.inHouse = this.inHouseXZ(d.x, d.z); if (d.inp) p.inp = d.inp; } return; }
    if (d.t === 'loaded' && this.isHost) { this.loadedSet.add(from); return this.checkAllLoaded(); }
    if (d.t === 'ev') return this.applyEvent(d.ev);
    if (d.t === 'snap') return this.applySnap(d);
    if (d.t === 'lobby') { this.lobby.roster = d.roster; this.lobby.cfg = d.cfg; this.ui.refreshLobby && this.ui.refreshLobby(); return; }
    if (d.t === 'start') return this.beginRun(d.payload);
    if (d.t === 'go') return this.intro(d.firstMon);
    if (d.t === 'kicked') { this.ui.toast('Вас вилучили з лобі'); this.leaveToMenu(); }
    if (d.t === 'chat') this.ui.toast(d.n + ': ' + d.m);
  },
  applySnap(d) {
    const S = this.S; S.hour = d.h; S.day = d.day; S.weather = d.w; if (d.gen) Object.assign(S.gen, d.gen);
    for (const a of d.p) { const [id, x, y, z, yaw, pitch, hold, fl, hp, st, sp, mon, inv] = a; const p = S.players.get(id); if (!p) continue; if (id !== this.myId || p.monster) { p.x = x; p.y = y; p.z = z; p.yaw = yaw; p.pitch = pitch; p.hold = hold; p.fl = fl; p.speed = sp; } p.hp = hp; p.state = st; p.monster = !!mon; if (inv) p.inv = inv; }
    const seen = new Set(); for (const a of d.m) { const [id, type, x, y, yaw, st, hp, msp, hid, atk] = a; seen.add(id); let m = S.mons.get(id); if (!m) { m = { id, type, x, z: 0 }; S.mons.set(id, m); } m.x = x; m.z = a[10]; m.y = y; m.yaw = yaw; m.st = st; m.hp = hp; m.moveSp = msp; m.hidden = !!hid; m.atk = atk; }
    for (const id of [...S.mons.keys()]) if (!seen.has(id)) S.mons.delete(id);
  },
  // ----- застосування подій (на всіх клієнтах) -----
  applyEvent(ev) {
    const S = this.S, me = this.me, W = this.world;
    switch (ev.k) {
      case 'spawn': for (const it of ev.list) { it.loc = 'w'; S.items.set(it.u, it); } break;
      case 'take': { const it = S.items.get(ev.u); if (!it) break; it.loc = 'h'; it.by = ev.pid; const p = S.players.get(ev.pid); if (p && !p.inv.includes(ev.u)) p.inv.push(ev.u); if (ev.pid === this.myId) { audio.play('pickup'); this.msg(`+ ${ITEMS[it.id].name}`, 1.5); } else if (it) this.sound('pickup', { x: it.x, z: it.z, y: it.y }); if (p) p.carriesFood = p.inv.some(u => FOOD.has(S.items.get(u)?.id)); break; }
      case 'drop': { const it = S.items.get(ev.u); if (!it) break; const p = S.players.get(it.by); if (p) { p.inv = p.inv.filter(u => u !== ev.u); p.carriesFood = p.inv.some(u => FOOD.has(S.items.get(u)?.id)); } it.loc = 'w'; it.x = ev.x; it.y = ev.y; it.z = ev.z; it.rot = undefined; this.sound('drop', { x: ev.x, z: ev.z, y: ev.y }); break; }
      case 'crate': { const it = S.items.get(ev.u); if (!it) break; const p = S.players.get(it.by); if (p) { p.inv = p.inv.filter(u => u !== ev.u); p.carriesFood = p.inv.some(u => FOOD.has(S.items.get(u)?.id)); } it.loc = 'c'; S.crate.push(ev.u); this.sound('wood', { x: 1.9, z: 9, y: 0 }); if (ev.pid === this.myId) this.msg('Лежить у ящику, продасться вранці', 1.5); break; }
      case 'gone': { const it = S.items.get(ev.u); if (it) { const p = S.players.get(it.by); if (p) p.inv = p.inv.filter(u => u !== ev.u); it.loc = 'x'; } break; }
      case 'door': S.doors[ev.id] = ev.open; break;
      case 'light': S.lights[ev.room] = ev.on; audio.play('click', { pos: V3(0, 1.3, 14), vol: .7 }); break;
      case 'gen': { const was = S.gen.on; Object.assign(S.gen, { on: ev.on, fuel: ev.fuel, broken: ev.broken, cover: ev.cover }); if (ev.on && !was) { audio.play('engine_start', { pos: V3(3.2, .6, 27.2), vol: .7 }); } if (ev.note && ev.who === this.myId) this.msg(ev.note, 3); if (ev.broken && !ev.silent) { this.sound('hit', { x: 3.2, z: 27.2, y: 1 }); this.msg('Генератор зламався під дощем!', 4); } break; }
      case 'carfuel': S.carFuel = ev.total; audio.play('pour', { pos: V3(0, 1, 4), vol: .8 }); this.msg(`Бак: ${ev.total.toFixed(1)}/${this.diff.carFuel} л`, 2.5); break;
      case 'cash': S.cash = ev.cash; S.paid = ev.paid; if (ev.note) this.msg(ev.note, 3); audio.play('cash', { vol: .7 }); break;
      case 'buy': { S.cash = ev.cash; if (ev.owned) { S.owned.add(ev.owned); if (ev.owned === 'cover') S.gen.cover = true; } if (ev.parcel) S.parcel.push(ev.parcel); if (ev.ammo) for (const p of S.players.values()) p.ammo += ev.ammo; this.ui.refreshLaptop && this.ui.refreshLaptop(); audio.play('click'); if (ev.msg) this.msg(ev.msg, 3); break; }
      case 'hurt': { const p = S.players.get(ev.pid); if (!p) break; p.hp = ev.hp; if (ev.pid === this.myId) { this.dmgFlash = 1; this.local.shake = 1; if (ev.slow) this.local.slowT = ev.slow; if (ev.grab) this.local.grab = ev.grab; audio.play('hurt'); audio.play('hit'); if (SET.vibrate && navigator.vibrate) navigator.vibrate(120); } else this.sound('hit', p); break; }
      case 'down': { const p = S.players.get(ev.pid); if (!p) break; p.state = ev.dead ? 'dead' : 'down'; p.hp = 0; if (ev.pid === this.myId) { this.msg(ev.dead ? 'Вас вбито. Спостерігайте за напарниками' : 'Вас поранено! Просіть аптечку', 5); this.local.fl = false; } else this.msg(`${p.name} ${ev.dead ? 'загинув' : 'поранений'}`, 3); break; }
      case 'revive': { const p = S.players.get(ev.pid); if (!p) break; p.state = 'alive'; p.hp = ev.hp; if (ev.x != null) { p.x = ev.x; p.z = ev.z; if (ev.pid === this.myId) { this.local.spawn(ev.x, ev.z, this.local.yaw); this.spectating = false; } } if (ev.pid === this.myId) this.msg('Ви повернулись у гру', 3); else this.msg(`${p.name} повернувся`, 3); break; }
      case 'heal': { const p = S.players.get(ev.pid); if (p) p.hp = ev.hp; if (ev.pid === this.myId) this.msg('Аптечка: здоров’я відновлено', 2); break; }
      case 'sound': this.sound(ev.name, ev.x != null ? { x: ev.x, y: ev.y || 0, z: ev.z } : null, ev.o || {}); break;
      case 'flare': this.flareFx(ev.x, ev.z); break;
      case 'shot': { if (ev.pid !== this.myId) this.sound('gunshot', { x: ev.x, y: 1, z: ev.z }, { kind: ev.kind, vol: 1 }); break; }
      case 'mhit': { const m = S.mons.get(ev.id); if (m) m.hp = ev.hp; this.sound('hit', { x: ev.x, z: ev.z, y: 1 }); break; }
      case 'mdead': { this.msg(`${MONSTERS[ev.type].name} убитий!${ev.bonus ? ' +' + money(ev.bonus) : ''}`, 4); this.sound('growl', { x: ev.x, z: ev.z, y: 0 }, { mon: ev.type, dur: 1.6 }); break; }
      case 'dig': { S.digs[ev.i].done = true; this.sound('dig', { x: S.digs[ev.i].x, z: S.digs[ev.i].z, y: 0 }); for (const it of ev.list) { it.loc = 'w'; S.items.set(it.u, it); } if (ev.pid === this.myId) this.msg('Щось знайшли!', 3); break; }
      case 'photo': { if (ev.pid === this.myId) this.msg(`Фото: ${PHOTO[ev.kind].name} (+${money(ev.val)})`, 2.5); break; }
      case 'stolen': { const it = S.items.get(ev.u); if (it) { const p = S.players.get(it.by); if (p) p.inv = p.inv.filter(u => u !== ev.u); it.loc = 'w'; it.x = ev.x; it.z = ev.z; it.y = ev.y; it.rot = undefined; } if (ev.pid === this.myId) this.msg('Ворон вкрав вашу річ!', 3); this.sound('caw', { x: ev.x, z: ev.z, y: 3 }); break; }
      case 'weather': S.weather = ev.w; this.msg({ clear: 'Ясно', cloudy: 'Хмарно', fog: 'Туман', rain: 'Починається дощ', storm: 'Гроза' }[ev.w], 3); break;
      case 'dusk': this.msg('Сутеніє... Щось вийшло з лісу', 5); audio.play('hoot', { vol: .3 }); break;
      case 'flicker': this.flicker = 2.5; break;
      case 'summary': return this.showSummary(ev);
      case 'newday': return this.applyNewDay(ev);
      case 'over': return this.showOver(ev);
      case 'mon': { this.msg(ev.text, 4); break; }
    }
  },
  flareFx(x, z) { const l = new THREE.PointLight(0xff4a2a, 40, 40, 1.5); l.position.set(x, 1.5, z); this.scene.add(l); audio.play('flare', { pos: V3(x, 1, z) }); const s = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff8a5a })); s.position.set(x, .2, z); this.scene.add(s); let t = 0; const iv = setInterval(() => { t += .1; l.intensity = 40 * (.7 + Math.random() * .3) * Math.max(0, 1 - t / 25); if (t > 25) { clearInterval(iv); this.scene.remove(l); this.scene.remove(s); } }, 100); },
});
const S_ = { get: (m, k) => m.get(k) };
