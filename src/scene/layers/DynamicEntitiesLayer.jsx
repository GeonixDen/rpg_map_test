import React, { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { APP_CONFIG } from '../../config/appConfig.js';
import { tileToWorld } from '../../utils/mapModel.js';
import { resolveEmojiTile } from '../../utils/tileResolver.js';
import { createTileGeometry } from '../tileGeometry.js';

const tempObject = new THREE.Object3D();

function resolveEntityCoords(entity, mapType) {
  const emoji = entity?.emoji;
  const fallbackEmoji = APP_CONFIG.dynamicEntities.fallbackEmojiByKind[entity?.kind] || APP_CONFIG.mapModel.fallbackEmoji;
  return (
    resolveEmojiTile(emoji, Number(entity?.x) || 0, Number(entity?.y) || 0, mapType) ||
    resolveEmojiTile(fallbackEmoji, Number(entity?.x) || 0, Number(entity?.y) || 0, mapType) ||
    resolveEmojiTile(APP_CONFIG.mapModel.fallbackEmoji, 0, 0, mapType)
  );
}

function buildEntityGroups(entities, dimensions, mapType) {
  const groupsByTile = new Map();

  for (const entity of Array.isArray(entities) ? entities : []) {
    const x = Number(entity?.x);
    const y = Number(entity?.y);
    const renderX = Number.isFinite(Number(entity?.renderX)) ? Number(entity.renderX) : x;
    const renderY = Number.isFinite(Number(entity?.renderY)) ? Number(entity.renderY) : y;
    if (!Number.isInteger(x) || !Number.isInteger(y)) continue;
    if (y < 0 || y >= dimensions.rows || x < 0 || x >= dimensions.cols) continue;

    const coords = resolveEntityCoords(entity, mapType);
    if (!coords) continue;

    const tileKey = `${coords[0]},${coords[1]}`;
    let group = groupsByTile.get(tileKey);
    if (!group) {
      group = {
        id: tileKey,
        tx: coords[0],
        ty: coords[1],
        positions: [],
      };
      groupsByTile.set(tileKey, group);
    }

    const world = tileToWorld(renderX, renderY, dimensions);
    group.positions.push(world.x, world.y);
  }

  return Array.from(groupsByTile.values()).map((group) => ({
    ...group,
    count: group.positions.length / 2,
    positions: new Float32Array(group.positions),
  }));
}

function EntityBatch({ group, image, material, z, scale, renderOrder }) {
  const meshRef = useRef(null);
  const geometry = useMemo(() => createTileGeometry(group.tx, group.ty, image), [group.tx, group.ty, image]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let i = 0, p = 0; i < group.count; i += 1, p += 2) {
      tempObject.position.set(group.positions[p], group.positions[p + 1], 0);
      tempObject.scale.set(scale, scale, 1);
      tempObject.updateMatrix();
      mesh.setMatrixAt(i, tempObject.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [group, scale]);

  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, group.count]}
      material={material}
      position={[0, 0, z]}
      renderOrder={renderOrder}
      frustumCulled={false}
      raycast={() => null}
    />
  );
}

function DynamicEntitiesLayer({ entities, dimensions, mapType, z, renderOrder }) {
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

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: texture,
        toneMapped: false,
        depthTest: false,
        depthWrite: false,
      }),
    [texture],
  );

  useEffect(() => () => material.dispose(), [material]);

  const groups = useMemo(() => buildEntityGroups(entities, dimensions, mapType), [dimensions, entities, mapType]);
  if (!APP_CONFIG.dynamicEntities.visible || groups.length === 0) return null;

  return (
    <group>
      {groups.map((group) => (
        <EntityBatch
          key={group.id}
          group={group}
          image={texture.image}
          material={material}
          z={z}
          scale={APP_CONFIG.dynamicEntities.scale}
          renderOrder={renderOrder}
        />
      ))}
    </group>
  );
}

export default memo(DynamicEntitiesLayer);
