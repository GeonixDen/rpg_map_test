import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Map as MapIcon, Route, SlidersHorizontal, UsersRound } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import MapScene from '../scene/MapScene.jsx';
import { useMapDemoStore } from '../store/mapDemoStore.js';
import { buildChunkModel, tileToWorld } from '../utils/mapModel.js';
import { formatNumber } from '../utils/format.js';
import BattleModal from '../battle/BattleModal.jsx';
import DialogModal from './DialogModal.jsx';
import JournalModal from './JournalModal.jsx';
import MapKeyboardPanel from './MapKeyboardPanel.jsx';
import SquadModal from './SquadModal.jsx';
import ToastStack from './ToastStack.jsx';

const EMPTY_ARRAY = Object.freeze([]);
const EMPTY_OBJECT = Object.freeze({});

function DemoPanels({
  selected,
  model,
  serverPlayer,
  live,
  liveLabel,
  showTransitionLabels,
  setShowTransitionLabels,
}) {
  const renderStats = useMapDemoStore((state) => state.renderStats);

  return (
    <>
      <div className="map-toolbar">
        <div className="map-toolbar__main">
          <div className="map-toolbar__title" title={selected.id}>
            {selected.title} · {selected.id}
          </div>
          <button
            className={`icon-button ${showTransitionLabels ? 'is-active' : ''}`}
            type="button"
            onClick={() => setShowTransitionLabels(!showTransitionLabels)}
            title="Подписи переходов"
          >
            <Route size={18} />
          </button>
        </div>
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
            <dd>
              {renderStats.mode === 'overview'
                ? 'overview'
                : `${renderStats.visibleChunks}/${renderStats.totalChunks} chunks`}
            </dd>
          </div>
          <div>
            <dt>Неизвестно</dt>
            <dd>{model.unknownCount}</dd>
          </div>
          <div>
            <dt>Клик</dt>
            <dd>-</dd>
          </div>
          <div>
            <dt>Игрок</dt>
            <dd>{serverPlayer ? `${serverPlayer.x}, ${serverPlayer.y}` : '-'}</dd>
          </div>
          <div>
            <dt>Live</dt>
            <dd title={live.error || live.actionError || ''}>{live.actionError || liveLabel}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}

export default function App() {
  const [showDemoPanels, setShowDemoPanels] = useState(false);
  const [cameraMode, setCameraMode] = useState('follow');
  const [squadModalOpen, setSquadModalOpen] = useState(false);
  const [journalModalOpen, setJournalModalOpen] = useState(false);
  const {
    loading,
    maps,
    mapEntries,
    selectedId,
    error,
    showTransitionLabels,
    toasts,
    dialogModal,
    battlePresentation,
    mapKeyboardRows,
    movementAnimation,
    selectedActionTile,
    live,
    loadMaps,
    connectLive,
    disconnectLive,
    setShowTransitionLabels,
    setRenderStats,
    handleTileClick,
    sendServerAction,
    dismissToast,
    clearMovementAnimation,
  } = useMapDemoStore(
    useShallow((state) => ({
      loading: state.loading,
      maps: state.maps,
      mapEntries: state.mapEntries,
      selectedId: state.selectedId,
      error: state.error,
      showTransitionLabels: state.showTransitionLabels,
      toasts: state.toasts,
      dialogModal: state.dialogModal,
      battlePresentation: state.battlePresentation,
      mapKeyboardRows: state.mapKeyboardRows,
      movementAnimation: state.movementAnimation,
      selectedActionTile: state.selectedActionTile,
      live: state.live,
      loadMaps: state.loadMaps,
      connectLive: state.connectLive,
      disconnectLive: state.disconnectLive,
      setShowTransitionLabels: state.setShowTransitionLabels,
      setRenderStats: state.setRenderStats,
      handleTileClick: state.handleTileClick,
      sendServerAction: state.sendServerAction,
      dismissToast: state.dismissToast,
      clearMovementAnimation: state.clearMovementAnimation,
    })),
  );

  useEffect(() => {
    loadMaps();
    connectLive();
    return () => disconnectLive();
  }, [connectLive, disconnectLive, loadMaps]);

  const selectedIndex = Math.max(0, mapEntries.findIndex((entry) => entry.id === selectedId));
  const selected = mapEntries[selectedIndex] || null;
  const model = useMemo(() => (selected ? buildChunkModel(selected.map) : null), [selected]);
  const liveOnSelectedMap = live.mapState?.ok && live.mapState.mapId === selected?.id ? live.mapState : null;
  const liveUiType = String(liveOnSelectedMap?.uiState?.type || '').toLowerCase();
  const currentUiType = String(live.mapState?.uiState?.type || '').toLowerCase();
  const battleUiType = String(live.battleState?.uiState?.type || currentUiType).toLowerCase();
  const battleModalVisible = battleUiType === 'battle' || battleUiType === 'battleresult';
  const serverPlayer = liveOnSelectedMap?.player || null;
  const squadState = liveOnSelectedMap?.squad || null;
  const journalState = liveOnSelectedMap?.journal || null;
  const questGuide = journalState?.guide || null;
  const activeMovementAnimation = movementAnimation?.mapId === selected?.id ? movementAnimation : null;
  const liveLayers = liveOnSelectedMap?.layers;
  const actionsByTile = liveOnSelectedMap?.actionsByTile || EMPTY_OBJECT;
  const otherPlayers = liveLayers?.otherPlayers || EMPTY_ARRAY;
  const actors = useMemo(() => {
    if (!liveOnSelectedMap) return EMPTY_ARRAY;

    return [
      ...(liveLayers?.consumables || EMPTY_ARRAY),
      ...(liveLayers?.huntTiles || EMPTY_ARRAY),
      ...(liveLayers?.enemies || EMPTY_ARRAY),
      ...(liveLayers?.npcs || EMPTY_ARRAY),
    ].filter(Boolean);
  }, [liveLayers, liveOnSelectedMap]);
  const lockedHoverTile = useMemo(() => {
    const canShowLockedTile =
      selectedActionTile?.mapId === selected?.id &&
      (live.actionStatus === 'sending' || !!activeMovementAnimation);

    if (!canShowLockedTile || !model) return null;

    const x = Number(selectedActionTile.x);
    const y = Number(selectedActionTile.y);
    if (!Number.isInteger(x) || !Number.isInteger(y)) return null;

    const world = tileToWorld(x, y, model.dimensions);
    return {
      x,
      y,
      worldX: world.x,
      worldY: world.y,
    };
  }, [activeMovementAnimation, live.actionStatus, model, selected?.id, selectedActionTile]);
  const visibleMapKeyboardRows =
    liveOnSelectedMap && liveUiType === 'map' && !dialogModal && !battleModalVisible && cameraMode === 'follow'
      ? mapKeyboardRows
      : EMPTY_ARRAY;
  const showMapViewToggle = !!liveOnSelectedMap && !dialogModal && !battleModalVisible;
  const showSquadToggle = !!squadState && !dialogModal && !battleModalVisible;
  const showJournalToggle = !!journalState && !dialogModal && !battleModalVisible;
  const isFullMap = cameraMode === 'full';
  const mapInteractionEnabled = cameraMode === 'follow' && !dialogModal && !battleModalVisible;
  const actionBusy = live.actionStatus === 'sending';
  const handleUiAction = useCallback(
    (action) => {
      if (!action || action === 'noop') return null;
      return sendServerAction(action);
    },
    [sendServerAction],
  );
  const handleMapKeyboardAction = useCallback(
    (action) => {
      if (action === 'showSq') {
        setSquadModalOpen(true);
        setJournalModalOpen(false);
        return null;
      }

      if (action === 'journal' || action === 'journalHints') {
        setJournalModalOpen(true);
        setSquadModalOpen(false);
        return null;
      }

      return handleUiAction(action);
    },
    [handleUiAction],
  );

  useEffect(() => {
    if (dialogModal || battleModalVisible || !squadState) {
      setSquadModalOpen(false);
    }
  }, [battleModalVisible, dialogModal, squadState]);

  useEffect(() => {
    if (dialogModal || battleModalVisible || !journalState) {
      setJournalModalOpen(false);
    }
  }, [battleModalVisible, dialogModal, journalState]);
  const liveLabel =
    live.status === 'ready'
      ? `${live.transport || 'live'} ${otherPlayers.length}/${actors.length}${
          live.actionStatus === 'sending' ? ' move...' : ''
        }`
      : live.status;

  if (loading) {
    return <div className="app-status">Загрузка карт...</div>;
  }

  if (error || !selected || !model) {
    return <div className="app-status">Не удалось загрузить карты: {error?.message || 'пустой список'}</div>;
  }

  return (
    <main className="app-shell">
      <button
        className={`demo-toggle ${showDemoPanels ? 'is-active' : ''}`}
        type="button"
        onClick={() => setShowDemoPanels((visible) => !visible)}
        title="Демо панели"
      >
        <SlidersHorizontal size={13} />
      </button>

      {showMapViewToggle ? (
        <button
          className={`map-view-toggle ${isFullMap ? 'is-active' : ''}`}
          type="button"
          onClick={() => setCameraMode((mode) => (mode === 'full' ? 'follow' : 'full'))}
          title={isFullMap ? 'Следовать за игроком' : 'Карта'}
        >
          <MapIcon size={15} />
          <span>{isFullMap ? 'Игрок' : 'Карта'}</span>
        </button>
      ) : null}

      {showSquadToggle ? (
        <button
          className={`squad-toggle ${squadModalOpen ? 'is-active' : ''}`}
          type="button"
          onClick={() => {
            setSquadModalOpen(true);
            setJournalModalOpen(false);
          }}
          title="Отряд"
        >
          <UsersRound size={15} />
          <span>Отряд</span>
        </button>
      ) : null}

      {showJournalToggle ? (
        <button
          className={`journal-toggle ${journalModalOpen ? 'is-active' : ''}`}
          type="button"
          onClick={() => {
            setJournalModalOpen(true);
            setSquadModalOpen(false);
          }}
          title="Журнал"
        >
          <BookOpen size={15} />
          <span>Журнал</span>
        </button>
      ) : null}

      {showDemoPanels ? (
        <DemoPanels
          selected={selected}
          model={model}
          serverPlayer={serverPlayer}
          live={live}
          liveLabel={liveLabel}
          showTransitionLabels={showTransitionLabels}
          setShowTransitionLabels={setShowTransitionLabels}
        />
      ) : null}

      <MapScene
        map={selected.map}
        mapsDict={maps}
        model={model}
        cameraMode={cameraMode}
        showTransitionLabels={showTransitionLabels}
        interactionEnabled={mapInteractionEnabled}
        lockedHoverTile={lockedHoverTile}
        hoverLayers={liveLayers}
        actionsByTile={actionsByTile}
        movementAnimation={activeMovementAnimation}
        playerEntity={serverPlayer}
        questGuide={questGuide}
        onMovementComplete={clearMovementAnimation}
        onTileClick={handleTileClick}
        otherPlayers={otherPlayers}
        actors={actors}
        onRenderStats={setRenderStats}
      />
      <DialogModal
        dialog={battleModalVisible ? null : dialogModal}
        busy={actionBusy}
        onAction={handleUiAction}
      />
      <BattleModal
        battleState={live.battleState}
        presentation={battlePresentation}
        uiType={battleUiType}
        busy={actionBusy}
        onAction={handleUiAction}
      />
      <SquadModal
        squad={squadState}
        visible={squadModalOpen && showSquadToggle}
        busy={actionBusy}
        onClose={() => setSquadModalOpen(false)}
        onAction={handleUiAction}
      />
      <JournalModal
        journal={journalState}
        visible={journalModalOpen && showJournalToggle}
        busy={actionBusy}
        onClose={() => setJournalModalOpen(false)}
        onAction={handleUiAction}
      />
      <MapKeyboardPanel
        rows={visibleMapKeyboardRows}
        busy={live.actionStatus === 'sending' || !!activeMovementAnimation}
        onAction={handleMapKeyboardAction}
      />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}
