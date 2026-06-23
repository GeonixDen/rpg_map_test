import * as THREE from 'three';
import { APP_CONFIG } from '../config/appConfig.js';

export function createTileGeometry(tx, ty, image, atlas = APP_CONFIG.tileAtlas) {
  const { tileSize, gap, margin, uvInset } = atlas;
  const sx = margin + tx * (tileSize + gap);
  const sy = margin + ty * (tileSize + gap);
  const u0 = (sx + uvInset) / image.width;
  const u1 = (sx + tileSize - uvInset) / image.width;
  const vTop = 1 - (sy + uvInset) / image.height;
  const vBottom = 1 - (sy + tileSize - uvInset) / image.height;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        -0.5, -0.5, 0,
        0.5, -0.5, 0,
        0.5, 0.5, 0,
        -0.5, 0.5, 0,
      ],
      3,
    ),
  );
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([u0, vBottom, u1, vBottom, u1, vTop, u0, vTop], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeBoundingSphere();
  return geometry;
}
