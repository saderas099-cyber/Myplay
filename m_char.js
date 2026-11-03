import { THREE, B, RB, C, S, G, rot, V3 } from './geo.js';
import { M, P } from './mats.js';
import { faceTex } from './tex.js';
import { COSMETICS, SKIN_TONES, HAIR_COLORS } from './data.js';

const col = (slot, id) => (COSMETICS[slot].find(c => c.id === id) || COSMETICS[slot][0]).color;

export function buildAvatar(p, opts = {}) {
  const f = p.gender === 'f', skinHex = SKIN_TONES[p.skin % SKIN_TONES.length], hairHex = HAIR_COLORS[p.hairColor % HAIR_COLORS.length];
  const skin = new THREE.MeshStandardMaterial({ color: skinHex, roughness: .6 });
  const topC = col('top', p.outfit.top), botC = col('bottom', p.outfit.bottom), shoeC = col('shoes', p.outfit.shoes);
  const top = M('fabric', { color: topC, rough: .9 }), bot = P(botC, { rough: .85 }), shoe = P(shoeC, { rough: .8 }), hair = P(hairHex, { rough: .55 });
  const root = new THREE.Group(), model = new THREE.Group(); root.add(model);
  const hs = .93 + p.height * .14; model.scale.setScalar(hs);
  const sw = f ? .9 : 1.0, hipS = .92 + p.hips * .2 + (f ? .06 : 0), chS = .94 + p.chest * .18;
  // ноги
  const mkLeg = s => {
    const hip = new THREE.Group(); hip.position.set(s * .1 * hipS, .92, 0);
    hip.add(RB(.15 * hipS, .46, .17 * hipS, .05, bot, 0, -.2, 0));
    const knee = new THREE.Group(); knee.position.y = -.43; knee.add(RB(.125, .44, .14, .04, bot, 0, -.2, 0));
    const boot = p.outfit.shoes === 'boots' || p.outfit.shoes === 'rubber';
    knee.add(RB(.14, .1 + (boot ? .12 : 0), .26, .04, shoe, 0, -.44 + (boot ? .05 : 0), -.04)); hip.add(knee); hip.userData.knee = knee; return hip;
  };
  const legL = mkLeg(-1), legR = mkLeg(1); model.add(legL, legR);
  // тулуб
  const torso = new THREE.Group(); torso.position.y = .92; model.add(torso);
  const long = p.outfit.top === 'raincoat' || p.outfit.top === 'suit';
  torso.add(RB(.4 * sw * chS, .6, .22, .08, top, 0, .3, 0)); torso.add(RB(.34 * hipS, .14 + (long ? .22 : 0), .22 * hipS, .05, top, 0, .02 - (long ? .1 : 0), 0));
  if (f) for (const s of [-1, 1]) torso.add(S(.075 * chS, top, s * .08, .42, -.09, 1, 1, .8));
  if (p.outfit.top === 'hoodie_blk' || p.outfit.hat === 'hood') torso.add(RB(.3, .12, .12, .05, top, 0, .58, .1));
  if (p.outfit.top === 'flannel') { torso.add(B(.012, .5, .01, P(0x121212), 0, .3, -.115)); }
  if (p.outfit.top === 'suit') { torso.add(B(.08, .4, .01, P(0xe6e6e6), 0, .36, -.116), B(.03, .26, .01, P(0x7a1a1a), 0, .34, -.12)); }
  const neck = C(.045, .05, .1, 10, skin, 0, .64, 0); torso.add(neck);
  // руки
  const mkArm = s => {
    const sh = new THREE.Group(); sh.position.set(s * (.215 * sw * chS + .02), .55, 0);
    sh.add(S(.065, top, 0, 0, 0)); sh.add(RB(.095, .3, .1, .04, top, 0, -.14, 0));
    const el = new THREE.Group(); el.position.y = -.29; el.add(RB(.085, .28, .09, .035, p.outfit.top === 'tee_gray' ? skin : top, 0, -.13, 0)); el.add(S(.052, skin, 0, -.29, 0));
    sh.add(el); sh.userData.elbow = el; return sh;
  };
  const armL = mkArm(-1), armR = mkArm(1); torso.add(armL, armR);
  const hand = new THREE.Group(); hand.position.set(0, -.3, -.03); armR.userData.elbow.add(hand);
  // голова
  const head = new THREE.Group(); head.position.y = .76; torso.add(head);
  const hr = .12 + (f ? -.004 : .004); head.add(S(hr, skin, 0, .06, 0, 1, 1.1, 1.02));
  const face = new THREE.Mesh(new THREE.SphereGeometry(hr * 1.006, 24, 16, Math.PI * 1.5 - .85, 1.7, Math.PI / 2 - .8, 1.55), new THREE.MeshStandardMaterial({ map: faceTex(skinHex, p.gender, p.face), roughness: .6, polygonOffset: true, polygonOffsetFactor: -1 }));
  face.scale.set(1, 1.1, 1.02); face.position.y = .06; head.add(face);
  head.add(S(.02, skin, 0, .04, -hr * 1.04, 1, 1, 1.3), S(.026, skin, -hr * .97, .06, 0, .5, 1.2, 1), S(.026, skin, hr * .97, .06, 0, .5, 1.2, 1));
  // волосся
  const hairStyle = p.hair % 4, hat = p.outfit.hat;
  if (hat !== 'beanie' && hat !== 'hood') {
    const cap = S(hr * 1.06, hair, 0, .09, .01, 1, 1.05, 1.04); head.add(cap);
    if (f) {
      if (hairStyle === 0) { head.add(rot(C(.03, .018, .3, 8, hair, 0, -.02, .14), .3, 0, 0), S(.04, hair, 0, .12, .13)); }
      else if (hairStyle === 1) { head.add(RB(.28, .2, .06, .03, hair, 0, .0, .1), RB(.04, .18, .2, .02, hair, -.12, 0, .02), RB(.04, .18, .2, .02, hair, .12, 0, .02)); }
      else if (hairStyle === 2) { head.add(RB(.3, .5, .08, .04, hair, 0, -.12, .1), RB(.05, .4, .16, .03, hair, -.13, -.08, .04), RB(.05, .4, .16, .03, hair, .13, -.08, .04)); }
      else { head.add(S(.07, hair, 0, .2, .06)); }
    } else {
      if (hairStyle === 1) head.add(RB(.26, .08, .08, .03, hair, 0, .16, -.06));
      else if (hairStyle === 2) { cap.scale.set(1, .85, 1); }
      else if (hairStyle === 3) { cap.visible = false; head.add(S(hr * 1.02, hair, 0, .09, .05, 1, .6, .7)); }
      else head.add(RB(.26, .06, .26, .03, hair, 0, .17, 0));
    }
  }
  if (hat === 'cap_red') { head.add(S(hr * 1.12, P(col('hat', hat)), 0, .1, .01, 1, .8, 1.05), B(.2, .015, .13, P(col('hat', hat)), 0, .1, -.16)); }
  else if (hat === 'beanie') { head.add(S(hr * 1.1, P(col('hat', hat), { rough: 1 }), 0, .1, .01, 1, 1.05, 1.05), S(.025, P(0xd9d9d9), 0, .24, 0)); }
  else if (hat === 'hunter') { head.add(C(.2, .2, .012, 22, P(col('hat', hat)), 0, .13, 0), C(.1, .12, .1, 16, P(col('hat', hat)), 0, .18, 0)); }
  else if (hat === 'hood') { head.add(S(hr * 1.2, P(col('hat', hat)), 0, .06, .05, 1, 1.05, 1.1)); }
  const fc = p.outfit.face;
  if (fc === 'glasses') { for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(.03, .004, 6, 16), P(0x111111)); r.position.set(s * .045, .075, -hr * 1.01); head.add(r); } head.add(B(.04, .004, .004, P(0x111111), 0, .08, -hr * 1.01)); }
  if (fc === 'mask') head.add(RB(.15, .08, .06, .03, P(0xe6eef0), 0, .005, -hr * .85));
  if (fc === 'scarf') { const sm = P(col('face', fc), { rough: 1 }), tr = new THREE.Mesh(new THREE.TorusGeometry(.085, .042, 8, 18), sm); tr.rotation.x = Math.PI / 2; tr.position.y = .62; torso.add(tr, RB(.07, .22, .03, .01, sm, 0.04, .5, -.12)); }
  // рюкзак
  if (opts.bag) torso.add(RB(.3, .38, .14, .05, P(0x3b4a32, { rough: .9 }), 0, .32, .17));
  const ud = root.userData; Object.assign(ud, { legL, legR, armL, armR, torso, head, hand, model, t: 0, hs });
  ud.setHeld = obj => { for (const c of [...hand.children]) hand.remove(c); if (obj) hand.add(obj); };
  ud.animate = (dt, speed = 0, o = {}) => {
    ud.t += dt * (2 + speed * 1.5); const w = Math.min(1, speed / 2.5), a = Math.sin(ud.t * 2.2) * .8 * w;
    if (o.seated) {
      const floor = o.seated === 'floor';
      legL.rotation.x = legR.rotation.x = floor ? 1.3 : 1.5; legL.userData.knee.rotation.x = legR.userData.knee.rotation.x = floor ? -1.5 : -1.5;
      if (floor) { legL.rotation.z = -.15; legR.rotation.z = .15; }
      armL.rotation.x = armR.rotation.x = o.drive ? -1.0 : -.4; armL.userData.elbow.rotation.x = armR.userData.elbow.rotation.x = o.drive ? -.6 : -.8;
      model.position.y = floor ? -.42 : -.34; torso.rotation.x = 0;
    } else {
      model.position.y = Math.abs(Math.sin(ud.t * 2.2)) * .02 * w; legL.rotation.x = a; legR.rotation.x = -a; legL.rotation.z = legR.rotation.z = 0;
      legL.userData.knee.rotation.x = Math.max(0, -a) * .8; legR.userData.knee.rotation.x = Math.max(0, a) * .8;
      armL.rotation.x = -a * .8; armR.rotation.x = o.hold ? -.9 : a * .8; armR.userData.elbow.rotation.x = o.hold ? -.7 : -Math.max(0, a) * .5; armL.userData.elbow.rotation.x = -Math.max(0, -a) * .5;
      torso.rotation.x = 0;
    }
    if (o.down) { model.rotation.x = -Math.PI / 2; model.position.y = .15; } else model.rotation.x = 0;
    head.rotation.x = o.pitch || 0;
  };
  root.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
  return root;
}
