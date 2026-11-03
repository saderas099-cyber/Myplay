import { S, IS_TOUCH } from './settings.js';
import { clamp } from './util.js';

export const inp = { mx: 0, mz: 0, lookX: 0, lookY: 0, sprint: false, crouch: false, fire: false, pressed: {}, enabled: false, locked: false };
const keys = {};
export const press = a => { inp.pressed[a] = true; };
export const take = a => { const v = inp.pressed[a]; inp.pressed[a] = false; return v; };
export function resetInput() { inp.mx = inp.mz = inp.lookX = inp.lookY = 0; inp.sprint = inp.crouch = inp.fire = false; inp.pressed = {}; for (const k in keys) keys[k] = false; }
const MAP = { KeyE: 'interact', KeyF: 'flash', KeyQ: 'drop', KeyM: 'map', KeyR: 'reload', KeyG: 'drop', Tab: 'score', KeyT: 'photo', KeyV: 'next' };

export function initInput(canvas) {
  window.addEventListener('keydown', e => {
    if (!inp.enabled) return; if (e.target.tagName === 'INPUT') return; keys[e.code] = true;
    if (MAP[e.code] && !e.repeat) press(MAP[e.code]); if (e.code.startsWith('Digit')) { inp.pressed['slot' + (+e.code.slice(5) - 1)] = true; }
    if (e.code === 'Tab' || e.code === 'Space') e.preventDefault(); if (e.code === 'Escape') press('menu');
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  canvas.addEventListener('click', () => { if (inp.enabled && !IS_TOUCH && !document.pointerLockElement) canvas.requestPointerLock?.(); });
  document.addEventListener('pointerlockchange', () => { inp.locked = !!document.pointerLockElement; });
  document.addEventListener('mousemove', e => { if (inp.enabled && document.pointerLockElement) { inp.lookX += e.movementX; inp.lookY += e.movementY; } });
  canvas.addEventListener('mousedown', e => { if (inp.enabled && document.pointerLockElement) { if (e.button === 0) { inp.fire = true; press('fire'); } else if (e.button === 2) press('aim'); } });
  window.addEventListener('mouseup', e => { if (e.button === 0) inp.fire = false; });
  canvas.addEventListener('wheel', e => { if (inp.enabled) press(e.deltaY > 0 ? 'next' : 'prev'); }, { passive: true });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
}
export function pollKeys() {
  if (IS_TOUCH && touchState.active) return;
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), r = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  inp.mz = f; inp.mx = r; inp.sprint = !!(keys.ShiftLeft || keys.ShiftRight); inp.crouch = !!(keys.ControlLeft || keys.KeyC);
}
export const touchState = { active: false, jx: 0, jy: 0, sprintLatch: false };

export function buildTouch(root) {
  root.innerHTML = '';
  const js = S.joySize || 1;
  const joy = document.createElement('div'); joy.className = 'joy'; joy.style.transform = `scale(${js})`; joy.style.transformOrigin = 'left bottom'; const knob = document.createElement('i'); joy.appendChild(knob); root.appendChild(joy);
  let jid = null, jc = null;
  const setJ = (x, y) => { const R = 52, l = Math.hypot(x, y), k = l > R ? R / l : 1; x *= k; y *= k; knob.style.transform = `translate(${x}px,${y}px)`; touchState.jx = x / R; touchState.jy = y / R; inp.mx = touchState.jx; inp.mz = -touchState.jy; touchState.active = true; inp.sprint = touchState.sprintLatch || Math.hypot(touchState.jx, touchState.jy) > .96; };
  joy.addEventListener('pointerdown', e => { jid = e.pointerId; joy.setPointerCapture(jid); const r = joy.getBoundingClientRect(); jc = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; setJ(e.clientX - jc.x, e.clientY - jc.y); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === jid) setJ(e.clientX - jc.x, e.clientY - jc.y); });
  const end = e => { if (e.pointerId === jid) { jid = null; knob.style.transform = ''; inp.mx = inp.mz = 0; touchState.jx = touchState.jy = 0; inp.sprint = touchState.sprintLatch; } };
  joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
  // область огляду (права половина)
  const look = document.createElement('div'); look.style.cssText = 'position:absolute;left:38%;right:0;top:0;bottom:0;z-index:0'; root.appendChild(look); let lid = null, lx = 0, ly = 0;
  look.addEventListener('pointerdown', e => { lid = e.pointerId; look.setPointerCapture(lid); lx = e.clientX; ly = e.clientY; });
  look.addEventListener('pointermove', e => { if (e.pointerId === lid) { inp.lookX += (e.clientX - lx) * 1.4; inp.lookY += (e.clientY - ly) * 1.4; lx = e.clientX; ly = e.clientY; } });
  const lend = e => { if (e.pointerId === lid) lid = null; }; look.addEventListener('pointerup', lend); look.addEventListener('pointercancel', lend);
  const btn = (txt, right, bottom, act, hold, size = 62) => {
    const b = document.createElement('div'); b.className = 'tbtn'; b.textContent = txt; b.style.cssText = `right:${right}px;bottom:${bottom}px;width:${size}px;height:${size}px;z-index:2`; root.appendChild(b);
    b.addEventListener('pointerdown', e => { e.stopPropagation(); b.setPointerCapture(e.pointerId); if (hold) hold(true, b); else press(act); b.classList.add('on'); }); const up = e => { if (hold) hold(false, b); b.classList.remove('on'); }; b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); return b;
  };
  btn('ДІЯ', 22, 104, 'interact', null, 74); btn('🔦', 108, 40, 'flash'); btn('ВОГОНЬ', 22, 190, 'fire', (d) => { inp.fire = d; if (d) press('fire'); }, 66);
  btn('КИНУТИ', 108, 130, 'drop', null, 56); btn('БІГ', 22, 22, null, (d, b) => { touchState.sprintLatch = d; inp.sprint = d; }, 62);
  btn('◀', 192, 24, 'prev', null, 48); btn('▶', 140, 24, 'next', null, 48); btn('КАРТА', 192, 130, 'map', null, 52); btn('ПРИСІСТИ', 108, 196, null, (d) => { inp.crouch = d; }, 56);
  btn('☰', 22, 270, 'menu', null, 44);
}
export function consumeLook() { const x = inp.lookX, y = inp.lookY; inp.lookX = inp.lookY = 0; return [x, y]; }
