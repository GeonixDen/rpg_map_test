import { APP_CONFIG } from '../config/appConfig.js';
import { getLoc } from './localization.js';
import { normalizeEmoji } from './tileResolver.js';
import { tileToWorld } from './mapModel.js';

export function buildTransitionLabels({ map, mapsDict, dimensions, lang = APP_CONFIG.transitionLabels.locale }) {
  const labels = [];
  const layout = Array.isArray(map?.layout) ? map.layout : null;
  const teleporters = Array.isArray(map?.teleporters) ? map.teleporters : [];
  const currentMapId = String(map?.id || '');
  const arrows = new Set(APP_CONFIG.transitionLabels.arrows);

  if (!layout || !teleporters.length || !currentMapId) return labels;

  for (const [index, tp] of teleporters.entries()) {
    const from = tp?.from || {};
    const to = tp?.to || {};

    if (from.map && String(from.map) !== currentMapId) continue;

    const x = Number(from.x);
    const y = Number(from.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    const emoji = normalizeEmoji(layout?.[y]?.[x]);
    if (!arrows.has(emoji)) continue;

    const destId = String(to.map || '').trim();
    if (!destId || destId === currentMapId) continue;

    const destMap = mapsDict?.[destId];
    const destName = getLoc(lang, destMap, 'name') || destId;
    const world = tileToWorld(x, y, dimensions);

    labels.push({
      key: `${currentMapId}:${x},${y}:${destId}:${index}`,
      x,
      y,
      emoji,
      destId,
      name: destName,
      worldX: world.x,
      worldY: world.y,
      placement: emoji === '🔽' ? 'below' : 'above',
    });
  }

  return labels;
}
