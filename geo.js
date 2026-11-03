import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
export { THREE };
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
function fin(o, x, y, z, shadow = true) { o.position.set(x, y, z); o.castShadow = shadow; o.receiveShadow = true; return o; }
export const B = (w, h, d, m, x = 0, y = 0, z = 0, sh = true) => fin(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), x, y, z, sh);
export const RB = (w, h, d, r, m, x = 0, y = 0, z = 0, sh = true) => fin(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - .001, h / 2 - .001, d / 2 - .001)), m), x, y, z, sh);
export const C = (rt, rb, h, seg, m, x = 0, y = 0, z = 0, sh = true) => fin(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m), x, y, z, sh);
export const S = (r, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, sh = true) => { const o = fin(new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), m), x, y, z, sh); o.scale.set(sx, sy, sz); return o; };
export const CONE = (r, h, seg, m, x = 0, y = 0, z = 0, sh = true) => fin(new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), m), x, y, z, sh);
export const PL = (w, h, m, x = 0, y = 0, z = 0, rx = 0, ry = 0) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); o.position.set(x, y, z); o.rotation.set(rx, ry, 0); o.receiveShadow = true; return o; };
export const G = (...kids) => { const g = new THREE.Group(); for (const k of kids) if (k) g.add(k); return g; };
export function rot(o, x = 0, y = 0, z = 0) { o.rotation.set(x, y, z); return o; }
export function at(o, x, y, z) { o.position.set(x, y, z); return o; }
export function extrude(shape, depth, m, bevel = 0.03, curve = 12) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: curve });
  const o = new THREE.Mesh(g, m); o.castShadow = o.receiveShadow = true; return o;
}
export function shapeOf(pts) { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath(); return s; }
export function noShadow(o) { o.traverse(c => { if (c.isMesh) { c.castShadow = false; } }); return o; }
export function setShadows(o, cast, recv = true) { o.traverse(c => { if (c.isMesh) { c.castShadow = cast; c.receiveShadow = recv; } }); }
export function mergeStatic(group) { return group; }
export function mkLine(pts, color = 0x222222) { const g = new THREE.BufferGeometry().setFromPoints(pts); return new THREE.Line(g, new THREE.LineBasicMaterial({ color })); }
