import * as THREE from 'three';
import { texClone } from './tex.js';
import { gfx } from './settings.js';

const FALLBACK = { grass: 0x4b6a2c, dirt: 0x6b543a, asphalt: 0x2a2a2c, bark: 0x4a3626, birch: 0xd8d6cc, planks: 0x7a5636, sidingW: 0x9a9480, brick: 0x8a4630, concrete: 0x8e8e88, rust: 0x7a5a44, corrug: 0x8a8e90, shingle: 0x4e4640, wallpaper: 0xa89c78, floor: 0x6a4c34, tile: 0xc0c2b8, fabric: 0x7a4a3e, rock: 0x7e7c74, needles: 0x23472a, leaves: 0x58802c, carpet: 0x5a6e56, mud: 0x3e3022, skin: 0xd8b090 };
let cache = {};
export function resetMats() { cache = {}; }
export function M(kind, o = {}) {
  const { color = 0xffffff, rx = 1, ry = 1, rough = 0.85, metal = 0, bump = 1, side, emissive = 0, ei = 1, vc = false, transparent, opacity } = o;
  const key = [kind, color, rx, ry, rough, metal, bump, side, emissive, vc, opacity].join('|');
  if (cache[key]) return cache[key];
  const g = gfx(); let m;
  if (!g.tex) {
    const c = new THREE.Color(FALLBACK[kind] ?? 0x888888); c.multiply(new THREE.Color(color));
    m = new THREE.MeshLambertMaterial({ color: c, flatShading: true, emissive, vertexColors: vc, side });
  } else {
    const t = texClone(kind, rx, ry);
    m = new THREE.MeshStandardMaterial({ map: t?.map, bumpMap: t?.bump, bumpScale: 1.6 * bump * (g.ultra ? 1.6 : 1), color, roughness: rough, metalness: metal, side, emissive, emissiveIntensity: ei, vertexColors: vc });
  }
  if (transparent) { m.transparent = true; m.opacity = opacity ?? 1; }
  return cache[key] = m;
}
export function P(color, o = {}) { // однотонний матеріал
  const { rough = 0.7, metal = 0, emissive = 0, ei = 1, side, opacity, vc = false, flat = false } = o;
  const key = ['P', color, rough, metal, emissive, ei, side, opacity, vc, flat].join('|');
  if (cache[key]) return cache[key];
  const g = gfx(); let m;
  if (!g.tex && !emissive && opacity == null) m = new THREE.MeshLambertMaterial({ color, flatShading: true, vertexColors: vc, side });
  else m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive, emissiveIntensity: ei, side, vertexColors: vc, flatShading: flat || !g.tex });
  if (opacity != null) { m.transparent = true; m.opacity = opacity; m.depthWrite = false; }
  return cache[key] = m;
}
export const glass = (color = 0x2a5d8f, op = 0.55) => {
  const key = 'glass' + color + op; if (cache[key]) return cache[key];
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.04, metalness: 0.9, transparent: true, opacity: op, depthWrite: false, envMapIntensity: 1.4 });
  return cache[key] = m;
};
export const chrome = () => P(0xcfd3d6, { rough: 0.18, metal: 1 });
export const rubber = () => P(0x151515, { rough: 0.95 });
