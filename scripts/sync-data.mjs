import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = resolve(root, '..');

const files = [
  ['BOT_RPG/src/content/maps.json', 'public/data/maps.json'],
  ['BOT_RPG/data/tiles.jpg', 'public/data/tiles.jpg'],
  ['BOT_RPG/src/content/chars.json', 'src/battle/assets/chars.json'],
  ['BOT_RPG/src/content/chars.json', 'public/data/battle/chars.json'],
  ['BOT_RPG/src/content/abilities.json', 'src/battle/assets/abilities.json'],
  ['BOT_RPG/src/content/abilities.json', 'public/data/battle/abilities.json'],
  ['BOT_RPG/src/content/statuses.json', 'src/battle/assets/statuses.json'],
  ['BOT_RPG/src/content/statuses.json', 'public/data/battle/statuses.json'],
  ['BOT_RPG/src/content/effects.json', 'src/battle/assets/effects.json'],
  ['BOT_RPG/src/content/effects.json', 'public/data/battle/effects.json'],
  ['BOT_RPG/src/content/maps.json', 'src/battle/assets/maps.json'],
  ['BOT_RPG/src/content/maps.json', 'public/data/battle/maps.json'],
];

for (const [from, to] of files) {
  const target = resolve(root, to);

  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolve(workspaceRoot, from), target);
  console.log(`synced ${from} -> ${to}`);
}
