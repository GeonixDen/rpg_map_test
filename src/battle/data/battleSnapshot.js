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
    effectiveStats: normalizeEffectiveStats(char.effectiveStats),
    position: {
      row: Number(char.position?.row ?? -1),
      col: Number(char.position?.col ?? -1),
    },
  };
}

function normalizeEffectiveStats(stats) {
  if (!stats || typeof stats !== 'object') return null;

  return {
    ...stats,
    defence: Number(stats.defence || 0),
    dodgeChance: Number(stats.dodgeChance || 0),
    maxHealth: Number(stats.maxHealth || 0),
    health: Number(stats.health || 0),
    statuses: stats.statuses || {},
    attack: {
      ...(stats.attack || {}),
      min: Number(stats.attack?.min || 0),
      max: Number(stats.attack?.max || 0),
    },
    name: stats.name || null,
    emoji: stats.emoji || '',
    hitEffect: stats.hitEffect || null,
    src: stats.src || null,
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

function normalizeStatusTickMap(statusesTicked = {}) {
  const normalized = {};

  Object.entries(statusesTicked || {}).forEach(([id, rawValue]) => {
    if (!id) return;

    let before = null;
    let after = null;

    if (rawValue && typeof rawValue === 'object') {
      before = Number(
        rawValue.before
        ?? rawValue.from
        ?? rawValue.countBefore
        ?? rawValue.valueBefore
        ?? rawValue.stacksBefore
        ?? rawValue.count
        ?? rawValue.value
        ?? rawValue.stacks,
      );
      after = Number(
        rawValue.after
        ?? rawValue.to
        ?? rawValue.countAfter
        ?? rawValue.valueAfter
        ?? rawValue.stacksAfter
        ?? rawValue.left
        ?? rawValue.remaining,
      );
    } else {
      before = Number(rawValue);
    }

    if (!Number.isFinite(before) || before <= 0) return;

    const normalizedAfter = Number.isFinite(after)
      ? Math.max(0, after)
      : Math.max(0, before - 1);

    if (normalizedAfter === before) return;

    normalized[id] = {
      before,
      after: normalizedAfter,
      delta: normalizedAfter - before,
    };
  });

  return normalized;
}

function hasStatuses(statuses = {}) {
  return Object.keys(statuses || {}).length > 0;
}

function hasStatusTicks(statusesTicked = {}) {
  return Object.keys(statusesTicked || {}).length > 0;
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

function restoreStatusTicks(baseStatuses = {}, statusesTicked = {}) {
  const next = { ...normalizeStatusMap(baseStatuses) };

  Object.entries(normalizeStatusTickMap(statusesTicked)).forEach(([id, transition]) => {
    const before = Number(transition.before || 0);

    if (before > 0) {
      next[id] = Math.max(Number(next[id] || 0), before);
    } else {
      delete next[id];
    }
  });

  return next;
}

function applyStatusTicks(baseStatuses = {}, statusesTicked = {}) {
  const next = { ...normalizeStatusMap(baseStatuses) };

  Object.entries(normalizeStatusTickMap(statusesTicked)).forEach(([id, transition]) => {
    const after = Number(transition.after || 0);

    if (after > 0) {
      next[id] = after;
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

function effectiveStatsEqual(left = null, right = null) {
  const leftStats = normalizeEffectiveStats(left);
  const rightStats = normalizeEffectiveStats(right);

  if (!leftStats || !rightStats) return leftStats === rightStats;

  return (
    Number(leftStats.defence || 0) === Number(rightStats.defence || 0)
    && Number(leftStats.dodgeChance || 0) === Number(rightStats.dodgeChance || 0)
    && Number(leftStats.maxHealth || 0) === Number(rightStats.maxHealth || 0)
    && Number(leftStats.health || 0) === Number(rightStats.health || 0)
    && Number(leftStats.attack?.min || 0) === Number(rightStats.attack?.min || 0)
    && Number(leftStats.attack?.max || 0) === Number(rightStats.attack?.max || 0)
    && statusMapsEqual(leftStats.statuses, rightStats.statuses)
  );
}

function getServerBackedEffectiveStats(char) {
  if (!char) return null;

  try {
    return getEffectiveStats(char);
  } catch {
    return char.effectiveStats || null;
  }
}

function addStatusApplications(baseStatuses = {}, appliedStatuses = {}) {
  const next = { ...normalizeStatusMap(baseStatuses) };

  Object.entries(normalizeStatusMap(appliedStatuses)).forEach(([id, count]) => {
    const value = Number(next[id] || 0) + count;

    if (value > 0) {
      next[id] = value;
    } else {
      delete next[id];
    }
  });

  return next;
}

function collectEffectiveStatEventsByTarget(events = []) {
  const byTargetId = {};

  (Array.isArray(events) ? events : []).forEach((event) => {
    const targetId = event?.targetId;
    const beforeStats = normalizeEffectiveStats(event?.targetEffectiveStatsBefore);
    const afterStats = normalizeEffectiveStats(event?.targetEffectiveStatsAfter);

    if (!targetId || (!beforeStats && !afterStats)) return;

    byTargetId[targetId] ||= [];
    byTargetId[targetId].push({
      beforeStats,
      afterStats,
    });
  });

  return byTargetId;
}

function collectStatusEventsByTarget(events = []) {
  const byTargetId = {};

  (Array.isArray(events) ? events : []).forEach((event) => {
    const targetId = event?.targetId;
    if (!targetId) return;

    const statusesApplied = normalizeStatusMap(event?.statusesApplied);
    const statusesTicked = normalizeStatusTickMap(event?.statusesTicked);

    if (!hasStatuses(statusesApplied) && !hasStatusTicks(statusesTicked)) return;

    byTargetId[targetId] ||= [];
    byTargetId[targetId].push({
      statusesApplied,
      statusesTicked,
    });
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
    statusesTicked: normalizeStatusTickMap(event.statusesTicked),
    targetEffectiveStatsBefore: normalizeEffectiveStats(event.targetEffectiveStatsBefore),
    targetEffectiveStatsAfter: normalizeEffectiveStats(event.targetEffectiveStatsAfter),
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
  const pendingStatusEventsByTarget = collectStatusEventsByTarget(queuedVisualEvents);
  const charsById = mapBattleChars(player || {});
  const overrides = {};

  Object.entries(pendingStatusEventsByTarget).forEach(([targetId, pendingEvents]) => {
    const target = charsById.get(targetId);
    if (!target) return;

    const finalStatuses = normalizeStatusMap(target.statuses);
    let visibleStatuses = finalStatuses;

    for (let index = pendingEvents.length - 1; index >= 0; index -= 1) {
      const event = pendingEvents[index];
      visibleStatuses = restoreStatusTicks(visibleStatuses, event.statusesTicked);
      visibleStatuses = subtractStatusMap(visibleStatuses, event.statusesApplied);
    }

    if (!statusMapsEqual(visibleStatuses, finalStatuses)) {
      overrides[targetId] = visibleStatuses;
    }
  });

  return overrides;
}

export function applyVisualEventToStatusOverrides(currentOverrides = {}, player, event) {
  const targetId = event?.targetId;
  const statusesApplied = normalizeStatusMap(event?.statusesApplied);
  const statusesTicked = normalizeStatusTickMap(event?.statusesTicked);

  if (!targetId || (!hasStatuses(statusesApplied) && !hasStatusTicks(statusesTicked))) {
    return currentOverrides || {};
  }

  const target = mapBattleChars(player || {}).get(targetId);
  if (!target) return currentOverrides || {};

  const finalStatuses = normalizeStatusMap(target.statuses);
  const currentStatuses = currentOverrides?.[targetId]
    ? normalizeStatusMap(currentOverrides[targetId])
    : finalStatuses;
  const visibleStatuses = applyStatusTicks(
    addStatusApplications(currentStatuses, statusesApplied),
    statusesTicked,
  );
  const nextOverrides = { ...(currentOverrides || {}) };

  if (statusMapsEqual(visibleStatuses, finalStatuses)) {
    delete nextOverrides[targetId];
  } else {
    nextOverrides[targetId] = visibleStatuses;
  }

  return nextOverrides;
}

export function buildInitialVisualEffectiveStatsOverrides(player, queuedVisualEvents = []) {
  const pendingStatEventsByTarget = collectEffectiveStatEventsByTarget(queuedVisualEvents);
  const charsById = mapBattleChars(player || {});
  const overrides = {};

  Object.entries(pendingStatEventsByTarget).forEach(([targetId, pendingEvents]) => {
    const target = charsById.get(targetId);
    if (!target) return;

    const finalStats = normalizeEffectiveStats(target.effectiveStats);
    if (!finalStats) return;

    let visibleStats = finalStats;

    for (let index = pendingEvents.length - 1; index >= 0; index -= 1) {
      const event = pendingEvents[index];
      if (event.beforeStats) {
        visibleStats = event.beforeStats;
      }
    }

    if (!effectiveStatsEqual(visibleStats, finalStats)) {
      overrides[targetId] = visibleStats;
    }
  });

  return overrides;
}

export function applyVisualEventToEffectiveStatsOverrides(currentOverrides = {}, player, event) {
  const targetId = event?.targetId;
  const afterStats = normalizeEffectiveStats(event?.targetEffectiveStatsAfter);

  if (!targetId || !afterStats) return currentOverrides || {};

  const target = mapBattleChars(player || {}).get(targetId);
  if (!target) return currentOverrides || {};

  const finalStats = normalizeEffectiveStats(target.effectiveStats);
  const nextOverrides = { ...(currentOverrides || {}) };

  if (effectiveStatsEqual(afterStats, finalStats)) {
    delete nextOverrides[targetId];
  } else {
    nextOverrides[targetId] = afterStats;
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
    kind !== 'heal' &&
    kind !== 'status'
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
  const heal = getVisualEventHealAmount(event);
  const damage = getVisualEventDamageAmount(event);
  if (
    event?.type === 'heal'
    || heal > 0
    || String(event?.effect || '').startsWith('heal')
  ) {
    return 'heal';
  }

  if (event?.type === 'statusTick' && damage <= 0) {
    return 'status';
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
  const includeDeath = options.includeDeath !== false;
  const nextAnimations = { ...currentAnimations };
  const targetId = event.targetId;
  const attackerId = event.attackerId;
  const kind = getVisualEventKind(event);

  if (includeAttacker && kind !== 'heal' && kind !== 'status' && attackerId && nextAnimations[attackerId]) {
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
  const shouldDieAfterThisEvent = includeDeath
    && shouldVisualEventTriggerDeath(player, event, remainingEvents);

  nextAnimations[targetId] = {
    ...currentTarget,
    hitToken: kind === 'heal'
      ? currentTarget.hitToken
      : kind === 'status'
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
        type: kind === 'heal' ? 'heal' : kind === 'status' ? 'status' : 'damage',
      }
      : null,
    floatText: floatText
      ? {
        ...floatText,
        id: `${event.id}:float`,
        token: event.seq || event.id,
      }
      : null,
    impact: kind === 'status'
      ? currentTarget.impact
      : {
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
  const visualTurnActorIds = new Set(
    newVisualEvents
      .filter((event) => event?.phase === 'turnStartStatus')
      .map((event) => event.targetId)
      .filter(Boolean),
  );
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
      || Object.keys(event.statusesTicked || {}).length > 0
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
    const suppressTurnToken = shouldQueueVisualEvents && (
      visualAttackerIds.has(id) ||
      visualTurnActorIds.has(id)
    );
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
        } else if (type !== 'status') {
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
        const effectiveStats = getServerBackedEffectiveStats(nextChar);
        animation.hitToken += 1;
        animation.effect = {
          name: nextChar.justHitEffect || effectiveStats?.hitEffect || 'blade',
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
    bossScene: player.session?.battle?.bossScene || null,
    statusOverridesByCharId: options.statusOverridesByCharId || {},
    effectiveStatsOverridesByCharId: options.effectiveStatsOverridesByCharId || {},
    animations,
  };
}
