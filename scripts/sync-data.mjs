import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = resolve(root, '..');

const files = [
  ['BOT_RPG/src/content/maps.json', 'public/data/maps.json'],
  ['BOT_RPG/data/tiles.jpg', 'public/data/tiles.jpg'],
];

await mkdir(resolve(root, 'public/data'), { recursive: true });

for (const [from, to] of files) {
  await copyFile(resolve(workspaceRoot, from), resolve(root, to));
  console.log(`synced ${from} -> ${to}`);
}
