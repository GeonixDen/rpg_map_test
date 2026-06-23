import { getMapDimensions } from '../utils/mapModel.js';

export function createMapEntries(maps) {
  if (!maps) return [];

  return Object.entries(maps)
    .filter(([, map]) => Array.isArray(map?.layout) && map.layout.length > 0)
    .map(([id, map]) => ({
      id,
      map: { ...map, id: map.id || id },
      dimensions: getMapDimensions(map),
      title: map.name || map.name_en || id,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
