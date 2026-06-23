import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Focus, Route } from 'lucide-react';
import { APP_CONFIG } from '../config/appConfig.js';
import { createMapEntries } from '../data/mapEntries.js';
import { useMapsData } from '../data/useMapsData.js';
import MapScene from '../scene/MapScene.jsx';
import { buildChunkModel } from '../utils/mapModel.js';
import { formatNumber } from '../utils/format.js';

export default function App() {
  const { loading, maps, error } = useMapsData();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [fitSignal, setFitSignal] = useState(0);
  const [cameraDistance, setCameraDistance] = useState(APP_CONFIG.camera.distance.default);
  const [clickedTile, setClickedTile] = useState(null);
  const [focusTarget, setFocusTarget] = useState(null);
  const [showTransitionLabels, setShowTransitionLabels] = useState(APP_CONFIG.transitionLabels.visibleByDefault);
  const [renderStats, setRenderStats] = useState({
    mode: 'chunks',
    visibleChunks: 0,
    totalChunks: 0,
  });

  const mapEntries = useMemo(() => createMapEntries(maps), [maps]);

  useEffect(() => {
    if (selectedIndex >= mapEntries.length) setSelectedIndex(0);
  }, [mapEntries.length, selectedIndex]);

  const selected = mapEntries[selectedIndex] || null;
  const model = useMemo(() => (selected ? buildChunkModel(selected.map) : null), [selected]);

  useEffect(() => {
    setFitSignal((value) => value + 1);
    setClickedTile(null);
    setFocusTarget(null);
  }, [selected?.id]);

  const goToMap = (nextIndex) => {
    if (!mapEntries.length) return;
    setSelectedIndex((nextIndex + mapEntries.length) % mapEntries.length);
  };

  if (loading) {
    return <div className="app-status">Загрузка карт...</div>;
  }

  if (error || !selected || !model) {
    return <div className="app-status">Не удалось загрузить карты: {error?.message || 'пустой список'}</div>;
  }

  return (
    <main className="app-shell">
      <div className="map-toolbar">
        <div className="map-toolbar__main">
          <button className="icon-button" type="button" onClick={() => goToMap(selectedIndex - 1)} title="Предыдущая карта">
            <ChevronLeft size={18} />
          </button>
          <select
            className="map-select"
            value={selected.id}
            onChange={(event) => {
              const index = mapEntries.findIndex((entry) => entry.id === event.target.value);
              if (index >= 0) setSelectedIndex(index);
            }}
          >
            {mapEntries.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title} · {entry.id}
              </option>
            ))}
          </select>
          <button className="icon-button" type="button" onClick={() => goToMap(selectedIndex + 1)} title="Следующая карта">
            <ChevronRight size={18} />
          </button>
          <button className="icon-button" type="button" onClick={() => setFitSignal((value) => value + 1)} title="Показать всю карту">
            <Focus size={18} />
          </button>
          <button
            className={`icon-button ${showTransitionLabels ? 'is-active' : ''}`}
            type="button"
            onClick={() => setShowTransitionLabels((value) => !value)}
            title="Подписи переходов"
          >
            <Route size={18} />
          </button>
        </div>
        <label className="camera-distance">
          <span>Дальность</span>
          <input
            type="range"
            min={APP_CONFIG.camera.distance.min}
            max={APP_CONFIG.camera.distance.max}
            step={APP_CONFIG.camera.distance.step}
            value={cameraDistance}
            onChange={(event) => setCameraDistance(Number(event.target.value))}
          />
          <output>{cameraDistance}</output>
        </label>
      </div>

      <section className="map-meta" aria-label="Информация о карте">
        <div>
          <strong>{selected.title}</strong>
          <span>{selected.id}</span>
        </div>
        <dl>
          <div>
            <dt>Размер</dt>
            <dd>
              {selected.dimensions.cols} x {selected.dimensions.rows}
            </dd>
          </div>
          <div>
            <dt>Клетки</dt>
            <dd>{formatNumber(selected.dimensions.cells)}</dd>
          </div>
          <div>
            <dt>Тип</dt>
            <dd>{selected.map.type || 'default'}</dd>
          </div>
          <div>
            <dt>Рендер</dt>
            <dd>{renderStats.mode === 'overview' ? 'overview' : `${renderStats.visibleChunks}/${renderStats.totalChunks} chunks`}</dd>
          </div>
          <div>
            <dt>Неизвестно</dt>
            <dd>{model.unknownCount}</dd>
          </div>
          <div>
            <dt>Клик</dt>
            <dd>{clickedTile ? `${clickedTile.x}, ${clickedTile.y}` : '-'}</dd>
          </div>
        </dl>
      </section>

      <MapScene
        map={selected.map}
        mapsDict={maps}
        model={model}
        fitSignal={fitSignal}
        showTransitionLabels={showTransitionLabels}
        cameraDistance={cameraDistance}
        focusTarget={focusTarget}
        onTileClick={(tile) => {
          setClickedTile({ x: tile.x, y: tile.y });
          setFocusTarget({ ...tile, nonce: Date.now() });
        }}
        onRenderStats={setRenderStats}
      />
    </main>
  );
}
