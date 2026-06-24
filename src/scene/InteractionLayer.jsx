import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { APP_CONFIG } from '../config/appConfig.js';
import { tileToWorld, worldToTile } from '../utils/mapModel.js';
import { normalizeEmoji } from '../utils/tileResolver.js';
import HoverTile from './HoverTile.jsx';

const ROAD_TILE_EMOJIS = new Set(['▫️', '▪️', '🟦', '🟧', '🏕']);
const NPC_INTERACTION_KINDS = new Set(['npc', 'battlepoint']);
const TRANSITION_INTERACTION_KINDS = new Set(['transition']);

function tileKey(x, y) {
  return `${Number(x)},${Number(y)}`;
}

function addEntityKeys(target, entities) {
  for (const entity of Array.isArray(entities) ? entities : []) {
    const x = Number(entity?.x);
    const y = Number(entity?.y);
    if (Number.isFinite(x) && Number.isFinite(y)) target.add(tileKey(x, y));
  }
}

export default function InteractionLayer({
  map,
  dimensions,
  enabled = true,
  lockedTile = null,
  actionsByTile = {},
  hoverLayers = null,
  onTileClick,
}) {
  const [hoverTile, setHoverTile] = useState(null);
  const transitionEmojiSet = useMemo(() => new Set(APP_CONFIG.transitionLabels.arrows.map(normalizeEmoji)), []);
  const hoverIndex = useMemo(() => {
    const npcTiles = new Set();
    const transitionTiles = new Set();

    addEntityKeys(npcTiles, hoverLayers?.npcs);
    addEntityKeys(npcTiles, hoverLayers?.battlepoints);
    addEntityKeys(transitionTiles, hoverLayers?.transitions);

    return {
      npcTiles,
      transitionTiles,
    };
  }, [hoverLayers]);

  useEffect(() => {
    if (!enabled) setHoverTile(null);
  }, [enabled]);

  useEffect(() => {
    if (lockedTile) setHoverTile(null);
  }, [lockedTile]);

  const getTileHoverType = useCallback(
    (x, y) => {
      const key = tileKey(x, y);
      const actionKind = actionsByTile?.[key]?.kind;

      if (TRANSITION_INTERACTION_KINDS.has(actionKind) || hoverIndex.transitionTiles.has(key)) {
        return 'transition';
      }

      if (NPC_INTERACTION_KINDS.has(actionKind) || hoverIndex.npcTiles.has(key)) {
        return 'npc';
      }

      const row = Array.isArray(map?.layout?.[y]) ? map.layout[y] : null;
      const emoji = normalizeEmoji(row?.[x]);

      if (transitionEmojiSet.has(emoji)) return 'transition';
      if (ROAD_TILE_EMOJIS.has(emoji)) return 'road';
      return 'none';
    },
    [actionsByTile, hoverIndex, map, transitionEmojiSet],
  );

  const decorateTile = useCallback(
    (tile) => {
      if (!tile) return null;

      return {
        ...tile,
        hoverType: getTileHoverType(tile.x, tile.y),
      };
    },
    [getTileHoverType],
  );

  const getTileFromEvent = useCallback(
    (event) => {
      const tile = worldToTile(event.point.x, event.point.y, dimensions);
      const row = Array.isArray(map?.layout?.[tile.y]) ? map.layout[tile.y] : null;

      if (!row || tile.x < 0 || tile.x >= row.length) return null;

      const world = tileToWorld(tile.x, tile.y, dimensions);
      return decorateTile({
        x: tile.x,
        y: tile.y,
        worldX: world.x,
        worldY: world.y,
      });
    },
    [decorateTile, dimensions, map],
  );
  const visibleTile = useMemo(() => (lockedTile ? decorateTile(lockedTile) : hoverTile), [decorateTile, hoverTile, lockedTile]);

  if (!enabled) return null;

  return (
    <group>
      <mesh
        position={[0, 0, APP_CONFIG.hover.hitPlaneZ]}
        onPointerMove={(event) => {
          if (lockedTile) return;
          const tile = getTileFromEvent(event);
          setHoverTile((current) => {
            if (!tile) return null;
            if (current?.x === tile.x && current?.y === tile.y && current?.hoverType === tile.hoverType) return current;
            return tile;
          });
        }}
        onPointerOut={() => {
          if (!lockedTile) setHoverTile(null);
        }}
        onClick={(event) => {
          if (lockedTile) return;
          if (event.delta > APP_CONFIG.hover.clickDeltaTolerance) return;
          const tile = getTileFromEvent(event);
          if (tile) onTileClick?.(tile);
        }}
      >
        <planeGeometry args={[dimensions.cols, dimensions.rows]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <HoverTile tile={visibleTile} />
    </group>
  );
}
