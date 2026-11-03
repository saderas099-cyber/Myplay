// Процедурні PBR-текстури (колір + рельєф). Генеруються під час завантаження, розмір залежить від графіки.
import * as THREE from 'three';
import { gfx } from './settings.js';
import { hash2, clamp, lerp, nextFrame } from './util.js';

const cache = {};
const mod = (a, n) => ((a % n) + n) % n;
function pn(x, y, px, py) { // періодичний value-noise
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(mod(xi, px), mod(yi, py)), b = hash2(mod(xi + 1, px), mod(yi, py)), c = hash2(mod(xi, px + 0) , mod(yi + 1, py)), d = hash2(mod(xi + 1, px), mod(yi + 1, py));
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function pf(u, v, bx, by, oct = 4) { let s = 0, a = 0.5, f = 1, t = 0; for (let i = 0; i < oct; i++) { s += a * pn(u * bx * f + i * 17, v * by * f + i * 31, bx * f, by * f); t += a; f *= 2; a *= 0.5; } return s / t; }
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

const RECIPES = {
  grass(u, v) { const n = pf(u, v, 6, 6, 5), s = pn(u * 90, v * 28, 90, 28), d = pf(u + .3, v + .7, 12, 12, 3); let c = mix([26, 42, 18], [88, 116, 44], n); c = mix(c, [122, 140, 60], Math.pow(s, 3) * .5); if (d > .68) c = mix(c, [78, 60, 36], (d - .68) * 3); return [...c, n * .7 + s * .3]; },
  dirt(u, v) { const n = pf(u, v, 8, 8, 5), p = pn(u * 60, v * 60, 60, 60); let c = mix([58, 42, 28], [112, 86, 58], n); if (p > .82) c = mix(c, [150, 140, 125], .6); return [...c, n * .6 + (p > .82 ? .4 : 0)]; },
  asphalt(u, v) { const g = pn(u * 220, v * 220, 220, 220), n = pf(u, v, 6, 6, 4), crack = Math.abs(pf(u + .4, v + .2, 5, 5, 4) - .5); let c = mix([28, 28, 30], [58, 58, 60], n * .6 + g * .4); if (crack < .012) c = mul(c, .45); if (g > .93) c = mix(c, [120, 120, 118], .5); return [...c, .5 * g + .3 * n]; },
  bark(u, v) { const r = pf(u, v, 14, 2, 4), r2 = pn(u * 40, v * 6, 40, 6), g = Math.abs(r - .5) * 2; let c = mix([30, 22, 15], [92, 70, 50], r); c = mul(c, .65 + .55 * r2); if (g < .12) c = mul(c, .5); return [...c, r * .8 + r2 * .2]; },
  birch(u, v) { const r = pf(u, v, 6, 3, 3), b = pn(u * 12, v * 30, 12, 30); let c = mix([205, 202, 192], [236, 234, 226], r); if (b > .8 && hash2(Math.floor(u * 12), Math.floor(v * 30)) > .4) c = mix(c, [24, 22, 20], .85); return [...c, r]; },
  planks(u, v) { const rows = 7, i = Math.floor(v * rows), f = v * rows - i, o = hash2(i, 3), g = pn(u * 6 + o * 9, v * 140, 6, 140), n = pf(u + o, v, 4, 18, 3), edge = f < .04 || f > .96; const tone = .6 + hash2(i, 9) * .5; let c = mix([84, 58, 36], [140, 104, 68], n * .7 + g * .3); c = mul(c, tone); if (edge) c = mul(c, .35); const kn = pn(u * 12 + o * 3, v * 7, 12, 7); if (kn > .9) c = mul(c, .6); return [...c, edge ? 0 : .6 + g * .3]; },
  sidingW(u, v) { const rows = 8, i = Math.floor(v * rows), f = v * rows - i, n = pf(u, v, 8, 8, 4), g = pn(u * 4, v * 120, 4, 120); let c = mix([120, 112, 96], [168, 160, 140], n * .7 + g * .3); c = mix(c, [64, 78, 52], Math.max(0, pf(u, v + .5, 5, 5, 4) - .62) * 2.2); if (f < .06) c = mul(c, .4); return [...c, f < .06 ? 0 : .6 + g * .3]; },
  brick(u, v) { const rows = 10, per = 5, r = Math.floor(v * rows), off = (r % 2) * .5, bx = (u * per + off), bi = Math.floor(bx), fx = bx - bi, fy = v * rows - r, mortar = fx < .06 || fy < .1, n = pn(u * 50, v * 50, 50, 50); const t = hash2(bi + 11, r + 5); let c = mix([112, 52, 38], [150, 78, 54], t); c = mul(c, .8 + n * .35); if (mortar) c = [150, 146, 136]; return [...c, mortar ? 0 : .6 + n * .4]; },
  concrete(u, v) { const n = pf(u, v, 8, 8, 5), p = pn(u * 90, v * 90, 90, 90); let c = mix([96, 96, 92], [150, 150, 144], n); if (p > .9) c = mul(c, .55); return [...c, n * .6 + p * .4]; },
  rust(u, v) { const n = pf(u, v, 6, 6, 5), r = pf(u + .6, v + .2, 7, 7, 4), g = pn(u * 100, v * 8, 100, 8); let c = mix([108, 112, 114], [150, 154, 156], g * .6); const k = clamp((r - .46) * 4, 0, 1); c = mix(c, mix([120, 62, 28], [70, 34, 16], n), k); return [...c, k * .6 + g * .4]; },
  corrug(u, v) { const w = Math.sin(u * Math.PI * 2 * 12) * .5 + .5, r = pf(u + .6, v + .2, 6, 6, 5); let c = mix([88, 92, 94], [150, 154, 156], w); const k = clamp((r - .5) * 4, 0, 1); c = mix(c, [112, 58, 28], k * .8); return [...c, w * .8]; },
  shingle(u, v) { const rows = 12, r = Math.floor(v * rows), fy = v * rows - r, per = 8, bx = u * per + (r % 2) * .5, bi = Math.floor(bx), fx = bx - bi, t = hash2(bi + 3, r + 7), n = pn(u * 80, v * 80, 80, 80); let c = mix([44, 38, 36], [88, 76, 68], t); c = mul(c, .8 + n * .3); if (fx < .04 || fy < .08) c = mul(c, .35); const m = pf(u, v, 6, 6, 4); if (m > .62) c = mix(c, [58, 78, 44], (m - .62) * 1.4); return [...c, fy < .08 ? .1 : .6 + n * .3]; },
  wallpaper(u, v) { const s = Math.sin(u * Math.PI * 2 * 8) * .5 + .5, cx = (u * 8) % 1, cy = (v * 12) % 1, d = Math.abs(cx - .5) + Math.abs(cy - .5); let c = mix([150, 140, 108], [170, 160, 124], s * .3); if (d < .22) c = mix(c, [110, 124, 88], .6); const st = Math.max(0, pf(u, v, 4, 6, 4) - .6) * 2.6; c = mix(c, [96, 78, 50], st); return [...c, .4 + .2 * s]; },
  floor(u, v) { const rows = 6, i = Math.floor(v * rows), f = v * rows - i, o = hash2(i, 77), g = pn(u * 5 + o * 7, v * 120, 5, 120), n = pf(u, v, 5, 5, 4); let c = mix([60, 42, 28], [104, 76, 50], g * .5 + n * .5); c = mul(c, .7 + hash2(i, 5) * .5); if (f < .035) c = mul(c, .3); const k = Math.floor((u * 3 + o * 3) % 1 * 3); return [...c, .5 + g * .3]; },
  tile(u, v) { const cx = (u * 8) % 1, cy = (v * 8) % 1, edge = cx < .04 || cy < .04, n = pf(u, v, 8, 8, 3); let c = mix([172, 174, 164], [204, 206, 196], n); if (edge) c = [96, 98, 92]; return [...c, edge ? 0 : .6]; },
  fabric(u, v) { const w = pn(u * 180, v * 180, 180, 180), n = pf(u, v, 5, 5, 3); let c = mix([100, 52, 44], [138, 76, 62], n); c = mul(c, .75 + w * .4); return [...c, .5 + w * .4]; },
  rock(u, v) { const n = pf(u, v, 6, 6, 6), s = pn(u * 4, v * 22, 4, 22); let c = mix([62, 62, 58], [128, 126, 118], n * .7 + s * .3); const m = pf(u + .3, v + .5, 7, 7, 4); if (m > .6) c = mix(c, [58, 84, 44], (m - .6) * 2); return [...c, n]; },
  needles(u, v) { const n = pf(u, v, 10, 10, 5), s = pn(u * 120, v * 50, 120, 50); let c = mix([14, 34, 18], [46, 86, 40], n * .6 + s * .5); return [...c, n * .6 + s * .4]; },
  leaves(u, v) { const n = pf(u, v, 12, 12, 5), s = pn(u * 100, v * 100, 100, 100); let c = mix([30, 64, 22], [104, 140, 46], n * .7 + s * .3); if (hash2(Math.floor(u * 30), Math.floor(v * 30)) > .94) c = mix(c, [200, 160, 40], .7); return [...c, n]; },
  carpet(u, v) { const w = pn(u * 140, v * 140, 140, 140), n = pf(u, v, 4, 4, 3); let c = mix([52, 74, 58], [86, 104, 78], n); c = mul(c, .8 + w * .35); return [...c, .5 + w * .4]; },
  mud(u, v) { const n = pf(u, v, 6, 6, 5); let c = mix([34, 26, 18], [68, 52, 34], n); return [...c, n]; },
  skin(u, v) { const n = pf(u, v, 10, 10, 3); return [...mix([210, 170, 140], [226, 186, 156], n), .5]; },
};

// ---------- шар дрібних деталей поверх кожної текстури (подряпини, плями, цвяхи, пил, мох, сколи) ----------
const hs = (a, b, c = 0) => hash2(a * 7 + c * 131, b * 13 + c * 17);
function cell(u, v, n, seed) { const x = u * n, y = v * n, xi = Math.floor(x), yi = Math.floor(y); return { xi, yi, fx: x - xi, fy: y - yi, h: hs(mod(xi, n), mod(yi, n), seed), h2: hs(mod(xi, n) + 5, mod(yi, n) + 9, seed) }; }
function spots(u, v, n, seed, rad, dens) { const c = cell(u, v, n, seed); if (c.h > dens) return 0; const cx = .25 + c.h2 * .5, cy = .25 + hs(c.xi, c.yi, seed + 3) * .5, d = Math.hypot(c.fx - cx, c.fy - cy); return d < rad ? 1 - d / rad : 0; }
function scratch(u, v, seed, len = 40, thick = .985) { const a = pn(u * len + seed, v * 3 + seed * 3, len, 3), b = pn(u * 3 + seed * 5, v * len + seed, 3, len); return Math.max(a > thick ? 1 : 0, b > thick ? 1 : 0); }
const DETAIL = {
  grass(u, v, r) { const l = spots(u, v, 40, 1, .5, .35); if (l > 0) { r = [...mix(r, [150, 126, 52], l * .5), r[3]]; } const f = spots(u, v, 24, 2, .35, .12); if (f > 0) r = [...mix(r, hash2(f * 99, 3) > .5 ? [238, 232, 210] : [226, 196, 70], .85), r[3]]; const cl = spots(u, v, 55, 4, .45, .2); if (cl > 0) r = [...mix(r, [14, 26, 10], cl * .5), r[3]]; return r; },
  dirt(u, v, r) { const p = spots(u, v, 36, 3, .42, .3); if (p > 0) r = [...mix(r, [138, 132, 120], p * .9), r[3] + p * .3]; const w = spots(u, v, 28, 6, .5, .14); if (w > 0) r = [...mix(r, [140, 104, 56], w * .7), r[3]]; const t = Math.abs(pf(u + .1, v + .8, 4, 4, 3) - .5); if (t < .012) r = [...mul(r, .5), r[3] * .5]; return r; },
  asphalt(u, v, r) { const p = spots(u, v, 90, 2, .4, .22); if (p > 0) r = [...mix(r, [150, 148, 142], p * .8), r[3]]; const o = pf(u + .5, v, 5, 5, 3); if (o > .66) r = [...mul(r, .72), r[3]]; const t = Math.abs(pf(u, v + .5, 7, 7, 5) - .5); if (t < .008) r = [...mul(r, .3), 0]; return r; },
  bark(u, v, r) { const m = pf(u + .3, v + .1, 5, 6, 4); if (m > .6) r = [...mix(r, [58, 84, 34], (m - .6) * 2.2), r[3]]; const k = spots(u, v, 6, 5, .3, .2); if (k > 0) r = [...mul(r, .45 + (1 - k) * .5), r[3] * .4]; const l = spots(u, v, 40, 8, .3, .12); if (l > 0) r = [...mix(r, [150, 125, 90], l * .5), r[3]]; return r; },
  birch(u, v, r) { const m = pf(u, v + .3, 4, 7, 4); if (m > .62) r = [...mix(r, [110, 120, 76], (m - .62) * 2), r[3]]; return r; },
  planks(u, v, r) { const k = spots(u, v, 5, 4, .3, .35); if (k > 0) { r = [...mix(mul(r, .4), r, 1 - k * .85), r[3] * (1 - k * .6)]; } const n = spots(u, v, 14, 7, .1, .09); if (n > 0) r = [...[44, 44, 48], 0]; if (scratch(u, v, 3, 70, .992)) r = [...mul(r, 1.25), r[3]]; const s = pf(u, v, 3, 3, 4); if (s > .64) r = [...mul(r, .7), r[3]]; return r; },
  sidingW(u, v, r) { const n = spots(u, v, 16, 8, .09, .1); if (n > 0) r = [...[60, 60, 62], 0]; if (scratch(u, v, 5, 60, .99)) r = [...mul(r, .75), r[3]]; const rs = pf(u + .2, v, 3, 9, 4); if (rs > .66) r = [...mix(r, [92, 64, 40], (rs - .66) * 2), r[3]]; return r; },
  brick(u, v, r) { const p = spots(u, v, 36, 2, .35, .16); if (p > 0) r = [...mul(r, .6), r[3] * .4]; const s = pf(u, v, 6, 4, 4); if (s > .6) r = [...mix(r, [200, 196, 182], (s - .6) * 1.4), r[3]]; const m = pf(u + .5, v, 4, 4, 4); if (m > .66) r = [...mix(r, [60, 86, 40], (m - .66) * 2), r[3]]; return r; },
  concrete(u, v, r) { const c = Math.abs(pf(u + .3, v, 5, 5, 5) - .5); if (c < .01) r = [...mul(r, .4), r[3] * .2]; const st = pf(u, v + .2, 3, 3, 4); if (st > .62) r = [...mul(r, .75), r[3]]; const p = spots(u, v, 50, 2, .3, .12); if (p > 0) r = [...mul(r, .5), r[3] * .3]; const rb = spots(u, v, 10, 9, .2, .08); if (rb > 0) r = [...mix(r, [130, 70, 36], .6), r[3]]; return r; },
  rust(u, v, r) { const w = spots(u, v, 12, 3, .3, .22); if (w > 0) r = [...mul(r, .5), r[3] + .2]; const rv = spots(u, v, 24, 6, .06, .12); if (rv > 0) r = [...[190, 188, 182], r[3]]; if (scratch(u, v, 9, 60, .99)) r = [...mix(r, [190, 192, 194], .6), r[3]]; return r; },
  corrug(u, v, r) { const rv = spots(u, v, 12, 3, .06, .2); if (rv > 0) r = [...[170, 170, 168], r[3]]; const d = spots(u, v, 4, 8, .45, .3); if (d > 0) r = [...mul(r, 1 - d * .35), r[3]]; return r; },
  shingle(u, v, r) { const m = pf(u, v, 4, 4, 5); if (m > .58) r = [...mix(r, [60, 88, 42], (m - .58) * 2.2), r[3]]; const g = spots(u, v, 30, 4, .3, .18); if (g > 0) r = [...mix(r, [30, 28, 28], g * .5), r[3]]; return r; },
  wallpaper(u, v, r) { const p = spots(u, v, 6, 4, .45, .12); if (p > 0) r = [...mix(r, [88, 66, 38], p * .7), r[3]]; if (scratch(u, v, 8, 30, .985)) r = [...mul(r, .75), r[3]]; const e = Math.max(0, pf(u, v, 2, 2, 3) - .55); r = [...mul(r, 1 - e * .5), r[3]]; return r; },
  floor(u, v, r) { const w = pf(u, v, 3, 3, 4); r = [...mul(r, 1 - Math.max(0, w - .5) * .6), r[3]]; if (scratch(u, v, 2, 80, .99)) r = [...mul(r, 1.3), r[3]]; const n = spots(u, v, 14, 11, .08, .1); if (n > 0) r = [...[50, 50, 54], 0]; return r; },
  tile(u, v, r) { const c = Math.abs(pf(u + .2, v, 6, 6, 4) - .5); if (c < .01) r = [...mul(r, .45), 0]; const g = pf(u, v + .4, 6, 6, 3); r = [...mix(r, [92, 100, 72], Math.max(0, g - .6)), r[3]]; return r; },
  fabric(u, v, r) { const p = spots(u, v, 18, 5, .35, .2); if (p > 0) r = [...mul(r, 1 - p * .4), r[3]]; const t = hash2(Math.floor(u * 6), Math.floor(v * 6)); const stripe = (Math.sin(u * Math.PI * 2 * 6) > .85 || Math.sin(v * Math.PI * 2 * 6) > .85) ? .25 : 0; r = [...mix(r, [30, 20, 16], stripe), r[3]]; return r; },
  rock(u, v, r) { const c = Math.abs(pf(u, v + .4, 5, 5, 5) - .5); if (c < .014) r = [...mul(r, .35), r[3] * .2]; const l = spots(u, v, 20, 3, .35, .22); if (l > 0) r = [...mix(r, [170, 160, 90], l * .6), r[3]]; const q = spots(u, v, 32, 5, .15, .1); if (q > 0) r = [...[220, 218, 212], r[3]]; return r; },
  needles(u, v, r) { const c = spots(u, v, 30, 2, .3, .15); if (c > 0) r = [...mix(r, [92, 56, 30], c * .8), r[3]]; return r; },
  leaves(u, v, r) { const vn = Math.abs(((u * 10) % 1) - .5) < .03 ? .8 : 1; r = [...mul(r, vn), r[3]]; const ho = spots(u, v, 40, 7, .2, .12); if (ho > 0) r = [...mix(r, [120, 90, 36], .6), r[3]]; return r; },
  carpet(u, v, r) { const p = spots(u, v, 6, 7, .5, .2); if (p > 0) r = [...mul(r, 1 - p * .45), r[3]]; const t = Math.abs(((u * 4) % 1) - .5) + Math.abs(((v * 4) % 1) - .5); if (t > .85) r = [...mix(r, [140, 120, 70], .6), r[3]]; return r; },
  mud(u, v, r) { const w = spots(u, v, 8, 3, .45, .3); if (w > 0) r = [...mul(r, .55), 1]; const p = spots(u, v, 40, 6, .3, .1); if (p > 0) r = [...[110, 104, 96], r[3]]; return r; },
  skin(u, v, r) { const f = spots(u, v, 40, 7, .2, .08); if (f > 0) r = [...mix(r, [150, 90, 60], .4), r[3]]; return r; },
};
// нові рецепти: джинса, шкіра, картон, папір, фарба зі сколами, матове скло, плед, гума, свіча/віск
Object.assign(RECIPES, {
  denim(u, v) { const a = pn(u * 220, v * 220, 220, 220), tw = ((u * 120 + v * 120) % 1); let c = mix([38, 56, 92], [64, 88, 130], a * .6 + tw * .4); const f = pf(u, v, 4, 4, 4); c = mul(c, .8 + f * .35); return [...c, .4 + a * .5]; },
  leather(u, v) { const c1 = pn(u * 70, v * 70, 70, 70), c2 = pn(u * 35, v * 35, 35, 35), n = pf(u, v, 5, 5, 3); const d = Math.abs(c1 - .5) < .05 || Math.abs(c2 - .5) < .05; let c = mix([52, 32, 22], [98, 62, 40], n); if (d) c = mul(c, .55); return [...c, d ? 0 : .5 + n * .3]; },
  cardboard(u, v) { const w = Math.sin(v * Math.PI * 2 * 40) * .5 + .5, n = pf(u, v, 6, 6, 4), g = pn(u * 80, v * 80, 80, 80); let c = mix([140, 104, 64], [178, 140, 92], n * .6 + g * .3); c = mul(c, .86 + w * .14); const s = Math.max(0, pf(u + .4, v, 3, 3, 4) - .6); c = mix(c, [86, 62, 36], s * 1.8); return [...c, .4 + w * .3]; },
  paper(u, v) { const n = pf(u, v, 8, 8, 5), g = pn(u * 140, v * 140, 140, 140), y = Math.max(0, pf(u, v + .5, 3, 3, 4) - .5); let c = mix([206, 200, 180], [232, 226, 208], n * .5 + g * .4); c = mix(c, [172, 142, 92], y * 1.6); return [...c, g * .5 + .2]; },
  paint(u, v) { const n = pf(u, v, 7, 7, 5), ch = spots(u, v, 20, 3, .35, .3) + spots(u, v, 45, 5, .3, .2), dr = pn(u * 6, v * 70, 6, 70); let c = mix([150, 40, 30], [178, 56, 42], n); if (dr > .9) c = mul(c, .8); if (ch > .35) c = mix(c, [150, 150, 148], .85); const rs = Math.max(0, pf(u + .3, v + .2, 5, 5, 5) - .62); c = mix(c, [112, 56, 24], Math.min(1, rs * 2.5)); return [...c, ch > .35 ? 0 : .6 + n * .2]; },
  frost(u, v) { const n = pf(u, v, 10, 10, 5), g = pn(u * 120, v * 120, 120, 120), s = Math.max(0, pf(u + .2, v + .6, 4, 4, 4) - .55); let c = mix([150, 170, 164], [190, 206, 200], n * .6 + g * .3); c = mix(c, [92, 96, 88], s * 2); return [...c, .3 + g * .3]; },
  plaid(u, v) { const a = Math.sin(u * Math.PI * 2 * 5) * .5 + .5, b = Math.sin(v * Math.PI * 2 * 5) * .5 + .5, th = pn(u * 200, v * 200, 200, 200); let c = mix([140, 36, 30], [30, 30, 34], Math.max(a > .7 ? 1 : 0, b > .7 ? 1 : 0) * .9); if (a > .45 && a < .55 || b > .45 && b < .55) c = mix(c, [230, 220, 190], .5); c = mul(c, .8 + th * .35); return [...c, .5 + th * .4]; },
  rubber(u, v) { const n = pf(u, v, 8, 8, 4), g = pn(u * 160, v * 160, 160, 160); let c = mix([22, 22, 24], [46, 46, 48], n * .6 + g * .4); const w = Math.max(0, pf(u, v + .3, 4, 4, 4) - .6); c = mix(c, [84, 82, 76], w * 1.5); return [...c, g * .5 + .3]; },
  wax(u, v) { const n = pf(u, v, 5, 5, 4), d = pn(u * 4, v * 40, 4, 40); let c = mix([210, 196, 150], [238, 226, 178], n); if (d > .86) c = mul(c, .84); return [...c, .3 + n * .2]; },
});

export async function buildTextures(progress) {
  const size0 = gfx().texSize, keys = Object.keys(RECIPES); let i = 0;
  for (const k of keys) {
    const big = ['grass', 'dirt', 'asphalt', 'bark', 'planks', 'sidingW', 'rock', 'concrete'].includes(k);
    const size = big ? size0 : Math.min(size0, 512);
    cache[k] = makeTex(RECIPES[k], size, k);
    i++; progress && progress(i / keys.length); await nextFrame();
  }
}
function makeTex(fn, size, name) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const ctx = cv.getContext('2d'), img = ctx.createImageData(size, size), d = img.data;
  const bv = document.createElement('canvas'); bv.width = bv.height = size; const bctx = bv.getContext('2d'), bimg = bctx.createImageData(size, size), bd = bimg.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const o = (y * size + x) * 4, r = fn((x + .5) / size, (y + .5) / size); if (DETAIL[name]) r = DETAIL[name]((x + .5) / size, (y + .5) / size, r);
    d[o] = clamp(r[0], 0, 255); d[o + 1] = clamp(r[1], 0, 255); d[o + 2] = clamp(r[2], 0, 255); d[o + 3] = 255;
    const h = clamp(r[3], 0, 1) * 255; bd[o] = bd[o + 1] = bd[o + 2] = h; bd[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); bctx.putImageData(bimg, 0, 0);
  const map = new THREE.CanvasTexture(cv), bump = new THREE.CanvasTexture(bv);
  for (const t of [map, bump]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; }
  map.colorSpace = THREE.SRGBColorSpace; map.name = name;
  return { map, bump };
}
export function getTex(kind) { return cache[kind]; }
export function texClone(kind, rx = 1, ry = 1) {
  const t = cache[kind]; if (!t) return null; const m = t.map.clone(), b = t.bump.clone(); m.needsUpdate = b.needsUpdate = true; m.repeat.set(rx, ry); b.repeat.set(rx, ry); m.colorSpace = THREE.SRGBColorSpace; return { map: m, bump: b };
}
// маленькі спеціальні канваси (номер, обличчя, наклейки)
export function canvasTex(w, h, draw, srgb = true) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
export function faceTex(skinHex, gender, face) {
  return canvasTex(256, 256, (g, w, h) => {
    const c = '#' + skinHex.toString(16).padStart(6, '0'); g.fillStyle = c; g.fillRect(0, 0, w, h);
    const grd = g.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w * .7); grd.addColorStop(0, 'rgba(255,255,255,.08)'); grd.addColorStop(1, 'rgba(0,0,0,.22)'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    const ex = [78, 178], ey = 124, es = [8, 10, 7, 9][face % 4];
    for (const x of ex) { g.fillStyle = '#f2f2ee'; g.beginPath(); g.ellipse(x, ey, es + 6, es + 2, 0, 0, 7); g.fill(); g.fillStyle = ['#2d4a68', '#3c5a2c', '#5a3a22', '#4a4a4a'][face % 4]; g.beginPath(); g.arc(x, ey, es, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(x, ey, es * .5, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 3, ey - 3, 2.2, 0, 7); g.fill(); }
    g.strokeStyle = '#2a1c12'; g.lineWidth = gender === 'f' ? 4 : 7; g.lineCap = 'round'; for (const [x, s] of [[78, -1], [178, 1]]) { g.beginPath(); g.moveTo(x - 24, ey - 28 + (face % 2) * 3); g.quadraticCurveTo(x, ey - 38 - (face >> 1) * 3, x + 24, ey - 26); g.stroke(); }
    if (gender === 'f') { g.strokeStyle = '#1a1210'; g.lineWidth = 3; for (const x of ex) { g.beginPath(); g.arc(x, ey, es + 6, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); } }
    g.strokeStyle = 'rgba(80,40,30,.5)'; g.lineWidth = 4; g.beginPath(); g.moveTo(128, 136); g.quadraticCurveTo(122, 168, 132, 174); g.stroke();
    g.fillStyle = gender === 'f' ? '#a8433f' : '#8a4a40'; g.beginPath(); g.moveTo(98, 206); g.quadraticCurveTo(128, 222 + (face % 3) * 2, 158, 206); g.quadraticCurveTo(128, 212, 98, 206); g.fill();
  });
}
