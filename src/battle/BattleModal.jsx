import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BattleCharactersCanvas from './components/BattleCharactersCanvas.jsx';
import BattleInteractionLayer from './components/BattleInteractionLayer.jsx';
import { BattleOverlay, BattleUnderlay } from './components/BattleOverlayLayer.jsx';
import {
  applyBattleVisualEventToAnimations,
  applyVisualEventToStatusOverrides,
  buildBattleView,
  buildInitialVisualStatusOverrides,
  collectNewVisualEvents,
  createInitialAnimationState,
  diffBattleAnimations,
  getVisualEventKind,
  normalizePlayerSnapshot,
} from './data/battleSnapshot.js';
import { applyServerResolvedActionToCard, buildActionCardsForActor } from './lib/battleActionCards.js';
import {
  FALLBACK_BATTLE_CATALOGS,
  loadPublicBattleCatalogs,
  mergeBattleCatalogs,
} from './lib/battleCatalogs.js';
import { getAvailableTargetsForAction } from './lib/battleCombat.js';
import { getEffectiveStats } from './lib/battleMath.js';
import { buildBattleSceneModel } from './lib/battleSceneModel.js';
import { APP_CONFIG } from '../config/appConfig.js';
import { normalizeInlineKeyboardRows, stripTelegramMarkup } from '../utils/inlineKeyboard.js';
import './battleScene.css';

const ACTIONS = {
  attackTarget: 'atkTgt',
  abilityTarget: 'abTgt',
  selectChar: 'selChar',
  endTurn: 'endTurn',
  flee: 'endTurnFlee',
  continueResult: 'battleResultContinue',
  unmaskTarget: 'maskTgt',
};

const HIDDEN_BATTLE_ABILITY_IDS = new Set(['enslave']);
const BATTLE_CONFIG = APP_CONFIG.battle || {};
const BATTLE_VISUAL_QUEUE = BATTLE_CONFIG.visualQueue || {};
const BATTLE_LIFE_ANIMATION = BATTLE_CONFIG.animations?.life || {};
const BATTLE_UI_SCALE_TUNE = 0.9;
const BATTLE_UI_SCALE_MIN = 0.52;
const BATTLE_VISUAL_STATUS_SYNC = BATTLE_VISUAL_QUEUE.syncStatusesWithHits !== false;
const BATTLE_VISUAL_IMPACT_DELAY_MS = numberOr(BATTLE_VISUAL_QUEUE.impactDelayMs, 58);
const BATTLE_VISUAL_EVENT_STEP_MS = numberOr(BATTLE_VISUAL_QUEUE.stepMs, 215);
const BATTLE_VISUAL_EVENT_HEAL_STEP_MS = numberOr(BATTLE_VISUAL_QUEUE.healStepMs, 240);
const BATTLE_DEATH_REMOVE_DELAY_MS = numberOr(BATTLE_LIFE_ANIMATION.removeDeadAfterMs, 880);
const BATTLE_DEATH_FADE_MS = numberOr(BATTLE_LIFE_ANIMATION.removeDeadFadeMs, 420);

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function buildSelectedActorModel(char) {
  if (!char) return null;

  return {
    charId: char.id,
    side: char.side,
    stats: getEffectiveStats(char),
  };
}

function getDefaultBattleCardId(actorId) {
  return actorId ? `${actorId}:attack` : null;
}

function getSelectableActor(player, actorId) {
  return (player?.validChars || []).find((char) => (
    char.id === actorId && char.side === 'player' && Number(char.health || 0) > 0
  )) || null;
}

function normalizeSelectedActorId(player, selectedActorId) {
  return getSelectableActor(player, selectedActorId)?.id || null;
}

function buildBattleAction(actorId, target, actionCard) {
  const row = Number(target?.position?.row);
  const col = Number(target?.position?.col);
  if (!actorId || !actionCard || !Number.isInteger(row) || !Number.isInteger(col)) return '';

  if (actionCard.type === 'ability' && Number.isInteger(actionCard.abilityIndex)) {
    return `${ACTIONS.abilityTarget}_${actorId}_${actionCard.abilityIndex}_${row}_${col}`;
  }

  return `${ACTIONS.attackTarget}_${actorId}_${row}_${col}`;
}

function buildUnmaskAction(target) {
  const row = Number(target?.position?.row);
  const col = Number(target?.position?.col);
  if (!Number.isInteger(row) || !Number.isInteger(col)) return '';

  return `${ACTIONS.unmaskTarget}_${row}_${col}`;
}

function buildSelectCharAction(char) {
  const row = Number(char?.position?.row);
  const col = Number(char?.position?.col);
  if (!Number.isInteger(row) || !Number.isInteger(col)) return '';

  return `${ACTIONS.selectChar}_${row}_${col}`;
}

function createBattleViewState(snapshot, previous) {
  const normalizedPlayer = normalizePlayerSnapshot(snapshot);
  const queuedVisualEvents = previous?.rawPlayer
    ? collectNewVisualEvents(previous.rawPlayer, normalizedPlayer)
    : [];
  const animations = previous?.rawPlayer
    ? diffBattleAnimations(previous.rawPlayer, normalizedPlayer, previous.animations, {
      playVisualEvents: false,
    })
    : createInitialAnimationState(normalizedPlayer);

  const statusOverridesByCharId = BATTLE_VISUAL_STATUS_SYNC && queuedVisualEvents.length
    ? buildInitialVisualStatusOverrides(normalizedPlayer, queuedVisualEvents)
    : {};

  return {
    ...buildBattleView(normalizedPlayer, animations, { statusOverridesByCharId }),
    queuedVisualEvents,
  };
}

function getBattlePlayerSnapshot(battleState) {
  return battleState?.player || battleState?.rawPlayer || battleState?.snapshot || null;
}

function getServerActorActionState(actionState, actorId) {
  if (!actionState || !actorId) return null;

  return actionState.byActorId?.[actorId]
    || (Array.isArray(actionState.actors)
      ? actionState.actors.find((actor) => actor.actorId === actorId)
      : null)
    || null;
}

function getServerAbilityState(actorState, actionCard) {
  if (!actorState || !actionCard || actionCard.type !== 'ability') return null;

  const abilities = Array.isArray(actorState.abilities) ? actorState.abilities : [];

  if (Number.isInteger(actionCard.abilityIndex)) {
    return abilities.find((ability) => (
      Number(ability.abilityIndex) === Number(actionCard.abilityIndex)
    )) || null;
  }

  return abilities.find((ability) => (
    ability.abilityId && ability.abilityId === actionCard.abilityId
  )) || null;
}

function getServerTargetIdsForAction(actionState, actorId, actionCard) {
  const actorState = getServerActorActionState(actionState, actorId);
  if (!actorState || !actionCard) return null;

  if (actionCard.type === 'attack') {
    return Array.isArray(actorState.attack?.targetIds)
      ? actorState.attack.targetIds.filter(Boolean)
      : null;
  }

  const abilityState = getServerAbilityState(actorState, actionCard);
  return Array.isArray(abilityState?.targetIds)
    ? abilityState.targetIds.filter(Boolean)
    : null;
}

function getServerBlockedReasonLabel(reason) {
  switch (reason) {
    case 'stun':
      return 'Оглушение';
    case 'cooldown':
      return 'Перезарядка';
    case 'silence':
      return 'Безмолвие';
    case 'confusion':
      return 'Замешательство';
    case 'not_selectable':
      return 'Уже действовал';
    case 'missing_ability':
      return 'Нет способности';
    default:
      return reason || null;
  }
}

function createServerActionCard(actorId, type, serverActionState, statusCatalogs, actorState = null) {
  const resolvedAction = serverActionState?.resolvedAction || null;
  const isAbility = type === 'ability';
  const abilityId = isAbility ? (serverActionState?.abilityId || resolvedAction?.abilityId || 'ability') : null;
  const abilityIndex = Number(serverActionState?.abilityIndex);
  const serverTargetIds = Array.isArray(serverActionState?.targetIds)
    ? serverActionState.targetIds.filter(Boolean)
    : [];
  const blockedReason = isAbility
    ? getServerBlockedReasonLabel(serverActionState?.blockedReason)
    : (actorState && actorState.selectable === false ? 'Уже действовал' : null);
  const noServerTargets = !blockedReason && serverTargetIds.length === 0;
  const title = resolvedAction?.name || (isAbility ? abilityId : 'Обычная атака');
  const description = resolvedAction?.description || '';
  const baseCard = {
    id: isAbility
      ? `${actorId}:ability:${abilityId}:${Number.isInteger(abilityIndex) ? abilityIndex : 'server'}`
      : `${actorId}:attack`,
    type,
    actorId,
    abilityId,
    abilityIndex: Number.isInteger(abilityIndex) ? abilityIndex : null,
    title,
    description,
    cooldown: Number(serverActionState?.cooldown || 0),
    blockedReason: blockedReason || (noServerTargets ? 'Нет целей' : null),
    tone: 'utility',
    resolvedAction: null,
    targetImpacts: serverActionState?.targetImpacts || {},
    summary: {
      damage: 'Данные действия с сервера',
      target: 'По серверу',
      area: 'По серверу',
      statuses: '',
      average: 0,
    },
    presentation: {
      displayTitle: title,
      metaLine: isAbility
        ? `⏳: ${Number(serverActionState?.baseCooldown || resolvedAction?.cooldown || 0)} • ⌛️: ${Number(serverActionState?.cooldown || 0) || 'готово'}`
        : '⌛️: готово',
      attackLine: 'Данные действия с сервера',
      description,
      geometryRows: [],
      appliesRows: [],
      afterEffectLines: [],
    },
  };

  return resolvedAction
    ? applyServerResolvedActionToCard(baseCard, resolvedAction, {
      statusCatalogs,
      targetImpacts: serverActionState?.targetImpacts || {},
    })
    : baseCard;
}

function buildServerActionCardsForActor(actionState, actorId, statusCatalogs) {
  const actorState = getServerActorActionState(actionState, actorId);
  if (!actorState) return null;

  const cards = [];

  if (actorState.attack) {
    cards.push(createServerActionCard(actorId, 'attack', actorState.attack, statusCatalogs, actorState));
  }

  if (Array.isArray(actorState.abilities)) {
    actorState.abilities
      .filter((abilityState) => !HIDDEN_BATTLE_ABILITY_IDS.has(abilityState?.abilityId))
      .forEach((abilityState) => {
        cards.push(createServerActionCard(actorId, 'ability', abilityState, statusCatalogs, actorState));
      });
  }

  return cards;
}

function isActorStunned(actionState, char) {
  if (!char) return false;

  const actorState = getServerActorActionState(actionState, char?.id);
  if (actorState && typeof actorState.stunned === 'boolean') return actorState.stunned;

  return Number(getEffectiveStats(char).statuses?.debuff_stun || 0) > 0;
}

function applyServerActionStateToCards(cards, actionState, actorId, statusCatalogs) {
  const actorState = getServerActorActionState(actionState, actorId);
  if (!actorState || !Array.isArray(cards)) return cards;

  const attackCards = cards.filter((card) => card.type === 'attack');
  const abilityCards = cards.filter((card) => (
    card.type === 'ability' && !HIDDEN_BATTLE_ABILITY_IDS.has(card.abilityId)
  ));
  const orderedAbilityCards = Array.isArray(actorState.abilities)
    ? actorState.abilities
      .filter((abilityState) => !HIDDEN_BATTLE_ABILITY_IDS.has(abilityState?.abilityId))
      .map((abilityState) => {
        const abilityIndex = Number(abilityState.abilityIndex);
        const byIndex = abilityCards.find((card) => (
          Number(card.abilityIndex) === abilityIndex
        ));

        if (byIndex) return byIndex;

        return abilityCards.find((card) => (
          abilityState.abilityId && card.abilityId === abilityState.abilityId
        )) || createServerActionCard(actorId, 'ability', abilityState, statusCatalogs, actorState);
      })
    : abilityCards;
  const orderedCards = [...attackCards, ...orderedAbilityCards];

  return orderedCards.map((card) => {
    const serverTargetIds = getServerTargetIdsForAction(actionState, actorId, card);
    const abilityState = getServerAbilityState(actorState, card);
    const serverResolvedAction = card.type === 'attack'
      ? actorState.attack?.resolvedAction
      : abilityState?.resolvedAction;
    const serverTargetImpacts = card.type === 'attack'
      ? actorState.attack?.targetImpacts
      : abilityState?.targetImpacts;
    const serverBlockedReason = card.type === 'ability'
      ? getServerBlockedReasonLabel(abilityState?.blockedReason)
      : null;
    const noServerTargets = Array.isArray(serverTargetIds) && serverTargetIds.length === 0;
    const blockedReason = serverBlockedReason || card.blockedReason || (noServerTargets ? 'Нет целей' : null);
    const resolvedCard = serverResolvedAction
      ? applyServerResolvedActionToCard(card, serverResolvedAction, {
        statusCatalogs,
        targetImpacts: serverTargetImpacts || {},
      })
      : card;

    if (blockedReason === resolvedCard.blockedReason) return resolvedCard;

    return {
      ...resolvedCard,
      blockedReason,
    };
  });
}

function BattleResultView({ battleResult, presentation, busy, onAction }) {
  const rows = useMemo(
    () => normalizeInlineKeyboardRows(presentation?.keyboard),
    [presentation?.keyboard],
  );
  const buttons = rows.flatMap((row) => row.buttons).filter((button) => button.action);
  const fallbackButtons = buttons.length ? buttons : [{
    id: 'battle-result-continue',
    text: 'Продолжить',
    action: ACTIONS.continueResult,
  }];
  const text = stripTelegramMarkup(presentation?.caption) || [
    battleResult?.result === 'win' ? 'Победа' : 'Бой завершен',
    battleResult?.extraCaption,
    battleResult?.log,
  ].filter(Boolean).join('\n\n');
  const items = Array.isArray(battleResult?.items) ? battleResult.items : [];

  return (
    <section className="battle-result" role="dialog" aria-modal="true" aria-label="Итог боя">
      {presentation?.image ? (
        <div className="battle-result__image">
          <img src={presentation.image} alt="" draggable="false" />
        </div>
      ) : null}

      <div className="battle-result__body">
        <h2>{battleResult?.result === 'win' ? 'Победа' : 'Итог боя'}</h2>

        {items.length ? (
          <div className="battle-result__items">
            {items.map((item, index) => (
              <span key={`${item?.item || 'item'}:${index}`}>
                {item?.item || 'item'} x{Number(item?.quantity) || 1}
              </span>
            ))}
          </div>
        ) : null}

        {text ? <div className="battle-result__text">{text}</div> : null}

        <div className="battle-result__actions">
          {fallbackButtons.map((button) => (
            <button
              key={button.id}
              type="button"
              disabled={busy}
              onClick={() => onAction(button.action)}
            >
              {button.text}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function BattleScene({ battleState, busy, onAction }) {
  const incomingPlayer = getBattlePlayerSnapshot(battleState);
  const [battleView, setBattleView] = useState(null);
  const [catalogs, setCatalogs] = useState(FALLBACK_BATTLE_CATALOGS);
  const [selectedActorId, setSelectedActorId] = useState(null);
  const [armedCardId, setArmedCardId] = useState(null);
  const [hoveredActorId, setHoveredActorId] = useState(null);
  const sceneFrameRef = useRef(null);
  const battleViewRef = useRef(null);
  const visualQueueRef = useRef([]);
  const visualQueueTimerRef = useRef(null);
  const visualQueueImpactTimerRef = useRef(null);
  const visualQueueRunningRef = useRef(false);
  const deathRemovalTimersRef = useRef(new Map());
  const [sceneUiScale, setSceneUiScale] = useState(1);
  const [sceneViewport, setSceneViewport] = useState({
    left: 0,
    top: 0,
    width: 1,
    height: 1,
  });

  const scheduleDeathRemoval = useCallback((charId) => {
    if (!charId || deathRemovalTimersRef.current.has(charId)) return;

    const finishRemoval = () => {
      setBattleView((current) => {
        const currentAnimation = current?.animations?.[charId];
        if (!currentAnimation?.dead || !currentAnimation?.keepVisible) return current;

        const nextAnimations = {
          ...current.animations,
          [charId]: {
            ...currentAnimation,
            keepVisible: false,
            removingDead: false,
          },
        };
        const nextView = {
          ...current,
          animations: nextAnimations,
        };

        battleViewRef.current = nextView;
        return nextView;
      });
    };

    const timeoutId = window.setTimeout(() => {
      setBattleView((current) => {
        const currentAnimation = current?.animations?.[charId];
        if (!currentAnimation?.dead || !currentAnimation?.keepVisible) {
          deathRemovalTimersRef.current.delete(charId);
          return current;
        }

        const nextView = {
          ...current,
          animations: {
            ...current.animations,
            [charId]: {
              ...currentAnimation,
              removingDead: true,
            },
          },
        };

        battleViewRef.current = nextView;
        return nextView;
      });

      const fadeTimeoutId = window.setTimeout(() => {
        deathRemovalTimersRef.current.delete(charId);
        finishRemoval();
      }, BATTLE_DEATH_FADE_MS);

      deathRemovalTimersRef.current.set(charId, fadeTimeoutId);
    }, BATTLE_DEATH_REMOVE_DELAY_MS);

    deathRemovalTimersRef.current.set(charId, timeoutId);
  }, []);

  const scheduleDeathRemovalsForView = useCallback((view) => {
    Object.entries(view?.animations || {}).forEach(([charId, animation]) => {
      if (animation?.dead && animation?.keepVisible) {
        scheduleDeathRemoval(charId);
      }
    });
  }, [scheduleDeathRemoval]);

  const clearDeathRemovalTimers = useCallback(() => {
    deathRemovalTimersRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    deathRemovalTimersRef.current.clear();
  }, []);

  const runVisualQueue = useCallback(() => {
    if (visualQueueRunningRef.current) return;

    visualQueueRunningRef.current = true;

    const applyVisualEvent = (event, options = {}) => {
      setBattleView((current) => {
        if (!current?.rawPlayer) return current;

        const nextView = {
          ...current,
          statusOverridesByCharId: !BATTLE_VISUAL_STATUS_SYNC || options.includeImpact === false
            ? current.statusOverridesByCharId
            : applyVisualEventToStatusOverrides(
              current.statusOverridesByCharId || {},
              current.rawPlayer,
              event,
            ),
          animations: applyBattleVisualEventToAnimations(
            current.animations || {},
            current.rawPlayer,
            event,
            visualQueueRef.current,
            options,
          ),
        };

        battleViewRef.current = nextView;
        scheduleDeathRemovalsForView(nextView);
        return nextView;
      });
    };

    const tick = () => {
      const event = visualQueueRef.current.shift();

      if (!event) {
        visualQueueRunningRef.current = false;
        visualQueueTimerRef.current = null;
        return;
      }

      applyVisualEvent(event, { includeImpact: false });
      visualQueueImpactTimerRef.current = window.setTimeout(() => {
        applyVisualEvent(event, { includeAttacker: false });
        visualQueueImpactTimerRef.current = null;
      }, BATTLE_VISUAL_IMPACT_DELAY_MS);

      const delay = getVisualEventKind(event) === 'heal'
        ? BATTLE_VISUAL_EVENT_HEAL_STEP_MS
        : BATTLE_VISUAL_EVENT_STEP_MS;

      visualQueueTimerRef.current = window.setTimeout(tick, delay);
    };

    tick();
  }, [scheduleDeathRemovalsForView]);

  const enqueueVisualEvents = useCallback((events = []) => {
    const normalizedEvents = Array.isArray(events)
      ? events.filter((event) => event?.id && event?.targetId)
      : [];

    if (!normalizedEvents.length) return;

    visualQueueRef.current.push(...normalizedEvents);
    runVisualQueue();
  }, [runVisualQueue]);

  useEffect(() => {
    let cancelled = false;

    loadPublicBattleCatalogs()
      .then((publicCatalogs) => {
        if (!cancelled) {
          setCatalogs(mergeBattleCatalogs(FALLBACK_BATTLE_CATALOGS, publicCatalogs));
        }
      })
      .catch((error) => {
        console.warn('[map-demo:battle] Failed to load public battle catalogs:', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (visualQueueTimerRef.current) {
        window.clearTimeout(visualQueueTimerRef.current);
      }
      if (visualQueueImpactTimerRef.current) {
        window.clearTimeout(visualQueueImpactTimerRef.current);
      }
      visualQueueTimerRef.current = null;
      visualQueueImpactTimerRef.current = null;
      visualQueueRef.current = [];
      visualQueueRunningRef.current = false;
      clearDeathRemovalTimers();
    };
  }, [clearDeathRemovalTimers]);

  useEffect(() => {
    if (!incomingPlayer) {
      if (visualQueueTimerRef.current) {
        window.clearTimeout(visualQueueTimerRef.current);
      }
      if (visualQueueImpactTimerRef.current) {
        window.clearTimeout(visualQueueImpactTimerRef.current);
      }
      visualQueueTimerRef.current = null;
      visualQueueImpactTimerRef.current = null;
      visualQueueRef.current = [];
      visualQueueRunningRef.current = false;
      clearDeathRemovalTimers();
      battleViewRef.current = null;
      setBattleView(null);
      setSelectedActorId(null);
      setArmedCardId(null);
      return;
    }

    const nextView = createBattleViewState(incomingPlayer, battleViewRef.current);

    battleViewRef.current = nextView;
    setBattleView(nextView);
    scheduleDeathRemovalsForView(nextView);
    enqueueVisualEvents(nextView.queuedVisualEvents);
  }, [clearDeathRemovalTimers, enqueueVisualEvents, incomingPlayer, scheduleDeathRemovalsForView]);

  useEffect(() => {
    if (!battleView?.rawPlayer) return;

    setSelectedActorId((current) => {
      const normalized = normalizeSelectedActorId(battleView.rawPlayer, current);
      return normalized;
    });
  }, [battleView?.rawPlayer]);

  const mapId = battleView?.mapId || 'betweenworlds';
  const validChars = battleView?.validChars || [];
  const enemyChars = battleView?.enemyChars || [];
  const actedCharacters = battleView?.actedCharacters || [];
  const enemiesResponded = battleView?.enemiesResponded || [];
  const animations = battleView?.animations || {};
  const statusOverridesByCharId = battleView?.statusOverridesByCharId || {};
  const battleActive = Boolean(battleView?.battleActive);
  const actionState = battleView?.actionState || null;
  const unmaskOptions = Array.isArray(battleView?.unmaskOptions) ? battleView.unmaskOptions : [];

  const sceneModel = useMemo(() => buildBattleSceneModel({
    mapId,
    validChars,
    enemyChars,
    actedCharacters,
    enemiesResponded,
    animations,
    statusOverridesByCharId,
    catalogs,
  }), [actedCharacters, animations, catalogs, enemiesResponded, enemyChars, mapId, statusOverridesByCharId, validChars]);

  useEffect(() => {
    const node = sceneFrameRef.current;
    if (!node) return undefined;

    const updateViewport = () => {
      const frameWidth = node.clientWidth || 1;
      const frameHeight = node.clientHeight || 1;
      const sceneAspect = sceneModel.scene.width / sceneModel.scene.height;

      let stageWidth = frameWidth;
      let stageHeight = stageWidth / sceneAspect;

      if (stageHeight > frameHeight) {
        stageHeight = frameHeight;
        stageWidth = stageHeight * sceneAspect;
      }

      const nextViewport = {
        left: (frameWidth - stageWidth) / (2 * frameWidth),
        top: (frameHeight - stageHeight) / (2 * frameHeight),
        width: stageWidth / frameWidth,
        height: stageHeight / frameHeight,
      };
      const nextUiScale = Math.max(
        BATTLE_UI_SCALE_MIN,
        Number(((stageWidth / sceneModel.scene.width) * BATTLE_UI_SCALE_TUNE).toFixed(4)),
      );

      setSceneViewport((current) => {
        const same = ['left', 'top', 'width', 'height'].every((key) => (
          Math.abs(current[key] - nextViewport[key]) < 0.0005
        ));
        return same ? current : nextViewport;
      });
      setSceneUiScale((current) => (
        Math.abs(current - nextUiScale) < 0.0005 ? current : nextUiScale
      ));
    };

    updateViewport();

    const resizeObserver = new ResizeObserver(updateViewport);
    resizeObserver.observe(node);

    return () => {
      resizeObserver.disconnect();
    };
  }, [sceneModel.scene.height, sceneModel.scene.width]);

  const allBattleChars = useMemo(
    () => [...validChars, ...enemyChars],
    [enemyChars, validChars],
  );
  const actedSet = useMemo(() => new Set(actedCharacters), [actedCharacters]);
  const selectedActorRaw = useMemo(() => (
    validChars.find((char) => (
      char.id === selectedActorId &&
      char.side === 'player' &&
      Number(char.health || 0) > 0 &&
      !actedSet.has(char.id)
    )) || null
  ), [actedSet, selectedActorId, validChars]);

  useEffect(() => {
    if (selectedActorId && !selectedActorRaw) {
      setSelectedActorId(null);
      setArmedCardId(null);
    }
  }, [selectedActorId, selectedActorRaw]);
  const selectedActor = useMemo(
    () => buildSelectedActorModel(selectedActorRaw),
    [selectedActorRaw],
  );
  const actionCardsByActorId = useMemo(() => Object.fromEntries(
    allBattleChars.map((char) => {
      const serverCards = actionState
        ? buildServerActionCardsForActor(actionState, char.id, catalogs.statuses)
        : null;

      return [
        char.id,
        serverCards || applyServerActionStateToCards(
          buildActionCardsForActor(char, catalogs),
          actionState,
          char.id,
          catalogs.statuses,
        ),
      ];
    }),
  ), [actionState, allBattleChars, catalogs]);
  const actionCards = useMemo(
    () => (selectedActorRaw ? actionCardsByActorId[selectedActorRaw.id] || [] : []),
    [actionCardsByActorId, selectedActorRaw],
  );
  const activeCard = useMemo(
    () => actionCards.find((card) => card.id === armedCardId) || null,
    [actionCards, armedCardId],
  );
  const selectableActorIds = useMemo(() => (
    actionState
      ? (actionState.actors || [])
        .filter((actor) => actor.selectable)
        .map((actor) => actor.actorId)
        .filter(Boolean)
      : validChars
      .filter((char) => (
        battleActive &&
        char.side === 'player' &&
        Number(char.health || 0) > 0 &&
        !actedSet.has(char.id)
      ))
      .map((char) => char.id)
  ), [actedSet, actionState, battleActive, validChars]);
  const unmaskTargetIds = useMemo(() => (
    unmaskOptions
      .map((option) => option.targetId)
      .filter(Boolean)
  ), [unmaskOptions]);
  const targetableIds = useMemo(() => {
    if (!selectedActorRaw || !activeCard || activeCard.blockedReason || busy) return [];

    const serverTargetIds = getServerTargetIdsForAction(actionState, selectedActorRaw.id, activeCard);
    if (actionState) {
      return Array.isArray(serverTargetIds) ? serverTargetIds : [];
    }

    if (Array.isArray(serverTargetIds)) {
      return serverTargetIds;
    }

    return getAvailableTargetsForAction(
      selectedActorRaw,
      allBattleChars,
      activeCard.resolvedAction,
      catalogs,
    ).map((char) => char.id);
  }, [actionState, activeCard, allBattleChars, busy, catalogs, selectedActorRaw]);
  const highlightStateById = useMemo(() => {
    const states = {};
    const targetableSet = new Set(targetableIds);
    const selectableSet = new Set(selectableActorIds);
    const unmaskTargetSet = new Set(unmaskTargetIds);

    unmaskTargetSet.forEach((id) => {
      states[id] = 'unmask-targetable';
    });

    if (selectedActorId) {
      states[selectedActorId] = 'selected';
    }

    targetableSet.forEach((id) => {
      states[id] = 'targetable';
    });

    if (hoveredActorId) {
      if (targetableSet.has(hoveredActorId)) {
        states[hoveredActorId] = 'hovered-targetable';
      } else if (unmaskTargetSet.has(hoveredActorId)) {
        states[hoveredActorId] = 'hovered-unmask';
      } else if (selectableSet.has(hoveredActorId) && hoveredActorId !== selectedActorId) {
        states[hoveredActorId] = 'hovered-selectable';
      }
    }

    return states;
  }, [hoveredActorId, selectableActorIds, selectedActorId, targetableIds, unmaskTargetIds]);

  const selectBattleActor = useCallback((actorId) => {
    if (busy) return;

    const actor = validChars.find((char) => char.id === actorId);
    if (actor && isActorStunned(actionState, actor)) {
      const action = buildSelectCharAction(actor);
      if (action) onAction(action);
      setSelectedActorId(null);
      setArmedCardId(null);
      return;
    }

    setSelectedActorId((current) => {
      const nextSelectedActorId = current === actorId ? null : actorId;
      setArmedCardId(getDefaultBattleCardId(nextSelectedActorId));
      return nextSelectedActorId;
    });
  }, [actionState, busy, onAction, validChars]);

  const cancelBattleSelection = useCallback(() => {
    setSelectedActorId(null);
    setArmedCardId(null);
  }, []);

  const executeBattleAction = useCallback((actorId, targetId, actionCard) => {
    if (busy) return;
    if (!targetableIds.includes(targetId)) return;

    const target = allBattleChars.find((char) => char.id === targetId);
    const action = buildBattleAction(actorId, target, actionCard);
    if (!action) return;

    onAction(action);
    setArmedCardId(null);
  }, [allBattleChars, busy, onAction, targetableIds]);

  const executeUnmaskAction = useCallback((targetId) => {
    if (busy) return;

    const target = allBattleChars.find((char) => char.id === targetId);
    const action = buildUnmaskAction(target);
    if (!action) return;

    onAction(action);
    setSelectedActorId(null);
    setArmedCardId(null);
  }, [allBattleChars, busy, onAction]);

  if (!battleView) {
    return <div className="battle-test__loading">Загрузка боя...</div>;
  }

  return (
    <section className="battle-test" role="dialog" aria-modal="true" aria-label="Бой">
      <div className="battle-test__stage-shell">
        <section
          className="battle-test__scene-wrap"
          aria-label="Battle canvas viewport"
          style={{
            '--battle-scene-aspect': `${sceneModel.scene.width} / ${sceneModel.scene.height}`,
          }}
        >
          <div
            ref={sceneFrameRef}
            className="battle-test__scene-frame"
            style={{ '--battle-ui-scale': sceneUiScale }}
          >
            <div
              className="battle-test__scene-backdrop"
              style={{ backgroundImage: `url(${sceneModel.scene.background})` }}
            />

            <div
              className="battle-test__scene-stage"
              style={{
                left: `${sceneViewport.left * 100}%`,
                top: `${sceneViewport.top * 100}%`,
                width: `${sceneViewport.width * 100}%`,
                height: `${sceneViewport.height * 100}%`,
              }}
            >
              <BattleUnderlay
                scene={sceneModel.scene}
                items={sceneModel.underlay}
                highlightStateById={highlightStateById}
              />

              <div className="battle-test__canvas-layer">
                <BattleCharactersCanvas
                  scene={sceneModel.scene}
                  sprites={sceneModel.sprites}
                  highlightStateById={highlightStateById}
                />
              </div>

              <BattleOverlay
                scene={sceneModel.scene}
                items={sceneModel.overlay}
                floatingTexts={sceneModel.floatingTexts}
                countsUri={sceneModel.countsUri}
              />
            </div>

            <BattleInteractionLayer
              scene={sceneModel.scene}
              viewport={sceneViewport}
              sprites={sceneModel.sprites}
              selectedActor={selectedActor}
              selectedActorId={selectedActorId}
              selectableActorIds={selectableActorIds}
              actionCards={actionCards}
              actionCardsByActorId={actionCardsByActorId}
              battleChars={allBattleChars}
              armedCardId={armedCardId}
              targetableIds={targetableIds}
              unmaskTargetIds={unmaskTargetIds}
              uiScale={sceneUiScale}
              onSelectActor={selectBattleActor}
              onArmCard={setArmedCardId}
              onCancelSelection={cancelBattleSelection}
              onExecuteAction={executeBattleAction}
              onExecuteUnmask={executeUnmaskAction}
              onHoverActorChange={setHoveredActorId}
            />

            <div className="battle-test__utility-anchor battle-test__utility-anchor--bottom">
              <div className="battle-test__utility-bar">
                <button
                  type="button"
                  className="battle-test__utility-button"
                  disabled={busy}
                  onClick={() => onAction(ACTIONS.endTurn)}
                >
                  Завершить ход
                </button>
                <button
                  type="button"
                  className="battle-test__utility-button"
                  disabled={busy}
                  onClick={() => onAction(ACTIONS.flee)}
                >
                  Побег
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

function BattleModal({ battleState, presentation, uiType, busy = false, onAction }) {
  const normalizedUiType = String(uiType || battleState?.uiState?.type || '').toLowerCase();
  const canShowBattleShell = normalizedUiType === 'battle' || normalizedUiType === 'battleresult';

  if (!battleState && !presentation && !canShowBattleShell) return null;

  const battleResult = battleState?.player?.session?.battleResult || battleState?.battleResult || null;

  return (
    <div className="battle-modal-layer" role="presentation">
      <div className="battle-modal-backdrop" aria-hidden="true" />

      {normalizedUiType === 'battleresult' ? (
        <BattleResultView
          battleResult={battleResult}
          presentation={presentation}
          busy={busy}
          onAction={onAction}
        />
      ) : !battleState ? (
        <div className="battle-test__loading">Восстановление боя...</div>
      ) : (
        <BattleScene battleState={battleState} busy={busy} onAction={onAction} />
      )}
    </div>
  );
}

export default memo(BattleModal);
