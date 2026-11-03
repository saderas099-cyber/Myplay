import * as THREE from 'three';
import { S as SET, P as PROF, gfx, saveP, addTokens } from './settings.js';
import { DIFFS, ITEMS, MONSTERS, SHOP, PHOTO, MODES, REWARD, MONSTER_KEYS } from './data.js';
import { rng, clamp, lerp, TAU, fmtTime, uid, money, angDiff, wait, $ } from './util.js';
import { audio } from './audio.js';
import { net } from './net.js';
import { World, FC, FR } from './world.js';
import { MenuScene } from './stage.js';
import { buildAvatar } from './m_char.js';
import { buildPickup } from './m_truck.js';
import { buildItem } from './m_nature.js';
import { buildMonster, silhouette } from './m_monsters.js';
import { LocalCtl, RemoteView, buildTool } from './player.js';
import { inp, take, resetInput, buildTouch } from './input.js';
import { marketFor, unitValue, shopPrice } from './economy.js';
import { applyWind } from './wind.js';
import { V3 } from './geo.js';

export const lookOf = p => ({ gender: p.gender, skin: p.skin, hair: p.hair, hairColor: p.hairColor, face: p.face, chest: p.chest, hips: p.hips, height: p.height, outfit: { ...p.outfit } });
export const sigOf = (look, bag) => JSON.stringify(look) + (bag ? 'B' : '');
export function roomAt(x, z) {
  if (x < -7 || x > 7 || z < 10 || z > 25) return null;
  if (z < 17.5) return x < -1.5 ? 'bed' : x < 1.5 ? 'hall' : 'kitchen';
  if (x > 4 && z > 20.5) return 'wc'; if (x > 1.5 && x < 4 && z > 22) return 'pantry'; return 'main';
}
const SEAT_ORDER = [0, 1, 2, 3, 4, 5, 6, 7];

export class Game {
  constructor(stage, ui) {
    this.stage = stage; this.ui = ui; this.role = 'solo'; this.myId = 'p0'; this.phase = 'menu'; this.scene = null; this.world = null; this.hudT = 0; this.sendT = 0; this.snapT = 0; this.running = false; this.S = this.freshState(); this.itemViews = new Map(); this.monViews = new Map(); this.lastHurt = 0; this.dmgFlash = 0; this.msgs = []; this.t = 0;
    this.lobby = { roster: [], cfg: null }; this.lobbyAv = new Map(); this.menu = null;
  }
  freshState() { return { day: 1, hour: 6, weather: 'clear', debt: 0, paid: 0, cash: 0, items: new Map(), players: new Map(), mons: new Map(), gen: { on: false, fuel: 0, broken: false, cover: false }, carFuel: 0, doors: {}, lights: {}, owned: new Set(), digs: [], crate: [], market: {}, parcel: [], phase: 'idle', stats: { earned: 0, found: 0 }, over: null, ammo: 0 }; }
  get me() { return this.S.players.get(this.myId); }
  get isHost() { return this.role !== 'client'; }
  get diff() { return this.cfg.diff; }
  // ---------- меню / лобі ----------
  enterMenu() {
    this.phase = 'menu'; if (!this.menu) this.menu = new MenuScene(PROF); else this.menu.setTruck(PROF); this.menu.camMode = 'menu'; this.stage.setScene(this.menu.scene); this.clearLobbyAv(); this.ui.hud(false); inp.enabled = false; document.exitPointerLock?.();
    this.menu.truck.userData.setTailgate(true); this.menu.truck.userData.doors.forEach(d => d.userData.open = false);
    this.stage.r.toneMappingExposure = 1;
  }
  clearLobbyAv() { for (const a of this.lobbyAv.values()) a.parent && a.parent.remove(a); this.lobbyAv.clear(); }
  syncLobbyAvatars() {
    if (!this.menu) return; const t = this.menu.truck, ro = this.lobby.roster; const ids = new Set(ro.map(p => p.id));
    for (const [id, a] of this.lobbyAv) if (!ids.has(id) || a.userData.sig !== ro.find(p => p.id === id)?.sig) { t.remove(a); this.lobbyAv.delete(id); }
    ro.forEach(p => { if (this.lobbyAv.has(p.id)) return; const av = buildAvatar(p.look, {}); const seat = t.userData.seats[p.seat ?? 0]; av.position.copy(seat.p); av.position.y -= .02; av.scale.setScalar(.95); av.userData.sig = p.sig; av.userData.seatKind = seat.kind; av.userData.drive = (p.seat ?? 0) === 0; t.add(av); this.lobbyAv.set(p.id, av); av.userData.animate(0, 0, { seated: seat.kind, drive: av.userData.drive }); av.userData.tag = p.name; av.rotation.y = 0; });
  }
  makeRosterEntry(id, name, profile, bot = false) { const look = lookOf(profile); const bag = false; return { id, name, look, sig: sigOf(look), bot, seat: 0, vehicle: profile.vehicle, paint: profile.paint, decal: profile.decal }; }
  assignSeats() { const n = this.lobby.roster.length; let seats = SEAT_ORDER.slice(); if (this.lobby.cfg?.randomSeats) { for (let i = seats.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [seats[i], seats[j]] = [seats[j], seats[i]]; } const hostI = 0; const di = seats.indexOf(0); /* хост за кермом */ [seats[hostI], seats[di]] = [seats[di], seats[hostI]]; } this.lobby.roster.forEach((p, i) => p.seat = seats[i] ?? i); }
  // ---------- старт забігу ----------
  async beginRun(payload) {
    // payload: {cfg, roster, seed, firstMon}
    const cfg = this.cfg = payload.cfg; this.roster = payload.roster; this.seed = payload.seed; this.S = this.freshState(); const S = this.S;
    S.debt = cfg.debt; S.hour = 6.5; S.day = 1; S.gen.fuel = 3; S.items.clear(); this.phase = 'launch'; this.running = false; resetInput();
    for (const r of payload.roster) S.players.set(r.id, this.newPlayer(r));
    // кінематограф вильоту
    this.ui.closeAll(); this.ui.hud(false); this.menu.camMode = 'fly'; this.menu.speed = 16; audio.play('engine_start'); audio.startAmbience(); await wait(2300);
    this.ui.fade(true); await wait(700); this.ui.showLoading(true, 0); audio.stopMusic();
    await this.buildWorld(p => this.ui.loadProgress(p));
    this.ui.loadProgress(1); await wait(500); this.ui.showLoading(false);
    if (this.isHost) this.hostInit(payload.firstMon); else net.send({ t: 'loaded' });
    this.phase = 'wait'; // чекаємо старт (host emits 'go')
    if (this.isHost) { this.loadedSet = new Set([this.myId]); this.loadWait = 0; this.checkAllLoaded(); }
  }
  newPlayer(r) {
    const diff = this.cfg.diff;
    return { id: r.id, name: r.name, look: r.look, sig: r.sig, bot: !!r.bot, seat: r.seat, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, hp: diff.hp, maxhp: diff.hp, state: 'alive', inv: [], hold: '', fl: false, noise: 0, inHouse: false, slowT: 0, bag: false, photos: new Set(), ammo: 0, monster: false, lives: diff.lives, inp: null, tool: 0, carriesFood: false, inLight: false, bot: !!r.bot, speed: 0 };
  }
  async buildWorld(progress) {
    const scene = this.scene = new THREE.Scene(); const W = this.world = new World(scene, this.seed); W.renderer = this.stage.r;
    await W.build(progress);
    // машина стоїть на узбіччі
    const prof = this.roster.find(r => r.id === this.roster[0].id) || {}; this.truck = buildPickup({ vehicle: this.roster[0].vehicle, paintId: this.roster[0].paint, decal: this.roster[0].decal }); this.truck.rotation.y = -Math.PI / 2; scene.add(this.truck); this.truck.userData.setTailgate(true);
    this.truckHome = V3(0, W.terrainH(0, 2.4), 2.4); this.truck.position.set(-70, W.terrainH(-70, 2.4), 2.4);
    this.local = new LocalCtl(this); this.local.attach(this.stage.cam, scene); this.remote = new RemoteView(scene, this.ui.labels());
    this.itemViews.clear(); this.monViews.clear(); this.stage.setScene(scene); if (this.stage.bloom) { }
    this.ui.setTouch(true);
  }
  // ---------- вступна сцена: приїзд до будинку ----------
  async intro(firstMon) {
    const S = this.S, W = this.world, st = this.stage, truck = this.truck; this.phase = 'intro'; this.ui.fade(false);
    // усі гравці сидять у кабіні
    const seated = {}; this.introAv = [];
    for (const p of S.players.values()) { const av = buildAvatar(p.look, {}); const seat = truck.userData.seats[p.seat]; av.position.copy(seat.p); av.scale.setScalar(.95); truck.add(av); av.userData.animate(0, 0, { seated: seat.kind, drive: p.seat === 0 }); this.introAv.push(av); }
    truck.userData.setLights(W.hour < 7 || true); W.hour = 6.6;
    const t0 = performance.now(), dur = 7200, camStart = V3(-58, 2.2, 8), camEnd = V3(6.5, 1.7, 7.2); let sil = null, silT = 0; audio.setAmb({ engine: 1, rpm: .5, wind: .3 }); inp.enabled = false;
    await new Promise(res => {
      const tick = () => {
        const t = (performance.now() - t0) / 1000, u = clamp(t / (dur / 1000), 0, 1), e = 1 - Math.pow(1 - u, 2.2); const x = lerp(-70, 0, e); const vx = (1 - u) * 2.2 * 70 / (dur / 1000) * 1.0;
        truck.position.set(x, W.terrainH(x, 2.4), 2.4); truck.userData.update(1 / 60, vx); truck.rotation.z = Math.sin(t * 10) * .003;
        if (u < 1) { const cx = lerp(camStart.x, x + 12, Math.min(1, u * 1.4)), cz = lerp(8, 7.2, u); st.cam.position.set(Math.min(cx, 14), 1.8, cz); st.cam.lookAt(x + 1.5, 1.2, 2.4); audio.setAmb({ engine: 1, rpm: .3 + (1 - u) * .6, wind: .3 }); }
        else {
          if (!sil) { audio.setAmb({ engine: .35, rpm: 0, wind: .3 }); truck.userData.setLights(true); sil = silhouette(firstMon || 'wolf'); sil.position.set(10, W.terrainH(10, -11), -11); sil.rotation.y = -Math.PI / 2 * 1; W.scene.add(sil); silT = performance.now(); st.cam.position.set(2.2, 1.6, 8.0); st.cam.lookAt(0, 1.1, -10); audio.play('step', { surface: 'grass' }); }
          const q = (performance.now() - silT) / 1000; sil.position.x = 10 - q * 9; sil.userData.animate(1 / 60, 7, {}); audio.setAmb({ engine: .2, rpm: 0, wind: .3, tense: 1 });
          if (q > 2.3) { W.scene.remove(sil); return res(); }
        }
        W.hour = 6.6; W.weather = 'clear'; W.update(1 / 60, st.cam, { players: [] }); st.render(1 / 60, { exposure: W.exposure }); requestAnimationFrame(tick);
      }; tick();
    });
    this.ui.fade(true); await wait(500); audio.setAmb({ engine: 0 }); this.ui.dayCard(S.day); audio.play('tick'); await wait(900); audio.play('bell'); await wait(1600);
    // гравці виходять
    for (const a of this.introAv) truck.remove(a); this.introAv = [];
    truck.position.copy(this.truckHome); truck.userData.setLights(false); W.cols.add({ t: 'b', x: 0, z: 2.4, hx: 2.95, hz: 1.0, yaw: 0 });
    const ex = truck.userData.exits; for (const p of S.players.values()) { const w = truck.localToWorld(ex[p.seat].clone()); p.x = w.x; p.z = w.z; p.y = W.terrainH(w.x, w.z); p.yaw = Math.atan2(-(0 - p.x), -(10 - p.z)); p.state = p.state === 'dead' ? 'dead' : 'alive'; }
    const me = this.me; this.local.spawn(me.x, me.z, me.yaw); this.local.flCharge = 1; this.ui.dayCard(null); this.ui.fade(false); this.ui.hud(true); this.ui.setTouch(true); inp.enabled = true; this.phase = 'play'; this.running = true; this.msg('День 1: збирайте речі, повертайтесь до заходу сонця', 6); audio.startAmbience(); audio.startMusic('forest'); audio.stopMusic();
    truck.userData.doors.forEach((d, i) => { d.userData.open = true; }); setTimeout(() => truck.userData.doors.forEach(d => d.userData.open = false), 2500);
  }
  // ---------- щокадровий цикл ----------
  loop(dt) {
    this.t += dt;
    if (this.phase === 'menu' || this.phase === 'launch') { if (this.menu) { this.syncLobbyAvatars(); this.menu.update(dt, this.stage); for (const a of this.lobbyAv.values()) a.userData.animate(dt, 0, { seated: a.userData.seatKind, drive: a.userData.drive }); this.stage.render(dt, { exposure: 1 }); } audio.setListener(this.stage.cam.position, 0); return; }
    if (this.phase === 'play' || this.phase === 'summary' || this.phase === 'wait') this.playLoop(dt);
  }
  playLoop(dt) {
    const S = this.S, W = this.world, st = this.stage, L = this.local, me = this.me; if (!me) return;
    const frozen = this.phase !== 'play' || !this.running || me.state === 'dead' && !this.spectating || this.ui.modalOpen() || this.sitting;
    if (this.phase === 'play' && me.state !== 'dead' && !me.monster) {
      L.update(dt, st.cam, { frozen }); me.x = L.x; me.y = L.y; me.z = L.z; me.yaw = L.yaw; me.pitch = L.pitch; me.fl = L.fl && L.flCharge > 0; me.noise = L.noise; me.inHouse = this.inHouseXZ(L.x, L.z); me.speed = L.moveSp; me.crouch = L.crouch;
      this.handleActions(dt);
    } else if (this.phase === 'play' && me.monster) this.monsterControl(dt);
    else if (this.phase === 'play' && me.state === 'dead') this.spectate(dt);
    // світ і сутності
    W.hour = S.hour; W.weather = S.weather; W.update(dt, st.cam, { players: this.playersArr(), onThunder: () => audio.play('thunder', { vol: .9 }) });
    this.updateHouse(dt); this.updateItems(dt); this.updateMonViews(dt); this.updateTruck(dt);
    this.remote.update(dt, this.playersArr(), st.cam, this.myId, {});
    audio.setListener(st.cam.position, L.yaw); this.updateAmb(dt);
    if (this.isHost) this.hostTick(dt); else this.clientTick(dt);
    this.sendT += dt; if (this.sendT > .066) { this.sendT = 0; this.sendState(); }
    // HUD
    this.hudT += dt; if (this.hudT > .1) { this.hudT = 0; this.ui.updateHud(this); }
    this.dmgFlash = Math.max(0, this.dmgFlash - dt * 1.6);
    const lowHp = me.hp < me.maxhp * .3 ? .35 + Math.sin(this.t * 6) * .1 : 0; st.render(dt, { fovKick: L.fovKick, exposure: W.exposure, dmg: Math.max(this.dmgFlash * .7, lowHp), sat: me.hp < me.maxhp * .3 ? .6 : 1, dark: this.phase === 'summary' ? 0 : 1 });
  }
  playersArr() { return [...this.S.players.values()]; }
  inHouseXZ(x, z) { return x > -6.9 && x < 6.9 && z > 10.1 && z < 24.9; }
  weightMul(p) { if (!p) return 1; let kg = 0; for (const u of p.inv) { const it = this.S.items.get(u); if (it) kg += ITEMS[it.id].kg + (ITEMS[it.id].fuel || ITEMS[it.id].gen ? it.lit * .8 : 0); } return 1 - clamp((kg - 8) / 36, 0, .45); }
  // ---------- звук ----------
  sound(name, pos, o = {}) { audio.play(name, { pos: pos && pos.x != null ? V3(pos.x, (pos.y || 0) + 1, pos.z) : null, ...o }); }
  footstep(L) { const me = this.me; const surf = this.inHouseXZ(L.x, L.z) ? 'wood' : Math.abs(L.z) < 3.2 ? 'road' : this.world.puddles.some(p => Math.hypot(p.x - L.x, p.z - L.z) < p.r) ? 'dirt' : 'grass'; audio.play('step', { surface: surf, vol: L.crouch ? .3 : L.sprinting ? 1 : .6 }); }
  msg(t, d = 3) { this.ui.msg(t, d); }
  updateAmb(dt) {
    const W = this.world, S = this.S, L = this.local; let tense = 0; for (const m of S.mons.values()) { const d = Math.hypot(m.x - L.x, m.z - L.z); if (d < 35) tense = Math.max(tense, 1 - d / 35); }
    const inside = this.inHouseXZ(L.x, L.z); audio.setAmb({ wind: (inside ? .25 : 1) * (.3 + W.windLevel * .5), rain: W.rainAmt * (inside ? .35 : 1), night: W.night || 0, gen: this.powerOn() ? (inside ? .4 : Math.max(0, 1 - Math.hypot(L.x - 3.2, L.z - 27) / 30)) : 0, engine: 0, tense });
    this.heartT = (this.heartT || 0) - dt; if (tense > .55 && this.heartT <= 0) { this.heartT = 1.2 - tense * .6; audio.play('heart', { vol: tense }); }
    this.owlT = (this.owlT || 20) - dt; if (this.owlT <= 0) { this.owlT = 40 + Math.random() * 60; if ((W.night || 0) > .5) audio.play('hoot', { pos: V3(L.x + 30, 8, L.z + 20), vol: .5 }); }
  }
  powerOn() { const g = this.S.gen; return g.on && !g.broken && g.fuel > 0; }
  roomLit(x, z) { const r = roomAt(x, z); return !!r && this.powerOn() && this.S.lights[r] !== false; }
  updateHouse(dt) {
    const W = this.world, S = this.S, pw = this.powerOn(), fl = this.flicker > 0 ? (this.flicker -= dt, Math.random() > .4) : true;
    for (const l of W.lights) { const on = pw && S.lights[l.room] !== false && fl; l.light.intensity += ((on ? l.base : 0) - l.light.intensity) * Math.min(1, dt * 12); l.bulb.material.emissiveIntensity = on ? 1.4 : 0; }
    W.house.ud.porchLight.intensity += ((pw && S.lights.hall !== false ? 6 : 0) - W.house.ud.porchLight.intensity) * Math.min(1, dt * 10); W.house.ud.lamp.material.emissiveIntensity = pw ? 1.2 : 0;
    const scr = W.house.ud.laptop.screen; scr.emissiveIntensity = this.laptopPower() ? .9 : 0;
    for (const d of W.doors) { const open = !!S.doors[d.id]; if (d.open !== open) { d.open = open; d.col.enabled = !open; audio.play(open ? 'door' : 'doorclose', { pos: d.pos, vol: .8 }); } d.t += ((open ? 1 : 0) - d.t) * Math.min(1, dt * 6); d.hinge.rotation.y = d.axis === 'x' ? -d.hs * d.dir * d.t * 1.7 : d.hs * d.dir * d.t * 1.7; }
    const g = S.gen; W.gen.userData.led.material.emissive.setHex(g.broken ? 0xff2200 : g.on && g.fuel > 0 ? 0x00ff00 : 0x333333); W.gen.userData.cover.visible = g.cover; W.crate.userData.lid.rotation.x += ((-1.7) - W.crate.userData.lid.rotation.x) * .1;
    if (g.on && !g.broken && g.fuel > 0 && this.isHost) { g.fuel = Math.max(0, g.fuel - dt / 60 * this.diff.genBurn); if (g.fuel <= 0) { this.emit({ k: 'gen', on: false, fuel: 0, broken: g.broken, cover: g.cover }); this.emit({ k: 'sound', name: 'click', x: 3.2, z: 27 }); } }
    this.laptopBat = this.laptopBat ?? 0; if (S.owned.has('lapbat')) { if (pw) this.laptopBat = Math.min(240, this.laptopBat + dt * 8); else this.laptopBat = Math.max(0, this.laptopBat - dt); }
  }
  laptopPower() { return this.powerOn() || (this.S.owned.has('lapbat') && this.laptopBat > 0); }
  updateTruck(dt) { if (this.truck && this.phase !== 'intro') this.truck.userData.update(dt, 0); }
  // ---------- візуалізація предметів ----------
  updateItems(dt) {
    const S = this.S, W = this.world, near = new Set(); const L = this.local;
    for (const it of S.items.values()) {
      if (it.loc !== 'w') { const v = this.itemViews.get(it.u); if (v) { this.scene.remove(v); this.itemViews.delete(it.u); } continue; }
      let v = this.itemViews.get(it.u); const d = Math.hypot(it.x - L.x, it.z - L.z);
      if (!v) { if (d > 90) continue; v = buildItem(it.id); v.position.set(it.x, it.y, it.z); v.rotation.y = it.rot ?? (it.rot = Math.random() * TAU); this.scene.add(v); this.itemViews.set(it.u, v); v.userData.it = it; if (it.id === 'gascan' || it.id === 'gen_fuel') { } }
      v.visible = d < 70;
    }
    for (const [u, v] of this.itemViews) if (!S.items.has(u)) { this.scene.remove(v); this.itemViews.delete(u); }
  }
  // ---------- монстри (вигляд) ----------
  updateMonViews(dt) {
    const S = this.S, W = this.world; const seen = new Set();
    for (const m of S.mons.values()) {
      seen.add(m.id); let v = this.monViews.get(m.id);
      if (!v) { v = { obj: buildMonster(m.type, this.mskin(m.type)), x: m.x, z: m.z, y: m.y, yaw: m.yaw, snd: 2 }; this.scene.add(v.obj); this.monViews.set(m.id, v); }
      const k = this.isHost ? 1 : Math.min(1, dt * 10); v.x += (m.x - v.x) * k; v.z += (m.z - v.z) * k; v.y += (m.y - v.y) * k; v.yaw += angDiff(v.yaw, m.yaw) * k;
      const gy = W.terrainH(v.x, v.z), swampDip = (m.type === 'swamp' && m.hidden) ? -2.5 : (m.type === 'swamp' && m.st === 'rise' ? -1 : 0);
      v.obj.position.set(v.x, gy + v.y + swampDip, v.z); v.obj.rotation.y = v.yaw; v.obj.visible = !(m.hidden && m.type !== 'granny') && !(m.hidden && m.type === 'granny');
      v.obj.userData.animate && v.obj.userData.animate(dt, m.moveSp, { attack: m.atk ? 1 : 0 });
      if (m.st === 'stun') v.obj.rotation.z = Math.sin(this.t * 30) * .05; else v.obj.rotation.z = 0;
      v.snd -= dt; if (v.snd <= 0 && m.moveSp > 1 && Math.hypot(m.x - this.local.x, m.z - this.local.z) < 40) { v.snd = Math.max(.35, 1.1 - m.moveSp * .08); this.sound('step', { x: m.x, z: m.z, y: 0 }, { surface: 'grass', vol: m.type === 'bear' || m.type === 'antlers' ? 1.6 : m.type === 'shade' ? .15 : .7 }); }
    }
    for (const [id, v] of this.monViews) if (!seen.has(id)) { this.scene.remove(v.obj); this.monViews.delete(id); }
  }
  mskin(type) { const o = { wolf: 'wolf_alpha', bear: 'bear_albino', shade: 'shade_blue', collector: 'col_red', scarecrow: 'scare_pump' }; const id = o[type]; return PROF.owned.includes(id) && PROF.mskin?.[type] === id ? id : null; }
}
