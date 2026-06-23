import * as THREE from 'three';
import { APP_CONFIG } from '../config/appConfig.js';
import { normalizeEmoji, resolveEmojiTile } from '../utils/tileResolver.js';

export function createOverviewTexture(map, model, atlasImage, config = APP_CONFIG) {
  const { tileSize, gap, margin } = config.tileAtlas;
  const { rows, cols, cells } = model.dimensions;
  const { lod } = config;
  const stride = Math.max(1, Math.ceil(Math.max(cols, rows) / lod.maxOverviewTextureDim));
  const tilePx = stride > 1 ? lod.coarseTilePx : cells <= lod.detailedTilePxCellLimit ? lod.detailedTilePx : lod.coarseTilePx;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(cols / stride) * tilePx);
  canvas.height = Math.max(1, Math.ceil(rows / stride) * tilePx);

  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#07090b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const layout = Array.isArray(map?.layout) ? map.layout : [];
  const mapType = map?.type || 'default';
  const fallback = resolveEmojiTile(config.mapModel.fallbackEmoji, 0, 0, mapType) || [0, 10];

  for (let y = 0; y < rows; y += stride) {
    const row = Array.isArray(layout[y]) ? layout[y] : [];
    for (let x = 0; x < row.length; x += stride) {
      const emoji = normalizeEmoji(row[x]);
      const [tx, ty] = resolveEmojiTile(emoji, x, y, mapType) || fallback;
      const sx = margin + tx * (tileSize + gap);
      const sy = margin + ty * (tileSize + gap);
      ctx.drawImage(
        atlasImage,
        sx,
        sy,
        tileSize,
        tileSize,
        Math.floor(x / stride) * tilePx,
        Math.floor(y / stride) * tilePx,
        tilePx,
        tilePx,
      );
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
