# BOT RPG Map Demo

Отдельная Vite-демка для просмотра карт из `BOT_RPG/src/content/maps.json` через React Three Fiber, Drei и react-spring.

```bash
npm install
npm run sync:data
npm run dev
```

Данные лежат в `public/data/maps.json` и `public/data/tiles.jpg`. Команда `npm run sync:data` обновляет их из проекта `BOT_RPG`.

## Структура

```text
src/
  app/            UI приложения и состояние выбранной карты
  config/         настройки демки и TILE_MAP
  data/           загрузка и подготовка maps.json
  scene/          React Three Fiber сцена
  scene/layers/   слои карты: тайлы, overview, границы, туман краев, подписи переходов
  scene/materials WebGL/Shader материалы
  utils/          чистые функции для координат, чанков и тайлов
```

Основные настройки находятся в `src/config/appConfig.js`: пути к данным, параметры атласа, камера, LOD, hover, подписи переходов, туман краев и границы карты. Соответствие эмодзи координатам `tiles.jpg` лежит в `src/config/tileMap.js`.
