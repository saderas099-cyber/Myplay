import * as THREE from 'three';
import { B, RB, C, S, G, rot, V3 } from './geo.js';
import { P as PM, M, chrome } from './mats.js';
import { buildItem } from './m_nature.js';
import { buildAvatar } from './m_char.js';
import { S as SET, gfx } from './settings.js';
import { inp, consumeLook, pollKeys, take, touchState } from './input.js';
import { clamp, lerp, angDiff, TAU } from './util.js';
import { FC, FR } from './world.js';

export function buildTool(id) {
  const g = new THREE.Group(), dark = PM(0x1a1a1c, { rough: .4, metal: .8 });
  if (id === 'shovel') { g.add(C(.02, .02, 1.0, 8, M('planks'), 0, 0, 0), B(.22, .3, .02, PM(0x8a8e92, { metal: .9, rough: .35 }), 0, -.62, 0), B(.14, .03, .03, M('planks'), 0, .48, 0)); g.rotation.set(.3, 0, .25); }
  else if (id === 'camera') { g.add(RB(.16, .1, .08, .015, dark, 0, 0, 0), C(.04, .045, .06, 14, dark, 0, 0, -.07), C(.033, .033, .01, 14, PM(0x335577, { rough: .1, metal: .6 }), 0, 0, -.105), B(.04, .02, .03, PM(0xc8c8c8), .05, .06, 0)); g.children[1].rotation.x = Math.PI / 2; g.children[2].rotation.x = Math.PI / 2; }
  else if (id === 'revolver') { g.add(RB(.04, .1, .2, .01, dark, 0, 0, 0), C(.015, .015, .22, 10, dark, 0, .03, -.18), C(.034, .034, .06, 10, PM(0x777, { metal: 1, rough: .3 }), 0, .03, -.02), RB(.035, .09, .05, .01, M('planks'), 0, -.08, .08)); g.children[1].rotation.x = Math.PI / 2; g.children[2].rotation.x = Math.PI / 2; }
  else if (id === 'deagle') { g.add(RB(.045, .09, .28, .01, PM(0xb8bcc0, { metal: 1, rough: .25 }), 0, 0, 0), C(.014, .014, .1, 8, dark, 0, .03, -.18), RB(.04, .1, .06, .01, dark, 0, -.08, .09)); g.children[1].rotation.x = Math.PI / 2; }
  else if (id === 'shotgun') { g.add(C(.016, .016, .7, 10, dark, 0, .02, -.3), C(.016, .016, .7, 10, dark, .035, .02, -.3), RB(.07, .09, .3, .02, M('planks'), 0, -.02, .15), RB(.05, .06, .22, .02, dark, 0, .0, -.2)); g.children[0].rotation.x = Math.PI / 2; g.children[1].rotation.x = Math.PI / 2; }
  else if (id === 'flare') return buildItem('flare');
  return g;
}

export class LocalCtl {
  constructor(game) {
    this.g = game; this.x = 0; this.y = 0; this.z = 0; this.yaw = -Math.PI / 2; this.pitch = 0; this.vx = 0; this.vz = 0; this.stamina = 100; this.crouch = false; this.noise = 0; this.bob = 0; this.eye = 1.65; this.fl = false; this.flCharge = 1; this.moveSp = 0; this.sel = 0; this.slowT = 0; this.grab = 0; this.tower = null; this.fireCd = 0; this.sprinting = false; this.fovKick = 0; this.recoil = 0; this.locked = false; this.shake = 0;
    this.hold = new THREE.Group(); this.holdKey = ''; this.spot = new THREE.SpotLight(0xfff2d8, 0, 55, .5, .55, 1.4); this.spotT = new THREE.Object3D(); this.spot.target = this.spotT;
  }
  attach(cam, scene) { scene.add(cam); cam.add(this.hold, this.spot, this.spotT); this.hold.position.set(.28, -.26, -.5); this.spot.position.set(.12, -.1, 0); this.spotT.position.set(0, 0, -10); if (gfx().shadows > 1 && gfx().ultra) { this.spot.castShadow = true; this.spot.shadow.mapSize.set(1024, 1024); this.spot.shadow.bias = -.0008; } }
  setHeld(obj, key) { if (key === this.holdKey) return; this.holdKey = key; for (const c of [...this.hold.children]) this.hold.remove(c); if (obj) { this.hold.add(obj); } }
  spawn(x, z, yaw) { this.x = x; this.z = z; this.yaw = yaw; this.pitch = 0; this.y = this.g.world.terrainH(x, z); this.vx = this.vz = 0; this.tower = null; }
  update(dt, cam, o = {}) {
    const g = this.g, W = g.world; const me = g.me;
    const [lx, ly] = consumeLook(); const sens = .0024 * SET.sens * (SET.invertY ? -1 : 1);
    if (!o.frozen) { this.yaw -= lx * sens; this.pitch = clamp(this.pitch - ly * sens * (SET.invertY ? -1 : 1) * (SET.invertY ? 1 : 1), -1.45, 1.45); }
    pollKeys();
    let mx = inp.mx, mz = inp.mz; const len = Math.hypot(mx, mz); if (len > 1) { mx /= len; mz /= len; }
    if (o.frozen) { mx = mz = 0; }
    this.crouch = !!inp.crouch && !this.tower; const wantSprint = inp.sprint && len > .1 && !this.crouch && this.stamina > 3 && !this.exhausted;
    const boots = g.S.owned.has('boots') ? 1.25 : 1;
    if (wantSprint) { this.stamina -= 22 * dt / boots; if (this.stamina <= 0) { this.stamina = 0; this.exhausted = true; } } else { this.stamina = Math.min(100, this.stamina + (len > .1 ? 10 : 18) * dt * boots); if (this.stamina > 25) this.exhausted = false; }
    this.sprinting = wantSprint;
    let sp = wantSprint ? 5.7 : this.crouch ? 1.8 : 3.5; sp *= g.weightMul(me); if (this.slowT > 0) { this.slowT -= dt; sp *= .5; } if (this.grab > 0) { this.grab -= dt; sp = 0; } if (me && me.state === 'down') sp = 1.0; if (this.tower) sp *= .5;
    const dx = (mx * Math.cos(this.yaw) + mz * -Math.sin(this.yaw)), dz = (-mx * Math.sin(this.yaw) + mz * -Math.cos(this.yaw));
    const tvx = dx * sp, tvz = dz * sp; const k = Math.min(1, dt * 12); this.vx += (tvx - this.vx) * k; this.vz += (tvz - this.vz) * k;
    let nx = this.x + this.vx * dt, nz = this.z + this.vz * dt;
    if (this.tower) { const t = this.tower, ddx = nx - t.x, ddz = nz - t.z; nx = t.x + clamp(ddx, -1.3, 1.3); nz = t.z + clamp(ddz, -1.3, 1.3); }
    else { [nx, nz] = W.cols.resolve(nx, nz, .32); const r = Math.hypot(nx - FC.x, nz - FC.z); if (r > FR - .9) { const kk = (FR - .9) / r; nx = FC.x + (nx - FC.x) * kk; nz = FC.z + (nz - FC.z) * kk; } }
    this.moveSp = Math.hypot(nx - this.x, nz - this.z) / Math.max(dt, 1e-4); this.x = nx; this.z = nz;
    const gy = this.tower ? this.tower.H + .2 : W.terrainH(this.x, this.z); this.y += (gy - this.y) * Math.min(1, dt * (this.tower ? 6 : 14));
    this.noise = this.moveSp < .3 ? 0 : wantSprint ? 1 : this.crouch ? .12 : .45;
    if (this.moveSp > .3) { this.bob += dt * this.moveSp * (this.crouch ? 2.2 : 2.6); this.stepAcc = (this.stepAcc || 0) + this.moveSp * dt; if (this.stepAcc > (wantSprint ? 2.2 : 1.5)) { this.stepAcc = 0; g.footstep(this); } }
    this.eye = lerp(this.eye, this.crouch ? 1.1 : 1.65, Math.min(1, dt * 10)); if (me && me.state === 'down') this.eye = lerp(this.eye, .55, Math.min(1, dt * 4));
    this.fovKick = lerp(this.fovKick, wantSprint ? 7 : 0, Math.min(1, dt * 6)); this.recoil = lerp(this.recoil, 0, Math.min(1, dt * 10)); this.shake = Math.max(0, this.shake - dt * 2);
    const bobY = Math.sin(this.bob * 2) * .035 * Math.min(1, this.moveSp / 3), bobX = Math.cos(this.bob) * .025 * Math.min(1, this.moveSp / 3);
    cam.position.set(this.x, this.y + this.eye + bobY, this.z); cam.rotation.order = 'YXZ'; cam.rotation.set(this.pitch + this.recoil * .06 + (Math.random() - .5) * this.shake * .03, this.yaw + bobX * .2 + (Math.random() - .5) * this.shake * .03, bobX * .3);
    // ліхтар
    const fcOn = this.fl && this.flCharge > 0; this.spot.intensity += ((fcOn ? (gfx().ultra ? 120 : 80) : 0) - this.spot.intensity) * Math.min(1, dt * 20); this.spot.visible = this.spot.intensity > .5;
    if (this.fl) { this.flCharge -= dt / 240; if (this.flCharge <= 0) { this.flCharge = 0; if (g.S.owned.has('lamp') && g.useAA()) this.flCharge = 1; else { this.fl = false; g.msg('Ліхтар розрядився'); } } }
    else if (g.houseCharging(this)) this.flCharge = Math.min(1, this.flCharge + dt / 50);
    // біля руки
    this.hold.position.y = -.26 + Math.sin(this.bob * 2) * .008 - this.recoil * .05; this.hold.position.z = -.5 + this.recoil * .1;
  }
}

export class RemoteView {
  constructor(scene, hudLabels) { this.scene = scene; this.map = new Map(); this.labels = hudLabels; }
  ensure(p) {
    let v = this.map.get(p.id); if (v && v.sig !== p.sig) { this.scene.remove(v.av); v.label.remove(); v = null; this.map.delete(p.id); }
    if (!v) { const av = buildAvatar(p.look, { bag: p.bag }); av.position.set(p.x, p.y, p.z); this.scene.add(av); const label = document.createElement('div'); label.className = 'pname'; label.textContent = p.name; this.labels.appendChild(label); v = { av, label, x: p.x, y: p.y, z: p.z, yaw: p.yaw, held: '', sig: p.sig, spd: 0 }; this.map.set(p.id, v); }
    return v;
  }
  update(dt, players, cam, selfId, seated = {}) {
    const seen = new Set();
    for (const p of players) {
      if (p.id === selfId || p.monster) { const v = this.map.get(p.id); if (v) { v.av.visible = false; v.label.style.display = 'none'; } continue; } seen.add(p.id);
      const v = this.ensure(p); v.av.visible = true; const k = Math.min(1, dt * 12);
      const ox = v.x, oz = v.z; v.x += (p.x - v.x) * k; v.y += (p.y - v.y) * k; v.z += (p.z - v.z) * k; v.yaw += angDiff(v.yaw, p.yaw) * k;
      const spd = Math.hypot(v.x - ox, v.z - oz) / Math.max(dt, 1e-4); v.spd += (spd - v.spd) * .2;
      v.av.position.set(v.x, v.y, v.z); v.av.rotation.y = v.yaw; const st = seated[p.id];
      v.av.userData.animate(dt, v.spd, { seated: st ? st.kind : false, drive: st && st.drive, hold: !!p.hold, down: p.state === 'down' || p.state === 'dead', pitch: p.pitch * .6 });
      if (p.hold !== v.held) { v.held = p.hold; if (!p.hold) v.av.userData.setHeld(null); else { const o = p.hold.startsWith('t:') ? buildTool(p.hold.slice(2)) : buildItem(p.hold); o.scale.setScalar(.8); v.av.userData.setHeld(o); } }
      const pos = new THREE.Vector3(v.x, v.y + 2.05, v.z).project(cam); const vis = pos.z < 1 && pos.z > 0 && Math.hypot(v.x - cam.position.x, v.z - cam.position.z) < 40;
      v.label.style.display = vis ? 'block' : 'none'; if (vis) { v.label.style.left = ((pos.x + 1) / 2 * innerWidth) + 'px'; v.label.style.top = ((1 - pos.y) / 2 * innerHeight) + 'px'; v.label.textContent = p.name + (p.state === 'down' ? ' (поранений)' : p.state === 'dead' ? ' (✝)' : ''); }
    }
    for (const [id, v] of this.map) if (!seen.has(id) && !players.some(p => p.id === id)) { this.scene.remove(v.av); v.label.remove(); this.map.delete(id); }
  }
  clear() { for (const v of this.map.values()) { this.scene.remove(v.av); v.label.remove(); } this.map.clear(); }
}
