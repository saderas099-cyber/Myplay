import { ITEMS, RARITY, PHOTO, SHOP, LOOT_PER_DAY, DIG_SPOTS } from './data.js';
import { rng } from './util.js';

export const KINDS = ['junk', 'scrap', 'nature', 'paint', 'relic', 'tool', 'medkit', 'photo', 'chest'];
export function marketFor(seed, day) {
  const R = rng(seed * 31 + day * 977), m = {}; for (const k of KINDS) m[k] = +(0.82 + R() * 0.46).toFixed(2);
  const hot = R.pick(['scrap', 'nature', 'relic', 'paint', 'tool']); m[hot] = +(m[hot] * 1.18).toFixed(2); m._hot = hot;
  const cold = R.pick(['scrap', 'nature', 'relic', 'paint', 'tool'].filter(k => k !== hot)); m[cold] = +(m[cold] * .82).toFixed(2); m._cold = cold; return m;
}
export const unitValue = (it, diff, market) => Math.round(it.val * diff.priceMul * (market?.[ITEMS[it.id]?.kind] ?? 1));
export const shopPrice = (e, diff) => e.id === 'revive' ? diff.reviveCost : Math.max(5, Math.round(e.price * diff.shopMul / 5) * 5);

function gasLiters(R) { const r = R(); return r < .3 ? .5 : r < .65 ? 1 : r < .87 ? 1.5 : r < .95 ? 2 : r < .98 ? 3 : 5; }
let UID = 1;
export const nextUid = (tag = 'i') => tag + (UID++) + Math.random().toString(36).slice(2, 5);
export function rollLoot(R, world, diff, day, rareSpawn = 1, existing = []) {
  const out = [], count = Math.round(LOOT_PER_DAY * diff.lootMul), defs = Object.entries(ITEMS).filter(([id, d]) => d.wt > 0);
  const rareMul = diff.rareMul * rareSpawn, wf = ([id, d]) => d.wt * (d.r === 'rare' ? rareMul : d.r === 'epic' ? rareMul * rareMul : 1);
  const ground = world.groundSpots || [], structs = world.lootSpots.filter(s => s.kind === 'struct'), bushes = world.lootSpots.filter(s => s.kind === 'bush');
  const used = existing.map(i => ({ x: i.x, z: i.z })); const tooNear = (x, z) => used.some(u => Math.hypot(u.x - x, u.z - z) < 1.4);
  const add = (id, sp, extra = {}) => { if (!sp || tooNear(sp.x, sp.z)) return false; used.push({ x: sp.x, z: sp.z }); const d = ITEMS[id]; out.push({ u: nextUid(), id, x: sp.x + (R() - .5) * .3, y: sp.y, z: sp.z + (R() - .5) * .3, val: Math.round((d.v || 0) * (.85 + R() * .3)), lit: 0, ...extra }); return true; };
  let tries = 0;
  while (out.length < count && tries < count * 6) {
    tries++; const roll = R(); let sp, pool = defs;
    if (roll < .22 && structs.length) { sp = R.pick(structs); const st = defs.filter(([id, d]) => d.r !== 'common' || d.kind === 'scrap'); pool = st; }
    else if (roll < .3 && bushes.length) { sp = R.pick(bushes); pool = defs.filter(([id, d]) => d.kind === 'nature'); }
    else sp = R.pick(ground); if (!sp) continue;
    const [id] = R.weighted(pool, wf); add(id, sp);
  }
  // каністри бензину та дизелю
  let cans = 0; const mean = 1.6 * diff.fuelItemChance; while (R() < mean / (mean + 1) * (cans < 1 ? 1.3 : 1) && cans < 4) { cans++; const sp = R() < .35 && structs.length ? R.pick(structs) : R.pick(ground); const l = gasLiters(R); add('gascan', sp, { lit: l, val: 0 }); }
  if (R() < .45 * diff.fuelItemChance) add('gen_fuel', R.pick(ground), { lit: R() < .7 ? 1 : 2.5 });
  return out;
}
export function rollDigs(R, world) { const res = []; for (let i = 0; i < DIG_SPOTS; i++) { const sp = R.pick(world.groundSpots); if (sp) res.push({ x: sp.x, z: sp.z, y: sp.y, done: false }); } return res; }
export function digReward(R, diff) {
  const r = R(); if (r < .5) return [{ id: 'chest', val: Math.round((140 + R() * 330) * diff.priceMul) }];
  if (r < .8) return [{ id: R.pick(['coin', 'spoon', 'clock']), val: 0 }, { id: 'coin', val: 0 }];
  return [{ id: R.pick(['brooch', 'icon', 'samovar']), val: 0 }];
}
