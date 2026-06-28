import * as THREE from 'three';
import { APP_CONFIG } from '../config/appConfig.js';
import { normalizeEmoji, resolveEmojiTile } from '../utils/tileResolver.js';

const tileMapTextureCache = new Map();
let cacheTick = 0;

function getCacheKey(map, dimensions) {
  return `${map?.id || map?.name || 'map'}:${dimensions.cols}x${dimensions.rows}:${map?.type || 'default'}`;
}

function pruneTileMapTextureCache(activeKey, limit) {
  if (!Number.isFinite(limit) || limit <= 0) return;

  while (tileMapTextureCache.size > limit) {
    let oldestKey = null;
    let oldestTick = Infinity;

    for (const [key, entry] of tileMapTextureCache.entries()) {
      if (key === activeKey) continue;

      if (entry.lastUsed < oldestTick) {
        oldestTick = entry.lastUsed;
        oldestKey = key;
      }
    }

    if (!oldestKey) return;

    tileMapTextureCache.get(oldestKey)?.texture?.dispose();
    tileMapTextureCache.delete(oldestKey);
  }
}

function createTileMapTexture(map, dimensions, config = APP_CONFIG) {
  const { rows, cols } = dimensions;
  const data = new Uint8Array(Math.max(1, cols) * Math.max(1, rows) * 4);
  const layout = Array.isArray(map?.layout) ? map.layout : [];
  const mapType = map?.type || 'default';
  const fallback = resolveEmojiTile(config.mapModel.fallbackEmoji, 0, 0, mapType) || [0, 10];
  const treeSwayTileKeys = new Set((config.treeSway.tileCoords || []).map(([tx, ty]) => `${tx},${ty}`));

  for (let y = 0; y < rows; y += 1) {
    const row = Array.isArray(layout[y]) ? layout[y] : [];

    for (let x = 0; x < cols; x += 1) {
      const flippedY = rows - 1 - y;
      const offset = (flippedY * cols + x) * 4;

      if (x >= row.length) {
        data[offset + 3] = 0;
        continue;
      }

      const emoji = normalizeEmoji(row[x]);
      const coords = resolveEmojiTile(emoji, x, y, mapType) || fallback;
      const tx = Math.max(0, Math.min(255, Number(coords[0]) || 0));
      const ty = Math.max(0, Math.min(255, Number(coords[1]) || 0));

      data[offset] = tx;
      data[offset + 1] = ty;
      data[offset + 2] = treeSwayTileKeys.has(`${tx},${ty}`) ? 255 : 0;
      data[offset + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, Math.max(1, cols), Math.max(1, rows), THREE.RGBAFormat);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export function getTileMapTexture(map, dimensions, config = APP_CONFIG) {
  const key = getCacheKey(map, dimensions);
  const cached = tileMapTextureCache.get(key);

  if (cached) {
    cached.lastUsed = ++cacheTick;
    return cached.texture;
  }

  const texture = createTileMapTexture(map, dimensions, config);
  tileMapTextureCache.set(key, {
    texture,
    lastUsed: ++cacheTick,
  });
  pruneTileMapTextureCache(key, config.mapRenderer.tileMapCacheLimit);
  return texture;
}

export function disposeTileMapTextureCache() {
  for (const entry of tileMapTextureCache.values()) {
    entry.texture.dispose();
  }

  tileMapTextureCache.clear();
}
