// Лобі, створення/приєднання, налаштування забігу
import { Game, lookOf, sigOf } from './game.js';
import { DIFFS, DIFF_KEYS, MODES, MONSTER_KEYS } from './data.js';
import { net, genCode } from './net.js';
import { P as PROF, S as SET, saveP } from './settings.js';
import { rng, pick, wait } from './util.js';
import { audio } from './audio.js';

const BOT_NAMES = ['Остап', 'Марічка', 'Тарас', 'Оксана', 'Богдан', 'Соломія', 'Данило', 'Яріна', 'Левко', 'Орися'];
const BASES = { easy: 1400, normal: 2200, hard: 3400, nightmare: 5200, hardcore: 4200 };
export function nearestPreset(debt) { let b = 'normal', bd = 1e9; for (const k of DIFF_KEYS) { const d = Math.abs(BASES[k] - debt); if (d < bd) { bd = d; b = k; } } return b; }
export function cfgLabel(cfg) {
  const base = DIFFS[cfg.diffKey]; const d = cfg.diff;
  const changed = d.debt !== base.debt || d.carFuel !== base.carFuel || d.priceMul !== base.priceMul || d.shopMul !== base.shopMul || d.monsterMul !== base.monsterMul || d.lootMul !== base.lootMul || d.hp !== base.hp || (cfg.rareSpawn || 'normal') !== 'normal';
  if (!changed) return base.name; const np = DIFFS[nearestPreset(d.debt)].name; return `Кастомний (${np})`;
}
Object.assign(Game.prototype, {
  defaultCfg(mode = 'survival') {
    const diffKey = mode === 'hardcore' ? 'hardcore' : 'normal';
    const diff = { ...DIFFS[diffKey] }; if (mode === 'action') { diff.monsterMul *= 1.25; diff.dmgMul = 1.2; }
    return { mode, diffKey, diff, debt: diff.debt, days: 7, maxPlayers: 4, bots: 0, monsterWho: 'host', monsterType: 'random', rareSpawn: 'normal', rareMul: 1, randomSeats: true, public: false, name: PROF.nick + ' · лобі', allowJoin: true };
  },
  setDiffKey(cfg, key) { cfg.diffKey = key; cfg.diff = { ...DIFFS[key] }; if (cfg.mode === 'action') { cfg.diff.monsterMul *= 1.25; cfg.diff.dmgMul = 1.2; } cfg.debt = cfg.diff.debt; },
  applyCustom(cfg) { cfg.diff.debt = cfg.debt; cfg.rareMul = { low: .6, normal: 1, high: 1.6 }[cfg.rareSpawn] || 1; },
  me0() { const look = lookOf(PROF); return { id: this.myId, name: PROF.nick, look, sig: sigOf(look), bot: false, seat: 0, vehicle: PROF.vehicle, paint: PROF.paint, decal: PROF.decal }; },
  makeBot(i) {
    const R = rng(Date.now() + i * 77), g = R() < .5 ? 'm' : 'f', look = { gender: g, skin: R.int(0, 5), hair: R.int(0, 3), hairColor: R.int(0, 6), face: R.int(0, 3), chest: R(), hips: R(), height: R(), outfit: { top: R.pick(['tee_gray', 'hoodie_blk', 'flannel', 'jacket_grn']), bottom: R.pick(['jeans', 'cargo', 'black']), shoes: R.pick(['sneak', 'boots']), hat: R.pick(['none', 'cap_red', 'beanie']), face: 'none' } };
    return { id: 'b' + i, name: 'Бот ' + BOT_NAMES[i % BOT_NAMES.length], look, sig: sigOf(look), bot: true, seat: 0 };
  },
  // ----- відкрити лобі як хост / соло -----
  async openLobby(cfg, online) {
    this.cfg = cfg; this.myId = 'p0'; this.lobby.cfg = cfg; this.lobby.roster = [this.me0()];
    if (online) {
      let code = genCode(), tries = 0; this.role = 'host'; cfg.code = code;
      while (tries++ < 4) { try { await net.host(code); break; } catch (e) { if (e.message === 'code') { code = genCode(); cfg.code = code; net.close(); this.role = 'host'; } else { net.close(); this.role = 'solo'; throw e; } } }
      this.bindNet(); if (cfg.public) net.registerPublic(() => ({ code: cfg.code, name: cfg.name, mode: cfg.mode, diff: cfgLabel(cfg), players: this.lobby.roster.filter(p => !p.bot).length, max: cfg.maxPlayers, started: this.phase !== 'menu' }));
    } else { this.role = 'solo'; }
    this.syncBots(); this.assignSeats(); this.enterLobbyScene(); this.broadcastLobby(); return cfg.code;
  },
  syncBots() { const cfg = this.cfg, humans = this.lobby.roster.filter(p => !p.bot); const want = Math.max(0, Math.min(cfg.bots, 8 - humans.length)); let bots = this.lobby.roster.filter(p => p.bot); while (bots.length > want) { const b = bots.pop(); this.lobby.roster = this.lobby.roster.filter(p => p !== b); } for (let i = bots.length; i < want; i++) this.lobby.roster.push(this.makeBot(i)); this.assignSeats(); },
  bindNet() {
    net.onMsg = (from, d) => {
      if (d.t === 'hello' && this.isHost) { if (this.lobby.roster.some(p => p.id === from)) return; if (this.lobby.roster.filter(p => !p.bot).length >= this.cfg.maxPlayers || !this.cfg.allowJoin || this.phase !== 'menu') { net.sendTo(from, { t: 'kicked' }); return; } this.lobby.roster = this.lobby.roster.filter(p => !p.bot || true); const e = { id: from, name: d.name, look: d.look, sig: d.sig, bot: false, seat: 0, vehicle: d.vehicle, paint: d.paint, decal: d.decal }; this.lobby.roster.splice(this.lobby.roster.filter(p => !p.bot).length, 0, e); this.syncBots(); this.broadcastLobby(); return; }
      if (d.t === 'gift') { PROF.owned.includes(d.item) || PROF.owned.push(d.item); saveP(); this.ui.toast(`Подарунок від ${d.from}: ${d.label}`); return; }
      if (d.t === 'chat') { this.ui.toast(d.n + ': ' + d.m); if (this.isHost) net.send({ t: 'chat', n: d.n, m: d.m }); return; }
      this.onNet(from, d);
    };
    net.onLeave = pid => { if (this.phase === 'menu') { this.lobby.roster = this.lobby.roster.filter(p => p.id !== pid); this.syncBots(); this.broadcastLobby(); } else { const p = this.S.players.get(pid); if (p) { this.ui.toast(`${p.name} вийшов`); if (p.state === 'alive') { p.state = 'dead'; this.emit({ k: 'down', pid, dead: true }); } p.bot = true; this.H && this.dropAll(p); } } };
    net.onClose = () => { if (this.role === 'client') { this.ui.toast('Хост закрив лобі'); this.leaveToMenu(); } };
  },
  broadcastLobby() { if (net.online) net.send({ t: 'lobby', roster: this.lobby.roster, cfg: this.lobby.cfg }); if (this.ui.refreshLobby) this.ui.refreshLobby(); this.syncLobbyAvatars && this.syncLobbyAvatars(); },
  async joinLobby(code) {
    this.role = 'client'; this.cfg = null; this.bindNet();
    try { const pid = await net.join(code.toUpperCase().trim()); this.myId = pid; } catch (e) { this.role = 'solo'; net.close(); throw e; }
    const look = lookOf(PROF); net.send({ t: 'hello', name: PROF.nick, look, sig: sigOf(look), vehicle: PROF.vehicle, paint: PROF.paint, decal: PROF.decal });
    this.lobby.roster = []; this.enterLobbyScene(); await wait(900); return true;
  },
  enterLobbyScene() { this.enterMenu(); this.menu.camMode = 'lobby'; this.menu.speed = 7; this.clearLobbyAv(); if (this.lobby.roster[0]) this.menu.setTruck({ vehicle: this.lobby.roster[0].vehicle || PROF.vehicle, paint: this.lobby.roster[0].paint || PROF.paint, decal: this.lobby.roster[0].decal || PROF.decal }); this.syncLobbyAvatars(); this.ui.showLobby(this); audio.startMusic('menu'); },
  startFromLobby() {
    if (!this.isHost) return; const cfg = this.cfg, humans = this.lobby.roster.length; this.applyCustom(cfg);
    cfg.debt = Math.round(cfg.diff.debt * (1 + .3 * (humans - 1)) / 50) * 50; cfg.diff.debt = cfg.debt; this.assignSeats();
    let firstMon = cfg.mode === 'monster' ? (cfg.monsterType === 'random' ? pick(MONSTER_KEYS) : cfg.monsterType) : pick(MONSTER_KEYS);
    const seed = (Math.random() * 1e9) | 0; const payload = { cfg: JSON.parse(JSON.stringify(cfg)), roster: this.lobby.roster, seed, firstMon };
    payload.cfg.diff = JSON.parse(JSON.stringify(cfg.diff)); if (net.online) net.send({ t: 'start', payload }); this.beginRun(payload);
  },
  leaveToMenu() {
    try { this.disposeWorld(); } catch (e) { } net.close(); this.role = 'solo'; this.myId = 'p0'; this.lobby = { roster: [], cfg: null }; this.phase = 'menu'; this.running = false; this.ui.closeAll(); this.enterMenu(); this.ui.home(this); audio.startMusic('menu');
  },
  disposeWorld() {
    if (this.scene) { this.scene.traverse(o => { if (o.geometry) o.geometry.dispose?.(); }); } if (this.remote) this.remote.clear(); this.scene = null; this.world = null; this.local = null; this.itemViews.clear(); this.monViews.clear(); this.H = null; this.truck = null; this.stage.setScene(this.menu.scene);
  },
  async returnToLobby(rewardTokens) {
    this.ui.fade(true); await wait(500); this.disposeWorld(); this.phase = 'menu'; this.S = this.freshState(); this.ui.closeAll(); this.ui.hud(false); this.ui.setTouch(false);
    if (this.role === 'client' || this.role === 'host' || this.role === 'solo') { this.cfg = this.cfg; if (this.role === 'host') { this.syncBots(); this.broadcastLobby(); } this.enterLobbyScene(); }
    this.ui.showLoading(true, 0); for (let i = 0; i <= 10; i++) { this.ui.loadProgress(i / 10); await wait(120); } this.ui.showLoading(false); this.ui.fade(false);
    if (rewardTokens) this.ui.rewardFlash(rewardTokens);
  },
});
