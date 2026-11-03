// Мультиплеєр через WebRTC (PeerJS): працює між Wi‑Fi та 4G. Хост авторитетний, клієнти шлють команди.
import { Peer } from 'peerjs';

const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' }, { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' }, { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }] };
const PFX = 'dlforest-', DIR = PFX + 'directory-v1';
const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const genCode = () => Array.from({ length: 5 }, () => ABC[Math.floor(Math.random() * ABC.length)]).join('');

class Net {
  constructor() { this.role = 'solo'; this.peer = null; this.conns = new Map(); this.hostConn = null; this.onMsg = () => { }; this.onJoin = () => { }; this.onLeave = () => { }; this.onClose = () => { }; this.code = ''; this.myId = 'host'; this.nextPid = 1; this.dirLobbies = new Map(); this.dirPeer = null; this.regTimer = null; }
  get online() { return this.role !== 'solo'; }
  // ---- хост ----
  host(code, info) {
    return new Promise((res, rej) => {
      this.role = 'host'; this.code = code; this.myId = 'p0'; const peer = this.peer = new Peer(PFX + code, { config: ICE, debug: 0 });
      peer.on('open', () => res(code)); peer.on('error', e => { if (e.type === 'unavailable-id') rej(new Error('code')); else rej(e); });
      peer.on('connection', conn => {
        conn.on('open', () => { const pid = 'p' + (this.nextPid++); conn._pid = pid; this.conns.set(pid, conn); conn.send({ t: 'welcome', pid }); this.onJoin(pid, conn); });
        conn.on('data', d => { if (conn._pid) this.onMsg(conn._pid, d); });
        conn.on('close', () => { if (conn._pid) { this.conns.delete(conn._pid); this.onLeave(conn._pid); } });
        conn.on('error', () => { });
      });
    });
  }
  // ---- клієнт ----
  join(code) {
    return new Promise((res, rej) => {
      this.role = 'client'; this.code = code; const peer = this.peer = new Peer({ config: ICE, debug: 0 }); let done = false;
      const fail = e => { if (!done) { done = true; rej(e); } };
      peer.on('error', e => fail(e)); setTimeout(() => fail(new Error('timeout')), 15000);
      peer.on('open', () => {
        const c = this.hostConn = peer.connect(PFX + code, { reliable: true, serialization: 'json' });
        c.on('open', () => { });
        c.on('data', d => { if (d.t === 'welcome') { this.myId = d.pid; if (!done) { done = true; res(d.pid); } } else this.onMsg('host', d); });
        c.on('close', () => { this.onClose(); }); c.on('error', fail);
      });
    });
  }
  send(msg) { if (this.role === 'host') for (const c of this.conns.values()) { try { c.send(msg); } catch (e) { } } else if (this.hostConn && this.hostConn.open) this.hostConn.send(msg); }
  sendTo(pid, msg) { const c = this.conns.get(pid); if (c && c.open) c.send(msg); }
  kick(pid) { const c = this.conns.get(pid); if (c) c.close(); }
  close() { clearInterval(this.regTimer); try { this.peer && this.peer.destroy(); } catch (e) { } try { this.dirPeer && this.dirPeer.destroy(); } catch (e) { } this.peer = null; this.dirPeer = null; this.conns.clear(); this.hostConn = null; this.role = 'solo'; }
  // ---- каталог публічних лобі (без сервера: перший хост стає каталогом) ----
  async listLobbies() {
    return new Promise(res => {
      const p = new Peer({ config: ICE, debug: 0 }); let done = false; const fin = l => { if (!done) { done = true; try { p.destroy(); } catch (e) { } res(l); } };
      setTimeout(() => fin([]), 5000); p.on('error', () => fin([]));
      p.on('open', () => { const c = p.connect(DIR, { reliable: true, serialization: 'json' }); c.on('open', () => c.send({ t: 'list' })); c.on('data', d => { if (d.t === 'lobbies') fin(d.list); }); c.on('error', () => fin([])); });
    });
  }
  registerPublic(infoFn) {
    const push = () => {
      const info = infoFn(); if (!info) return;
      if (this.dirPeer) { this.dirLobbies.set(info.code, { ...info, ts: Date.now() }); return; }
      const p = new Peer({ config: ICE, debug: 0 }); p.on('error', () => { try { p.destroy(); } catch (e) { } this.tryBecomeDir(infoFn); });
      p.on('open', () => { const c = p.connect(DIR, { reliable: true, serialization: 'json' }); c.on('open', () => { c.send({ t: 'reg', info }); setTimeout(() => { try { p.destroy(); } catch (e) { } }, 1500); }); c.on('error', () => { try { p.destroy(); } catch (e) { } this.tryBecomeDir(infoFn); }); });
    };
    push(); this.regTimer = setInterval(push, 9000);
  }
  tryBecomeDir(infoFn) {
    if (this.dirPeer || this._becoming) return; this._becoming = true;
    const p = new Peer(DIR, { config: ICE, debug: 0 }); p.on('error', () => { this._becoming = false; try { p.destroy(); } catch (e) { } });
    p.on('open', () => { this.dirPeer = p; this._becoming = false; const i = infoFn(); if (i) this.dirLobbies.set(i.code, { ...i, ts: Date.now() }); });
    p.on('connection', c => { c.on('data', d => { const now = Date.now(); for (const [k, v] of this.dirLobbies) if (now - v.ts > 25000) this.dirLobbies.delete(k); if (d.t === 'reg') this.dirLobbies.set(d.info.code, { ...d.info, ts: now }); else if (d.t === 'list') c.send({ t: 'lobbies', list: [...this.dirLobbies.values()] }); }); });
  }
}
export const net = new Net();
