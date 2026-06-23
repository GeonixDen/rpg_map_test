import * as THREE from 'three';
import { APP_CONFIG } from '../../config/appConfig.js';

export function createTreeSwayMaterial(texture) {
  const cfg = APP_CONFIG.treeSway;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    toneMapped: false,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSwayTime = { value: 0 };
    shader.uniforms.uSwayAmplitude = { value: cfg.amplitudeTiles };
    shader.uniforms.uSwayLift = { value: cfg.liftTiles };
    shader.uniforms.uSwaySpeed = { value: cfg.speed };
    shader.uniforms.uSwayPhaseScale = { value: cfg.phaseScale };
    shader.uniforms.uSwayAnchor = { value: cfg.trunkAnchor };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uSwayTime;
uniform float uSwaySpeed;
uniform float uSwayPhaseScale;
attribute vec2 aTileUvMin;
attribute vec2 aTileUvMax;
varying vec2 vTileUvMin;
varying vec2 vTileUvMax;
varying float vSwayPhase;`,
      )
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
vTileUvMin = aTileUvMin;
vTileUvMax = aTileUvMax;
#ifdef USE_INSTANCING
  vec2 swaySeed = instanceMatrix[3].xy;
#else
  vec2 swaySeed = vec2(0.0);
#endif
vSwayPhase = dot(swaySeed, vec2(1.0, 1.37)) * uSwayPhaseScale;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uSwayTime;
uniform float uSwayAmplitude;
uniform float uSwayLift;
uniform float uSwaySpeed;
uniform float uSwayAnchor;
varying vec2 vTileUvMin;
varying vec2 vTileUvMax;
varying float vSwayPhase;`,
      )
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
  vec2 tileSpan = max(vTileUvMax - vTileUvMin, vec2(0.000001));
  float localY = clamp((vMapUv.y - vTileUvMin.y) / tileSpan.y, 0.0, 1.0);
  float anchor = clamp(uSwayAnchor + 0.5, 0.0, 0.95);
  float swayMask = smoothstep(anchor, 1.0, localY);
  float swayWave = sin(uSwayTime * uSwaySpeed + vSwayPhase) * 0.68;
  swayWave += sin(uSwayTime * uSwaySpeed * 0.61 + vSwayPhase * 1.73) * 0.32;

  vec2 swayUv = vMapUv;
  swayUv.x = clamp(vMapUv.x - swayWave * uSwayAmplitude * tileSpan.x * swayMask, vTileUvMin.x, vTileUvMax.x);
  swayUv.y = clamp(vMapUv.y - abs(swayWave) * uSwayLift * tileSpan.y * swayMask, vTileUvMin.y, vTileUvMax.y);

  vec4 sampledDiffuseColor = texture2D(map, swayUv);
  diffuseColor *= sampledDiffuseColor;
#endif`,
      );

    material.userData.shader = shader;
  };

  material.customProgramCacheKey = () => 'bot-rpg-tree-sway-v2';
  return material;
}

export function updateTreeSwayMaterial(material, elapsedTime) {
  const shader = material?.userData?.shader;
  if (!shader) return;

  const cfg = APP_CONFIG.treeSway;
  shader.uniforms.uSwayTime.value = elapsedTime;
  shader.uniforms.uSwayAmplitude.value = cfg.amplitudeTiles;
  shader.uniforms.uSwayLift.value = cfg.liftTiles;
  shader.uniforms.uSwaySpeed.value = cfg.speed;
  shader.uniforms.uSwayPhaseScale.value = cfg.phaseScale;
  shader.uniforms.uSwayAnchor.value = cfg.trunkAnchor;
}
