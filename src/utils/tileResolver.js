import { TILE_MAP } from '../config/tileMap.js';

export function normalizeEmoji(value) {
  return String(value ?? '').normalize('NFKC');
}

export function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pickWeightedOption(options, x, y, emoji, salt = '') {
  let total = 0;
  const weights = new Array(options.length);

  for (let i = 0; i < options.length; i += 1) {
    const opt = options[i];
    const weight = Array.isArray(opt) && opt.length >= 3 && Number.isFinite(opt[2]) && opt[2] > 0 ? opt[2] : 1;
    weights[i] = weight;
    total += weight;
  }

  if (total <= 0) return options[0];

  const h = hash32(`${emoji}|${x},${y}|${salt}`);
  let r = h % total;

  for (let i = 0; i < options.length; i += 1) {
    if (r < weights[i]) return options[i];
    r -= weights[i];
  }

  return options[options.length - 1];
}

export function resolveEmojiTile(emoji, x, y, mapType = 'default', tileMap = TILE_MAP) {
  const entry = tileMap[emoji];
  if (!entry) return null;

  if (Array.isArray(entry) && typeof entry[0] === 'number') {
    return [entry[0], entry[1]];
  }

  if (Array.isArray(entry) && Array.isArray(entry[0])) {
    const picked = pickWeightedOption(entry, x, y, emoji, 'top');
    return [picked[0], picked[1]];
  }

  const options = entry[mapType] || entry.default;
  if (!Array.isArray(options) || options.length === 0) return null;
  if (options.length === 1) return [options[0][0], options[0][1]];

  const picked = pickWeightedOption(options, x, y, emoji, mapType);
  return [picked[0], picked[1]];
}
