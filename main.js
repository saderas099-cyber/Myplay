import { S as SET, P as PROF, gfx } from './settings.js';
import { buildTextures } from './tex.js';
import { Stage } from './stage.js';
import { Game } from './game.js';
import './game2.js';
import './host.js';
import './lobby.js';
import { UI } from './ui.js';
import { initInput } from './input.js';
import { audio } from './audio.js';
import { $, wait } from './util.js';

const setPct = p => { const v = Math.round(p * 100); const a = $('#ld-pct'), f = $('#ld-fill'), t = $('#ld-truck'); if (a) a.textContent = v + '%'; if (f) f.style.width = v + '%'; if (t) t.style.left = (4 + p * 66) + '%'; };

function fatal(e) { console.error(e); let b = $('#fatal'); if (!b) { b = document.createElement('div'); b.id = 'fatal'; b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;background:#300;color:#fff;font:12px monospace;padding:8px;z-index:999;max-height:40vh;overflow:auto;white-space:pre-wrap'; document.body.appendChild(b); } b.textContent += '\n' + (e && (e.stack || e.message || e)); }
window.addEventListener('error', e => fatal(e.error || e.message));
window.addEventListener('unhandledrejection', e => fatal(e.reason));

async function boot() {
  setPct(0);
  const unlock = () => { audio.unlock(); };
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, unlock, { once: false, passive: true }));
  await wait(60);
  await buildTextures(p => setPct(p * .8));
  const canvas = $('#c'); const stage = new Stage(canvas); initInput(canvas);
  const ui = new UI(); const game = new Game(stage, ui); ui.attach(game); window.__game = game;
  setPct(.9); game.enterMenu(); await wait(50);
  game.menu.update(.016, stage); stage.render(.016, { exposure: 1 });
  setPct(1); await wait(450);
  const ld = $('#loading'); if (ld) { ld.style.transition = 'opacity .9s'; ld.style.opacity = 0; setTimeout(() => ld.remove(), 950); }
  ui.home(game);
  let last = performance.now();
  const tick = now => { const dt = Math.min(.05, (now - last) / 1000); last = now; try { game.loop(dt); } catch (e) { fatal(e); } requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
boot().catch(fatal);
