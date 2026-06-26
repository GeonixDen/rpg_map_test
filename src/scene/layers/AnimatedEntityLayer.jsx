import React, { memo, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { APP_CONFIG } from '../../config/appConfig.js';
import { tileToWorld } from '../../utils/mapModel.js';
import { getNowMs, sampleMovementPath } from '../../utils/movementPath.js';
import { resolveEmojiTile } from '../../utils/tileResolver.js';
import { createTileGeometry } from '../tileGeometry.js';

function resolveEntityCoords(entity, mapType) {
  const emoji = entity?.emoji;
  const fallbackEmoji = APP_CONFIG.dynamicEntities.fallbackEmojiByKind[entity?.kind] || APP_CONFIG.mapModel.fallbackEmoji;
  return (
    resolveEmojiTile(emoji, Number(entity?.x) || 0, Number(entity?.y) || 0, mapType) ||
    resolveEmojiTile(fallbackEmoji, Number(entity?.x) || 0, Number(entity?.y) || 0, mapType) ||
    resolveEmojiTile(APP_CONFIG.mapModel.fallbackEmoji, 0, 0, mapType)
  );
}

function getEntityPoint(entity) {
  const x = Number(entity?.x);
  const y = Number(entity?.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function AnimatedEntityLayer({
  entity,
  animation,
  dimensions,
  mapType,
  z,
  renderOrder,
  worldPositionRef,
  onComplete,
}) {
  const meshRef = useRef(null);
  const completedIdRef = useRef(null);
  const texture = useTexture(APP_CONFIG.data.tilesetUrl);

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = 1;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
  }, [texture]);

  const coords = useMemo(() => resolveEntityCoords(entity, mapType), [entity, mapType]);
  const geometry = useMemo(
    () => (coords ? createTileGeometry(coords[0], coords[1], texture.image) : null),
    [coords, texture.image],
  );
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: texture,
        toneMapped: false,
        depthTest: false,
        depthWrite: false,
        transparent: true,
      }),
    [texture],
  );
  const initialPoint = useMemo(
    () => sampleMovementPath(animation, getNowMs()) || getEntityPoint(entity),
    [animation, entity],
  );
  const initialWorld = initialPoint ? tileToWorld(initialPoint.x, initialPoint.y, dimensions) : null;

  useEffect(() => () => material.dispose(), [material]);

  useEffect(
    () => () => {
      geometry?.dispose();
    },
    [geometry],
  );

  useEffect(() => {
    completedIdRef.current = null;
  }, [animation?.id]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh || !dimensions) return;

    const point = sampleMovementPath(animation) || getEntityPoint(entity);
    if (!point) return;

    const world = tileToWorld(point.x, point.y, dimensions);
    mesh.position.set(world.x, world.y, z);
    if (worldPositionRef) {
      worldPositionRef.current = { worldX: world.x, worldY: world.y };
    }

    if (point.done && animation?.id && completedIdRef.current !== animation.id) {
      completedIdRef.current = animation.id;
      onComplete?.(animation.id);
    }
  });

  if (!APP_CONFIG.dynamicEntities.visible || !entity || !geometry || !initialWorld) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={[initialWorld.x, initialWorld.y, z]}
      scale={[APP_CONFIG.dynamicEntities.scale, APP_CONFIG.dynamicEntities.scale, 1]}
      renderOrder={renderOrder}
      frustumCulled={false}
      raycast={() => null}
    />
  );
}

export default memo(AnimatedEntityLayer);
