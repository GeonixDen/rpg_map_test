import { create } from 'zustand';
import { io } from 'socket.io-client';
import { APP_CONFIG } from '../config/appConfig.js';
import { createMapEntries } from '../data/mapEntries.js';
import {
  createDialogModalFromActionResult,
  getActionResultUiType,
} from '../utils/dialogResult.js';
import { createMapKeyboardRows, stripTelegramMarkup } from '../utils/inlineKeyboard.js';
import { getNowMs, normalizeMovementPath } from '../utils/movementPath.js';

let liveSocket = null;
let toastSeq = 0;

function logIncoming(source, payload) {
  console.groupCollapsed(`[map-demo:${source}] incoming`);
  console.log(payload);
  console.groupEnd();
}

function logBossSceneDiagnostics(source, payload) {
  const battleState = payload?.battleState;
  const battle = battleState?.player?.session?.battle;
  const bossScene = battle?.bossScene || null;
  const bossChar = battleState?.player?.enemyChars?.find((char) => char?.isBoss || char?.bossId) || null;

  if (!battleState || (!battle?.boss && !bossChar && !bossScene)) return;

  const summary = {
    uiState: battleState?.uiState?.type || null,
    bossId: bossScene?.id || battle?.boss?.id || bossChar?.bossId || null,
    bossCharId: bossScene?.charId || bossChar?.id || null,
    queueLength: Array.isArray(bossScene?.queue) ? bossScene.queue.length : 0,
    roundLimit: Number(bossScene?.roundLimit || 0),
    actionPoints: Number(bossScene?.actionPoints || 0),
    roundActionPoints: Number(bossScene?.roundActionPoints || 0),
    source: bossScene?.debug?.source || null,
    debug: bossScene?.debug || null,
  };

  if (!summary.queueLength || summary.roundLimit <= 0) {
    console.warn(`[map-demo:${source}] bossScene incomplete`, summary, bossScene);
    return;
  }

  console.log(`[map-demo:${source}] bossScene`, summary);
}

function getTelegramInitData() {
  return window?.Telegram?.WebApp?.initData || '';
}

function getBackendAuth() {
  return {
    userId: APP_CONFIG.backend.devUserId,
    devKey: APP_CONFIG.backend.devKey,
    initData: getTelegramInitData(),
  };
}

function hasBackendAuth(auth) {
  return !!(auth.initData || (auth.userId && auth.devKey));
}

function getMapStateFromAction(result) {
  return result?.mapState || null;
}

function getBattleStateFromAction(result) {
  return result?.battleState || null;
}

function normalizeUiType(uiType) {
  return String(uiType || '').trim().toLowerCase();
}

function isBattleUiType(uiType) {
  const normalized = normalizeUiType(uiType);
  return normalized === 'battle' || normalized === 'battleresult';
}

function createBattlePresentationFromActionResult(result) {
  const uiType = normalizeUiType(getActionResultUiType(result));
  if (uiType !== 'battleresult') return null;

  return {
    image: result?.image || '',
    caption: result?.caption || '',
    keyboard: Array.isArray(result?.keyboard) ? result.keyboard : [],
    uiState: result?.uiState || result?.mapState?.uiState || null,
  };
}

function getMapKeyboardRowsFromResult(result) {
  const fromAction = createMapKeyboardRows(result?.keyboard);
  if (fromAction.length) return fromAction;
  return createMapKeyboardRows(result?.mapState?.mapKeyboard);
}

function isSameTile(a, b) {
  return Number(a?.x) === Number(b?.x) && Number(a?.y) === Number(b?.y);
}

function createMovementAnimationFromResult(result, currentMapState) {
  const mapState = result?.mapState;
  const player = mapState?.player;
  const path = normalizeMovementPath(result?.movementPath);

  if (!mapState?.ok || !mapState.mapId || !player || path.length < 2) return null;

  const first = path[0];
  const last = path[path.length - 1];
  const startsAtCurrentPlayer = currentMapState?.ok && currentMapState.mapId && isSameTile(first, currentMapState.player);
  const endsAtResultPlayer = isSameTile(last, player);

  if (!startsAtCurrentPlayer && !endsAtResultPlayer) return null;

  return {
    id: `${Date.now()}:${mapState.mapId}:${path.map((point) => `${point.x},${point.y}`).join('|')}`,
    mapId: startsAtCurrentPlayer ? currentMapState.mapId : mapState.mapId,
    targetMapId: mapState.mapId,
    entityId: String(player.id),
    startedAtMs: getNowMs(),
    path,
  };
}

function getCaptionToastText(caption) {
  const text = stripTelegramMarkup(caption);
  if (!text) return '';

  const chunks = text
    .split(/\n\s*\n/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return chunks.length > 1 ? chunks.slice(1).join('\n\n') : '';
}

function getActionToasts(result, { skipCaption = false } = {}) {
  if (!result || typeof result !== 'object') return [];

  const toasts = [];
  const notification = stripTelegramMarkup(result.notification);
  const captionText = skipCaption ? '' : getCaptionToastText(result.caption);
  const errorText = stripTelegramMarkup(result.error);

  if (notification) {
    toasts.push({
      type: result.notificationType === 'alert' ? 'alert' : 'info',
      text: notification,
    });
  }

  if (captionText && captionText !== notification) {
    toasts.push({
      type: 'success',
      text: captionText,
    });
  }

  if (errorText && errorText !== notification && errorText !== captionText) {
    toasts.push({
      type: 'alert',
      text: errorText,
    });
  }

  return toasts;
}

function closeLiveSocket() {
  if (liveSocket) {
    liveSocket.disconnect();
    liveSocket = null;
  }
}

export const useMapDemoStore = create((set, get) => ({
  loading: true,
  maps: null,
  mapEntries: [],
  selectedId: null,
  error: null,

  showTransitionLabels: APP_CONFIG.transitionLabels.visibleByDefault,
  toasts: [],
  pendingToasts: [],
  dialogModal: null,
  battlePresentation: null,
  mapKeyboardRows: [],
  movementAnimation: null,
  pendingActionResult: null,
  selectedActionTile: null,

  live: {
    enabled: APP_CONFIG.backend.enabled,
    status: 'idle',
    transport: null,
    error: null,
    mapState: null,
    battleState: null,
    updatedAt: null,
    actionStatus: 'idle',
    actionError: null,
  },

  loadMaps: async () => {
    set({ loading: true, error: null });

    try {
      const response = await fetch(APP_CONFIG.data.mapsUrl);
      if (!response.ok) throw new Error(`maps.json: ${response.status}`);

      const maps = await response.json();
      const mapEntries = createMapEntries(maps);
      const currentSelected = get().selectedId;
      const liveMapId = get().live.mapState?.mapId;
      const fallbackMapId = APP_CONFIG.backend.enabled ? null : mapEntries[0]?.id || null;
      const nextSelected =
        (currentSelected && mapEntries.some((entry) => entry.id === currentSelected) && currentSelected) ||
        (liveMapId && mapEntries.some((entry) => entry.id === liveMapId) && liveMapId) ||
        fallbackMapId ||
        null;

      set({
        loading: false,
        maps,
        mapEntries,
        selectedId: nextSelected,
      });
    } catch (error) {
      set({ loading: false, maps: null, mapEntries: [], error });
    }
  },

  pushToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts.slice(-4),
        {
          id: `${Date.now()}:${toastSeq++}`,
          type: toast.type || 'info',
          text: toast.text,
        },
      ].filter((item) => item.text),
    })),
  queueToast: (toast) =>
    set((state) => ({
      pendingToasts: [...state.pendingToasts.slice(-4), toast].filter((item) => item?.text),
    })),
  flushQueuedToasts: () => {
    const pendingToasts = get().pendingToasts;
    if (!pendingToasts.length) return;

    set({ pendingToasts: [] });
    pendingToasts.forEach((toast) => get().pushToast(toast));
  },
  pushActionToasts: (result, options) => {
    getActionToasts(result, options).forEach((toast) => get().pushToast(toast));
  },
  handleActionPresentation: (result) => {
    const uiType = getActionResultUiType(result);
    const normalizedUiType = normalizeUiType(uiType);
    const fallbackImage = result?.image == null ? get().dialogModal?.image || '' : '';
    const dialogModal = createDialogModalFromActionResult(result, { fallbackImage });
    const mapKeyboardRows = uiType === 'map' ? getMapKeyboardRowsFromResult(result) : [];
    const battlePresentation = createBattlePresentationFromActionResult(result);

    if (dialogModal) {
      set({ dialogModal, battlePresentation: null });
    } else if (isBattleUiType(normalizedUiType)) {
      set({
        dialogModal: null,
        battlePresentation: battlePresentation || (normalizedUiType === 'battle' ? null : get().battlePresentation),
      });
    } else if (uiType && uiType !== 'dialog') {
      set((state) => ({
        dialogModal: null,
        battlePresentation: null,
        mapKeyboardRows: mapKeyboardRows.length ? mapKeyboardRows : state.mapKeyboardRows,
      }));
    }

    get().pushActionToasts(result, { skipCaption: !!dialogModal || uiType === 'dialog' });
    return !!dialogModal;
  },
  completeActionResult: (result, transport, { responseOk = true } = {}) => {
    const mapState = result?.mapState;
    const battleState = getBattleStateFromAction(result);
    get().handleActionPresentation(result);

    if (!responseOk || !mapState?.ok) {
      set((state) => ({
        selectedActionTile: null,
        live: {
          ...state.live,
          actionStatus: 'error',
          actionError: result?.error || mapState?.error || 'move_failed',
        },
      }));
      if (battleState) {
        get().applyLiveBattleState(battleState, transport);
      }
      get().flushQueuedToasts();
      return false;
    }

    get().applyLiveMapState(mapState, transport, battleState);
    set((state) => ({
      selectedActionTile: null,
      live: {
        ...state.live,
        actionStatus: 'idle',
        actionError: null,
      },
    }));
    get().flushQueuedToasts();
    return true;
  },
  handleServerActionResult: (result, transport, options = {}) => {
    const responseOk = options.responseOk !== false;
    const movementAnimation = responseOk
      ? createMovementAnimationFromResult(result, get().live.mapState)
      : null;

    if (movementAnimation) {
      set({
        movementAnimation,
        pendingActionResult: {
          result,
          transport,
          responseOk,
        },
      });
      return { queued: true, ok: true };
    }

    return {
      queued: false,
      ok: get().completeActionResult(result, transport, { responseOk }),
    };
  },
  dismissToast: (toastId) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== toastId),
    })),

  applyActionMapStateResult: (result, transport) => {
    const mapState = getMapStateFromAction(result);
    const battleState = getBattleStateFromAction(result);

    if (mapState?.ok) {
      get().applyLiveMapState(mapState, transport, battleState);
      return true;
    }

    set((state) => ({
      live: {
        ...state.live,
        status: state.live.mapState ? 'ready' : 'error',
        transport,
        error: result?.error || mapState?.error || 'map_state_failed',
      },
    }));
    return false;
  },

  applyLiveBattleState: (battleState, transport = 'http') => {
    set((state) => {
      const uiType = getActionResultUiType({ uiState: battleState?.uiState });
      const nextBattleState = battleState?.ok && isBattleUiType(uiType) ? battleState : null;

      return {
        live: {
          ...state.live,
          status: state.live.status === 'idle' ? 'ready' : state.live.status,
          transport,
          error: null,
          battleState: nextBattleState,
          updatedAt: battleState?.updatedAt || state.live.updatedAt || new Date().toISOString(),
        },
      };
    });
  },

  handleTileClick: (tile) => {
    const tileX = Number(tile?.x);
    const tileY = Number(tile?.y);
    const state = get();
    const canSendMapAction =
      Number.isInteger(tileX) &&
      Number.isInteger(tileY) &&
      APP_CONFIG.backend.enabled &&
      state.live.status === 'ready' &&
      state.live.actionStatus !== 'sending' &&
      !state.movementAnimation &&
      state.live.mapState?.ok &&
      state.live.mapState.mapId === state.selectedId &&
      getActionResultUiType({ uiState: state.live.mapState.uiState }) === 'map';

    if (!canSendMapAction) return null;

    const serverAction = state.live.mapState?.actionsByTile?.[`${tileX},${tileY}`]?.action || `move_to:${tileX}:${tileY}`;
    set({
      selectedActionTile: {
        mapId: state.selectedId,
        x: tileX,
        y: tileY,
      },
    });
    return get().sendServerAction(serverAction);
  },

  sendServerAction: async (action) => {
    const auth = getBackendAuth();
    if (!APP_CONFIG.backend.enabled || !hasBackendAuth(auth)) {
      set((state) => ({
        selectedActionTile: null,
        live: {
          ...state.live,
          actionStatus: 'error',
          actionError: APP_CONFIG.backend.enabled ? 'backend_auth_missing' : 'backend_disabled',
        },
      }));
      return null;
    }

    set((state) => ({
      live: {
        ...state.live,
        actionStatus: 'sending',
        actionError: null,
      },
    }));

    if (liveSocket?.connected) {
      return new Promise((resolve) => {
        let isSettled = false;
        const timeout = window.setTimeout(() => {
          if (isSettled) return;
          isSettled = true;
          set((state) => ({
            selectedActionTile: null,
            live: {
              ...state.live,
              actionStatus: 'error',
              actionError: 'socket_action_timeout',
            },
          }));
          get().flushQueuedToasts();
          get().pushToast({ type: 'alert', text: 'Сервер не ответил на действие карты' });
          resolve(null);
        }, 6000);

        liveSocket.emit('action', { action, mapDemo: true }, (result) => {
          if (isSettled) return;
          isSettled = true;
          window.clearTimeout(timeout);
          logIncoming('socket:action', result);
          logBossSceneDiagnostics('socket:action', result);
          get().handleServerActionResult(result, 'socket');

          resolve(result);
        });
      });
    }

    try {
      const response = await fetch(new URL('/api/action', APP_CONFIG.backend.baseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: auth.userId,
          devKey: auth.devKey,
          initData: auth.initData,
          action,
          mapDemo: true,
        }),
      });
      const result = await response.json();
      logIncoming('api:action', result);
      logBossSceneDiagnostics('api:action', result);
      const mapState = result?.mapState;
      const handled = get().handleServerActionResult(result, 'http', { responseOk: response.ok });

      if (!response.ok || !mapState?.ok) {
        if (!handled.queued) return null;
        return result;
      }

      return result;
    } catch (error) {
      get().flushQueuedToasts();
      get().pushToast({ type: 'alert', text: error.message });
      set((state) => ({
        selectedActionTile: null,
        live: {
          ...state.live,
          actionStatus: 'error',
          actionError: error.message,
        },
      }));
      return null;
    }
  },

  applyLiveMapState: (mapState, transport = 'http', battleState = undefined) => {
    if (!mapState?.ok) {
      set((state) => ({
        live: {
          ...state.live,
          status: 'error',
          transport,
          error: mapState?.error || 'map_state_failed',
        },
      }));
      return;
    }

    set((state) => {
      const nextUiType = getActionResultUiType({ uiState: mapState.uiState });
      const mapKeyboardRows = nextUiType === 'map' ? createMapKeyboardRows(mapState.mapKeyboard) : [];
      const hasBattleStatePayload = battleState !== undefined;
      const battleUiType = getActionResultUiType({ uiState: battleState?.uiState });
      const nextBattleState = hasBattleStatePayload
        ? (battleState?.ok && isBattleUiType(battleUiType) ? battleState : null)
        : (isBattleUiType(nextUiType) ? state.live.battleState : null);
      const canFollowMap =
        mapState.mapId &&
        state.mapEntries.some((entry) => entry.id === mapState.mapId) &&
        state.selectedId !== mapState.mapId;

      return {
        selectedId: canFollowMap ? mapState.mapId : state.selectedId,
        dialogModal: nextUiType && nextUiType !== 'dialog' ? null : state.dialogModal,
        mapKeyboardRows: mapKeyboardRows.length ? mapKeyboardRows : state.mapKeyboardRows,
        selectedActionTile:
          state.selectedActionTile && state.selectedActionTile.mapId !== mapState.mapId ? null : state.selectedActionTile,
        movementAnimation:
          state.movementAnimation && state.movementAnimation.mapId !== mapState.mapId ? null : state.movementAnimation,
        live: {
          ...state.live,
          status: 'ready',
          transport,
          error: null,
          mapState,
          battleState: nextBattleState,
          updatedAt: mapState.updatedAt || new Date().toISOString(),
          actionStatus: state.live.actionStatus,
          actionError: state.live.actionError,
        },
      };
    });
  },

  refreshLive: async () => {
    const auth = getBackendAuth();
    if (!APP_CONFIG.backend.enabled || !hasBackendAuth(auth)) {
      set((state) => ({
        live: {
          ...state.live,
          status: 'disabled',
          error: APP_CONFIG.backend.enabled ? 'backend_auth_missing' : null,
        },
      }));
      return null;
    }

    try {
      const response = await fetch(new URL('/api/action', APP_CONFIG.backend.baseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: auth.userId,
          devKey: auth.devKey,
          initData: auth.initData,
          action: 'map_demo:refresh',
          mapDemo: true,
        }),
      });
      const result = await response.json();
      logIncoming('api:action:refresh', result);
      logBossSceneDiagnostics('api:action:refresh', result);
      get().applyActionMapStateResult(result, 'http');
      const mapState = getMapStateFromAction(result);
      const uiType = normalizeUiType(getActionResultUiType({ uiState: mapState?.uiState }));

      if (uiType === 'dialog' && !get().dialogModal) {
        await get().sendServerAction('resume_dialog');
      }

      if (uiType === 'battle') {
        await get().sendServerAction('resume_dialog');
      }

      if (uiType === 'battleresult' && !get().battlePresentation) {
        await get().sendServerAction('resume_dialog');
      }

      return getMapStateFromAction(result);
    } catch (error) {
      set((state) => ({
        live: {
          ...state.live,
          status: 'error',
          transport: 'http',
          error: error.message,
        },
      }));
      return null;
    }
  },

  connectLive: () => {
    const auth = getBackendAuth();
    closeLiveSocket();

    if (!APP_CONFIG.backend.enabled || !hasBackendAuth(auth)) {
      set((state) => ({
        live: {
          ...state.live,
          status: 'disabled',
          error: APP_CONFIG.backend.enabled ? 'backend_auth_missing' : null,
        },
      }));
      return;
    }

    set((state) => ({
      live: {
        ...state.live,
        status: 'connecting',
        error: null,
      },
    }));

    get().refreshLive();

    liveSocket = io(APP_CONFIG.backend.baseUrl, {
      auth,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    liveSocket.on('connect', () => {
      set((state) => ({
        live: {
          ...state.live,
          status: 'ready',
          transport: 'socket',
          error: null,
        },
      }));
    });

    liveSocket.on('connect_error', (error) => {
      logIncoming('socket:connect_error', error);
      set((state) => ({
        live: {
          ...state.live,
          status: state.live.mapState ? 'ready' : 'error',
          transport: state.live.mapState ? 'http' : 'socket',
          error: error.message,
        },
      }));
    });

    liveSocket.on('game:notify', (payload = {}) => {
      logIncoming('socket:game:notify', payload);
      const text = stripTelegramMarkup(payload.text || payload.notification || payload.message);
      if (!text) return;

      const toast = {
        type: payload.notificationType === 'alert' ? 'alert' : 'info',
        text,
      };

      if (get().movementAnimation || get().pendingActionResult || get().live.actionStatus === 'sending') {
        get().queueToast(toast);
      } else {
        get().pushToast(toast);
      }
    });
  },

  disconnectLive: () => {
    closeLiveSocket();
  },

  clearMovementAnimation: (animationId) => {
    const state = get();
    if (animationId && state.movementAnimation?.id !== animationId) return;

    const pendingActionResult = state.pendingActionResult;
    set({
      movementAnimation: null,
      pendingActionResult: null,
      selectedActionTile: null,
    });

    if (pendingActionResult) {
      get().completeActionResult(
        pendingActionResult.result,
        pendingActionResult.transport,
        { responseOk: pendingActionResult.responseOk },
      );
      return;
    }

    get().flushQueuedToasts();
  },
}));
