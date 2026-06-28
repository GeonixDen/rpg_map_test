import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { APP_CONFIG } from '../../config/appConfig.js';
import {
  createFogUniforms,
  fogCommonGLSL,
  fogVertexShader,
  syncFogUniforms,
  updateFogTime,
} from '../materials/fogMaterial.js';

const fragmentShader = `
  uniform sampler2D uVisibilityFrom;
  uniform sampler2D uVisibilityTo;
  uniform vec2 uMapSize;
  uniform float uRevealMix;
  uniform float uEdgeSoftness;
  uniform float uNoiseStrength;

  varying vec2 vWorld;

  ${fogCommonGLSL}

  void main() {
    if (uOpacity <= 0.001) discard;

    vec2 tile = vec2(vWorld.x + uMapSize.x * 0.5, uMapSize.y * 0.5 - vWorld.y);
    vec2 uv = clamp(tile / max(uMapSize, vec2(1.0)), vec2(0.0), vec2(1.0));
    uv.y = 1.0 - uv.y;

    float fromClarity = texture2D(uVisibilityFrom, uv).r;
    float toClarity = texture2D(uVisibilityTo, uv).r;
    float clarity = mix(fromClarity, toClarity, smoothstep(0.0, 1.0, uRevealMix));
    float noiseMix = fogNoiseMix(vWorld);
    float noisyClarity = clamp(clarity + (noiseMix - 0.5) * uNoiseStrength, 0.0, 1.0);
    float fogMask = 1.0 - smoothstep(uEdgeSoftness, 1.0, noisyClarity);

    if (fogMask <= 0.003) discard;

    gl_FragColor = fogRender(fogMask, noiseMix);
  }
`;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function parseTileKey(key) {
  const [x, y] = String(key).split(',').map(Number);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function getEdgeClarity(x, y, visibleTileKeys, cfg) {
  const fadeTiles = Math.max(1, Number(cfg.fadeTiles) || 2);
  let nearestHidden = fadeTiles + 1;

  for (let dy = -fadeTiles; dy <= fadeTiles; dy += 1) {
    for (let dx = -fadeTiles; dx <= fadeTiles; dx += 1) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      if (distance === 0 || distance >= nearestHidden) continue;

      if (!visibleTileKeys.has(`${x + dx},${y + dy}`)) {
        nearestHidden = distance;
      }
    }
  }

  if (nearestHidden > fadeTiles) return 1;

  const edgeClearMin = clamp(Number(cfg.edgeClearMin) || 0.42, 0, 1);
  return edgeClearMin + (1 - edgeClearMin) * smoothstep(1, fadeTiles, nearestHidden);
}

function createVisibilityTexture(dimensions, visibleTileKeys, cfg) {
  const cols = Math.max(1, Number(dimensions?.cols) || 1);
  const rows = Math.max(1, Number(dimensions?.rows) || 1);
  const maxSize = Math.max(64, Number(cfg.maxMaskTextureSize) || 1536);
  const width = Math.max(1, Math.min(cols, maxSize));
  const height = Math.max(1, Math.min(rows, maxSize));
  const data = new Uint8Array(width * height * 4);

  for (const key of visibleTileKeys || []) {
    const tile = parseTileKey(key);
    if (!tile) continue;

    const x0 = Math.floor((tile.x / cols) * width);
    const x1 = Math.max(x0 + 1, Math.ceil(((tile.x + 1) / cols) * width));
    const y0 = Math.floor((tile.y / rows) * height);
    const y1 = Math.max(y0 + 1, Math.ceil(((tile.y + 1) / rows) * height));
    const value = Math.round(getEdgeClarity(tile.x, tile.y, visibleTileKeys, cfg) * 255);

    for (let y = y0; y < y1; y += 1) {
      if (y < 0 || y >= height) continue;

      const flippedY = height - 1 - y;
      for (let x = x0; x < x1; x += 1) {
        if (x < 0 || x >= width) continue;

        const offset = (flippedY * width + x) * 4;
        const next = Math.max(data[offset], value);
        data[offset] = next;
        data[offset + 1] = next;
        data[offset + 2] = next;
        data[offset + 3] = 255;
      }
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function createSolidVisibilityTexture(value = 255) {
  const data = new Uint8Array([value, value, value, 255]);
  const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export default function FogOfWarPlane({ dimensions, visible, visibleTileKeys }) {
  const fogStyle = APP_CONFIG.fog;
  const cfg = APP_CONFIG.fogOfWar;
  const currentTextureRef = useRef(null);
  const disposeQueueRef = useRef([]);
  const revealMixRef = useRef(1);
  const opacityRef = useRef(visible && visibleTileKeys ? cfg.opacity : 0);
  const fallbackTexture = useMemo(() => createSolidVisibilityTexture(255), []);
  const visibilityTexture = useMemo(
    () => (visible && visibleTileKeys ? createVisibilityTexture(dimensions, visibleTileKeys, cfg) : null),
    [cfg, dimensions.cols, dimensions.rows, visible, visibleTileKeys],
  );
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          ...createFogUniforms(fogStyle, opacityRef.current),
          uVisibilityFrom: { value: visibilityTexture || fallbackTexture },
          uVisibilityTo: { value: visibilityTexture || fallbackTexture },
          uMapSize: { value: new THREE.Vector2(dimensions.cols, dimensions.rows) },
          uRevealMix: { value: 1 },
          uEdgeSoftness: { value: cfg.edgeSoftness },
          uNoiseStrength: { value: cfg.noiseStrength },
        },
        vertexShader: fogVertexShader,
        fragmentShader,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    [cfg, dimensions.cols, dimensions.rows, fallbackTexture, fogStyle],
  );

  useEffect(() => {
    if (visibilityTexture) {
      const previousTexture = currentTextureRef.current || visibilityTexture;

      if (currentTextureRef.current && currentTextureRef.current !== visibilityTexture) {
        disposeQueueRef.current.push(currentTextureRef.current);
        revealMixRef.current = 0;
        material.uniforms.uRevealMix.value = 0;
      } else {
        revealMixRef.current = 1;
        material.uniforms.uRevealMix.value = 1;
      }

      currentTextureRef.current = visibilityTexture;
      material.uniforms.uVisibilityFrom.value = previousTexture;
      material.uniforms.uVisibilityTo.value = visibilityTexture;
    } else if (!currentTextureRef.current) {
      material.uniforms.uVisibilityFrom.value = fallbackTexture;
      material.uniforms.uVisibilityTo.value = fallbackTexture;
      revealMixRef.current = 1;
      material.uniforms.uRevealMix.value = 1;
    }

    material.uniforms.uMapSize.value.set(dimensions.cols, dimensions.rows);
    material.uniforms.uEdgeSoftness.value = cfg.edgeSoftness;
    material.uniforms.uNoiseStrength.value = cfg.noiseStrength;
    syncFogUniforms(material, fogStyle, opacityRef.current);
  }, [cfg, dimensions.cols, dimensions.rows, fallbackTexture, fogStyle, material, visibilityTexture]);

  useEffect(
    () => () => {
      const textures = new Set([
        currentTextureRef.current,
        ...disposeQueueRef.current,
        material.uniforms.uVisibilityFrom.value,
        material.uniforms.uVisibilityTo.value,
      ].filter((texture) => texture && texture !== fallbackTexture));

      textures.forEach((texture) => texture.dispose());
      disposeQueueRef.current = [];
      currentTextureRef.current = null;
      material.dispose();
    },
    [fallbackTexture, material],
  );

  useEffect(
    () => () => {
      fallbackTexture.dispose();
    },
    [fallbackTexture],
  );

  useFrame(({ clock }, delta) => {
    updateFogTime(material, fogStyle, clock.elapsedTime);

    if (revealMixRef.current < 1) {
      revealMixRef.current = Math.min(1, revealMixRef.current + delta * cfg.revealSpeed);
      material.uniforms.uRevealMix.value = revealMixRef.current;

      if (revealMixRef.current >= 1 && disposeQueueRef.current.length) {
        disposeQueueRef.current.forEach((texture) => texture.dispose());
        disposeQueueRef.current = [];
        material.uniforms.uVisibilityFrom.value = currentTextureRef.current || material.uniforms.uVisibilityTo.value;
      }
    }

    const targetOpacity = visible && visibleTileKeys ? cfg.opacity : 0;
    const fadeSpeed = targetOpacity > opacityRef.current ? cfg.fadeInSpeed : cfg.fadeOutSpeed;
    const opacityAlpha = Math.min(1, delta * Math.max(0.01, fadeSpeed));
    let nextOpacity = opacityRef.current + (targetOpacity - opacityRef.current) * opacityAlpha;
    if (Math.abs(nextOpacity - targetOpacity) < 0.002) nextOpacity = targetOpacity;

    opacityRef.current = nextOpacity;
    material.uniforms.uOpacity.value = nextOpacity;
  });

  if (!cfg.enabled) return null;

  return (
    <mesh
      position={[0, 0, cfg.z]}
      renderOrder={cfg.renderOrder}
      material={material}
      raycast={() => null}
    >
      <planeGeometry args={[dimensions.cols, dimensions.rows]} />
    </mesh>
  );
}
