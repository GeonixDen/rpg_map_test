import React, { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { APP_CONFIG } from '../config/appConfig.js';
import { createHoverTileMaterial } from './materials/createHoverTileMaterial.js';

export default function HoverTile({ tile }) {
  const material = useMemo(() => createHoverTileMaterial(), []);

  useEffect(
    () => () => {
      material.dispose();
    },
    [material],
  );

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
  });

  if (!tile) return null;

  return (
    <mesh position={[tile.worldX, tile.worldY, APP_CONFIG.hover.markerZ]} renderOrder={1000} raycast={() => null}>
      <planeGeometry args={[1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
