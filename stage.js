import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { gfx, S } from './settings.js';
import { buildPickup } from './m_truck.js';
import { buildTreeSpecs } from './m_nature.js';
import { M } from './mats.js';
import { texClone } from './tex.js';
import { rng, TAU } from './util.js';

const FX = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vig: { value: .35 }, grain: { value: .035 }, quant: { value: 0 }, sat: { value: 1 }, dmg: { value: 0 }, dark: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time,vig,grain,quant,sat,dmg,dark; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
  void main(){ vec2 uv=vUv; vec3 c=texture2D(tDiffuse,uv).rgb; float l=dot(c,vec3(.299,.587,.114)); c=mix(vec3(l),c,sat);
    vec2 d=uv-.5; float v=1.-dot(d,d)*vig*2.2; c*=clamp(v,0.,1.);
    c+=(h(uv*vec2(1731.,911.)+time)-.5)*grain;
    c=mix(c,c*vec3(1.,.35,.3)+vec3(.18,0.,0.)*dot(d,d)*4.,dmg);
    if(quant>.5){ float b=h(floor(uv*vec2(320.,180.)))-.5; c=floor((c+b*.06)*10.+.5)/10.; }
    gl_FragColor=vec4(c*dark,1.); }`,
};
export class Stage {
  constructor(canvas) {
    this.canvas = canvas; const g = gfx();
    this.r = new THREE.WebGLRenderer({ canvas, antialias: !g.aa && g.scale >= .8, powerPreference: 'high-performance', alpha: false, stencil: false });
    this.r.outputColorSpace = THREE.SRGBColorSpace; this.r.toneMapping = THREE.ACESFilmicToneMapping; this.r.toneMappingExposure = 1;
    this.cam = new THREE.PerspectiveCamera(S.fov, 1, .08, 600); this.scene = null; this.fxOn = false; this.size();
    window.addEventListener('resize', () => this.size());
  }
  size() {
    const g = gfx(), w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, g.dpr) * g.scale;
    this.r.setPixelRatio(dpr); this.r.setSize(w, h, false); this.canvas.classList.toggle('pix', g.pix); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); this.w = w; this.h = h;
    this.r.shadowMap.enabled = g.shadows > 0; this.r.shadowMap.type = g.shadows > 1 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    if (this.composer) { this.composer.setPixelRatio(dpr); this.composer.setSize(w, h); }
  }
  setScene(scene) {
    this.scene = scene; const g = gfx(); const usePost = g.bloom || g.aa || S.grain || g.pix;
    if (!usePost) { this.composer = null; return; }
    const dpr = Math.min(devicePixelRatio || 1, g.dpr) * g.scale;
    const rt = new THREE.WebGLRenderTarget(this.w * dpr, this.h * dpr, { type: THREE.HalfFloatType, samples: g.aa ? 4 : 0 });
    this.composer = new EffectComposer(this.r, rt); this.composer.setPixelRatio(dpr); this.composer.setSize(this.w, this.h);
    this.rp = new RenderPass(scene, this.cam); this.composer.addPass(this.rp);
    if (g.bloom && S.bloom) { this.bloom = new UnrealBloomPass(new THREE.Vector2(this.w, this.h), g.ultra ? .45 : .3, .6, .88); this.composer.addPass(this.bloom); }
    this.composer.addPass(new OutputPass());
    this.fx = new ShaderPass(FX); this.fx.uniforms.quant.value = g.pix ? 1 : 0; this.fx.uniforms.grain.value = S.grain ? (g.pix ? .05 : .03) : 0; this.composer.addPass(this.fx);
  }
  render(dt, o = {}) {
    if (!this.scene) return; this.cam.fov = S.fov + (o.fovKick || 0); this.cam.updateProjectionMatrix();
    if (o.exposure != null) this.r.toneMappingExposure = o.exposure;
    if (this.composer) { this.rp.scene = this.scene; this.rp.camera = this.cam; if (this.fx) { this.fx.uniforms.time.value = performance.now() * .001 % 100; this.fx.uniforms.dmg.value = o.dmg || 0; this.fx.uniforms.sat.value = o.sat ?? 1; this.fx.uniforms.dark.value = o.dark ?? 1; } this.composer.render(dt); }
    else this.r.render(this.scene, this.cam);
  }
}

// ---------- сцена меню/лобі: пікап їде лісовою дорогою ----------
export class MenuScene {
  constructor(profile) {
    this.scene = new THREE.Scene(); const g = gfx(); const sc = this.scene;
    sc.background = new THREE.Color(0x9fb0b0); sc.fog = new THREE.FogExp2(0xa8b4b0, g.fog * 1.4);
    const hemi = new THREE.HemisphereLight(0xdfe8f0, 0x39402a, 1.0); sc.add(hemi); const sun = new THREE.DirectionalLight(0xffe6c0, 3.2); sun.position.set(-12, 16, 14); sun.castShadow = g.shadows > 0;
    if (g.shadows > 0) { sun.shadow.mapSize.set(Math.min(2048, g.shadowSize), Math.min(2048, g.shadowSize)); Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 60 }); sun.shadow.bias = -.0005; sun.shadow.normalBias = .04; }
    sc.add(sun, sun.target); this.sun = sun;
    // земля та дорога, що «біжать» назад
    const gt = texClone('grass', 30, 30), rt = texClone('asphalt', 40, 1.2);
    const gm = g.tex ? new THREE.MeshStandardMaterial({ map: gt.map, bumpMap: gt.bump, bumpScale: 2, color: 0xbfd0a0, roughness: 1 }) : new THREE.MeshLambertMaterial({ color: 0x4b6a2c });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), gm); ground.rotation.x = -Math.PI / 2; ground.position.y = -.02; ground.receiveShadow = true; sc.add(ground); this.gt = gt;
    const rm = g.tex ? new THREE.MeshStandardMaterial({ map: rt.map, bumpMap: rt.bump, bumpScale: 1, roughness: .9 }) : new THREE.MeshLambertMaterial({ color: 0x2a2a2c });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(300, 7), rm); road.rotation.x = -Math.PI / 2; road.receiveShadow = true; sc.add(road); this.rt = rt;
    this.dashes = []; const dm = new THREE.MeshStandardMaterial({ color: 0xd9b43a, roughness: .7 }), dg = new THREE.PlaneGeometry(2.6, .16); dg.rotateX(-Math.PI / 2);
    for (let i = 0; i < 40; i++) { const d = new THREE.Mesh(dg, dm); d.position.set(-100 + i * 5.5, .02, 0); sc.add(d); this.dashes.push(d); }
    // дерева по краях
    const specs = buildTreeSpecs(), R = rng(3); this.spec = specs; this.meshes = []; const N = g.tex ? 150 : 90; this.trees = [];
    for (let i = 0; i < N; i++) { const side = R() < .5 ? -1 : 1, sp = i % specs.length; this.trees.push({ x: -110 + R() * 220, z: side * (6 + R() * 40) + (side > 0 ? 0 : 0), s: .8 + R() * .6, r: R() * TAU, sp }); }
    specs.forEach((s, i) => { const cnt = this.trees.filter(t => t.sp === i).length; const tm = new THREE.InstancedMesh(s.trunkGeo, s.trunkMat, Math.max(1, cnt)), cm = s.crownGeo ? new THREE.InstancedMesh(s.crownGeo, s.crownMat, Math.max(1, cnt)) : null; for (const m of [tm, cm]) if (m) { m.frustumCulled = false; m.castShadow = g.shadows > 0; sc.add(m); } this.meshes.push({ tm, cm, list: this.trees.filter(t => t.sp === i) }); });
    this.o = new THREE.Object3D(); this.speed = 9; this.t = 0;
    this.truck = null; this.setTruck(profile); this.cam = new THREE.Vector3(5, 1.6, 6.5); this.look = new THREE.Vector3(.5, 1.0, 0); this.camMode = 'menu';
  }
  setTruck(profile) {
    if (this.truck) this.scene.remove(this.truck); const t = this.truck = buildPickup({ vehicle: profile.vehicle, paintId: profile.paint, decal: profile.decal }); t.rotation.y = -Math.PI / 2; t.position.set(0, 0, 0); this.scene.add(t);
    t.userData.setLights(false); this.sun.target = t;
  }
  update(dt, stage) {
    this.t += dt; const sp = this.speed, d = sp * dt; this.truck.userData.update(dt, sp); this.truck.position.y = Math.sin(this.t * 9) * .006; this.truck.rotation.z = Math.sin(this.t * 2.3) * .004;
    for (const dsh of this.dashes) { dsh.position.x -= d; if (dsh.position.x < -100) dsh.position.x += 220; }
    this.gt.map.offset.x += d / 10; this.gt.bump.offset.x += d / 10; this.rt.map.offset.x += d / 7.5; this.rt.bump.offset.x += d / 7.5;
    const o = this.o; for (const grp of this.meshes) { grp.list.forEach((t, i) => { t.x -= d; if (t.x < -110) t.x += 220; o.position.set(t.x, 0, t.z); o.rotation.set(0, t.r, 0); o.scale.setScalar(t.s); o.updateMatrix(); grp.tm.setMatrixAt(i, o.matrix); if (grp.cm) grp.cm.setMatrixAt(i, o.matrix); }); grp.tm.instanceMatrix.needsUpdate = true; if (grp.cm) grp.cm.instanceMatrix.needsUpdate = true; }
    const cam = stage.cam, sway = Math.sin(this.t * .5) * .25;
    if (this.camMode === 'menu') { this.tc = new THREE.Vector3(4.6 + sway, 1.55, 6.2); this.tl = new THREE.Vector3(.9, 1.0, 0); }
    else if (this.camMode === 'lobby') { this.tc = new THREE.Vector3(-3.2 + sway, 3.1, 5.6); this.tl = new THREE.Vector3(.2, 1.0, 0.3); }
    else if (this.camMode === 'fly') { this.tc = new THREE.Vector3(30, 1.8, 2.4); this.tl = new THREE.Vector3(60, 1.5, 0); }
    else if (this.camMode === 'intro') { this.tc = new THREE.Vector3(22, 2.0, 7.5); this.tl = new THREE.Vector3(6, 1.0, 0); }
    const k = Math.min(1, dt * (this.camMode === 'fly' ? .9 : 2.2)); this.cam.lerp(this.tc, k); this.look.lerp(this.tl, k); cam.position.copy(this.cam); cam.lookAt(this.look);
  }
}
