# BOT RPG Map Demo

Отдельная Vite-демка для просмотра карт из `BOT_RPG/src/content/maps.json` через React Three Fiber, Drei и react-spring.

```bash
npm install
npm run sync:data
npm run dev
```

Данные лежат в `public/data/maps.json` и `public/data/tiles.jpg`. Команда `npm run sync:data` обновляет их из проекта `BOT_RPG`.

## Backend live-слои

Демка умеет подключаться к `BOT_RPG` для инициализации игрока и отрисовки динамических слоев. Для локального dev-режима укажите те же `DEV_KEY` и user id, что использует backend:

```bash
VITE_SERVER_URL=http://localhost:3000
VITE_DEV_USER_ID=1023513907
VITE_DEV_KEY=...
VITE_BOT_USERNAME=T0000000000000000GHBOT
```

Если `VITE_DEV_USER_ID` не задан, демка по умолчанию берет админа `1023513907`. Старые имена `VITE_BOT_RPG_API_URL`, `VITE_BOT_RPG_DEV_USER_ID` и `VITE_BOT_RPG_DEV_KEY` тоже поддерживаются.
Если ключ не задан или backend недоступен, демка остается обычным просмотрщиком карт. Live snapshot содержит второй слой других игроков и третий слой NPC, врагов, расходников и текущего игрока.

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

Основные настройки находятся в `src/config/appConfig.js`: пути к данным, backend, параметры атласа, камера, LOD, hover, подписи переходов, туман краев, динамические слои, покачивание деревьев и границы карты. Покачивание деревьев проверяется по координатам выбранного тайла в `tiles.jpg`, уже после рандома из `TILE_MAP`. Соответствие эмодзи координатам `tiles.jpg` лежит в `src/config/tileMap.js`.
