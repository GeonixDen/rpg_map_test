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
  uniform float uTreeSwayEnabled;
  uniform float uSwayTime;
  uniform float uSwayAmplitude;
  uniform float uSwayLift;
  uniform float uSwaySpeed;
  uniform float uSwayPhaseScale;
  uniform float uSwayAnchor;

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

    if (uTreeSwayEnabled > 0.5 && tileData.b > 0.5) {
      float localFromBottom = 1.0 - local.y;
      float anchor = clamp(uSwayAnchor + 0.5, 0.0, 0.95);
      float swayMask = smoothstep(anchor, 1.0, localFromBottom);
      float phase = dot(tileIndex, vec2(1.0, 1.37)) * uSwayPhaseScale + hashTile(tileIndex) * 6.283185;
      float wave = sin(uSwayTime * uSwaySpeed + phase) * 0.68;
      wave += sin(uSwayTime * uSwaySpeed * 0.61 + phase * 1.73) * 0.32;

      local.x = clamp(local.x - wave * uSwayAmplitude * swayMask, 0.0, 1.0);
      local.y = clamp(local.y + abs(wave) * uSwayLift * swayMask, 0.0, 1.0);
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
          uTreeSwayEnabled: { value: cfg.treeSway && tree.enabled ? 1 : 0 },
          uSwayTime: { value: 0 },
          uSwayAmplitude: { value: tree.amplitudeTiles },
          uSwayLift: { value: tree.liftTiles },
          uSwaySpeed: { value: tree.speed },
          uSwayPhaseScale: { value: tree.phaseScale },
          uSwayAnchor: { value: tree.trunkAnchor },
        },
        vertexShader,
        fragmentShader,
        depthTest: true,
        depthWrite: false,
        toneMapped: false,
      }),
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
  }, [atlas, atlasTexture, cfg.treeSway, material, model.dimensions, tileMapTexture, tree]);

  useEffect(
    () => () => {
      material.dispose();
    },
    [material],
  );

  useFrame(({ clock }) => {
    if (cfg.treeSway && tree.enabled) {
      material.uniforms.uSwayTime.value = clock.elapsedTime;
    }
  });

  return (
    <mesh position={[0, 0, cfg.z]} material={material} raycast={() => null}>
      <planeGeometry args={[model.dimensions.cols, model.dimensions.rows]} />
    </mesh>
  );
}
