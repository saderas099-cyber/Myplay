// Процедурний реалістичний звук (без «космічних» синтезаторних писків): шум, фільтри, струнні, дихання лісу.
import { S } from './settings.js';
import { clamp, rr, TAU } from './util.js';

class AudioEngine {
  constructor() { this.ctx = null; this.loops = {}; this.musicOn = false; this.lastStep = 0; }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain();
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(c.destination);
    this.sfx = c.createGain(); this.amb = c.createGain(); this.mus = c.createGain();
    this.sfx.connect(this.master); this.amb.connect(this.master); this.mus.connect(this.master);
    // реверб (імпульс із затухаючого шуму)
    this.rev = c.createConvolver(); this.rev.buffer = this._impulse(2.2, 2.6);
    this.revGain = c.createGain(); this.revGain.gain.value = 0.22; this.rev.connect(this.revGain); this.revGain.connect(this.master);
    this.sfx.connect(this.rev);
    this.white = this._noise('white'); this.pink = this._noise('pink'); this.brown = this._noise('brown');
    this.applyVolumes();
    this._plucks = {};
  }
  applyVolumes() { if (!this.ctx) return; this.master.gain.value = S.master; this.sfx.gain.value = S.sfx; this.amb.gain.value = S.ambience; this.mus.gain.value = S.music * 0.5; }
  _impulse(sec, decay) { const c = this.ctx, n = c.sampleRate * sec | 0, b = c.createBuffer(2, n, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); } return b; }
  _noise(type) {
    const c = this.ctx, n = c.sampleRate * 3, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    let l = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'white') d[i] = w;
      else if (type === 'brown') { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; }
      else { b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; }
    }
    return b;
  }
  setListener(p, yaw) {
    if (!this.ctx) return; const l = this.ctx.listener;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    if (l.positionX) { l.positionX.value = p.x; l.positionY.value = p.y; l.positionZ.value = p.z; l.forwardX.value = fx; l.forwardY.value = 0; l.forwardZ.value = fz; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0; }
    else { l.setPosition(p.x, p.y, p.z); l.setOrientation(fx, 0, fz, 0, 1, 0); }
  }
  _out(pos, vol = 1, bus) {
    const c = this.ctx, g = c.createGain(); g.gain.value = vol;
    if (pos) { const p = c.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 3; p.rolloffFactor = 1.3; p.maxDistance = 120; p.positionX ? (p.positionX.value = pos.x, p.positionY.value = pos.y, p.positionZ.value = pos.z) : p.setPosition(pos.x, pos.y, pos.z); g.connect(p); p.connect(bus || this.sfx); }
    else g.connect(bus || this.sfx);
    return g;
  }
  _burst(out, { type = 'white', f = 1000, q = 1, ft = 'bandpass', dur = 0.1, att = 0.003, vol = 1, t0 = 0, rate = 1 }) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this[type]; s.playbackRate.value = rate; s.loop = false;
    const fl = c.createBiquadFilter(); fl.type = ft; fl.frequency.value = f; fl.Q.value = q;
    const g = c.createGain(); const t = c.currentTime + t0;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random() * 2); s.stop(t + dur + 0.05); return { fl, g, t };
  }
  _tone(out, { type = 'sine', f = 100, f2 = null, dur = 0.2, vol = 1, att = 0.005, t0 = 0, lp = 0 }) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime + t0; o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let n = o; if (lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); n = fl; }
    n.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05); return o;
  }
  play(name, o = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const vol = (o.vol ?? 1), out = this._out(o.pos, vol);
    const fn = this['s_' + name]; if (fn) fn.call(this, out, o);
  }
  // ---------- одноразові звуки ----------
  s_step(out, o) {
    const sf = o.surface || 'grass', r = rr(0.9, 1.1);
    if (sf === 'grass') { this._burst(out, { f: 900 * r, q: 0.6, dur: 0.12, vol: 0.5, ft: 'bandpass', type: 'pink' }); this._burst(out, { f: 220, ft: 'lowpass', dur: 0.09, vol: 0.5, type: 'brown' }); }
    else if (sf === 'wood') { this._burst(out, { f: 380 * r, q: 1.5, dur: 0.1, vol: 0.9 }); this._tone(out, { f: 110 * r, f2: 70, dur: 0.12, vol: 0.5 }); }
    else if (sf === 'road') { this._burst(out, { f: 2200 * r, q: 0.8, dur: 0.06, vol: 0.5 }); this._burst(out, { f: 300, ft: 'lowpass', dur: 0.07, vol: 0.4, type: 'brown' }); }
    else if (sf === 'metal') { this._burst(out, { f: 1800 * r, q: 4, dur: 0.14, vol: 0.5 }); this._tone(out, { f: 640 * r, dur: 0.15, vol: 0.12 }); }
    else { this._burst(out, { f: 600 * r, q: 0.7, dur: 0.1, vol: 0.6, type: 'pink' }); this._burst(out, { f: 160, ft: 'lowpass', dur: 0.1, vol: 0.5, type: 'brown' }); }
  }
  s_pickup(out) { this._burst(out, { f: 1800, q: 0.5, dur: 0.14, vol: 0.5, type: 'pink' }); this._burst(out, { f: 600, q: 0.5, dur: 0.1, vol: 0.4, t0: 0.05, type: 'pink' }); }
  s_drop(out) { this._burst(out, { f: 250, ft: 'lowpass', dur: 0.14, vol: 0.9, type: 'brown' }); this._burst(out, { f: 900, q: 1, dur: 0.06, vol: 0.4 }); }
  s_door(out) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.pink; const fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 14; const g = c.createGain(); const t = c.currentTime;
    fl.frequency.setValueAtTime(260, t); fl.frequency.linearRampToValueAtTime(520, t + 0.6); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.55, t + 0.12); g.gain.linearRampToValueAtTime(0.0001, t + 0.7);
    const lf = c.createOscillator(), lg = c.createGain(); lf.frequency.value = 17; lg.gain.value = 40; lf.connect(lg); lg.connect(fl.frequency); lf.start(t); lf.stop(t + 0.8);
    s.connect(fl); fl.connect(g); g.connect(out); s.start(t, 0.3); s.stop(t + 0.8);
    this._burst(out, { f: 140, ft: 'lowpass', dur: 0.1, vol: 0.5, t0: 0.65, type: 'brown' });
  }
  s_doorclose(out) { this._burst(out, { f: 180, ft: 'lowpass', dur: 0.25, vol: 1.1, type: 'brown' }); this._burst(out, { f: 1100, q: 2, dur: 0.05, vol: 0.5, t0: 0.01 }); }
  s_cardoor(out) { this._burst(out, { f: 200, ft: 'lowpass', dur: 0.2, vol: 1.1, type: 'brown' }); this._burst(out, { f: 2400, q: 3, dur: 0.04, vol: 0.5, t0: 0.12 }); this._burst(out, { f: 1200, q: 4, dur: 0.1, vol: 0.4, t0: 0.02 }); }
  s_gunshot(out, o) {
    const k = o.kind || 'revolver', big = k === 'deagle' ? 1.3 : k === 'shotgun' ? 1.5 : 1;
    this._burst(out, { f: 3000, ft: 'highpass', q: 0.5, dur: 0.12 * big, vol: 1.2, att: 0.001 });
    this._burst(out, { f: 400, ft: 'lowpass', dur: 0.45 * big, vol: 1.3, att: 0.002, type: 'brown' });
    this._tone(out, { f: 120 / big, f2: 35, dur: 0.35, vol: 1.1, att: 0.001 });
    if (k === 'shotgun') this._burst(out, { f: 1200, q: 0.5, dur: 0.3, vol: 0.5, t0: 0.02, type: 'pink' });
  }
  s_click(out) { this._burst(out, { f: 3500, q: 2, dur: 0.03, vol: 0.5 }); this._burst(out, { f: 1800, q: 2, dur: 0.03, vol: 0.4, t0: 0.05 }); }
  s_shutter(out) { this._burst(out, { f: 2600, q: 3, dur: 0.025, vol: 0.7 }); this._burst(out, { f: 1400, q: 3, dur: 0.04, vol: 0.6, t0: 0.07 }); }
  s_dig(out) { this._burst(out, { f: 900, q: 0.5, dur: 0.35, vol: 0.6, type: 'pink' }); this._burst(out, { f: 130, ft: 'lowpass', dur: 0.2, vol: 0.8, t0: 0.25, type: 'brown' }); }
  s_snap(out) { this._burst(out, { f: 2200, q: 1.5, dur: 0.05, vol: 0.9 }); this._burst(out, { f: 600, q: 1, dur: 0.1, vol: 0.5, t0: 0.02 }); }
  s_rustle(out) { for (let i = 0; i < 5; i++) this._burst(out, { f: rr(1200, 3200), q: 0.7, dur: 0.07, vol: 0.4, t0: i * 0.05, type: 'pink' }); }
  s_hit(out) { this._burst(out, { f: 160, ft: 'lowpass', dur: 0.2, vol: 1.2, type: 'brown' }); this._burst(out, { f: 800, q: 1, dur: 0.06, vol: 0.5 }); }
  s_hurt(out) { const t = this._tone(out, { type: 'sawtooth', f: 190, f2: 120, dur: 0.35, vol: 0.45, lp: 900 }); this._burst(out, { f: 700, q: 2, dur: 0.25, vol: 0.4, type: 'pink' }); }
  s_heart(out) { this._tone(out, { f: 62, f2: 45, dur: 0.14, vol: 1.2 }); this._tone(out, { f: 55, f2: 40, dur: 0.16, vol: 0.9, t0: 0.19 }); }
  s_cash(out) { this._burst(out, { f: 300, ft: 'lowpass', dur: 0.12, vol: 0.9, type: 'brown' }); this._tone(out, { f: 2500, dur: 0.9, vol: 0.28, t0: 0.08 }); this._tone(out, { f: 3730, dur: 0.7, vol: 0.14, t0: 0.08 }); }
  s_bell(out) { // механічний будильник
    const c = this.ctx, t = c.currentTime;
    for (let i = 0; i < 18; i++) { this._tone(out, { f: 2050, dur: 0.04, vol: 0.35, t0: i * 0.065 }); this._tone(out, { f: 2690, dur: 0.04, vol: 0.2, t0: i * 0.065 }); }
  }
  s_tick(out) { this._burst(out, { f: 1400, q: 5, dur: 0.03, vol: 0.5 }); this._burst(out, { f: 900, q: 5, dur: 0.03, vol: 0.4, t0: 0.5 }); }
  s_thunder(out) { this._burst(out, { f: 3000, ft: 'highpass', dur: 0.15, vol: 0.6, type: 'white' }); this._burst(out, { f: 220, ft: 'lowpass', dur: 4.5, att: 0.3, vol: 1.6, t0: 0.2, type: 'brown' }); this._burst(out, { f: 90, ft: 'lowpass', dur: 5, att: 0.6, vol: 1.2, t0: 0.5, type: 'brown' }); }
  s_hoot(out) { const t0 = [0, 0.45, 0.9, 1.6]; t0.forEach((t, i) => this._tone(out, { f: 360, f2: 330, dur: i === 3 ? 0.5 : 0.28, vol: 0.28, att: 0.06, t0: t, lp: 700 })); }
  s_flare(out) { this._burst(out, { f: 2500, q: 0.4, dur: 1.6, vol: 0.4, att: 0.05, type: 'white' }); }
  s_pour(out) { this._burst(out, { f: 1500, q: 0.8, dur: 1.4, vol: 0.4, att: 0.1, type: 'pink' }); this._burst(out, { f: 400, q: 2, dur: 1.4, vol: 0.25, att: 0.1, type: 'pink' }); }
  s_engine_start(out) {
    const c = this.ctx, t = c.currentTime; for (let i = 0; i < 4; i++) this._burst(out, { f: 160, ft: 'lowpass', dur: 0.22, vol: 0.9, t0: i * 0.26, type: 'brown' });
    this._tone(out, { type: 'sawtooth', f: 38, f2: 52, dur: 1.1, vol: 0.3, t0: 1.0, lp: 380 });
  }
  s_growl(out, o) {
    const m = MON_VOICE[o.mon] || MON_VOICE.wolf, c = this.ctx, t = c.currentTime, dur = o.dur || 1.2;
    const osc = c.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(m.f, t); osc.frequency.linearRampToValueAtTime(m.f * m.glide, t + dur);
    const lf = c.createOscillator(), lg = c.createGain(); lf.frequency.value = m.rough; lg.gain.value = m.f * 0.35; lf.connect(lg); lg.connect(osc.frequency); lf.start(t); lf.stop(t + dur + 0.1);
    const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = m.f1; f1.Q.value = 3;
    const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = m.f2; f2.Q.value = 4;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.9, t + 0.15); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    osc.connect(f1); osc.connect(f2); f1.connect(g); f2.connect(g); g.connect(out); osc.start(t); osc.stop(t + dur + 0.1);
    this._burst(out, { f: m.f2, q: 1.2, dur, vol: 0.45, att: 0.1, type: 'pink' });
  }
  s_caw(out) { for (let i = 0; i < 3; i++) { this._tone(out, { type: 'sawtooth', f: 900, f2: 560, dur: 0.18, vol: 0.28, t0: i * 0.26, lp: 2500 }); this._burst(out, { f: 1500, q: 2, dur: 0.15, vol: 0.2, t0: i * 0.26 }); } }
  s_mumble(out) { for (let i = 0; i < 6; i++) { const f = rr(110, 170); this._tone(out, { type: 'sawtooth', f, f2: f * rr(0.85, 1.1), dur: rr(0.12, 0.22), vol: 0.3, t0: i * 0.24, lp: 700 }); } }
  s_knock(out) { for (let i = 0; i < 3; i++) this._burst(out, { f: 220, q: 2, dur: 0.09, vol: 1.1, t0: i * 0.22, type: 'brown' }); }
  s_wood(out) { this._burst(out, { f: 480, q: 3, dur: 0.2, vol: 0.8 }); this._tone(out, { f: 140, f2: 80, dur: 0.2, vol: 0.4 }); }
  s_swoosh(out) { this._burst(out, { f: 900, q: 0.6, dur: 0.25, att: 0.1, vol: 0.4, type: 'pink' }); }
  // ---------- петлі ----------
  loop(name, make) {
    if (!this.ctx) return null;
    if (this.loops[name]) return this.loops[name];
    const l = make(); this.loops[name] = l; return l;
  }
  _loopSrc(buf, bus, f, ft = 'lowpass', q = 0.7) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = buf; s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = ft; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0;
    s.connect(fl); fl.connect(g); g.connect(bus); s.start(0, Math.random() * 2); return { s, fl, g };
  }
  startAmbience() {
    if (!this.ctx) return;
    this.loop('wind', () => {
      const l = this._loopSrc(this.pink, this.amb, 500, 'bandpass', 0.5); const lf = this.ctx.createOscillator(), lg = this.ctx.createGain(); lf.frequency.value = 0.11; lg.gain.value = 180; lf.connect(lg); lg.connect(l.fl.frequency); lf.start(); l.lf = lf; return l;
    });
    this.loop('rain', () => this._loopSrc(this.white, this.amb, 4500, 'bandpass', 0.3));
    this.loop('raind', () => this._loopSrc(this.pink, this.amb, 1200, 'lowpass', 0.5));
    this.loop('crick', () => {
      const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), am = c.createOscillator(), ag = c.createGain(), mix = c.createGain();
      o.type = 'sine'; o.frequency.value = 4300; o2.type = 'sine'; o2.frequency.value = 4700; am.type = 'square'; am.frequency.value = 7.3; ag.gain.value = 0.5; g.gain.value = 0;
      mix.gain.value = 0.5; am.connect(ag); ag.connect(mix.gain); o.connect(mix); o2.connect(mix); mix.connect(g); g.connect(this.amb); o.start(); o2.start(); am.start(); return { g };
    });
    this.loop('hum', () => { // генератор
      const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain(), lf = c.createOscillator(), lg = c.createGain();
      o.type = 'sawtooth'; o.frequency.value = 46; o2.type = 'square'; o2.frequency.value = 92; fl.type = 'lowpass'; fl.frequency.value = 520; lf.frequency.value = 11; lg.gain.value = 8; lf.connect(lg); lg.connect(o.frequency); g.gain.value = 0;
      const pg = c.createGain(); pg.gain.value = 0.5; o.connect(fl); o2.connect(pg); pg.connect(fl); fl.connect(g); const pos = this._out(null, 1, this.amb); g.connect(pos); o.start(); o2.start(); lf.start();
      const n = this._loopSrc(this.brown, this.amb, 500, 'lowpass'); return { g, n, o, o2, pan: null };
    });
    this.loop('engine', () => {
      const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = 40; o2.type = 'square'; o2.frequency.value = 80;
      fl.type = 'lowpass'; fl.frequency.value = 420; g.gain.value = 0; const pg = c.createGain(); pg.gain.value = 0.4; o.connect(fl); o2.connect(pg); pg.connect(fl); fl.connect(g); g.connect(this.amb); o.start(); o2.start();
      const n = this._loopSrc(this.brown, this.amb, 300, 'lowpass'); return { g, o, o2, fl, n };
    });
    this.loop('tense', () => this._loopSrc(this.brown, this.amb, 120, 'lowpass', 0.5));
  }
  setAmb({ wind = 0.2, rain = 0, night = 0, gen = 0, engine = 0, rpm = 0, tense = 0 }) {
    if (!this.ctx) return; const L = this.loops, t = this.ctx.currentTime;
    if (!L.wind) return;
    L.wind.g.gain.setTargetAtTime(0.18 * wind, t, 0.8);
    L.rain.g.gain.setTargetAtTime(0.28 * rain, t, 0.6); L.raind.g.gain.setTargetAtTime(0.35 * rain, t, 0.6);
    L.crick.g.gain.setTargetAtTime(0.05 * night * (1 - rain), t, 1.2);
    L.hum.g.gain.setTargetAtTime(0.12 * gen, t, 0.3); L.hum.n.g.gain.setTargetAtTime(0.2 * gen, t, 0.3);
    L.engine.g.gain.setTargetAtTime(0.28 * engine, t, 0.2); L.engine.n.g.gain.setTargetAtTime(0.4 * engine, t, 0.2);
    L.engine.o.frequency.setTargetAtTime(38 + rpm * 70, t, 0.15); L.engine.o2.frequency.setTargetAtTime(76 + rpm * 140, t, 0.15); L.engine.fl.frequency.setTargetAtTime(380 + rpm * 700, t, 0.15);
    L.tense.g.gain.setTargetAtTime(0.35 * tense, t, 1.5);
  }
  // ---------- музика: акустична гітара (Karplus-Strong) ----------
  _pluck(freq) {
    const c = this.ctx, key = freq.toFixed(1); if (this._plucks[key]) return this._plucks[key];
    const sr = c.sampleRate, n = sr * 2.4 | 0, buf = c.createBuffer(1, n, sr), d = buf.getChannelData(0), N = Math.round(sr / freq), ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    let idx = 0, prev = 0; for (let i = 0; i < n; i++) { const cur = ring[idx], nxt = ring[(idx + 1) % N]; ring[idx] = (cur + nxt) * 0.4985; d[i] = cur * Math.exp(-i / (sr * 1.6)); idx = (idx + 1) % N; }
    return this._plucks[key] = buf;
  }
  playPluck(freq, vol = 0.5, t0 = 0) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this._pluck(freq); const g = c.createGain(); g.gain.value = vol; const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 3200;
    s.connect(fl); fl.connect(g); g.connect(this.mus); const rg = c.createGain(); rg.gain.value = 0.4; g.connect(rg); rg.connect(this.rev); s.start(c.currentTime + t0);
  }
  startMusic(mood = 'menu') {
    if (!this.ctx) return; this.stopMusic(); this.musicOn = true; this.mood = mood;
    const A = 110, notes = { A2: 110, C3: 130.8, D3: 146.8, E3: 164.8, G3: 196, A3: 220, C4: 261.6, D4: 293.7, E4: 329.6, G4: 392 };
    const prog = [['A2', 'E3', 'A3', 'C4', 'E4'], ['G3', 'D3', 'G3', 'D4', 'G4'], ['D3', 'A3', 'D4', 'E4', 'A3'], ['E3', 'G3', 'E4', 'D4', 'C4']];
    let step = 0;
    const tick = () => {
      if (!this.musicOn) return;
      const ch = prog[Math.floor(step / 8) % prog.length], n = ch[[0, 2, 3, 1, 4, 3, 2, 1][step % 8]];
      this.playPluck(notes[n], 0.32 * (step % 4 === 0 ? 1.2 : 0.8));
      step++; this._mt = setTimeout(tick, mood === 'menu' ? 560 : 780);
    };
    tick();
  }
  stopMusic() { this.musicOn = false; clearTimeout(this._mt); }
}
const MON_VOICE = {
  wolf: { f: 130, glide: 0.7, rough: 24, f1: 500, f2: 1400 }, creaker: { f: 70, glide: 1.4, rough: 9, f1: 300, f2: 900 }, shade: { f: 200, glide: 0.5, rough: 40, f1: 800, f2: 2200 },
  hound: { f: 160, glide: 0.8, rough: 30, f1: 600, f2: 1600 }, spider: { f: 400, glide: 0.6, rough: 60, f1: 1500, f2: 3500 }, bear: { f: 60, glide: 0.8, rough: 18, f1: 280, f2: 700 },
  scarecrow: { f: 120, glide: 1.1, rough: 7, f1: 400, f2: 1200 }, collector: { f: 95, glide: 1.1, rough: 5, f1: 450, f2: 1100 }, granny: { f: 260, glide: 1.3, rough: 8, f1: 900, f2: 2400 },
  crows: { f: 700, glide: 0.8, rough: 50, f1: 1500, f2: 3000 }, swamp: { f: 55, glide: 0.7, rough: 14, f1: 250, f2: 800 }, antlers: { f: 85, glide: 0.5, rough: 12, f1: 350, f2: 1000 },
};
export const audio = new AudioEngine();
