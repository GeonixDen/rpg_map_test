import charsRaw from '../assets/chars.json';
import abilitiesRaw from '../assets/abilities.json';
import statusesRaw from '../assets/statuses.json';
import effectsRaw from '../assets/effects.json';
import mapsRaw from '../assets/maps.json';

export const SCENE_WIDTH = 600;
export const SCENE_HEIGHT = 480;
export const CHARACTER_DRAW_HEIGHT = 150;
export const EFFECT_DRAW_HEIGHT = 60;
export const STATUS_ICON_SIZE = 22;

const PUBLIC_DATA_PREFIX = '/data/';
const PUBLIC_ASSET_PREFIX = '/data/images/';

export function toPublicAssetPath(src = '') {
  const normalized = String(src || '').trim().replace(/\\/g, '/');

  if (!normalized) return '';
  if (/^(https?:)?\/\//.test(normalized)) return normalized;
  if (normalized.startsWith('/')) return normalized;

  return normalized
    .replace(/^(\.\.\/)+data\/images\//, PUBLIC_ASSET_PREFIX)
    .replace(/^\.?\/?data\/images\//, PUBLIC_ASSET_PREFIX)
    .replace(/^(\.\.\/)+data\//, PUBLIC_DATA_PREFIX)
    .replace(/^\.?\/?data\//, PUBLIC_DATA_PREFIX);
}

function normalizeMapBackground(background = {}) {
  return {
    width: Number(background?.width) || SCENE_WIDTH,
    height: Number(background?.height) || SCENE_HEIGHT,
    src: toPublicAssetPath(background?.src),
  };
}

export function normalizeBattleMaps(entries = {}) {
  return Object.fromEntries(
    Object.entries(entries || {}).map(([id, map]) => [
      id,
      {
        ...map,
        id: map?.id || id,
        name: map?.name || map?.name_en || id,
        background: normalizeMapBackground(map?.background),
      },
    ]),
  );
}

export const mapDefinitions = normalizeBattleMaps(mapsRaw);

export const charTemplates = {};
export const charImages = {};

Object.entries(charsRaw).forEach(([baseId, tpl]) => {
  let imgBase = tpl.src;
  let ext = '.png';
  const match = String(tpl.src || '').match(/(.*?)(1)(\.[a-zA-Z0-9]+)$/);

  if (match) {
    imgBase = match[1];
    ext = match[3];
  }

  charImages[baseId] = {};
  [1, 2, 3].forEach((tier) => {
    charImages[baseId][tier] = toPublicAssetPath(`${imgBase}${tier}${ext}`);
  });

  charTemplates[baseId] = {
    ...tpl,
    src: charImages[baseId][1],
  };
});

export const statusDefinitions = Object.fromEntries(
  Object.entries(statusesRaw).map(([id, status]) => [
    id,
    {
      ...status,
      id,
      src: toPublicAssetPath(status.src),
    },
  ]),
);

export const effectDefinitions = Object.fromEntries(
  Object.entries(effectsRaw).map(([id, effect]) => [
    id,
    {
      ...effect,
      id,
      height: Number(effect.height) || EFFECT_DRAW_HEIGHT,
      src: toPublicAssetPath(effect.src),
    },
  ]),
);

export const abilityDefinitions = Object.fromEntries(
  Object.entries(abilitiesRaw).map(([id, ability]) => [
    id,
    {
      ...ability,
      id,
    },
  ]),
);

export function getBattleBackground(mapId, mapsCatalog = mapDefinitions) {
  const fallbackBackground = mapDefinitions.betweenworlds?.background || {
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    src: `${PUBLIC_ASSET_PREFIX}bg/battle_betweenworlds.jpg`,
  };

  return mapsCatalog?.[mapId]?.background || fallbackBackground;
}
