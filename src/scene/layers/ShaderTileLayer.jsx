import React, { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { APP_CONFIG } from '../../config/appConfig.js';
import { getTileMapTexture } from '../tileMapTexture.js';

const vertexShader = `
  varying vec2 vWorld;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorld = worldPosition.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uAtlas;
  uniform sampler2D uTileMap;
  uniform vec2 uAtlasSize;
  uniform vec2 uMapSize;
  uniform float uTileSize;
  uniform float uGap;
  uniform float uMargin;
  uniform float uUvInset;

  // treeSway
  uniform float uTreeSwayEnabled;
  uniform float uSwayTime;
  uniform float uSwayAmplitude;
  uniform float uSwayLift;
  uniform float uSwaySpeed;
  uniform float uSwayPhaseScale;
  uniform float uSwayAnchor;

  // fluid (water / lava)
  uniform float uFluidEnabled;
  uniform float uFluidTime;
  uniform float uWaterSpeed;
  uniform float uWaterAmplitudeX;
  uniform float uWaterAmplitudeY;
  uniform float uWaterPhaseScale;
  uniform float uWaterFlowX;
  uniform float uWaterFlowY;
  uniform float uLavaSpeed;
  uniform float uLavaAmplitudeX;
  uniform float uLavaAmplitudeY;
  uniform float uLavaPhaseScale;
  uniform float uLavaFlowX;
  uniform float uLavaFlowY;

  varying vec2 vWorld;

  float hashTile(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec2 tile = vec2(vWorld.x + uMapSize.x * 0.5, uMapSize.y * 0.5 - vWorld.y);

    if (tile.x < 0.0 || tile.y < 0.0 || tile.x >= uMapSize.x || tile.y >= uMapSize.y) {
      discard;
    }

    vec2 tileIndex = floor(tile);
    vec2 mapUv = vec2((tileIndex.x + 0.5) / uMapSize.x, 1.0 - ((tileIndex.y + 0.5) / uMapSize.y));
    vec4 tileData = texture2D(uTileMap, mapUv);

    if (tileData.a < 0.5) discard;

    vec2 atlasTile = floor(tileData.rg * 255.0 + 0.5);
    vec2 local = fract(tile);

    float animFlag = tileData.b * 255.0;

    // treeSway — B channel ~255
    if (uTreeSwayEnabled > 0.5 && animFlag > 200.0) {
      float localFromBottom = 1.0 - local.y;
      float anchor = clamp(uSwayAnchor + 0.5, 0.0, 0.95);
      float swayMask = smoothstep(anchor, 1.0, localFromBottom);
      float phase = dot(tileIndex, vec2(1.0, 1.37)) * uSwayPhaseScale + hashTile(tileIndex) * 6.283185;
      float wave = sin(uSwayTime * uSwaySpeed + phase) * 0.68;
      wave += sin(uSwayTime * uSwaySpeed * 0.61 + phase * 1.73) * 0.32;

      local.x = clamp(local.x - wave * uSwayAmplitude * swayMask, 0.0, 1.0);
      local.y = clamp(local.y + abs(wave) * uSwayLift * swayMask, 0.0, 1.0);
    }

    // water — B channel ~128 (between 100 and 200)
    else if (uFluidEnabled > 0.5 && animFlag > 100.0 && animFlag < 200.0) {
      float phase = dot(tileIndex, vec2(1.0, 1.37)) * uWaterPhaseScale + hashTile(tileIndex) * 6.283185;
      float t = uFluidTime;
      // primary scroll — fract wraps seamlessly across tile edges
      float scrollX = fract(local.x + t * uWaterFlowX);
      float scrollY = fract(local.y + t * uWaterFlowY);
      // surface ripple on perpendicular axis
      float rippleX = sin(t * uWaterSpeed + local.y * 6.2832 + phase) * uWaterAmplitudeX;
      float rippleY = cos(t * uWaterSpeed * 0.83 + local.x * 6.2832 + phase) * uWaterAmplitudeY;

      local.x = fract(scrollX + rippleX);
      local.y = fract(scrollY + rippleY);
    }

    // lava — B channel ~64 (between 32 and 100)
    else if (uFluidEnabled > 0.5 && animFlag > 32.0 && animFlag < 100.0) {
      float phase = dot(tileIndex, vec2(1.0, 1.37)) * uLavaPhaseScale + hashTile(tileIndex) * 6.283185;
      float t = uFluidTime;
      // primary scroll
      float scrollX = fract(local.x + t * uLavaFlowX);
      float scrollY = fract(local.y + t * uLavaFlowY);
      // slow heavy bulge
      float rippleX = sin(t * uLavaSpeed + local.y * 4.712 + phase) * uLavaAmplitudeX;
      float rippleY = cos(t * uLavaSpeed * 0.67 + local.x * 4.712 + phase) * uLavaAmplitudeY;

      local.x = fract(scrollX + rippleX);
      local.y = fract(scrollY + rippleY);
    }

    vec2 sourcePx = vec2(
      uMargin + atlasTile.x * (uTileSize + uGap) + uUvInset + local.x * max(1.0, uTileSize - uUvInset * 2.0),
      uMargin + atlasTile.y * (uTileSize + uGap) + uUvInset + local.y * max(1.0, uTileSize - uUvInset * 2.0)
    );
    vec2 atlasUv = vec2(sourcePx.x / uAtlasSize.x, 1.0 - sourcePx.y / uAtlasSize.y);
    vec4 color = texture2D(uAtlas, atlasUv);

    if (color.a < 0.01) discard;

    gl_FragColor = color;
    #include <colorspace_fragment>
  }
`;

export default function ShaderTileLayer({ map, model, atlasTexture }) {
  const cfg = APP_CONFIG.mapRenderer;
  const atlas = APP_CONFIG.tileAtlas;
  const tree = APP_CONFIG.treeSway;
  const fluid = APP_CONFIG.tileFluid;
  const tileMapTexture = useMemo(
    () => getTileMapTexture(map, model.dimensions),
    [map, model.dimensions],
  );
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uAtlas: { value: atlasTexture },
          uTileMap: { value: tileMapTexture },
          uAtlasSize: {
            value: new THREE.Vector2(atlasTexture.image?.width || 1, atlasTexture.image?.height || 1),
          },
          uMapSize: { value: new THREE.Vector2(model.dimensions.cols, model.dimensions.rows) },
          uTileSize: { value: atlas.tileSize },
          uGap: { value: atlas.gap },
          uMargin: { value: atlas.margin },
          uUvInset: { value: atlas.uvInset },
          // treeSway
          uTreeSwayEnabled: { value: cfg.treeSway && tree.enabled ? 1 : 0 },
          uSwayTime: { value: 0 },
          uSwayAmplitude: { value: tree.amplitudeTiles },
          uSwayLift: { value: tree.liftTiles },
          uSwaySpeed: { value: tree.speed },
          uSwayPhaseScale: { value: tree.phaseScale },
          uSwayAnchor: { value: tree.trunkAnchor },
          // fluid
          uFluidEnabled: { value: fluid?.enabled ? 1 : 0 },
          uFluidTime: { value: 0 },
          uWaterSpeed: { value: fluid?.water?.speed ?? 0.12 },
          uWaterAmplitudeX: { value: fluid?.water?.amplitudeX ?? 0.03 },
          uWaterAmplitudeY: { value: fluid?.water?.amplitudeY ?? 0.02 },
          uWaterPhaseScale: { value: fluid?.water?.phaseScale ?? 0.62 },
          uWaterFlowX: { value: fluid?.water?.flowX ?? 0.18 },
          uWaterFlowY: { value: fluid?.water?.flowY ?? 0.0 },
          uLavaSpeed: { value: fluid?.lava?.speed ?? 0.08 },
          uLavaAmplitudeX: { value: fluid?.lava?.amplitudeX ?? 0.025 },
          uLavaAmplitudeY: { value: fluid?.lava?.amplitudeY ?? 0.03 },
          uLavaPhaseScale: { value: fluid?.lava?.phaseScale ?? 0.44 },
          uLavaFlowX: { value: fluid?.lava?.flowX ?? 0.06 },
          uLavaFlowY: { value: fluid?.lava?.flowY ?? 0.0 },
        },
        vertexShader,
        fragmentShader,
        depthTest: true,
        depthWrite: false,
        toneMapped: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [atlas.gap, atlas.margin, atlas.tileSize, atlas.uvInset, atlasTexture, cfg.treeSway, model.dimensions, tileMapTexture, tree],
  );

  useEffect(() => {
    material.uniforms.uAtlas.value = atlasTexture;
    material.uniforms.uTileMap.value = tileMapTexture;
    material.uniforms.uAtlasSize.value.set(atlasTexture.image?.width || 1, atlasTexture.image?.height || 1);
    material.uniforms.uMapSize.value.set(model.dimensions.cols, model.dimensions.rows);
    material.uniforms.uTileSize.value = atlas.tileSize;
    material.uniforms.uGap.value = atlas.gap;
    material.uniforms.uMargin.value = atlas.margin;
    material.uniforms.uUvInset.value = atlas.uvInset;
    material.uniforms.uTreeSwayEnabled.value = cfg.treeSway && tree.enabled ? 1 : 0;
    material.uniforms.uSwayAmplitude.value = tree.amplitudeTiles;
    material.uniforms.uSwayLift.value = tree.liftTiles;
    material.uniforms.uSwaySpeed.value = tree.speed;
    material.uniforms.uSwayPhaseScale.value = tree.phaseScale;
    material.uniforms.uSwayAnchor.value = tree.trunkAnchor;
    material.uniforms.uFluidEnabled.value = fluid?.enabled ? 1 : 0;
    material.uniforms.uWaterSpeed.value = fluid?.water?.speed ?? 0.12;
    material.uniforms.uWaterAmplitudeX.value = fluid?.water?.amplitudeX ?? 0.03;
    material.uniforms.uWaterAmplitudeY.value = fluid?.water?.amplitudeY ?? 0.02;
    material.uniforms.uWaterPhaseScale.value = fluid?.water?.phaseScale ?? 0.62;
    material.uniforms.uWaterFlowX.value = fluid?.water?.flowX ?? 0.18;
    material.uniforms.uWaterFlowY.value = fluid?.water?.flowY ?? 0.0;
    material.uniforms.uLavaSpeed.value = fluid?.lava?.speed ?? 0.08;
    material.uniforms.uLavaAmplitudeX.value = fluid?.lava?.amplitudeX ?? 0.025;
    material.uniforms.uLavaAmplitudeY.value = fluid?.lava?.amplitudeY ?? 0.03;
    material.uniforms.uLavaPhaseScale.value = fluid?.lava?.phaseScale ?? 0.44;
    material.uniforms.uLavaFlowX.value = fluid?.lava?.flowX ?? 0.06;
    material.uniforms.uLavaFlowY.value = fluid?.lava?.flowY ?? 0.0;
  }, [atlas, atlasTexture, cfg.treeSway, fluid, material, model.dimensions, tileMapTexture, tree]);

  useEffect(
    () => () => {
      material.dispose();
    },
    [material],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (cfg.treeSway && tree.enabled) {
      material.uniforms.uSwayTime.value = t;
    }
    if (APP_CONFIG.tileFluid?.enabled) {
      const w = APP_CONFIG.tileFluid.water || {};
      const l = APP_CONFIG.tileFluid.lava || {};
      const u = material.uniforms;
      u.uFluidTime.value = t;
      u.uFluidEnabled.value = 1;
      u.uWaterFlowX.value = w.flowX ?? 0.18;
      u.uWaterFlowY.value = w.flowY ?? 0.0;
      u.uWaterSpeed.value = w.speed ?? 0.12;
      u.uWaterAmplitudeX.value = w.amplitudeX ?? 0.03;
      u.uWaterAmplitudeY.value = w.amplitudeY ?? 0.02;
      u.uWaterPhaseScale.value = w.phaseScale ?? 0.62;
      u.uLavaFlowX.value = l.flowX ?? 0.06;
      u.uLavaFlowY.value = l.flowY ?? 0.0;
      u.uLavaSpeed.value = l.speed ?? 0.08;
      u.uLavaAmplitudeX.value = l.amplitudeX ?? 0.025;
      u.uLavaAmplitudeY.value = l.amplitudeY ?? 0.03;
      u.uLavaPhaseScale.value = l.phaseScale ?? 0.44;
    }
  });

  return (
    <mesh position={[0, 0, cfg.z]} material={material} raycast={() => null}>
      <planeGeometry args={[model.dimensions.cols, model.dimensions.rows]} />
    </mesh>
  );
}
