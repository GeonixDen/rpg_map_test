import React, { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { APP_CONFIG } from '../config/appConfig.js';
import { createHoverTileMaterial } from './materials/createHoverTileMaterial.js';

function getHoverColors(type) {
  return APP_CONFIG.hover.types?.[type] || APP_CONFIG.hover.colors;
}

export default function HoverTile({ tile }) {
  const material = useMemo(() => createHoverTileMaterial(), []);
  const hoverType = tile?.hoverType || 'road';

  useEffect(
    () => () => {
      material.dispose();
    },
    [material],
  );

  useEffect(() => {
    const colors = getHoverColors(hoverType);
    material.uniforms.uOpacity.value = colors.opacity ?? APP_CONFIG.hover.opacity;
    material.uniforms.uBaseColor.value.set(...colors.base);
    material.uniforms.uHotColor.value.set(...colors.hot);
    material.uniforms.uAccentColor.value.set(...colors.accent);
  }, [hoverType, material]);

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
