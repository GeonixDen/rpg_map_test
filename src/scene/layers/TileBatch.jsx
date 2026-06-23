import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { createTileGeometry } from '../tileGeometry.js';

const tempObject = new THREE.Object3D();

export default function TileBatch({ group, image, material }) {
  const meshRef = useRef(null);
  const geometry = useMemo(() => createTileGeometry(group.tx, group.ty, image), [group.tx, group.ty, image]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let i = 0, p = 0; i < group.count; i += 1, p += 2) {
      tempObject.position.set(group.positions[p], group.positions[p + 1], 0);
      tempObject.updateMatrix();
      mesh.setMatrixAt(i, tempObject.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [group]);

  useLayoutEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );

  return <instancedMesh ref={meshRef} args={[geometry, material, group.count]} material={material} frustumCulled={false} />;
}
