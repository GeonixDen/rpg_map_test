import React, { useCallback, useState } from 'react';
import { APP_CONFIG } from '../config/appConfig.js';
import { tileToWorld, worldToTile } from '../utils/mapModel.js';
import HoverTile from './HoverTile.jsx';

export default function InteractionLayer({ map, dimensions, onTileClick }) {
  const [hoverTile, setHoverTile] = useState(null);

  const getTileFromEvent = useCallback(
    (event) => {
      const tile = worldToTile(event.point.x, event.point.y, dimensions);
      const row = Array.isArray(map?.layout?.[tile.y]) ? map.layout[tile.y] : null;

      if (!row || tile.x < 0 || tile.x >= row.length) return null;

      const world = tileToWorld(tile.x, tile.y, dimensions);
      return {
        x: tile.x,
        y: tile.y,
        worldX: world.x,
        worldY: world.y,
      };
    },
    [dimensions, map],
  );

  return (
    <group>
      <mesh
        position={[0, 0, APP_CONFIG.hover.hitPlaneZ]}
        onPointerMove={(event) => {
          const tile = getTileFromEvent(event);
          setHoverTile((current) => {
            if (!tile) return null;
            if (current?.x === tile.x && current?.y === tile.y) return current;
            return tile;
          });
        }}
        onPointerOut={() => setHoverTile(null)}
        onClick={(event) => {
          if (event.delta > APP_CONFIG.hover.clickDeltaTolerance) return;
          const tile = getTileFromEvent(event);
          if (tile) onTileClick?.(tile);
        }}
      >
        <planeGeometry args={[dimensions.cols, dimensions.rows]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <HoverTile tile={hoverTile} />
    </group>
  );
}
