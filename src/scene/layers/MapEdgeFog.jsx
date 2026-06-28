import React, { useEffect, useMemo } from 'react';
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
  uniform vec2 uMapSize;
  uniform float uInnerFadeBand;
  uniform float uOuterBand;

  varying vec2 vWorld;

  ${fogCommonGLSL}

  float edgeMask(vec2 p, float edgeNoise) {
    vec2 halfMap = uMapSize * 0.5;
    float signedEdge = min(halfMap.x - abs(p.x), halfMap.y - abs(p.y));
    float distanceToEdge = abs(signedEdge);
    float noiseGate = smoothstep(0.04, 0.7, distanceToEdge);
    float innerDistance = signedEdge + edgeNoise * uInnerFadeBand * 0.3 * noiseGate;
    float outerDistance = distanceToEdge + edgeNoise * uOuterBand * 0.26 * noiseGate;
    float innerMask = 1.0 - smoothstep(0.0, max(0.001, uInnerFadeBand), innerDistance);
    float outerMask = 1.0 - smoothstep(0.0, max(0.001, uOuterBand), outerDistance);
    return signedEdge >= 0.0 ? innerMask : outerMask;
  }

  void main() {
    float noiseMix = fogNoiseMix(vWorld);
    float mask = edgeMask(vWorld, noiseMix - 0.5);
    if (mask <= 0.001) discard;

    gl_FragColor = fogRender(mask, noiseMix);
  }
`;

export default function MapEdgeFog({ dimensions }) {
  const fogStyle = APP_CONFIG.fog;
  const cfg = APP_CONFIG.edgeFog;
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          ...createFogUniforms(fogStyle, cfg.opacity),
          uMapSize: { value: new THREE.Vector2(dimensions.cols, dimensions.rows) },
          uInnerFadeBand: { value: cfg.innerFadeTiles },
          uOuterBand: { value: cfg.outerFadeTiles },
        },
        vertexShader: fogVertexShader,
        fragmentShader,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    [cfg, dimensions.cols, dimensions.rows, fogStyle],
  );

  useEffect(() => {
    material.uniforms.uMapSize.value.set(dimensions.cols, dimensions.rows);
    material.uniforms.uInnerFadeBand.value = cfg.innerFadeTiles;
    material.uniforms.uOuterBand.value = cfg.outerFadeTiles;
    syncFogUniforms(material, fogStyle, cfg.opacity);
  }, [cfg, dimensions.cols, dimensions.rows, fogStyle, material]);

  useEffect(
    () => () => {
      material.dispose();
    },
    [material],
  );

  useFrame(({ clock }) => {
    updateFogTime(material, fogStyle, clock.elapsedTime);
  });

  if (!cfg.enabled) return null;

  const strips = useMemo(() => {
    const innerBand = cfg.innerFadeTiles;
    const outerBand = cfg.outerFadeTiles;
    const band = innerBand + outerBand;
    const horizontalWidth = dimensions.cols + outerBand * 2;
    const verticalHeight = dimensions.rows + outerBand * 2;
    const edgeOffset = (outerBand - innerBand) / 2;

    return [
      {
        key: 'top',
        position: [0, dimensions.rows / 2 + edgeOffset, cfg.z],
        size: [horizontalWidth, band],
      },
      {
        key: 'bottom',
        position: [0, -dimensions.rows / 2 - edgeOffset, cfg.z],
        size: [horizontalWidth, band],
      },
      {
        key: 'left',
        position: [-dimensions.cols / 2 - edgeOffset, 0, cfg.z],
        size: [band, verticalHeight],
      },
      {
        key: 'right',
        position: [dimensions.cols / 2 + edgeOffset, 0, cfg.z],
        size: [band, verticalHeight],
      },
    ];
  }, [cfg, dimensions.cols, dimensions.rows]);

  return (
    <group>
      {strips.map((strip) => (
        <mesh key={strip.key} position={strip.position} renderOrder={250} material={material} raycast={() => null}>
          <planeGeometry args={strip.size} />
        </mesh>
      ))}
    </group>
  );
}
