import * as THREE from 'three';
export const windU = { uTime: { value: 0 }, uWind: { value: new THREE.Vector2(1, 0.35) }, uStrength: { value: 1 }, uGust: { value: 0 } };
const FN = `
uniform float uTime; uniform vec2 uWind; uniform float uStrength; uniform float uGust;
vec2 windOffset(vec3 wp, float h, float amp, float flutter){
  float ph = dot(wp.xz, normalize(uWind)) * 0.09;
  float gust = 0.5 + 0.5 * sin(ph * 1.7 - uTime * 0.9) * sin(ph * 0.6 - uTime * 0.37 + 1.7);
  float base = sin(uTime * 1.3 + ph * 2.0 + wp.x * 0.31 + wp.z * 0.23);
  float flut = sin(uTime * 7.1 + wp.x * 3.3 + wp.z * 2.7 + h * 4.0) * sin(uTime * 4.3 + wp.z * 5.1);
  float k = h * h * amp * uStrength * (0.35 + 0.9 * gust + uGust);
  return normalize(uWind) * (base * 0.6 + gust * 0.9) * k + vec2(flut * flutter * k * 0.6, flut * flutter * k * 0.4);
}`;
export function applyWind(mat, { amp = 0.02, flutter = 0.6, hScale = 0.12, grass = false } = {}) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, windU);
    sh.vertexShader = FN + sh.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec4 _wp = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        _wp = instanceMatrix * _wp;
      #endif
      _wp = modelMatrix * _wp;
      float _h = max(transformed.y, 0.0) * ${hScale.toFixed(4)};
      vec2 _o = windOffset(_wp.xyz, _h, ${amp.toFixed(4)}, ${flutter.toFixed(3)});
      transformed.x += _o.x; transformed.z += _o.y;
      ${grass ? 'transformed.y -= length(_o) * 0.35;' : ''}
    `);
  };
  mat.customProgramCacheKey = () => 'wind' + amp + flutter + hScale + grass;
  mat.needsUpdate = true;
  return mat;
}
