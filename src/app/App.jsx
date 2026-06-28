import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Map as MapIcon, UsersRound } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { APP_CONFIG } from '../config/appConfig.js';
import MapScene from '../scene/MapScene.jsx';
import { useMapDemoStore } from '../store/mapDemoStore.js';
import { buildChunkModel, tileToWorld } from '../utils/mapModel.js';
import BattleModal from '../battle/BattleModal.jsx';
import DialogModal from './DialogModal.jsx';
import JournalModal from './JournalModal.jsx';
import LoadingScreen from './LoadingScreen.jsx';
import MapKeyboardPanel from './MapKeyboardPanel.jsx';
import SquadModal from './SquadModal.jsx';
import ToastStack from './ToastStack.jsx';

const EMPTY_ARRAY = Object.freeze([]);
const EMPTY_OBJECT = Object.freeze({});

function getTileKey(x, y) {
  return `${Number(x)},${Number(y)}`;
}

function createVisibleTileSet(exploration) {
  if (!exploration?.fogEnabled) return null;

  const tiles = Array.isArray(exploration.visibleTiles) ? exploration.visibleTiles : [];
  const set = new Set();

  for (const tile of tiles) {
    const x = Array.isArray(tile) ? Number(tile[0]) : Number(tile?.x);
    const y = Array.isArray(tile) ? Number(tile[1]) : Number(tile?.y);
    if (Number.isFinite(x) && Number.isFinite(y)) set.add(getTileKey(x, y));
  }

  return set;
}

function filterEntitiesByVisibility(entities, visibleTileSet) {
  if (!visibleTileSet) return Array.isArray(entities) ? entities : EMPTY_ARRAY;

  return (Array.isArray(entities) ? entities : []).filter((entity) => {
    const x = Number(entity?.x);
    const y = Number(entity?.y);
    return Number.isFinite(x) && Number.isFinite(y) && visibleTileSet.has(getTileKey(x, y));
  });
}

function filterActionsByVisibility(actionsByTile, visibleTileSet) {
  if (!visibleTileSet || !actionsByTile || typeof actionsByTile !== 'object') return actionsByTile || EMPTY_OBJECT;

  return Object.fromEntries(Object.entries(actionsByTile).filter(([tileKey]) => visibleTileSet.has(tileKey)));
}

export default function App() {
  const [cameraMode, setCameraMode] = useState('follow');
  const [squadModalOpen, setSquadModalOpen] = useState(false);
  const [journalModalOpen, setJournalModalOpen] = useState(false);
  const [readySceneId, setReadySceneId] = useState(null);
  const [mapTransitionKey, setMapTransitionKey] = useState(null);
  const presentedMapIdRef = useRef(null);
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

  const serverMapId = live.mapState?.ok ? live.mapState.mapId : null;
  const serverMapExists = !serverMapId || mapEntries.some((entry) => entry.id === serverMapId);
  const selectedIdForView = serverMapId && serverMapExists ? serverMapId : selectedId;
  const selected = selectedIdForView
    ? mapEntries.find((entry) => entry.id === selectedIdForView) || null
    : null;
  const liveOnSelectedMap = live.mapState?.ok && live.mapState.mapId === selected?.id ? live.mapState : null;
  const exploration = liveOnSelectedMap?.exploration || null;
  const visibleTileSet = useMemo(() => createVisibleTileSet(exploration), [exploration]);
  const model = useMemo(
    () => (selected ? buildChunkModel(selected.map) : null),
    [selected],
  );
  const sceneReady = !!selected?.id && readySceneId === selected.id;
  const liveUiType = String(liveOnSelectedMap?.uiState?.type || '').toLowerCase();
  const currentUiType = String(live.mapState?.uiState?.type || '').toLowerCase();
  const battleUiType = String(live.battleState?.uiState?.type || currentUiType).toLowerCase();
  const battleModalVisible = battleUiType === 'battle' || battleUiType === 'battleresult';
  const serverPlayer = liveOnSelectedMap?.player || null;
  const squadState = liveOnSelectedMap?.squad || null;
  const journalState = liveOnSelectedMap?.journal || null;
  const questGuide = journalState?.guide || null;
  const activeMovementAnimation = movementAnimation?.mapId === selected?.id ? movementAnimation : null;
  const sourceLiveLayers = liveOnSelectedMap?.layers;
  const liveLayers = useMemo(() => {
    if (!sourceLiveLayers) return null;
    if (!visibleTileSet) return sourceLiveLayers;

    return {
      otherPlayers: filterEntitiesByVisibility(sourceLiveLayers.otherPlayers, visibleTileSet),
      npcs: filterEntitiesByVisibility(sourceLiveLayers.npcs, visibleTileSet),
      enemies: filterEntitiesByVisibility(sourceLiveLayers.enemies, visibleTileSet),
      consumables: filterEntitiesByVisibility(sourceLiveLayers.consumables, visibleTileSet),
      huntTiles: filterEntitiesByVisibility(sourceLiveLayers.huntTiles, visibleTileSet),
      transitions: filterEntitiesByVisibility(sourceLiveLayers.transitions, visibleTileSet),
    };
  }, [sourceLiveLayers, visibleTileSet]);
  const actionsByTile = useMemo(
    () => filterActionsByVisibility(liveOnSelectedMap?.actionsByTile, visibleTileSet),
    [liveOnSelectedMap?.actionsByTile, visibleTileSet],
  );
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
  const handleSceneReady = useCallback((sceneId) => {
    setReadySceneId(sceneId);
  }, []);
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

  useEffect(() => {
    if (!selected?.id || !sceneReady) return undefined;

    const previousMapId = presentedMapIdRef.current;
    presentedMapIdRef.current = selected.id;

    if (!previousMapId || previousMapId === selected.id) return undefined;

    setMapTransitionKey(selected.id);
    const timeoutId = window.setTimeout(() => {
      setMapTransitionKey((current) => (current === selected.id ? null : current));
    }, APP_CONFIG.mapTransition.fadeMs);

    return () => window.clearTimeout(timeoutId);
  }, [sceneReady, selected?.id]);

  if (loading) {
    return <LoadingScreen message="Загружаем карты..." />;
  }

  if (error) {
    return <LoadingScreen error={error.message || 'Пустой список карт'} />;
  }

  if (APP_CONFIG.backend.enabled && !live.mapState?.ok) {
    const serverError = live.status === 'error' || live.status === 'disabled' ? live.error || live.status : null;
    if (serverError) return <LoadingScreen error={serverError} />;

    return <LoadingScreen message="Подключаемся к серверу..." />;
  }

  if (APP_CONFIG.backend.enabled && serverMapId && !serverMapExists) {
    return <LoadingScreen error={`Карта ${serverMapId} не найдена в maps.json`} />;
  }

  if (!selected || !model) {
    return <LoadingScreen error="Пустой список карт" />;
  }

  if (APP_CONFIG.backend.enabled && !liveOnSelectedMap) {
    return <LoadingScreen message="Синхронизируем локацию..." />;
  }

  return (
    <main className="app-shell">
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

      <MapScene
        map={selected.map}
        mapsDict={maps}
        model={model}
        cameraMode={cameraMode}
        showTransitionLabels={showTransitionLabels}
        fogOfWarEnabled={!!exploration?.fogEnabled}
        visibleTileKeys={visibleTileSet}
        visibleTileBounds={exploration?.bounds || null}
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
        transitionLabelBlockers={liveLayers?.npcs || EMPTY_ARRAY}
        onSceneReady={handleSceneReady}
      />
      {mapTransitionKey === selected.id ? (
        <div
          key={`map-transition:${selected.id}`}
          className="map-scene-transition"
          aria-hidden="true"
          style={{
            '--map-transition-bg': APP_CONFIG.mapTransition.background,
            '--map-transition-ms': `${APP_CONFIG.mapTransition.fadeMs}ms`,
          }}
        />
      ) : null}
      {!sceneReady ? <LoadingScreen overlay message="Готовим сцену..." /> : null}
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
