import { APP_CONFIG } from '../config/appConfig.js';
import { normalizeEmoji, resolveEmojiTile } from './tileResolver.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function getMapDimensions(map) {
  const layout = Array.isArray(map?.layout) ? map.layout : [];
  const rows = layout.length;
  const cols = layout.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);

  return {
    rows,
    cols,
    cells: layout.reduce((sum, row) => sum + (Array.isArray(row) ? row.length : 0), 0),
  };
}

export function tileToWorld(x, y, dimensions) {
  return {
    x: x - dimensions.cols / 2 + 0.5,
    y: dimensions.rows / 2 - y - 0.5,
  };
}

export function worldToTile(x, y, dimensions) {
  return {
    x: Math.floor(x + dimensions.cols / 2),
    y: Math.floor(dimensions.rows / 2 - y),
  };
}

export function buildChunkModel(map, chunkSize = APP_CONFIG.mapModel.chunkSize) {
  const dimensions = getMapDimensions(map);
  const layout = Array.isArray(map?.layout) ? map.layout : [];
  const mapType = map?.type || 'default';
  const chunksByCoord = new Map();
  const unknownByEmoji = new Map();
  const tileCountByKey = new Map();
  const fallback = resolveEmojiTile(APP_CONFIG.mapModel.fallbackEmoji, 0, 0, mapType) || [0, 10];

  for (let y = 0; y < layout.length; y += 1) {
    const row = Array.isArray(layout[y]) ? layout[y] : [];

    for (let x = 0; x < row.length; x += 1) {
      const emoji = normalizeEmoji(row[x]);
      let coords = resolveEmojiTile(emoji, x, y, mapType);

      if (!coords) {
        coords = fallback;
        unknownByEmoji.set(emoji, (unknownByEmoji.get(emoji) || 0) + 1);
      }

      const cx = Math.floor(x / chunkSize);
      const cy = Math.floor(y / chunkSize);
      const coordKey = `${cx},${cy}`;

      let chunk = chunksByCoord.get(coordKey);
      if (!chunk) {
        chunk = {
          id: coordKey,
          cx,
          cy,
          groups: new Map(),
        };
        chunksByCoord.set(coordKey, chunk);
      }

      const tileKey = `${coords[0]},${coords[1]}`;
      let group = chunk.groups.get(tileKey);
      if (!group) {
        group = {
          tileKey,
          tx: coords[0],
          ty: coords[1],
          positions: [],
        };
        chunk.groups.set(tileKey, group);
      }

      const world = tileToWorld(x, y, dimensions);
      group.positions.push(world.x, world.y);
      tileCountByKey.set(tileKey, (tileCountByKey.get(tileKey) || 0) + 1);
    }
  }

  const chunks = Array.from(chunksByCoord.values()).map((chunk) => {
    const x0 = chunk.cx * chunkSize;
    const y0 = chunk.cy * chunkSize;
    const x1 = Math.min((chunk.cx + 1) * chunkSize, dimensions.cols);
    const y1 = Math.min((chunk.cy + 1) * chunkSize, dimensions.rows);

    return {
      ...chunk,
      minX: x0 - dimensions.cols / 2,
      maxX: x1 - dimensions.cols / 2,
      minY: dimensions.rows / 2 - y1,
      maxY: dimensions.rows / 2 - y0,
      groups: Array.from(chunk.groups.values()).map((group) => ({
        ...group,
        count: group.positions.length / 2,
        positions: new Float32Array(group.positions),
      })),
    };
  });

  const byCoord = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const maxChunkX = Math.max(0, Math.ceil(dimensions.cols / chunkSize) - 1);
  const maxChunkY = Math.max(0, Math.ceil(dimensions.rows / chunkSize) - 1);

  return {
    id: map?.id || map?.name || 'map',
    mapType,
    dimensions,
    chunkSize,
    chunks,
    byCoord,
    maxChunkX,
    maxChunkY,
    tileCountByKey,
    unknownByEmoji,
    unknownCount: Array.from(unknownByEmoji.values()).reduce((sum, count) => sum + count, 0),
  };
}

export function getVisibleChunkRange(model, camera, size, marginChunks = 1) {
  if (!model || !camera || !size?.width || !size?.height) return null;

  const halfW = size.width / (2 * camera.zoom);
  const halfH = size.height / (2 * camera.zoom);
  const minX = camera.position.x - halfW;
  const maxX = camera.position.x + halfW;
  const minY = camera.position.y - halfH;
  const maxY = camera.position.y + halfH;

  const minTileX = Math.floor(minX + model.dimensions.cols / 2);
  const maxTileX = Math.ceil(maxX + model.dimensions.cols / 2);
  const minTileY = Math.floor(model.dimensions.rows / 2 - maxY);
  const maxTileY = Math.ceil(model.dimensions.rows / 2 - minY);

  const x0 = clamp(Math.floor(minTileX / model.chunkSize) - marginChunks, 0, model.maxChunkX);
  const x1 = clamp(Math.floor(maxTileX / model.chunkSize) + marginChunks, 0, model.maxChunkX);
  const y0 = clamp(Math.floor(minTileY / model.chunkSize) - marginChunks, 0, model.maxChunkY);
  const y1 = clamp(Math.floor(maxTileY / model.chunkSize) + marginChunks, 0, model.maxChunkY);

  return {
    x0,
    x1,
    y0,
    y1,
    key: `${x0}:${x1}:${y0}:${y1}`,
  };
}

export function chunksForRange(model, range) {
  if (!model || !range) return [];

  const chunks = [];
  for (let cy = range.y0; cy <= range.y1; cy += 1) {
    for (let cx = range.x0; cx <= range.x1; cx += 1) {
      const chunk = model.byCoord.get(`${cx},${cy}`);
      if (chunk) chunks.push(chunk);
    }
  }

  return chunks;
}
