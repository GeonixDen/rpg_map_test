import * as THREE from 'three';
import { APP_CONFIG } from '../../config/appConfig.js';

export const fogVertexShader = `
  varying vec2 vWorld;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorld = worldPosition.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const fogUniformsGLSL = `
  uniform float uOpacity;
  uniform float uTime;
  uniform float uWaveScale;
  uniform float uDriftScale;
  uniform float uMistStrength;
  uniform vec3 uFogColor;
  uniform vec3 uMistColor;
`;

export const fogCommonGLSL = `
  ${fogUniformsGLSL}

  float fogHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float fogNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(fogHash(i + vec2(0.0, 0.0)), fogHash(i + vec2(1.0, 0.0)), u.x),
      mix(fogHash(i + vec2(0.0, 1.0)), fogHash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fogFbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;

    for (int i = 0; i < 3; i++) {
      value += fogNoise(p) * amplitude;
      p = p * 2.03 + 17.17;
      amplitude *= 0.5;
    }

    return value;
  }

  float fogNoiseMix(vec2 world) {
    vec2 drift = vec2(uTime * 0.42, -uTime * 0.27);
    float clouds = fogFbm(world * uWaveScale + drift);
    float fineMist = fogFbm(world * (uWaveScale + uDriftScale) - drift.yx);
    return clouds * 0.72 + fineMist * 0.28;
  }

  vec4 fogRender(float mask, float noiseMix) {
    float wisp = smoothstep(0.28, 0.92, noiseMix);
    float alpha = uOpacity * smoothstep(0.0, 1.0, mask);
    vec3 color = mix(uFogColor, uMistColor, wisp * mask * uMistStrength);
    return vec4(color, alpha);
  }
`;

export function createFogUniforms(style = APP_CONFIG.fog, opacity = 1) {
  return {
    uOpacity: { value: opacity },
    uTime: { value: 0 },
    uWaveScale: { value: style.animation.waveScale },
    uDriftScale: { value: style.animation.driftScale },
    uMistStrength: { value: style.animation.mistStrength },
    uFogColor: { value: new THREE.Color(style.color) },
    uMistColor: { value: new THREE.Color(style.mistColor) },
  };
}

export function syncFogUniforms(material, style = APP_CONFIG.fog, opacity = 1) {
  if (!material?.uniforms) return;

  material.uniforms.uOpacity.value = opacity;
  material.uniforms.uWaveScale.value = style.animation.waveScale;
  material.uniforms.uDriftScale.value = style.animation.driftScale;
  material.uniforms.uMistStrength.value = style.animation.mistStrength;
  material.uniforms.uFogColor.value.set(style.color);
  material.uniforms.uMistColor.value.set(style.mistColor);
}

export function updateFogTime(material, style = APP_CONFIG.fog, elapsedTime = 0) {
  if (!material?.uniforms || !style.animation.enabled) return;

  material.uniforms.uTime.value = elapsedTime * style.animation.speed;
}
