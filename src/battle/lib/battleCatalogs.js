import {
  abilityDefinitions,
  charTemplates,
  effectDefinitions,
  mapDefinitions,
  normalizeBattleMaps,
  statusDefinitions,
  toPublicAssetPath,
} from './battleData';

const PUBLIC_ENDPOINTS = {
  abilities: '/data/battle/abilities.json',
  chars: '/data/battle/chars.json',
  statuses: '/data/battle/statuses.json',
  effects: '/data/battle/effects.json',
  maps: '/data/battle/maps.json',
};

export const FALLBACK_BATTLE_CATALOGS = {
  abilities: abilityDefinitions,
  chars: charTemplates,
  statuses: statusDefinitions,
  effects: effectDefinitions,
  maps: mapDefinitions,
};

function normalizeCatalogAssetMap(entries = {}) {
  return Object.fromEntries(
    Object.entries(entries).map(([id, value]) => [
      id,
      {
        ...value,
        id,
        ...(value?.src ? { src: toPublicAssetPath(value.src) } : {}),
      },
    ]),
  );
}

async function fetchJsonCatalog(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  return response.json();
}

export async function loadPublicBattleCatalogs() {
  const [abilities, chars, statuses, effects, maps] = await Promise.all([
    fetchJsonCatalog(PUBLIC_ENDPOINTS.abilities),
    fetchJsonCatalog(PUBLIC_ENDPOINTS.chars),
    fetchJsonCatalog(PUBLIC_ENDPOINTS.statuses),
    fetchJsonCatalog(PUBLIC_ENDPOINTS.effects),
    fetchJsonCatalog(PUBLIC_ENDPOINTS.maps),
  ]);

  return {
    abilities: Object.fromEntries(
      Object.entries(abilities || {}).map(([id, ability]) => [id, { ...ability, id }]),
    ),
    chars: Object.fromEntries(
      Object.entries(chars || {}).map(([id, char]) => [id, { ...char, id }]),
    ),
    statuses: normalizeCatalogAssetMap(statuses || {}),
    effects: normalizeCatalogAssetMap(effects || {}),
    maps: normalizeBattleMaps(maps || {}),
  };
}

export function mergeBattleCatalogs(baseCatalogs, overrideCatalogs) {
  return {
    abilities: { ...(baseCatalogs?.abilities || {}), ...(overrideCatalogs?.abilities || {}) },
    chars: { ...(baseCatalogs?.chars || {}), ...(overrideCatalogs?.chars || {}) },
    statuses: { ...(baseCatalogs?.statuses || {}), ...(overrideCatalogs?.statuses || {}) },
    effects: { ...(baseCatalogs?.effects || {}), ...(overrideCatalogs?.effects || {}) },
    maps: { ...(baseCatalogs?.maps || {}), ...(overrideCatalogs?.maps || {}) },
  };
}
