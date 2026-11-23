// Post stack: Bloom + found-footage VHS pass (amber grade, vignette, scanlines,
// grain, tape black-lift, subtle chromatic aberration) — the M13 look rebuilt
// as GLSL. V key toggles the whole composer.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

export const VHSShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    amount: { value: 1.0 },
    resolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float time, amount;
    uniform vec2 resolution;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      // gentle radial chromatic aberration
      vec2 d = uv - 0.5;
      float ca = 0.0016 * amount * (0.4 + dot(d, d));
      vec3 c;
      c.r = texture2D(tDiffuse, uv + d * ca).r;
      c.g = texture2D(tDiffuse, uv).g;
      c.b = texture2D(tDiffuse, uv - d * ca).b;
      // pale yellow-green fluorescent grade (reference), not orange sepia
      float luma = dot(c, vec3(0.30, 0.59, 0.11));
      c = mix(c, vec3(1.08, 1.05, 0.68) * luma, 0.44 * amount);
      // vignette
      c *= mix(1.0, smoothstep(0.95, 0.35, length(d) * 1.42), 0.5 * amount);
      // scanlines every ~3 px
      c *= 1.0 - 0.10 * amount * (0.5 + 0.5 * sin(uv.y * resolution.y * 1.05));
      // animated grain (24 fps)
      float g = hash(floor(uv * resolution) + floor(time * 24.0));
      c += (g - 0.5) * 0.055 * amount;
      // lifted tape blacks, slight green-cyan cast in shadows
      c = c * vec3(1.04, 1.02, 0.86) + vec3(0.020, 0.017, 0.006) * amount;
      // rare horizontal tape jitter line
      float jl = step(0.997, hash(vec2(floor(time * 2.0), 7.0)));
      float jy = fract(time * 0.23);
      c += jl * amount * smoothstep(0.006, 0.0, abs(uv.y - jy)) * 0.12;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export function makeComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.6, 0.88);
  composer.addPass(bloom);
  const vhs = new ShaderPass(VHSShader);
  composer.addPass(vhs);
  composer.addPass(new OutputPass());
  return { composer, bloom, vhs };
}
