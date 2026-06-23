import React, { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { APP_CONFIG } from '../../config/appConfig.js';

const vertexShader = `
  varying vec2 vWorld;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorld = worldPosition.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform vec2 uMapSize;
  uniform float uInnerFadeBand;
  uniform float uOuterBand;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uWaveScale;
  uniform float uDriftScale;
  uniform float uMistStrength;
  uniform vec3 uFogColor;
  uniform vec3 uMistColor;

  varying vec2 vWorld;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;

    for (int i = 0; i < 3; i++) {
      value += noise(p) * amplitude;
      p = p * 2.03 + 17.17;
      amplitude *= 0.5;
    }

    return value;
  }

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
    float t = uTime;
    vec2 drift = vec2(t * 0.42, -t * 0.27);
    float clouds = fbm(vWorld * uWaveScale + drift);
    float fineMist = fbm(vWorld * (uWaveScale + uDriftScale) - drift.yx);
    float noiseMix = clouds * 0.72 + fineMist * 0.28;
    float mask = edgeMask(vWorld, noiseMix - 0.5);
    if (mask <= 0.001) discard;

    float wisp = smoothstep(0.28, 0.92, noiseMix);

    float mist = wisp * mask;
    float alpha = uOpacity * smoothstep(0.0, 1.0, mask);
    vec3 color = mix(uFogColor, uMistColor, mist * uMistStrength);

    gl_FragColor = vec4(color, alpha);
  }
`;

export default function MapEdgeFog({ dimensions }) {
  const cfg = APP_CONFIG.edgeFog;
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uMapSize: { value: new THREE.Vector2(dimensions.cols, dimensions.rows) },
          uInnerFadeBand: { value: cfg.innerFadeTiles },
          uOuterBand: { value: cfg.outerFadeTiles },
          uOpacity: { value: cfg.opacity },
          uTime: { value: 0 },
          uWaveScale: { value: cfg.animation.waveScale },
          uDriftScale: { value: cfg.animation.driftScale },
          uMistStrength: { value: cfg.animation.mistStrength },
          uFogColor: { value: new THREE.Color(cfg.color) },
          uMistColor: { value: new THREE.Color(cfg.mistColor) },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    [cfg, dimensions.cols, dimensions.rows],
  );

  useEffect(() => {
    material.uniforms.uMapSize.value.set(dimensions.cols, dimensions.rows);
    material.uniforms.uInnerFadeBand.value = cfg.innerFadeTiles;
    material.uniforms.uOuterBand.value = cfg.outerFadeTiles;
    material.uniforms.uOpacity.value = cfg.opacity;
    material.uniforms.uWaveScale.value = cfg.animation.waveScale;
    material.uniforms.uDriftScale.value = cfg.animation.driftScale;
    material.uniforms.uMistStrength.value = cfg.animation.mistStrength;
    material.uniforms.uFogColor.value.set(cfg.color);
    material.uniforms.uMistColor.value.set(cfg.mistColor);
  }, [cfg, dimensions.cols, dimensions.rows, material]);

  useEffect(
    () => () => {
      material.dispose();
    },
    [material],
  );

  useFrame(({ clock }) => {
    if (cfg.animation.enabled) {
      material.uniforms.uTime.value = clock.elapsedTime * cfg.animation.speed;
    }
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
