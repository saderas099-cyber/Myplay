import { clamp } from './util.js';
const KEY_S = 'dl_settings_v1', KEY_P = 'dl_profile_v1';
export const GFX = {
  low:    { name: 'Низька',    scale: 0.5,  pix: true,  shadows: 0,    shadowSize: 0,    trees: 220,  grass: 0,   grassR: 0,  bloom: false, aa: false, texSize: 128, fog: 0.032, dpr: 1, terr: 56, env: false, rainN: 600,  anim: 15, props: 0.5, sky: false, tex: false },
  medium: { name: 'Середня',   scale: 0.8,  pix: false, shadows: 1,    shadowSize: 1024, trees: 500,  grass: 1.6, grassR: 20, bloom: false, aa: false, texSize: 256, fog: 0.022, dpr: 1, terr: 96, env: false, rainN: 1500, anim: 30, props: 0.75, sky: true, tex: true },
  high:   { name: 'Висока',    scale: 1.0,  pix: false, shadows: 2,    shadowSize: 2048, trees: 850,  grass: 3.2, grassR: 28, bloom: true,  aa: true,  texSize: 512, fog: 0.016, dpr: 1.25, terr: 128, env: true, rainN: 3000, anim: 60, props: 1, sky: true, tex: true },
  ultra:  { name: 'Ультра',    scale: 1.0,  pix: false, shadows: 2,    shadowSize: 4096, trees: 1300, grass: 6.0, grassR: 36, bloom: true,  aa: true,  texSize: 1024, fog: 0.012, dpr: 2, terr: 180, env: true, rainN: 6000, anim: 60, props: 1.3, sky: true, tex: true, ultra: true },
};
export const GFX_KEYS = ['low', 'medium', 'high', 'ultra'];
const isMobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || 'ontouchstart' in window;
export const IS_TOUCH = isMobile;

const defS = { gfx: isMobile ? 'medium' : 'high', master: 0.8, sfx: 1, music: 0.6, ambience: 1, sens: 1, invertY: false, fov: 75, joySize: 1, vibrate: true, showFps: false, bloom: true, grain: true, shadowsOn: true };
const defP = {
  nick: 'Гравець' + Math.floor(Math.random() * 900 + 100), gender: 'm', skin: 1, hair: 0, hairColor: 1, face: 0, chest: 0.5, hips: 0.5, height: 0.5,
  outfit: { top: 'tee_gray', bottom: 'jeans', shoes: 'sneak', hat: 'none', face: 'none' },
  tokens: 100, owned: ['tee_gray', 'jeans', 'sneak', 'none', 'pickup', 'red', 'none:decal'],
  vehicle: 'pickup', paint: 'red', decal: 'none', mskin: {}, tskin: {},
  stats: { runs: 0, wins: 0, best: 0, earned: 0 },
};
function load(key, def) {
  try { const s = JSON.parse(localStorage.getItem(key) || 'null'); if (s) return mergeDeep(structuredClone(def), s); } catch (e) { }
  return structuredClone(def);
}
function mergeDeep(a, b) { for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') mergeDeep(a[k], b[k]); else a[k] = b[k]; } return a; }
export const S = load(KEY_S, defS);
export const P = load(KEY_P, defP);
let tmr = null;
export function saveS() { try { localStorage.setItem(KEY_S, JSON.stringify(S)); } catch (e) { } }
export function saveP() { clearTimeout(tmr); tmr = setTimeout(() => { try { localStorage.setItem(KEY_P, JSON.stringify(P)); } catch (e) { } }, 100); }
export const gfx = () => GFX[S.gfx] || GFX.medium;
export function addTokens(n) { P.tokens = Math.max(0, Math.round(P.tokens + n)); saveP(); }
export const owns = id => P.owned.includes(id);
export function buy(id, price) { if (owns(id)) return true; if (P.tokens < price) return false; P.tokens -= price; P.owned.push(id); saveP(); return true; }
export { clamp };
