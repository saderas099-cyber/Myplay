// Колізії: кола та орієнтовані прямокутники з просторовою сіткою.
export class Colliders {
  constructor(cell = 8) { this.cell = cell; this.grid = new Map(); this.all = []; }
  _k(i, j) { return i * 73856093 ^ j * 19349663; }
  add(c) {
    c.enabled = c.enabled !== false; this.all.push(c);
    const r = c.t === 'c' ? c.r : Math.hypot(c.hx, c.hz) + 0.01, i0 = Math.floor((c.x - r) / this.cell), i1 = Math.floor((c.x + r) / this.cell), j0 = Math.floor((c.z - r) / this.cell), j1 = Math.floor((c.z + r) / this.cell);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = this._k(i, j); let a = this.grid.get(k); if (!a) this.grid.set(k, a = []); a.push(c); }
    return c;
  }
  addTransformed(c, ox, oz, yaw) {
    const cs = Math.cos(yaw), sn = Math.sin(yaw), lx = c.x * cs + c.z * sn, lz = -c.x * sn + c.z * cs;
    if (c.t === 'c') return this.add({ ...c, x: ox + lx, z: oz + lz });
    return this.add({ ...c, x: ox + lx, z: oz + lz, yaw: (c.yaw || 0) + yaw });
  }
  near(x, z, r, fn) {
    const i0 = Math.floor((x - r) / this.cell), i1 = Math.floor((x + r) / this.cell), j0 = Math.floor((z - r) / this.cell), j1 = Math.floor((z + r) / this.cell), seen = new Set();
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const a = this.grid.get(this._k(i, j)); if (!a) continue; for (const c of a) { if (seen.has(c) || !c.enabled) continue; seen.add(c); fn(c); } }
  }
  // повертає [x, z] після виштовхування
  resolve(x, z, r) {
    for (let it = 0; it < 3; it++) this.near(x, z, r + 2, c => {
      if (c.t === 'c') { const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), m = r + c.r; if (d < m) { const k = d > 1e-4 ? (m - d) / d : 0; if (d > 1e-4) { x += dx * k; z += dz * k; } else x += m; } }
      else {
        const cs = Math.cos(c.yaw || 0), sn = Math.sin(c.yaw || 0), dx = x - c.x, dz = z - c.z, lx = dx * cs + dz * sn, lz = -dx * sn + dz * cs, px = Math.max(-c.hx, Math.min(c.hx, lx)), pz = Math.max(-c.hz, Math.min(c.hz, lz)), ex = lx - px, ez = lz - pz, d = Math.hypot(ex, ez);
        if (d < r) { let nx, nz; if (d > 1e-4) { nx = ex / d * (r - d); nz = ez / d * (r - d); } else { const ox = c.hx - Math.abs(lx), oz = c.hz - Math.abs(lz); if (ox < oz) { nx = Math.sign(lx || 1) * (ox + r); nz = 0; } else { nx = 0; nz = Math.sign(lz || 1) * (oz + r); } } x += nx * cs - nz * sn; z += nx * sn + nz * cs; }
      }
    });
    return [x, z];
  }
  blocked(x, z, r) { let b = false; this.near(x, z, r + 1, c => { if (b) return; if (c.t === 'c') { if (Math.hypot(x - c.x, z - c.z) < r + c.r) b = true; } else { const cs = Math.cos(c.yaw || 0), sn = Math.sin(c.yaw || 0), dx = x - c.x, dz = z - c.z, lx = dx * cs + dz * sn, lz = -dx * sn + dz * cs; if (Math.abs(lx) < c.hx + r && Math.abs(lz) < c.hz + r) b = true; } }); return b; }
  // проста перевірка видимості по відрізку (для ШІ): true якщо відрізок перетинає стіну/колону високого типу
  ray(x0, z0, x1, z1, step = 1.0) { const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / step); for (let i = 1; i < n; i++) { const t = i / n; if (this.blocked(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, .05)) return true; } return false; }
}
