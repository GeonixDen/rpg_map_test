import { getEffectiveStats } from '../lib/battleMath';

function clone(value) {
  return structuredClone(value);
}

function normalizeBattleChar(char, fallbackSide) {
  return {
    ...char,
    side: char.side || fallbackSide,
    statuses: char.statuses || {},
    statusesEnv: char.statusesEnv || {},
    abilityIds: Array.isArray(char.abilityIds) ? char.abilityIds : [],
    abilityCooldowns: Array.isArray(char.abilityCooldowns) ? char.abilityCooldowns : [],
    equippedRunes: Array.isArray(char.equippedRunes) ? char.equippedRunes : [],
    justHitEffect: char.justHitEffect ?? null,
    sharpness: Number(char.sharpness) || 0,
    tier: Number(char.tier) || 1,
    level: Number(char.level) || 0,
    health: Number(char.health) || 0,
    position: {
      row: Number(char.position?.row ?? -1),
      col: Number(char.position?.col ?? -1),
    },
  };
}

function parseFiniteNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.');
    if (!normalized) return null;

    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  }

  return null;
}

function parseSignedHpDelta(value) {
  if (value == null) return null;

  if (typeof value === 'object') {
    return parseSignedHpDelta(value.text ?? value.label ?? value.value ?? value.amount);
  }

  const text = String(value);
  const match = text.match(/(^|[^\d])([+-])\s*(\d+(?:[.,]\d+)?)/);
  if (!match) return null;

  const amount = Number(match[3].replace(',', '.'));
  if (!Number.isFinite(amount)) return null;

  return match[2] === '+' ? amount : -amount;
}

function normalizeStatusMap(statuses = {}) {
  const normalized = {};

  Object.entries(statuses || {}).forEach(([id, rawValue]) => {
    const value = typeof rawValue === 'object' && rawValue !== null
      ? rawValue.count ?? rawValue.value ?? rawValue.stacks
      : rawValue;
    const count = Number(value);

    if (id && Number.isFinite(count) && count > 0) {
      normalized[id] = count;
    }
  });

  return normalized;
}

function hasStatuses(statuses = {}) {
  return Object.keys(statuses || {}).length > 0;
}

function subtractStatusMap(baseStatuses = {}, subtractStatuses = {}) {
  const next = { ...normalizeStatusMap(baseStatuses) };

  Object.entries(normalizeStatusMap(subtractStatuses)).forEach(([id, count]) => {
    const left = Number(next[id] || 0) - count;

    if (left > 0) {
      next[id] = left;
    } else {
      delete next[id];
    }
  });

  return next;
}

function statusMapsEqual(left = {}, right = {}) {
  const leftMap = normalizeStatusMap(left);
  const rightMap = normalizeStatusMap(right);
  const keys = new Set([...Object.keys(leftMap), ...Object.keys(rightMap)]);

  for (const key of keys) {
    if (Number(leftMap[key] || 0) !== Number(rightMap[key] || 0)) {
      return false;
    }
  }

  return true;
}

function addStatusApplications(baseStatuses = {}, appliedStatuses = {}, finalStatuses = null) {
  const next = { ...normalizeStatusMap(baseStatuses) };
  const finalMap = finalStatuses ? normalizeStatusMap(finalStatuses) : null;

  Object.entries(normalizeStatusMap(appliedStatuses)).forEach(([id, count]) => {
    const rawNext = Number(next[id] || 0) + count;
    const cap = finalMap && finalMap[id] != null ? Number(finalMap[id]) : rawNext;
    const value = Math.min(rawNext, cap);

    if (value > 0) {
      next[id] = value;
    } else {
      delete next[id];
    }
  });

  return next;
}

function collectStatusApplicationsByTarget(events = []) {
  const byTargetId = {};

  (Array.isArray(events) ? events : []).forEach((event) => {
    const targetId = event?.targetId;
    const statusesApplied = normalizeStatusMap(event?.statusesApplied);

    if (!targetId || !hasStatuses(statusesApplied)) return;

    byTargetId[targetId] = addStatusApplications(byTargetId[targetId], statusesApplied);
  });

  return byTargetId;
}

const HP_DELTA_FIELDS = [
  'hpDelta',
  'healthDelta',
  'hpChange',
  'healthChange',
  'hpDiff',
  'healthDiff',
  'deltaHp',
  'deltaHealth',
];

const SIGNED_HP_TEXT_FIELDS = [
  'text',
  'label',
  'message',
  'caption',
  'value',
  'amount',
  'floatText',
];

export function getVisualEventHealAmount(event) {
  const explicitHeal = Math.max(0, parseFiniteNumber(event?.heal) || 0);
  if (explicitHeal > 0) return explicitHeal;

  const damageDelta = parseFiniteNumber(event?.damage);
  if (damageDelta != null && damageDelta < 0) return Math.abs(damageDelta);

  const damageTextDelta = parseSignedHpDelta(event?.damage);
  if (damageTextDelta != null && damageTextDelta > 0) return damageTextDelta;

  for (const field of HP_DELTA_FIELDS) {
    const delta = parseFiniteNumber(event?.[field]);
    if (delta != null && delta > 0) return delta;
  }

  for (const field of SIGNED_HP_TEXT_FIELDS) {
    const delta = parseSignedHpDelta(event?.[field]);
    if (delta != null && delta > 0) return delta;
  }

  return 0;
}

export function getVisualEventDamageAmount(event) {
  const damageTextDelta = parseSignedHpDelta(event?.damage);
  if (damageTextDelta != null) {
    return damageTextDelta < 0 ? Math.abs(damageTextDelta) : 0;
  }

  const explicitDamage = parseFiniteNumber(event?.damage);
  if (explicitDamage != null) return Math.max(0, explicitDamage);

  for (const field of HP_DELTA_FIELDS) {
    const delta = parseFiniteNumber(event?.[field]);
    if (delta != null && delta < 0) return Math.abs(delta);
  }

  for (const field of SIGNED_HP_TEXT_FIELDS) {
    const delta = parseSignedHpDelta(event?.[field]);
    if (delta != null && delta < 0) return Math.abs(delta);
  }

  return 0;
}

function normalizeVisualEvent(event, index) {
  if (!event || typeof event !== 'object') return null;

  const targetId = event.targetId || event.defenderId || event.charId || null;
  if (!targetId) return null;
  const heal = getVisualEventHealAmount(event);
  const damage = getVisualEventDamageAmount(event);

  return {
    ...event,
    id: String(event.id ?? event.seq ?? `${targetId}:${index}`),
    seq: Number(event.seq || index),
    targetId,
    attackerId: event.attackerId || null,
    effect: event.effect || event.hitEffect || null,
    type: event.type || null,
    damage,
    heal,
    hpDelta: heal > 0 ? heal : -damage,
    dodged: Boolean(event.dodged),
    blocked: Boolean(event.blocked),
    statusesApplied: normalizeStatusMap(event.statusesApplied),
  };
}

function normalizeUnmaskOption(option, index) {
  if (!option || typeof option !== 'object') return null;

  const targetId = option.targetId || option.target?.id || null;
  const row = Number(option.row ?? option.target?.position?.row);
  const col = Number(option.col ?? option.target?.position?.col);
  if (!targetId || !Number.isInteger(row) || !Number.isInteger(col)) return null;

  return {
    id: String(option.id || `${targetId}:${row}:${col}:${index}`),
    targetId,
    attackerId: option.attackerId || option.attacker?.id || null,
    abilityIndex: Number.isInteger(option.abilityIndex) ? option.abilityIndex : null,
    damage: Number(option.damage || 0),
    label: option.label || '🎭',
    row,
    col,
  };
}

export function normalizePlayerSnapshot(snapshot) {
  const player = clone(snapshot || {});

  player.session = player.session || {};
  player.session.battle = player.session.battle || {};
  player.session.mapName = player.session.mapName || player.session.battle.mapIdBG || 'betweenworlds';
  player.session.battle.actedCharacters = Array.isArray(player.session.battle.actedCharacters)
    ? player.session.battle.actedCharacters
    : [];
  player.session.battle.enemiesResponded = Array.isArray(player.session.battle.enemiesResponded)
    ? player.session.battle.enemiesResponded
    : [];
  player.session.battle.visualEvents = Array.isArray(player.session.battle.visualEvents)
    ? player.session.battle.visualEvents
      .map((event, index) => normalizeVisualEvent(event, index))
      .filter(Boolean)
    : [];
  player.session.battle.unmaskOptions = Array.isArray(player.session.battle.unmaskOptions)
    ? player.session.battle.unmaskOptions
      .map((option, index) => normalizeUnmaskOption(option, index))
      .filter(Boolean)
    : [];

  player.playerChars = Array.isArray(player.playerChars)
    ? player.playerChars.map((char) => normalizeBattleChar(char, 'player'))
    : [];

  player.validChars = Array.isArray(player.validChars)
    ? player.validChars.map((char) => normalizeBattleChar(char, 'player'))
    : [];

  player.enemyChars = Array.isArray(player.enemyChars)
    ? player.enemyChars.map((char) => normalizeBattleChar(char, 'enemy'))
    : [];

  return player;
}

export function createInitialAnimationState(player) {
  const animations = {};

  [...(player.validChars || []), ...(player.enemyChars || [])].forEach((char) => {
    animations[char.id] = {
      attackToken: 0,
      hitToken: 0,
      healToken: 0,
      deathToken: 0,
      dead: char.health <= 0,
      keepVisible: false,
      removingDead: false,
      effect: null,
      floatText: null,
      impact: null,
    };
  });

  return animations;
}

function mapBattleChars(player) {
  return new Map(
    [...(player.validChars || []), ...(player.enemyChars || [])].map((char) => [char.id, char]),
  );
}

export function buildInitialVisualStatusOverrides(player, queuedVisualEvents = []) {
  const pendingStatusesByTarget = collectStatusApplicationsByTarget(queuedVisualEvents);
  const charsById = mapBattleChars(player || {});
  const overrides = {};

  Object.entries(pendingStatusesByTarget).forEach(([targetId, pendingStatuses]) => {
    const target = charsById.get(targetId);
    if (!target) return;

    const finalStatuses = normalizeStatusMap(target.statuses);
    const visibleStatuses = subtractStatusMap(finalStatuses, pendingStatuses);

    if (!statusMapsEqual(visibleStatuses, finalStatuses)) {
      overrides[targetId] = visibleStatuses;
    }
  });

  return overrides;
}

export function applyVisualEventToStatusOverrides(currentOverrides = {}, player, event) {
  const targetId = event?.targetId;
  const statusesApplied = normalizeStatusMap(event?.statusesApplied);

  if (!targetId || !hasStatuses(statusesApplied)) return currentOverrides || {};

  const target = mapBattleChars(player || {}).get(targetId);
  if (!target) return currentOverrides || {};

  const finalStatuses = normalizeStatusMap(target.statuses);
  const currentStatuses = currentOverrides?.[targetId]
    ? normalizeStatusMap(currentOverrides[targetId])
    : finalStatuses;
  const visibleStatuses = addStatusApplications(currentStatuses, statusesApplied, finalStatuses);
  const nextOverrides = { ...(currentOverrides || {}) };

  if (statusMapsEqual(visibleStatuses, finalStatuses)) {
    delete nextOverrides[targetId];
  } else {
    nextOverrides[targetId] = visibleStatuses;
  }

  return nextOverrides;
}

function cloneAnimationEntry(entry, alive, syncDead = true) {
  return {
    attackToken: entry?.attackToken || 0,
    hitToken: entry?.hitToken || 0,
    healToken: entry?.healToken || 0,
    deathToken: entry?.deathToken || 0,
    dead: syncDead ? alive === false : Boolean(entry?.dead),
    keepVisible: Boolean(entry?.keepVisible),
    removingDead: Boolean(entry?.removingDead),
    effect: entry?.effect || null,
    floatText: entry?.floatText || null,
    impact: entry?.impact || null,
  };
}

export function shouldVisualEventTriggerDeath(player, event, remainingEvents = []) {
  const targetChar = mapBattleChars(player || {}).get(event?.targetId);
  const kind = getVisualEventKind(event);

  return Boolean(
    targetChar &&
    Number(targetChar.health || 0) <= 0 &&
    !remainingEvents.some((item) => item?.targetId === event?.targetId) &&
    kind !== 'heal'
  );
}

export function getBattleVisualEvents(player) {
  return Array.isArray(player?.session?.battle?.visualEvents)
    ? player.session.battle.visualEvents
    : [];
}

export function collectNewVisualEvents(prevPlayer, nextPlayer) {
  if (!prevPlayer || !nextPlayer) return [];

  const prevVisualEventIds = new Set(getBattleVisualEvents(prevPlayer).map((event) => event.id));

  return getBattleVisualEvents(nextPlayer)
    .filter((event) => event?.id && !prevVisualEventIds.has(event.id))
    .sort((a, b) => {
      const seqA = Number(a.seq || 0);
      const seqB = Number(b.seq || 0);
      return seqA - seqB;
    });
}

export function getVisualEventKind(event) {
  if (event?.dodged) return 'dodge';
  if (event?.blocked) return 'block';
  if (
    event?.type === 'heal'
    || getVisualEventHealAmount(event) > 0
    || String(event?.effect || '').startsWith('heal')
  ) {
    return 'heal';
  }

  return 'damage';
}

function buildFloatTextForVisualEvent(event) {
  const kind = getVisualEventKind(event);
  const damage = getVisualEventDamageAmount(event);
  const heal = getVisualEventHealAmount(event);

  if (kind === 'dodge') {
    return {
      type: 'dodge',
      text: 'УКЛОН',
    };
  }

  if (kind === 'block') {
    return {
      type: 'block',
      text: 'БЛОК',
    };
  }

  if (kind === 'heal' && heal > 0) {
    return {
      type: 'heal',
      text: `+${heal}`,
    };
  }

  if (damage > 0) {
    return {
      type: 'damage',
      text: `-${damage}`,
    };
  }

  return null;
}

export function applyBattleVisualEventToAnimations(
  currentAnimations = {},
  player,
  event,
  remainingEvents = [],
  options = {},
) {
  if (!event?.targetId) return currentAnimations;

  const includeAttacker = options.includeAttacker !== false;
  const includeImpact = options.includeImpact !== false;
  const nextAnimations = { ...currentAnimations };
  const targetId = event.targetId;
  const attackerId = event.attackerId;
  const kind = getVisualEventKind(event);

  if (includeAttacker && kind !== 'heal' && attackerId && nextAnimations[attackerId]) {
    const current = nextAnimations[attackerId];

    nextAnimations[attackerId] = {
      ...current,
      attackToken: (current.attackToken || 0) + 1,
    };
  }

  if (!includeImpact) return nextAnimations;

  const currentTarget = nextAnimations[targetId] || {
    attackToken: 0,
    hitToken: 0,
    healToken: 0,
    deathToken: 0,
    dead: false,
    keepVisible: false,
    removingDead: false,
    effect: null,
    floatText: null,
    impact: null,
  };
  const effectName = kind === 'block' || kind === 'dodge'
    ? null
    : event.effect || null;
  const effectToken = event.seq || event.id || (currentTarget.effect?.token || 0) + 1;
  const floatText = buildFloatTextForVisualEvent(event);
  const shouldDieAfterThisEvent = shouldVisualEventTriggerDeath(player, event, remainingEvents);

  nextAnimations[targetId] = {
    ...currentTarget,
    hitToken: kind === 'heal'
      ? currentTarget.hitToken
      : (currentTarget.hitToken || 0) + 1,
    healToken: kind === 'heal'
      ? (currentTarget.healToken || 0) + 1
      : currentTarget.healToken,
    deathToken: shouldDieAfterThisEvent
      ? (currentTarget.deathToken || 0) + 1
      : currentTarget.deathToken,
    dead: shouldDieAfterThisEvent ? true : currentTarget.dead,
    keepVisible: shouldDieAfterThisEvent || currentTarget.keepVisible,
    removingDead: false,
    effect: effectName
      ? {
        name: effectName,
        token: effectToken,
        type: kind === 'heal' ? 'heal' : 'damage',
      }
      : null,
    floatText: floatText
      ? {
        ...floatText,
        id: `${event.id}:float`,
        token: event.seq || event.id,
      }
      : null,
    impact: {
      type: kind,
      token: event.seq || event.id,
    },
  };

  return nextAnimations;
}

export function diffBattleAnimations(prevPlayer, nextPlayer, prevAnimations = {}, options = {}) {
  const prevChars = mapBattleChars(prevPlayer || {});
  const nextChars = mapBattleChars(nextPlayer || {});
  const nextAnimations = {};
  const prevActed = new Set(prevPlayer?.session?.battle?.actedCharacters || []);
  const nextActed = new Set(nextPlayer?.session?.battle?.actedCharacters || []);
  const prevResponded = new Set(prevPlayer?.session?.battle?.enemiesResponded || []);
  const nextResponded = new Set(nextPlayer?.session?.battle?.enemiesResponded || []);
  const playVisualEvents = options.playVisualEvents !== false;
  const newVisualEvents = collectNewVisualEvents(prevPlayer, nextPlayer);
  const visualTargetIds = new Set(newVisualEvents.map((event) => event.targetId).filter(Boolean));
  const visualAttackerIds = new Set(newVisualEvents.map((event) => event.attackerId).filter(Boolean));
  const shouldQueueVisualEvents = !playVisualEvents && newVisualEvents.length > 0;
  const visualEventsByTargetId = new Map();

  (playVisualEvents ? newVisualEvents : []).forEach((event) => {
    const hasVisualValue = (
      getVisualEventHealAmount(event) > 0
      || getVisualEventDamageAmount(event) > 0
      || event.dodged
      || event.blocked
      || event.mask
      || event.maskFailed
      || Object.keys(event.statusesApplied || {}).length > 0
    );

    if (!event.targetId || (!event.effect && !hasVisualValue)) return;

    const list = visualEventsByTargetId.get(event.targetId) || [];
    list.push(event);
    visualEventsByTargetId.set(event.targetId, list);
  });
  const allIds = new Set([...prevChars.keys(), ...nextChars.keys()]);

  allIds.forEach((id) => {
    const prevChar = prevChars.get(id);
    const nextChar = nextChars.get(id);
    const nextAlive = nextChar ? nextChar.health > 0 : false;
    const suppressVisualFallback = shouldQueueVisualEvents && visualTargetIds.has(id);
    const suppressTurnToken = shouldQueueVisualEvents && visualAttackerIds.has(id);
    const animation = cloneAnimationEntry(prevAnimations[id], nextAlive, !suppressVisualFallback);
    let effectChanged = false;

    if (suppressVisualFallback && !nextAlive) {
      animation.keepVisible = true;
      animation.removingDead = false;
    }

    if (!suppressTurnToken && nextActed.has(id) && !prevActed.has(id)) {
      animation.attackToken += 1;
    }

    if (!suppressTurnToken && nextResponded.has(id) && !prevResponded.has(id)) {
      animation.attackToken += 1;
    }

    if (prevChar && nextChar) {
      const visualEvents = visualEventsByTargetId.get(id) || [];

      if (visualEvents.length) {
        const event = visualEvents[visualEvents.length - 1];
        const type = getVisualEventKind(event);

        if (type === 'heal') {
          animation.healToken += visualEvents.length;
        } else {
          animation.hitToken += visualEvents.length;
        }

        animation.effect = event.effect
          ? {
            name: event.effect,
            token: (animation.effect?.token || 0) + visualEvents.length,
            type,
          }
          : null;
        effectChanged = true;
      } else if (!suppressVisualFallback && nextChar.health < prevChar.health) {
        const effectiveStats = getEffectiveStats(nextChar);
        animation.hitToken += 1;
        animation.effect = {
          name: nextChar.justHitEffect || effectiveStats.hitEffect || 'blade',
          token: (animation.effect?.token || 0) + 1,
          type: 'damage',
        };
        effectChanged = true;
      } else if (!suppressVisualFallback && nextChar.health > prevChar.health) {
        animation.healToken += 1;
        animation.effect = {
          name: nextChar.justHitEffect || 'heal2',
          token: (animation.effect?.token || 0) + 1,
          type: 'heal',
        };
        effectChanged = true;
      } else if (
        !suppressVisualFallback &&
        nextChar.justHitEffect &&
        nextChar.justHitEffect !== prevChar.justHitEffect
      ) {
        animation.effect = {
          name: nextChar.justHitEffect,
          token: (animation.effect?.token || 0) + 1,
          type: nextChar.justHitEffect.startsWith('heal') ? 'heal' : 'damage',
        };
        effectChanged = true;
      }

      if (!suppressVisualFallback && prevChar.health > 0 && nextChar.health <= 0) {
        animation.deathToken += 1;
        animation.dead = true;
        animation.keepVisible = true;
        animation.removingDead = false;
      } else if (!suppressVisualFallback && nextChar.health > 0) {
        animation.dead = false;
        animation.keepVisible = false;
        animation.removingDead = false;
      }
    }

    if (!prevChar && nextChar) {
      animation.effect = null;
      animation.dead = nextChar.health <= 0;
    }

    if (!effectChanged) {
      animation.effect = null;
    }

    nextAnimations[id] = animation;
  });

  return nextAnimations;
}

export function buildBattleView(player, animations = {}, options = {}) {
  return {
    rawPlayer: player,
    playerChars: player.playerChars || [],
    validChars: player.validChars || [],
    enemyChars: player.enemyChars || [],
    mapId: player.session?.battle?.mapIdBG || player.session?.mapName || 'betweenworlds',
    actedCharacters: player.session?.battle?.actedCharacters || [],
    enemiesResponded: player.session?.battle?.enemiesResponded || [],
    battleTurn: player.session?.battle?.turn || 'player',
    battleMode: player.session?.battle?.mode || 'pve',
    battleActive: Boolean(player.session?.battle?.active),
    battleResult: player.session?.battleResult || null,
    actionState: player.session?.battle?.actionState || null,
    visualEvents: player.session?.battle?.visualEvents || [],
    unmaskOptions: player.session?.battle?.unmaskOptions || [],
    statusOverridesByCharId: options.statusOverridesByCharId || {},
    animations,
  };
}
