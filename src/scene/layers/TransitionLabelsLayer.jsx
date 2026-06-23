import React, { useEffect, useMemo } from 'react';
import { APP_CONFIG } from '../../config/appConfig.js';
import { buildTransitionLabels } from '../../utils/transitions.js';
import { createTransitionBadgeTexture } from '../transitionBadgeTexture.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function TransitionBadge({ label, dimensions }) {
  const badge = useMemo(() => createTransitionBadgeTexture(label.name), [label.name]);
  const cfg = APP_CONFIG.transitionLabels;

  useEffect(
    () => () => {
      badge.texture.dispose();
    },
    [badge],
  );

  const uncappedWorldWidth = badge.pixelWidth / cfg.pixelsPerTile;
  const width = Math.min(cfg.maxBadgeTiles, Math.max(cfg.minWorldWidth, uncappedWorldWidth));
  const height = width * (badge.pixelHeight / badge.pixelWidth);
  const minX = -dimensions.cols / 2 + width / 2;
  const maxX = dimensions.cols / 2 - width / 2;
  const minY = -dimensions.rows / 2 + height / 2;
  const maxY = dimensions.rows / 2 - height / 2;
  const x = clamp(label.worldX, minX, maxX);
  const y =
    label.placement === 'below'
      ? clamp(label.worldY - 0.5 - cfg.offsetTiles - height / 2, minY, maxY)
      : clamp(label.worldY + 0.5 + cfg.offsetTiles + height / 2, minY, maxY);

  return (
    <mesh position={[x, y, cfg.z]} renderOrder={900} raycast={() => null}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={badge.texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

export default function TransitionLabelsLayer({ map, mapsDict, dimensions, visible }) {
  const labels = useMemo(
    () =>
      buildTransitionLabels({
        map,
        mapsDict,
        dimensions,
        lang: APP_CONFIG.transitionLabels.locale,
      }),
    [dimensions, map, mapsDict],
  );

  if (!visible || labels.length === 0) return null;

  return (
    <group>
      {labels.map((label) => (
        <TransitionBadge key={label.key} label={label} dimensions={dimensions} />
      ))}
    </group>
  );
}
