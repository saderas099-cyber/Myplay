import * as THREE from 'three';
import { $, el, money, esc, wait, fmtTime, clamp, lerp } from './util.js';
import { S as SET, P as PROF, saveS, saveP, addTokens, owns, buy, GFX, GFX_KEYS, gfx, IS_TOUCH } from './settings.js';
import { DIFFS, DIFF_KEYS, MODES, MONSTERS, MONSTER_KEYS, SHOP, COSMETICS, SKIN_TONES, HAIR_COLORS, HAIR_STYLES, VEHICLES, CAR_PAINTS, CAR_DECALS, MONSTER_SKINS, TOOL_SKINS, CURRENCY, ITEMS, KIND_LABEL, REWARD, RARITY, MONSTER_WHO, RARE_SPAWN } from './data.js';
import { audio } from './audio.js';
import { net } from './net.js';
import { buildAvatar } from './m_char.js';
import { shopPrice } from './economy.js';
import { buildTouch } from './input.js';
import { cfgLabel, nearestPreset } from './lobby.js';
import { lookOf } from './game.js';
import { FC, FR } from './world.js';

export class UI {
  constructor() {
    this.root = $('#ui'); this.hudEl = $('#hud'); this.touchEl = $('#touch'); this.fadeEl = $('#fade'); this.modals = []; this.game = null; this.msgT = 0; this.prev = null; this.curScreen = null;
    this.hudBuilt = false;
  }
  attach(game) { this.game = game; }
  // ---------- базові ----------
  fade(on) { this.fadeEl.classList.toggle('on', !!on); }
  modalOpen() { return this.modals.length > 0; }
  closeTopModal() { const m = this.modals.pop(); if (m) { m.el.remove(); m.onClose && m.onClose(); } if (!this.modals.length && this.game && this.game.phase === 'play' && !IS_TOUCH) { } }
  closeAll() { while (this.modals.length) this.closeTopModal(); this.root.innerHTML = ''; this.curScreen = null; this.stopPreview(); }
  openModal(html, onClose, cls = '') { const m = el('div', 'modal ' + cls); m.innerHTML = `<div class="box">${html}</div>`; this.root.appendChild(m); const rec = { el: m, onClose }; this.modals.push(rec); m.addEventListener('pointerdown', e => { if (e.target === m && !cls.includes('sticky')) { this.modals = this.modals.filter(x => x !== rec); m.remove(); onClose && onClose(); } }); document.exitPointerLock?.(); return rec; }
  toast(text, ms = 3500) { const t = el('div', 'panel', esc(text)); t.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:90;font-weight:700;max-width:80vw;text-align:center'; document.body.appendChild(t); setTimeout(() => t.remove(), ms); }
  msg(text, dur = 3) { let m = this.hudEl.querySelector('.msg'); if (!m) { m = el('div', 'msg'); this.hudEl.appendChild(m); } m.textContent = text; m.style.opacity = 1; clearTimeout(this.msgT); this.msgT = setTimeout(() => { m.style.opacity = 0; }, dur * 1000); }
  prompt(text) { let p = this.hudEl.querySelector('.prompt'); if (!p) return; p.style.display = text ? 'block' : 'none'; if (p._t !== text) { p.textContent = text; p._t = text; } }
  flash() { const f = el('div'); f.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:.8;z-index:40;transition:opacity .35s;pointer-events:none'; document.body.appendChild(f); requestAnimationFrame(() => f.style.opacity = 0); setTimeout(() => f.remove(), 450); }
  labels() { let l = $('#labels'); if (!l) { l = el('div'); l.id = 'labels'; l.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5'; document.body.appendChild(l); } return l; }
  setTouch(on) { if (!IS_TOUCH) return; this.touchEl.classList.toggle('hidden', !on); if (on) buildTouch(this.touchEl); }
  // ---------- завантаження ----------
  showLoading(on, p = 0) {
    let w = $('#bottomload'); if (!on) { if (w) w.remove(); return; }
    if (!w) { w = el('div', 'wheelbar', `<div class="track"><i></i></div><div class="pct">0%</div><div class="wheel"></div>`); w.id = 'bottomload'; w.style.zIndex = 55; document.body.appendChild(w); }
    this.loadProgress(p);
  }
  loadProgress(p) { const w = $('#bottomload'); if (!w) return; w.querySelector('i').style.width = (p * 100).toFixed(0) + '%'; w.querySelector('.pct').textContent = (p * 100).toFixed(0) + '%'; }
  dayCard(n) { let d = $('#daycard'); if (n == null) { d && d.remove(); return; } if (!d) { d = el('div', 'dayscreen'); d.id = 'daycard'; d.style.zIndex = 70; document.body.appendChild(d); } d.innerHTML = `<div class="big">ДЕНЬ ${n}</div>`; }
  // ---------- HUD ----------
  hud(on) {
    this.hudEl.classList.toggle('hidden', !on); if (!on) { this.hudBuilt = false; this.hudEl.innerHTML = ''; return; }
    if (!this.hudBuilt) { this.hudBuilt = true; this.hudEl.innerHTML = `<div class="vign"></div><div class="cross"></div><div class="hud-top"><div class="t" id="h-time"></div><div class="d" id="h-debt"></div></div>
      <div class="hud-left"><div id="h-name"></div><div class="bar"><i id="h-hp" style="background:#c8402f;width:100%"></i></div><div class="bar"><i id="h-st" style="background:#e3b341;width:100%"></i></div><div class="bar"><i id="h-fl" style="background:#7fb6ff;width:100%"></i></div><div id="h-wt" class="tip"></div><div id="h-fps" class="tip"></div></div>
      <div class="bal" id="h-cash"></div><div class="hud-inv" id="h-inv"></div><div class="prompt" style="display:none"></div>`; }
  }
  updateHud(g) {
    const S = g.S, me = g.me, L = g.local; if (!me || !this.hudBuilt) return; const h = S.hour, hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60);
    $('#h-time').textContent = `День ${S.day} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; $('#h-debt').textContent = `Борг: ${money(Math.max(0, S.debt - S.paid))}  ·  Пальне: ${S.carFuel.toFixed(1)}/${g.diff.carFuel} л`;
    $('#h-cash').textContent = money(S.cash); $('#h-name').textContent = me.state === 'alive' ? '' : me.state === 'down' ? 'ПОРАНЕНИЙ' : me.state === 'dead' ? 'ЗАГИНУВ' : '';
    $('#h-hp').style.width = clamp(me.hp / me.maxhp * 100, 0, 100) + '%'; $('#h-st').style.width = L.stamina + '%'; $('#h-fl').style.width = (L.flCharge * 100) + '%';
    let kg = 0; for (const u of me.inv) { const it = S.items.get(u); if (it) kg += ITEMS[it.id].kg; } $('#h-wt').textContent = `Вага: ${kg.toFixed(1)} кг${me.ammo ? '  ·  Набої: ' + me.ammo : ''}`;
    if (SET.showFps) { this.fc = (this.fc || 0) + 1; const n = performance.now(); if (!this.ft || n - this.ft > 1000) { $('#h-fps').textContent = this.fc + ' fps'; this.fc = 0; this.ft = n; } } else $('#h-fps').textContent = '';
    const bar = g.hotbar(), inv = $('#h-inv'); const sig = bar.map(b => b.id || b.type).join() + g.local.sel; if (inv._s !== sig) { inv._s = sig; inv.innerHTML = bar.map((b, i) => `<div class="slot ${i === g.local.sel ? 'on' : ''}" data-i="${i}" style="${b.it ? 'border-color:' + (RARITY[ITEMS[b.id].r]?.color || '') : ''}">${b.type === 'empty' ? '<span class="dim">' + (i + 1) + '</span>' : esc(b.name) + (b.it && b.it.lit ? '<br>' + b.it.lit + ' л' : '')}</div>`).join(''); inv.querySelectorAll('.slot').forEach(s => s.addEventListener('pointerdown', e => { g.local.sel = +s.dataset.i; })); }
    const v = this.hudEl.querySelector('.vign'); if (v) { const low = me.hp / me.maxhp < .35; v.style.boxShadow = `inset 0 0 160px 40px rgba(160,0,0,${low ? .45 : g.dmgFlash * .5})`; }
  }
  // ---------- підсумок дня / кінець гри ----------
  showSummary(ev, game) {
    this.closeSummary(); const d = el('div', 'dayscreen'); d.id = 'summary'; d.style.zIndex = 65;
    const lines = ev.lines.length ? ev.lines.map(l => `<div class="dline"><span>${esc(l.name)} ×${l.n}${l.kg ? ' · ' + l.kg.toFixed(1) + ' кг' : ''}${l.lit ? ' · ' + l.lit.toFixed(1) + ' л' : ''}</span><b>${money(l.total)}</b></div>`).join('') : '<div class="dim">Нічого не продано</div>';
    d.innerHTML = `<div style="font-size:26px;font-weight:800;letter-spacing:.1em">ДЕНЬ ${ev.day}: ПРОДАНО</div>${lines}<hr><div class="dline"><span>Зароблено</span><b>${money(ev.earned)}</b></div><div class="dline"><span>Баланс</span><b>${money(ev.cash)}</b></div>${ev.auto ? '<div class="tip">Баланс автоматично спрямовано на борг</div>' : ''}<div class="dline"><span>Залишилось погасити</span><b style="color:#e3b341">${money(ev.left)}</b></div><div class="tip" style="margin-top:18px">Натисніть, щоб продовжити</div>`;
    document.body.appendChild(d); let done = false; d.addEventListener('pointerdown', () => { if (done) return; done = true; d.querySelector('.tip:last-child').textContent = 'Чекаємо інших гравців...'; game.cmd({ k: 'ready' }); });
  }
  closeSummary() { const d = $('#summary'); d && d.remove(); }
  showOver(ev, game) {
    this.closeSummary(); $('#overscr')?.remove(); const meId = game.myId; const isMon = ev.monsterPlayer === meId; const win = ev.mode === 'monster' ? (isMon ? ev.monsterWin !== false && !ev.win : ev.win) : ev.win;
    const d = el('div', 'dayscreen'); d.id = 'overscr'; d.style.zIndex = 70; const mult = game.cfg.mode === 'hardcore' ? 1.5 : 1;
    const tokens = Math.round(((win ? REWARD.win : REWARD.loss) + ev.day * REWARD.perDay + ev.earned / 60 + (ev.bonus || 0) / 8) * mult * (game.cfg.diffKey === 'nightmare' ? 1.4 : game.cfg.diffKey === 'hard' ? 1.2 : 1));
    d.innerHTML = `<div class="big" style="color:${win ? '#6fbf73' : '#c8402f'}">${win ? 'ВИ ПЕРЕМОГЛИ' : 'ВИ ПРОГРАЛИ'}</div><div>${esc(ev.reason)}</div><hr><div class="dline"><span>Залишилось до погашення боргу</span><b>${money(ev.debtLeft)}</b></div><div class="dline"><span>Дні в лісі</span><b>${ev.day}</b></div><div class="dline"><span>Зароблено</span><b>${money(ev.earned)}</b></div><div class="tip" style="margin-top:20px">Натисніть, щоб повернутись у лобі</div>`;
    document.body.appendChild(d); PROF.stats.runs++; if (win) PROF.stats.wins++; PROF.stats.best = Math.max(PROF.stats.best, ev.day); PROF.stats.earned += ev.earned; saveP();
    let go = false; const fin = () => { if (go) return; go = true; d.remove(); game.returnToLobby(tokens); }; d.addEventListener('pointerdown', fin); setTimeout(fin, 9000);
  }
  rewardFlash(n) { const t = el('div', 'tokflash', `+${n} ${CURRENCY}<div class="tip">Торкніться, щоб забрати</div>`); t.style.zIndex = 80; document.body.appendChild(t); let done = false; t.addEventListener('pointerdown', () => { if (done) return; done = true; audio.play('cash'); t.classList.add('fly'); setTimeout(() => { addTokens(n); t.remove(); this.updateBal(); const b = $('#balbox'); if (b) { b.style.transform = 'scale(1.25)'; setTimeout(() => b.style.transform = '', 250); } }, 900); }); }
  updateBal() { const b = $('#balbox'); if (b) b.textContent = `${PROF.tokens} ${CURRENCY}`; }
  // ---------- головний екран ----------
  home(game) {
    this.closeAll(); this.game = game; this.curScreen = 'home'; this.root.innerHTML = `<div class="screen"><div class="logo">БОРГ: ЛІС<small>ВИЖИВАННЯ ПІД ЗАХІД СОНЦЯ</small></div>
      <div class="menu-main"><button class="btn" data-a="play">Грати</button><button class="btn" data-a="mp">Мультиплеєр</button><button class="btn sec" data-a="shop">Магазин</button><button class="btn sec" data-a="acc">Акаунт</button><button class="btn sec" data-a="set">Налаштування</button></div>
      <div class="bal" id="balbox" style="transition:transform .2s">${PROF.tokens} ${CURRENCY}</div></div>`;
    this.root.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => { audio.unlock(); audio.play('click'); const a = b.dataset.a; if (a === 'play') this.playModes(game, false); else if (a === 'mp') this.multiplayer(game); else if (a === 'shop') this.shop(); else if (a === 'acc') this.account(); else if (a === 'set') this.settings(game); }));
    game.menu.camMode = 'menu';
  }
  back(fn) { return `<button class="btn sm sec" data-back style="position:absolute;left:12px;top:12px;z-index:3">← Назад</button>`; }
  screen(html, onBack) { this.closeAll(); this.root.innerHTML = `<div class="screen" style="background:rgba(0,0,0,.45);overflow:auto;touch-action:pan-y"><button class="btn sm sec" data-back style="position:absolute;left:12px;top:12px;z-index:3">← Назад</button><div style="padding:60px 16px 20px;max-width:980px;margin:0 auto;width:100%">${html}</div><div class="bal" id="balbox">${PROF.tokens} ${CURRENCY}</div></div>`; this.root.querySelector('[data-back]').addEventListener('click', () => { audio.play('click'); onBack(); }); }
  playModes(game, online) {
    this.screen(`<h2>${online ? 'Створити лобі: режим' : 'Режими гри'}</h2><div class="grid">${Object.entries(MODES).map(([k, m]) => `<div class="card" data-m="${k}"><b>${m.name}</b><span class="dim">${m.desc}</span><button class="btn sm">Обрати</button></div>`).join('')}</div>`, () => this.home(game));
    this.root.querySelectorAll('[data-m]').forEach(c => c.addEventListener('click', () => { audio.play('click'); this.config(game, c.dataset.m, online); }));
  }
  // ---------- налаштування забігу ----------
  config(game, mode, online) {
    const cfg = game.defaultCfg(mode); cfg.maxPlayers = online ? 4 : 1; cfg.bots = mode === 'monster' ? 4 : 0; if (mode === 'monster') cfg.monsterWho = 'host'; this.cfgScreen(game, cfg, online);
  }
  cfgScreen(game, cfg, online) {
    const d = cfg.diff, mode = MODES[cfg.mode], lbl = cfgLabel(cfg);
    const sel = (id, opts, val) => `<select id="${id}">${opts.map(([v, t]) => `<option value="${v}" ${String(v) === String(val) ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
    const maxPl = online ? 8 : 1;
    this.screen(`<h2>${mode.name}: налаштування</h2><div class="panel"><div class="tabs">${DIFF_KEYS.filter(k => k !== 'hardcore' || cfg.mode === 'hardcore' || true).map(k => `<div class="tab ${cfg.diffKey === k ? 'on' : ''}" data-d="${k}">${DIFFS[k].name}</div>`).join('')}</div>
      <div class="setrow"><label>Складність</label><b id="lbl">${esc(lbl)}</b></div>
      <div class="setrow"><label>Борг (крок $50)</label><div class="row"><button class="btn sm sec" data-debt="-50">−50</button><b id="debtv" class="grow" style="text-align:center">${money(cfg.debt)}</b><button class="btn sm sec" data-debt="50">+50</button></div></div>
      <div class="setrow"><label>Пальне для виїзду</label><div class="row"><button class="btn sm sec" data-fuel="-1">−1</button><b class="grow" style="text-align:center" id="fuelv">${d.carFuel} л</b><button class="btn sm sec" data-fuel="1">+1</button></div></div>
      <div class="setrow"><label>Ціни продажу</label>${sel('pm', [[.6, '−40%'], [.78, '−20%'], [1, 'Норма'], [1.15, '+15%'], [1.3, '+30%']], d.priceMul)}</div>
      <div class="setrow"><label>Ціни магазину</label>${sel('sm', [[.6, '−40%'], [.85, '−15%'], [1, 'Норма'], [1.2, '+20%'], [1.4, '+40%']], d.shopMul)}</div>
      <div class="setrow"><label>Шанс рідкісних речей</label>${sel('rs', [['low', 'Низький'], ['normal', 'Звичайний'], ['high', 'Високий']], cfg.rareSpawn)}</div>
      <div class="setrow"><label>Здоров’я гравця</label>${sel('hp', [[60, '60'], [80, '80'], [100, '100'], [150, '150']], d.hp)}</div>
      ${cfg.mode === 'monster' ? `<div class="setrow"><label>Хто монстр</label>${sel('mw', [['host', 'Хост'], ['random', 'Випадковий гравець']], cfg.monsterWho)}</div><div class="setrow"><label>Тип монстра</label>${sel('mt', [['random', 'Випадковий'], ...MONSTER_KEYS.map(k => [k, MONSTERS[k].name])], cfg.monsterType)}</div>` : ''}
      ${online ? `<div class="setrow"><label>Макс. гравців</label>${sel('mp', [2, 3, 4, 5, 6, 7, 8].map(n => [n, n]), cfg.maxPlayers)}</div>` : ''}
      <div class="setrow"><label>Ботів (1–${online ? 7 : 8})</label>${sel('bots', Array.from({ length: (online ? 8 : 9) }, (_, i) => [i, i]), cfg.bots)}</div>
      <div class="setrow"><label>Випадкові місця в пікапі</label><input type="checkbox" id="rseat" ${cfg.randomSeats ? 'checked' : ''}></div>
      ${online ? `<div class="setrow"><label>Публічне лобі</label><input type="checkbox" id="pub" ${cfg.public ? 'checked' : ''}></div><div class="setrow"><label>Назва лобі</label><input type="text" id="lname" value="${esc(cfg.name)}" maxlength="28"></div>` : ''}
      <div class="tip">Борг збільшується на 30% за кожного додаткового гравця (ботів теж). Будь-яка зміна параметрів робить складність «кастомною».</div></div>
      <div class="row" style="margin-top:12px"><button class="btn ok grow" id="go">${online ? 'Створити лобі' : 'Далі'}</button></div>`, () => this.playModes(game, online));
    const R = this.root, refresh = () => { game.applyCustom(cfg); R.querySelector('#lbl').textContent = cfgLabel(cfg); R.querySelector('#debtv').textContent = money(cfg.debt); R.querySelector('#fuelv').textContent = cfg.diff.carFuel + ' л'; };
    R.querySelectorAll('[data-d]').forEach(t => t.addEventListener('click', () => { game.setDiffKey(cfg, t.dataset.d); this.cfgScreen(game, cfg, online); }));
    R.querySelectorAll('[data-debt]').forEach(b => b.addEventListener('click', () => { cfg.debt = clamp(cfg.debt + +b.dataset.debt, 300, 30000); refresh(); }));
    R.querySelectorAll('[data-fuel]').forEach(b => b.addEventListener('click', () => { cfg.diff.carFuel = clamp(cfg.diff.carFuel + +b.dataset.fuel, 3, 40); refresh(); }));
    const on = (id, fn) => { const e = R.querySelector('#' + id); e && e.addEventListener('change', () => { fn(e); refresh(); }); };
    on('pm', e => cfg.diff.priceMul = +e.value); on('sm', e => cfg.diff.shopMul = +e.value); on('rs', e => cfg.rareSpawn = e.value); on('hp', e => cfg.diff.hp = +e.value); on('mw', e => cfg.monsterWho = e.value); on('mt', e => cfg.monsterType = e.value);
    on('mp', e => cfg.maxPlayers = +e.value); on('bots', e => cfg.bots = +e.value); on('rseat', e => cfg.randomSeats = e.checked); on('pub', e => cfg.public = e.checked); on('lname', e => cfg.name = e.value);
    R.querySelector('#go').addEventListener('click', async () => { audio.play('click'); game.applyCustom(cfg); try { await game.openLobby(cfg, online); } catch (e) { this.toast('Не вдалося створити лобі: ' + (e.message || e.type || 'помилка мережі')); } });
  }
  // ---------- мультиплеєр ----------
  async multiplayer(game) {
    this.screen(`<h2>Мультиплеєр</h2><div class="row"><button class="btn ok" data-a="create">Створити лобі</button><button class="btn" data-a="code">Приєднатися по коду</button><button class="btn sec" data-a="ref">Оновити</button></div><h3>Відкриті лобі</h3><div class="lobbylist panel" id="ll"><div class="dim">Пошук...</div></div><div class="tip">Гра працює через Інтернет (Wi‑Fi та 4G). Хост — один із гравців. Список публічних лобі найкраще працює, коли хоча б один хост увімкнув «Публічне лобі».</div>`, () => this.home(game));
    const R = this.root; R.querySelector('[data-a=create]').addEventListener('click', () => this.playModes(game, true));
    R.querySelector('[data-a=code]').addEventListener('click', () => this.codePrompt(game)); const load = async () => { const ll = R.querySelector('#ll'); if (!ll) return; ll.innerHTML = '<div class="dim">Пошук...</div>'; const list = await net.listLobbies(); if (!R.querySelector('#ll')) return; ll.innerHTML = list.length ? list.map(l => `<div class="lobbyitem"><div><b>${esc(l.name)}</b><div class="dim">${esc(MODES[l.mode]?.name || l.mode)} · ${esc(l.diff)} · ${l.players}/${l.max}</div></div><button class="btn sm" data-j="${esc(l.code)}">Приєднатися</button></div>`).join('') : '<div class="dim">Лобі не знайдено. Створіть своє або введіть код друга.</div>'; ll.querySelectorAll('[data-j]').forEach(b => b.addEventListener('click', () => this.joinCode(game, b.dataset.j))); };
    R.querySelector('[data-a=ref]').addEventListener('click', load); load();
  }
  codePrompt(game) { const rec = this.openModal(`<h2>Код лобі</h2><input type="text" id="cd" maxlength="5" placeholder="XXXXX" style="font-size:26px;letter-spacing:.3em;text-transform:uppercase;text-align:center"><div class="row" style="margin-top:12px"><button class="btn ok grow" id="ok">Приєднатися</button></div>`); const m = rec.el; m.querySelector('#ok').addEventListener('click', () => { const c = m.querySelector('#cd').value.trim(); if (c.length >= 4) { this.closeTopModal(); this.joinCode(game, c); } }); setTimeout(() => m.querySelector('#cd').focus(), 50); }
  async joinCode(game, code) { this.toast('Підключення...', 2500); try { await game.joinLobby(code); } catch (e) { this.toast('Не вдалося підключитись: ' + (e.type === 'peer-unavailable' ? 'лобі не знайдено' : (e.message || 'мережа'))); } }
  // ---------- лобі (поверх 3D-сцени з пікапом) ----------
  showLobby(game) {
    this.closeAll(); this.curScreen = 'lobby'; const cfg = game.lobby.cfg || game.cfg; const host = game.isHost; const code = game.role !== 'solo' ? (cfg?.code || net.code) : '';
    this.root.innerHTML = `<div class="screen"><div class="topbar"><div class="col"><button class="btn sm sec" id="lset">⚙ Налаштування</button><button class="btn sm sec" id="lleave">← Вийти</button></div><div class="col" style="align-items:flex-end">${code ? `<div class="code" id="lcode">${code}</div><div class="tip">код лобі: торкніться, щоб скопіювати</div>` : ''}<div id="lbal" class="bal" style="position:static">${PROF.tokens} ${CURRENCY}</div></div></div>
      <div id="lplayers" class="panel" style="position:absolute;left:12px;bottom:12px;width:min(300px,45vw);max-height:46vh;overflow:auto;touch-action:pan-y"></div>
      <div style="position:absolute;right:12px;bottom:12px;display:flex;gap:8px"><button class="btn sm sec" id="lacc">Акаунт</button>${host ? '<button class="btn ok" id="lgo">Погнали</button>' : '<div class="panel dim">Чекаємо, поки хост почне гру...</div>'}</div></div>`;
    const R = this.root; R.querySelector('#lleave').addEventListener('click', () => { game.leaveToMenu(); }); const cc = R.querySelector('#lcode'); cc && cc.addEventListener('click', () => { navigator.clipboard?.writeText(code); this.toast('Код скопійовано: ' + code, 1500); });
    R.querySelector('#lacc').addEventListener('click', () => this.account(true)); R.querySelector('#lset').addEventListener('click', () => host ? this.lobbySettings(game) : this.toast('Налаштування змінює хост'));
    const go = R.querySelector('#lgo'); go && go.addEventListener('click', () => { audio.play('click'); this.root.innerHTML = ''; game.startFromLobby(); });
    this.refreshLobby();
  }
  refreshLobby() {
    const game = this.game, box = $('#lplayers'); if (!box || !game) return; const ro = game.lobby.roster, cfg = game.lobby.cfg || game.cfg, host = game.isHost;
    box.innerHTML = `<b>${cfg ? esc(MODES[cfg.mode]?.name || '') + ' · ' + esc(cfgLabel(cfg)) : ''}</b><div class="tip">Борг: ${cfg ? money(cfg.debt) : ''} · Гравців: ${ro.filter(p => !p.bot).length}${cfg ? '/' + cfg.maxPlayers : ''}</div>` + ro.map(p => `<div class="setrow"><span>${p.bot ? '🤖 ' : ''}${esc(p.name)}${p.id === game.myId ? ' (ви)' : ''}${p.seat === 0 ? ' 🚗' : ''}</span><span>${host && !p.bot && p.id !== game.myId ? `<button class="btn sm sec" data-k="${p.id}">✕</button>` : ''}${!p.bot && p.id !== game.myId && game.role !== 'solo' ? `<button class="btn sm sec" data-g="${p.id}">🎁</button>` : ''}</span></div>`).join('');
    box.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => { net.sendTo(b.dataset.k, { t: 'kicked' }); net.kick(b.dataset.k); game.lobby.roster = game.lobby.roster.filter(p => p.id !== b.dataset.k); game.syncBots(); game.broadcastLobby(); }));
    box.querySelectorAll('[data-g]').forEach(b => b.addEventListener('click', () => this.giftPrompt(game, b.dataset.g)));
    const bal = $('#lbal'); if (bal) bal.textContent = `${PROF.tokens} ${CURRENCY}`;
  }
  giftPrompt(game, to) {
    const names = {}; for (const g of ['top', 'bottom', 'shoes', 'hat', 'face']) for (const c of COSMETICS[g]) names[c.id] = c.name; for (const v of VEHICLES) names[v.id] = v.name; for (const c of CAR_PAINTS) names[c.id] = 'Фарба: ' + c.name; for (const m of MONSTER_SKINS) names[m.id] = m.name; for (const t of TOOL_SKINS) names[t.id] = t.name;
    const free = new Set(['tee_gray', 'jeans', 'sneak', 'none', 'pickup', 'red']); const list = PROF.owned.filter(id => !free.has(id) && names[id]);
    const rec = this.openModal(`<h2>Подарувати гравцеві</h2>${list.length ? `<div class="grid">${list.map(id => `<div class="card"><b>${esc(names[id])}</b><button class="btn sm" data-id="${id}">Подарувати</button></div>`).join('')}</div>` : '<div class="dim">У вас немає предметів для подарунка. Купіть у магазині.</div>'}`);
    rec.el.querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', () => { const id = b.dataset.id; PROF.owned = PROF.owned.filter(x => x !== id); for (const k of ['top', 'bottom', 'shoes', 'hat', 'face']) if (PROF.outfit[k] === id) PROF.outfit[k] = COSMETICS[k][0].id; saveP(); net.sendTo(to, { t: 'gift', item: id, label: names[id], from: PROF.nick }); if (game.role === 'client') net.send({ t: 'giftrelay', to, item: id }); this.toast('Подарунок надіслано'); this.closeTopModal(); }));
  }
  lobbySettings(game) { this.cfgScreenModal(game); }
  cfgScreenModal(game) {
    const cfg = game.cfg; const rec = this.openModal(`<h2>Налаштування лобі</h2>
      <div class="tabs">${DIFF_KEYS.map(k => `<div class="tab ${cfg.diffKey === k ? 'on' : ''}" data-d="${k}">${DIFFS[k].name}</div>`).join('')}</div>
      <div class="setrow"><label>Складність</label><b id="lbl">${esc(cfgLabel(cfg))}</b></div>
      <div class="setrow"><label>Борг</label><div class="row"><button class="btn sm sec" data-debt="-50">−50</button><b id="debtv">${money(cfg.debt)}</b><button class="btn sm sec" data-debt="50">+50</button></div></div>
      <div class="setrow"><label>Дозволити вхід</label><input type="checkbox" id="aj" ${cfg.allowJoin ? 'checked' : ''}></div>
      <div class="setrow"><label>Випадкові місця</label><input type="checkbox" id="rseat" ${cfg.randomSeats ? 'checked' : ''}></div>
      <div class="setrow"><label>Ботів</label><select id="bots">${Array.from({ length: 9 }, (_, i) => `<option ${i === cfg.bots ? 'selected' : ''}>${i}</option>`).join('')}</select></div>
      <div class="setrow"><label>Макс. гравців</label><select id="mp">${[2, 3, 4, 5, 6, 7, 8].map(n => `<option ${n === cfg.maxPlayers ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`);
    const R = rec.el, ref = () => { game.applyCustom(cfg); R.querySelector('#lbl').textContent = cfgLabel(cfg); R.querySelector('#debtv').textContent = money(cfg.debt); game.broadcastLobby(); };
    R.querySelectorAll('[data-d]').forEach(t => t.addEventListener('click', () => { game.setDiffKey(cfg, t.dataset.d); this.closeTopModal(); this.cfgScreenModal(game); game.broadcastLobby(); }));
    R.querySelectorAll('[data-debt]').forEach(b => b.addEventListener('click', () => { cfg.debt = clamp(cfg.debt + +b.dataset.debt, 300, 30000); ref(); }));
    R.querySelector('#aj').addEventListener('change', e => cfg.allowJoin = e.target.checked); R.querySelector('#rseat').addEventListener('change', e => { cfg.randomSeats = e.target.checked; game.assignSeats(); game.broadcastLobby(); }); R.querySelector('#bots').addEventListener('change', e => { cfg.bots = +e.target.value; game.syncBots(); game.broadcastLobby(); }); R.querySelector('#mp').addEventListener('change', e => { cfg.maxPlayers = +e.target.value; game.broadcastLobby(); });
  }
  // ---------- акаунт ----------
  account(modal = false) {
    const render = () => {
      const P = PROF, f = P.gender === 'f';
      const slot = (k, label) => `<h3>${label}</h3><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))">${COSMETICS[k].map(c => `<div class="card ${P.outfit[k] === c.id ? 'sel' : ''} ${owns(c.id) ? '' : 'dim'}" data-eq="${k}:${c.id}" style="min-height:0"><b style="font-size:12px">${esc(c.name)}</b>${owns(c.id) ? '' : '<span class="price">🔒 ' + c.price + '</span>'}</div>`).join('')}</div>`;
      const html = `<h2>Акаунт</h2><div class="row" style="align-items:flex-start;gap:16px"><div style="flex:0 0 min(260px,44vw)"><div class="panel" style="padding:6px;position:relative"><canvas id="prev" width="320" height="420" style="width:100%;height:auto;display:block"></canvas><div style="position:absolute;left:50%;top:6px;transform:translateX(-50%);display:flex;gap:6px;align-items:center;background:#000a;padding:4px 10px;border-radius:8px"><span id="nick">${esc(P.nick)}</span><span id="pen" style="cursor:pointer">✏️</span></div></div>
        <div class="tip" style="margin-top:6px">Ігор: ${P.stats.runs} · Перемог: ${P.stats.wins} · Найкращий день: ${P.stats.best}</div></div>
        <div class="grow" style="min-width:220px"><div class="tabs"><div class="tab ${f ? '' : 'on'}" data-g="m">Хлопець</div><div class="tab ${f ? 'on' : ''}" data-g="f">Дівчина</div></div>
        <h3>Колір шкіри</h3><div class="row">${SKIN_TONES.map((c, i) => `<span class="swatch ${P.skin === i ? 'on' : ''}" data-sk="${i}" style="background:#${c.toString(16).padStart(6, '0')}"></span>`).join('')}</div>
        <h3>Обличчя</h3><div class="row">${[0, 1, 2, 3].map(i => `<div class="tab ${P.face === i ? 'on' : ''}" data-fc="${i}">Тип ${i + 1}</div>`).join('')}</div>
        <h3>Зачіска</h3><div class="row">${HAIR_STYLES[f ? 'f' : 'm'].map((n, i) => `<div class="tab ${P.hair === i ? 'on' : ''}" data-hs="${i}">${n}</div>`).join('')}</div>
        <h3>Колір волосся</h3><div class="row">${HAIR_COLORS.map((c, i) => `<span class="swatch ${P.hairColor === i ? 'on' : ''}" data-hc="${i}" style="background:#${c.toString(16).padStart(6, '0')}"></span>`).join('')}</div>
        <h3>Фігура</h3><div class="setrow"><label>Груди</label><input type="range" min="0" max="100" value="${P.chest * 100}" data-r="chest"></div><div class="setrow"><label>Стегна</label><input type="range" min="0" max="100" value="${P.hips * 100}" data-r="hips"></div><div class="setrow"><label>Зріст</label><input type="range" min="0" max="100" value="${P.height * 100}" data-r="height"></div>
        ${slot('top', 'Верх')}${slot('bottom', 'Низ')}${slot('shoes', 'Взуття')}${slot('hat', 'Головний убір')}${slot('face', 'Обличчя / шарф')}</div></div>`;
      if (modal) { const rec = this.openModal(html, () => this.stopPreview(), 'sticky'); return rec.el; }
      this.screen(html, () => this.home(this.game)); return this.root;
    };
    this._accRender = () => { const R = render(); wire(R); }; const wire = R => {
      const rerender = () => { this.stopPreview(); const top = modal ? this.modals.pop() : null; if (top) top.el.remove(); saveP(); this._accRender(); };
      R.querySelectorAll('[data-g]').forEach(t => t.addEventListener('click', () => { PROF.gender = t.dataset.g; PROF.hair = 0; rerender(); }));
      R.querySelectorAll('[data-sk]').forEach(t => t.addEventListener('click', () => { PROF.skin = +t.dataset.sk; rerender(); })); R.querySelectorAll('[data-fc]').forEach(t => t.addEventListener('click', () => { PROF.face = +t.dataset.fc; rerender(); }));
      R.querySelectorAll('[data-hs]').forEach(t => t.addEventListener('click', () => { PROF.hair = +t.dataset.hs; rerender(); })); R.querySelectorAll('[data-hc]').forEach(t => t.addEventListener('click', () => { PROF.hairColor = +t.dataset.hc; rerender(); }));
      R.querySelectorAll('[data-r]').forEach(t => t.addEventListener('input', () => { PROF[t.dataset.r] = t.value / 100; saveP(); this.refreshPreview(); }));
      R.querySelectorAll('[data-eq]').forEach(t => t.addEventListener('click', () => { const [k, id] = t.dataset.eq.split(':'); if (!owns(id)) return this.toast('Купіть у магазині за ' + CURRENCY); PROF.outfit[k] = id; rerender(); }));
      R.querySelector('#pen').addEventListener('click', () => { const rec = this.openModal(`<h2>Нікнейм</h2><input type="text" id="nn" maxlength="16" value="${esc(PROF.nick)}"><div class="row" style="margin-top:10px"><button class="btn ok grow" id="ok">Зберегти</button></div>`, null, 'sticky'); rec.el.querySelector('#ok').addEventListener('click', () => { const v = rec.el.querySelector('#nn').value.trim().slice(0, 16); if (v) PROF.nick = v; this.closeTopModal(); rerender(); }); });
      this.startPreview(R.querySelector('#prev'));
    }; this._accRender();
  }
  startPreview(canvas) {
    this.stopPreview(); const r = this.prevR = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.setSize(canvas.clientWidth || 260, (canvas.clientWidth || 260) * 1.3, false); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
    const sc = this.prevS = new THREE.Scene(); const cam = this.prevC = new THREE.PerspectiveCamera(32, 320 / 420, .1, 30); cam.position.set(0, 1.1, 3.9); cam.lookAt(0, .95, 0); sc.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.6)); const d = new THREE.DirectionalLight(0xfff0dd, 2.6); d.position.set(2, 3, 3); sc.add(d);
    const fl = new THREE.Mesh(new THREE.CircleGeometry(1.4, 28), new THREE.MeshStandardMaterial({ color: 0x1c1f1d, roughness: 1 })); fl.rotation.x = -Math.PI / 2; sc.add(fl); this.refreshPreview(); this.prevOn = true; const t0 = performance.now(); const loop = () => { if (!this.prevOn) return; if (this.prevAv) { this.prevAv.rotation.y = Math.PI + Math.sin((performance.now() - t0) / 1500) * .7; this.prevAv.userData.animate(.016, 0, {}); } r.render(sc, cam); this.prevRaf = requestAnimationFrame(loop); }; loop();
  }
  refreshPreview() { if (!this.prevS) return; if (this.prevAv) this.prevS.remove(this.prevAv); this.prevAv = buildAvatar(lookOf(PROF), {}); this.prevS.add(this.prevAv); }
  stopPreview() { this.prevOn = false; cancelAnimationFrame(this.prevRaf); if (this.prevR) { this.prevR.dispose(); this.prevR.forceContextLoss?.(); this.prevR = null; } this.prevS = null; this.prevAv = null; }
  // ---------- магазин ----------
  shop(tab = 'cloth') {
    const P = PROF; const tabs = [['cloth', 'Одяг'], ['veh', 'Машини'], ['paint', 'Фарби'], ['decal', 'Наклейки'], ['mon', 'Скіни монстрів'], ['tool', 'Скіни предметів']];
    const card = (id, name, price, extra = '', equipFn = '') => { const o = owns(id); return `<div class="card ${o ? 'owned' : ''}"><b>${esc(name)}</b>${extra}${o ? `<button class="btn sm sec" data-e="${id}">${equipFn || 'Є'}</button>` : `<span class="price">${price} ${CURRENCY}</span><button class="btn sm" data-b="${id}:${price}">Купити</button>`}</div>`; };
    let body = '';
    if (tab === 'cloth') for (const [k, n] of [['top', 'Верх'], ['bottom', 'Низ'], ['shoes', 'Взуття'], ['hat', 'Головні убори'], ['face', 'Аксесуари']]) body += `<h3>${n}</h3><div class="grid">${COSMETICS[k].filter(c => c.price > 0 || true).map(c => card(c.id, c.name, c.price, '', P.outfit[k] === c.id ? 'Вдягнено' : 'Вдягнути').replace('data-e="' + c.id + '"', `data-e="${k}:${c.id}"`)).join('')}</div>`;
    if (tab === 'veh') body = `<div class="grid">${VEHICLES.map(v => card(v.id, v.name, v.price, `<span class="dim">${v.desc}</span>`, P.vehicle === v.id ? 'Обрано' : 'Обрати')).join('')}</div>`;
    if (tab === 'paint') body = `<div class="grid">${CAR_PAINTS.map(c => card(c.id, c.name, c.price, `<span class="swatch" style="background:#${c.color.toString(16).padStart(6, '0')}"></span>`, P.paint === c.id ? 'Обрано' : 'Застосувати')).join('')}</div>`;
    if (tab === 'decal') body = `<div class="grid">${CAR_DECALS.map(c => card(c.id + ':decal', c.name, c.price, '', P.decal === c.id ? 'Обрано' : 'Застосувати')).join('')}</div>`;
    if (tab === 'mon') body = `<div class="grid">${MONSTER_SKINS.map(s => card(s.id, s.name, s.price, '', P.mskin?.[s.monster] === s.id ? 'Вдягнено' : 'Вдягнути')).join('')}</div>`;
    if (tab === 'tool') body = `<div class="grid">${TOOL_SKINS.map(s => card(s.id, s.name, s.price, '', P.tskin?.[s.tool] === s.id ? 'Вдягнено' : 'Вдягнути')).join('')}</div>`;
    this.screen(`<h2>Магазин</h2><div class="tabs">${tabs.map(([k, n]) => `<div class="tab ${tab === k ? 'on' : ''}" data-t="${k}">${n}</div>`).join('')}</div>${body}<div class="tip" style="margin-top:12px">Предмети можна дарувати друзям у лобі (кнопка 🎁 біля гравця). Жетони дають за проходження гри.</div>`, () => this.home(this.game));
    const R = this.root; R.querySelectorAll('[data-t]').forEach(t => t.addEventListener('click', () => this.shop(t.dataset.t)));
    R.querySelectorAll('[data-b]').forEach(b => b.addEventListener('click', () => { const [id, pr] = b.dataset.b.split(':').length > 2 ? [b.dataset.b.split(':').slice(0, 2).join(':'), b.dataset.b.split(':')[2]] : b.dataset.b.split(':'); if (buy(id, +pr)) { audio.play('cash'); this.shop(tab); } else this.toast(`Не вистачає ${CURRENCY}`); }));
    R.querySelectorAll('[data-e]').forEach(b => b.addEventListener('click', () => { const v = b.dataset.e; if (tab === 'cloth') { const [k, id] = v.split(':'); PROF.outfit[k] = id; } else if (tab === 'veh') PROF.vehicle = v; else if (tab === 'paint') PROF.paint = v; else if (tab === 'decal') PROF.decal = v.replace(':decal', ''); else if (tab === 'mon') { const s = MONSTER_SKINS.find(x => x.id === v); PROF.mskin = PROF.mskin || {}; PROF.mskin[s.monster] = PROF.mskin[s.monster] === v ? null : v; } else if (tab === 'tool') { const s = TOOL_SKINS.find(x => x.id === v); PROF.tskin = PROF.tskin || {}; PROF.tskin[s.tool] = v; } saveP(); this.game.menu && this.game.menu.setTruck(PROF); this.shop(tab); }));
  }
  // ---------- налаштування ----------
  settings(game, tab = 'gfx') {
    const tabs = [['gfx', 'Графіка'], ['snd', 'Звук'], ['ctl', 'Керування'], ['misc', 'Інше']]; let body = '';
    const slider = (k, label, min, max, step = 1) => `<div class="setrow"><label>${label}</label><input type="range" min="${min}" max="${max}" step="${step}" value="${SET[k]}" data-s="${k}"></div>`;
    const chk = (k, label) => `<div class="setrow"><label>${label}</label><input type="checkbox" ${SET[k] ? 'checked' : ''} data-c="${k}"></div>`;
    if (tab === 'gfx') body = `<div class="grid">${GFX_KEYS.map(k => { const g = GFX[k]; return `<div class="card ${SET.gfx === k ? 'sel' : ''}" data-g="${k}"><b>${g.name}</b><span class="dim" style="font-size:12px">${{ low: 'Пікселізований «денді»-вигляд, без тіней і трави. Для слабких телефонів.', medium: 'Текстури, м’які тіні, трохи трави, жива погода.', high: 'Висока якість: тіні, відблиски, трава, Bloom, згладжування.', ultra: 'Максимум: деталізовані текстури, 4K-тіні, густа жива трава, відблиски в калюжах, об’ємне світло.' }[k]}</span></div>`; }).join('')}</div><div class="tip">Після зміни пресету гра перезапуститься, щоб заново згенерувати текстури.</div>${chk('bloom', 'Світіння (Bloom)')}${chk('grain', 'Плівкове зерно')}${slider('fov', 'Поле зору', 60, 100)}${chk('showFps', 'Показувати FPS')}`;
    if (tab === 'snd') body = `${slider('master', 'Загальна гучність', 0, 1, .05)}${slider('sfx', 'Ефекти', 0, 1, .05)}${slider('ambience', 'Атмосфера лісу', 0, 1, .05)}${slider('music', 'Музика', 0, 1, .05)}`;
    if (tab === 'ctl') body = `${slider('sens', 'Чутливість огляду', .3, 2.5, .05)}${chk('invertY', 'Інвертувати Y')}${slider('joySize', 'Розмір джойстика', .7, 1.4, .05)}${chk('vibrate', 'Вібрація при ударі')}<div class="tip">ПК: WASD, миша, Shift біг, Ctrl присісти, E дія, F ліхтар, Q кинути, 1-9 слоти, M карта, ЛКМ використати.</div>`;
    if (tab === 'misc') body = `<div class="row"><button class="btn sec" id="rst">Скинути прогрес</button></div><div class="tip">Версія 1.0 · Борг: Ліс</div>`;
    this.screen(`<h2>Налаштування</h2><div class="tabs">${tabs.map(([k, n]) => `<div class="tab ${tab === k ? 'on' : ''}" data-t="${k}">${n}</div>`).join('')}</div>${body}`, () => game.phase === 'menu' && game.lobby.roster.length ? this.showLobby(game) : this.home(game));
    const R = this.root; R.querySelectorAll('[data-t]').forEach(t => t.addEventListener('click', () => this.settings(game, t.dataset.t)));
    R.querySelectorAll('[data-g]').forEach(c => c.addEventListener('click', () => { if (SET.gfx === c.dataset.g) return; SET.gfx = c.dataset.g; saveS(); this.toast('Застосовуємо...', 1200); setTimeout(() => location.reload(), 600); }));
    R.querySelectorAll('[data-s]').forEach(i => i.addEventListener('input', () => { SET[i.dataset.s] = +i.value; saveS(); audio.applyVolumes(); }));
    R.querySelectorAll('[data-c]').forEach(i => i.addEventListener('change', () => { SET[i.dataset.c] = i.checked; saveS(); if (i.dataset.c === 'bloom' || i.dataset.c === 'grain') this.toast('Набуде чинності після перезапуску'); }));
    const rs = R.querySelector('#rst'); rs && rs.addEventListener('click', () => { if (confirm('Скинути весь прогрес?')) { try { localStorage.removeItem('dl_profile_v1'); } catch (e) { } location.reload(); } });
  }
  // ---------- пауза ----------
  pauseMenu(game) {
    const online = game.role !== 'solo'; const rec = this.openModal(`<h2>Пауза</h2>${online ? '<div class="tip">У мультиплеєрі гра не зупиняється</div>' : ''}<div class="col"><button class="btn ok" id="rs">Продовжити</button><button class="btn sec" id="st">Налаштування звуку</button><button class="btn sec" id="ex">Вийти в меню</button></div>`);
    rec.el.querySelector('#rs').addEventListener('click', () => this.closeTopModal()); rec.el.querySelector('#ex').addEventListener('click', () => { this.closeTopModal(); game.leaveToMenu(); });
    rec.el.querySelector('#st').addEventListener('click', () => { this.closeTopModal(); const rec2 = this.openModal(`<h2>Звук</h2>${['master', 'sfx', 'ambience'].map(k => `<div class="setrow"><label>${{ master: 'Загальна', sfx: 'Ефекти', ambience: 'Атмосфера' }[k]}</label><input type="range" min="0" max="1" step=".05" value="${SET[k]}" data-s="${k}"></div>`).join('')}`); rec2.el.querySelectorAll('[data-s]').forEach(i => i.addEventListener('input', () => { SET[i.dataset.s] = +i.value; saveS(); audio.applyVolumes(); })); });
  }
  // ---------- карта ----------
  openMap(game) {
    const S = game.S, W = game.world, L = game.local; const rec = this.openModal(`<h2>Карта лісу</h2><canvas id="mp" width="640" height="640" style="width:min(80vh,92vw);height:auto;display:block;margin:0 auto;border-radius:10px;touch-action:none"></canvas><div class="tip" style="text-align:center">${S.owned.has('shovel') ? 'Хрестики — місця для лопати' : 'Купіть лопату в ноутбуці, щоб бачити, де копати'}</div>`);
    const c = rec.el.querySelector('#mp'), g = c.getContext('2d'), sc = 640 / (FR * 2 + 10), tx = x => 320 + (x - FC.x) * sc, tz = z => 320 + (z - FC.z) * sc;
    g.fillStyle = '#16220f'; g.fillRect(0, 0, 640, 640); g.beginPath(); g.arc(320, 320, FR * sc, 0, 7); g.fillStyle = '#2d4a24'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#8a8e92'; g.stroke();
    g.fillStyle = '#333'; g.fillRect(tx(FC.x - FR), tz(-3), FR * 2 * sc, 6 * sc); g.fillStyle = '#c9a85a'; g.fillRect(tx(-7), tz(10), 14 * sc, 15 * sc); g.fillStyle = '#000'; g.font = '14px sans-serif'; g.fillText('БУДИНОК', tx(-3), tz(18));
    g.fillStyle = '#b3261e'; g.fillRect(tx(-3), tz(2), 6 * sc, 2 * sc);
    for (const t of W.towers) { g.fillStyle = '#5a3a1a'; g.fillRect(tx(t.x) - 6, tz(t.z) - 6, 12, 12); g.fillStyle = '#fff'; g.font = '11px sans-serif'; g.fillText('вишка', tx(t.x) - 16, tz(t.z) - 9); }
    for (const h of W.huts) { g.fillStyle = '#7a5a3a'; g.fillRect(tx(h.obj.position.x) - 6, tz(h.obj.position.z) - 5, 12, 10); g.fillStyle = '#fff'; g.font = '11px sans-serif'; g.fillText('хатина', tx(h.obj.position.x) - 16, tz(h.obj.position.z) - 8); }
    for (const p of W.puddles.filter(q => q.swamp)) { g.fillStyle = '#1a1812'; g.beginPath(); g.arc(tx(p.x), tz(p.z), p.r * sc, 0, 7); g.fill(); }
    if (S.owned.has('shovel')) for (const d of S.digs) if (!d.done) { g.strokeStyle = '#e33'; g.lineWidth = 4; const x = tx(d.x), z = tz(d.z); g.beginPath(); g.moveTo(x - 8, z - 8); g.lineTo(x + 8, z + 8); g.moveTo(x + 8, z - 8); g.lineTo(x - 8, z + 8); g.stroke(); }
    for (const p of S.players.values()) { if (p.state === 'dead') continue; g.fillStyle = p.id === game.myId ? '#3df' : '#6f6'; g.beginPath(); g.arc(tx(p.x), tz(p.z), 6, 0, 7); g.fill(); }
    g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText('Ви', tx(L.x) + 8, tz(L.z) - 6);
  }
  // ---------- ноутбук ----------
  openLaptop(game, tab = 'news') {
    this.laptopTab = tab; const rec = this.laptopRec = this.openModal('', () => { this.laptopRec = null; }, 'sticky'); this.game = game; this.renderLaptop(game);
  }
  refreshLaptop() { if (this.laptopRec && this.game) this.renderLaptop(this.game); }
  renderLaptop(game) {
    const S = game.S, d = game.diff, tab = this.laptopTab; const box = this.laptopRec.el.querySelector('.box'); const tabs = [['news', 'Новини'], ['shop', 'Магазин'], ['debt', 'Борг'], ['team', 'Команда']];
    let body = '';
    if (tab === 'news') { const m = S.market || {}; body = `<h3>Ринок скупки</h3><div class="grid">${Object.keys(KIND_LABEL).filter(k => m[k] != null && k !== 'fuel').map(k => `<div class="card"><b>${KIND_LABEL[k]}</b><span style="color:${m[k] >= 1 ? '#6fbf73' : '#e06a5a'};font-weight:800">${m[k] >= 1 ? '▲' : '▼'} ${(m[k] * 100).toFixed(0)}%</span></div>`).join('')}</div><div class="tip">Ціни скупки змінюються щодня. Продавайте те, що дорожчає. Множник складності: ×${d.priceMul.toFixed(2)}.</div>${m._hot ? `<p>🔥 Зараз дорожче: <b>${KIND_LABEL[m._hot]}</b>. Дешевшає: <b>${KIND_LABEL[m._cold]}</b>.</p>` : ''}`; }
    if (tab === 'shop') body = `<div class="row"><b>Баланс: ${money(S.cash)}</b><span class="dim">Посилки приходять наступного ранку на ґанок</span></div><div class="grid" style="margin-top:8px">${SHOP.map(e => { const price = shopPrice(e, d), have = e.kind === 'perm' && S.owned.has(e.id), can = S.cash >= price && !have; return `<div class="card ${have ? 'owned' : ''}"><b>${esc(e.name)}</b><span class="dim" style="font-size:12px">${esc(e.desc)}</span><span class="price">${e.id === 'revive' ? money(price) : money(price)}</span><button class="btn sm ${can ? '' : 'sec'}" data-buy="${e.id}" ${can ? '' : 'disabled'}>${have ? 'Куплено' : 'Купити'}</button></div>`; }).join('')}</div>`;
    if (tab === 'debt') { const left = Math.max(0, S.debt - S.paid); body = `<div class="panel"><div class="dline" style="width:100%"><span>Загальний борг</span><b>${money(S.debt)}</b></div><div class="dline" style="width:100%"><span>Сплачено</span><b>${money(S.paid)}</b></div><div class="dline" style="width:100%"><span>Залишилось</span><b style="color:#e3b341">${money(left)}</b></div><div class="dline" style="width:100%"><span>Баланс</span><b>${money(S.cash)}</b></div><div class="dline" style="width:100%"><span>Пальне в машині</span><b>${S.carFuel.toFixed(1)} / ${d.carFuel} л</b></div></div><div class="row" style="margin-top:10px">${[100, 500].map(n => `<button class="btn sm" data-pay="${n}">Сплатити ${money(n)}</button>`).join('')}<button class="btn ok sm" data-pay="all">Сплатити все можливе</button></div><div class="tip">Коли борг погашено й бак заправлено, підійдіть до водійських дверей пікапа й виїжджайте. Інакше на ранок 8-го дня монстр розіб’є машину.</div>`; }
    if (tab === 'team') body = `<div class="grid">${[...S.players.values()].map(p => `<div class="card"><b>${esc(p.name)}</b><span>${{ alive: 'У строю', down: 'Поранений', dead: 'Загинув' }[p.state]} · ${p.hp}/${p.maxhp}</span></div>`).join('')}</div><div class="row" style="margin-top:10px"><button class="btn sm" data-buy="revive">Повернути напарника (${money(shopPrice({ id: 'revive', price: 0 }, d))})</button></div>`;
    box.innerHTML = `<div class="row" style="justify-content:space-between"><h2 style="margin:0">Комп’ютер · Лісовий ринок</h2><button class="btn sm sec" id="lx">Закрити</button></div><div class="tabs" style="margin-top:10px">${tabs.map(([k, n]) => `<div class="tab ${tab === k ? 'on' : ''}" data-t="${k}">${n}</div>`).join('')}</div>${body}`;
    box.querySelector('#lx').addEventListener('click', () => this.closeTopModal()); box.querySelectorAll('[data-t]').forEach(t => t.addEventListener('click', () => { this.laptopTab = t.dataset.t; this.renderLaptop(game); }));
    box.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => game.cmd({ k: 'buy', id: b.dataset.buy })));
    box.querySelectorAll('[data-pay]').forEach(b => b.addEventListener('click', () => game.cmd({ k: 'pay', amt: b.dataset.pay === 'all' ? 1e9 : +b.dataset.pay })));
  }
}
