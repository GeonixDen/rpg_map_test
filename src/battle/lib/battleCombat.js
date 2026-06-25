import { charTemplates } from './battleData';
import { getEffectiveStats } from './battleMath';

const GRID_ROWS = 3;
const GRID_COLS = 4;
const ORTHO_OFFSETS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

function inGrid(row, col) {
  return row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS;
}

function isAlive(char) {
  return Number(char?.health || 0) > 0;
}

function hasTauntStatus(unit) {
  return Number(getEffectiveStats(unit).statuses?.buff_taunt || 0) > 0;
}

function isConfused(unit) {
  return Number(getEffectiveStats(unit).statuses?.debuff_confusion || 0) > 0;
}

function mapRangesWithConfusion(unit, ranges) {
  if (!isConfused(unit)) return ranges;
  if (ranges === 'anyEnemies') return 'anyAllies';
  if (ranges === 'anyAllies') return 'anyEnemies';
  if (Array.isArray(ranges)) return 'self';
  return ranges;
}

function getCharAtPosition(allChars, row, col) {
  return allChars.find((char) => (
    isAlive(char) && char.position?.row === row && char.position?.col === col
  )) || null;
}

function filterEnslavables(chars, catalogs) {
  const templates = catalogs?.chars || charTemplates;
  return chars.filter((char) => String(templates?.[char.templateId]?.enslaveImmune || '').toLowerCase() !== 'true');
}

export function getAvailableTargetsForAction(actor, allChars, actionDef, catalogs = {}) {
  let enemies = allChars.filter((char) => isAlive(char) && char.side !== actor.side);
  const allies = allChars.filter((char) => isAlive(char) && char.side === actor.side);
  const effectiveStatuses = getEffectiveStats(actor).statuses || {};
  const ranges = mapRangesWithConfusion(
    { ...actor, statuses: effectiveStatuses },
    actionDef?.ranges ?? 'anyEnemies',
  );

  if ((actionDef?.abilityId || actionDef?.id) === 'enslave') {
    enemies = filterEnslavables(enemies, catalogs);
  }

  if (ranges === 'self') return [actor];
  if (ranges === 'any') return allChars.filter(isAlive);
  if (ranges === 'anyAllies') return allies;

  if (ranges === 'anyEnemies') {
    const taunted = enemies.filter(hasTauntStatus);
    return taunted.length > 0 ? taunted : enemies;
  }

  let pattern = Array.isArray(ranges) ? ranges : [];
  if (pattern.length === 0) return [];

  if (actor.side === 'enemy') {
    pattern = pattern.map(([row, col]) => [row, -col]);
  }

  const rowLayers = [[0], [-1, 1], [-2, 2]];
  const colLayers = [[0], [-1], [1]];
  let firstNonEmpty = null;

  const collectForLayer = (rowLayer, colLayer) => {
    const found = new Set();

    for (const rowOffset of rowLayer) {
      for (const colOffset of colLayer) {
        enemies.forEach((target) => {
          pattern.forEach(([deltaRow, deltaCol]) => {
            const row = actor.position.row + deltaRow + rowOffset;
            const col = actor.position.col + deltaCol + colOffset;

            if (row === target.position.row && col === target.position.col && inGrid(row, col)) {
              found.add(target);
            }
          });
        });
      }
    }

    return Array.from(found);
  };

  colLayers.forEach((colLayer) => {
    rowLayers.forEach((rowLayer) => {
      const targets = collectForLayer(rowLayer, colLayer);
      if (targets.length === 0) return;

      const taunted = targets.filter(hasTauntStatus);
      if (taunted.length > 0) {
        if (!firstNonEmpty) firstNonEmpty = taunted;
        return;
      }

      if (!firstNonEmpty) firstNonEmpty = targets;
    });
  });

  return firstNonEmpty || [];
}

function getOffsetHitCounts(damageAoe) {
  const offsets = Array.isArray(damageAoe) && damageAoe.length > 0 ? damageAoe : [[0, 0]];
  const hitCounts = new Map();

  offsets.forEach(([row, col]) => {
    const key = `${row}:${col}`;
    hitCounts.set(key, (hitCounts.get(key) || 0) + 1);
  });

  return hitCounts;
}

function resolveAreaTargets(attacker, anchorChar, allChars, damageAoe, sideToAffect) {
  const hitCounts = getOffsetHitCounts(damageAoe);
  const targets = [];

  hitCounts.forEach((hits, key) => {
    const [rowOffsetRaw, colOffsetRaw] = key.split(':');
    const rowOffset = Number(rowOffsetRaw);
    const colOffset = Number(colOffsetRaw);
    const mirroredColOffset = attacker.side === 'enemy' ? -colOffset : colOffset;
    const row = anchorChar.position.row + rowOffset;
    const col = anchorChar.position.col + mirroredColOffset;

    if (!inGrid(row, col)) return;

    const target = getCharAtPosition(allChars, row, col);
    if (!target || !isAlive(target) || target.side !== sideToAffect) return;

    targets.push({ target, hits });
  });

  return targets;
}

function getNeighbors(char, allChars, sideToAffect, excludeIds = new Set()) {
  return ORTHO_OFFSETS
    .map(([rowOffset, colOffset]) => getCharAtPosition(
      allChars,
      char.position.row + rowOffset,
      char.position.col + colOffset,
    ))
    .filter((target) => (
      target
      && isAlive(target)
      && target.side === sideToAffect
      && !excludeIds.has(target.id)
    ));
}

function getChainTargets(anchorChar, allChars, actionDef, sideToAffect) {
  const jumps = Math.max(0, Number(actionDef.chainJumps || 0));
  const chainMode = actionDef.chainMode === 'random' ? 'random' : 'sequential';
  const noRepeat = Boolean(actionDef.chainNoRepeat);
  const targets = [];
  const hitCounts = new Map();
  const visited = new Set();
  const path = [anchorChar];
  let current = anchorChar;
  let jumpsLeft = jumps;

  if (current && isAlive(current) && current.side === sideToAffect) {
    targets.push({ target: current, hits: 1 });
    hitCounts.set(current.id, 1);
    visited.add(current.id);
  }

  while (jumpsLeft > 0 && current) {
    const candidates = getNeighbors(current, allChars, sideToAffect, noRepeat ? visited : new Set());
    let next = null;

    if (candidates.length > 0) {
      if (chainMode === 'random') {
        next = candidates[Math.floor(Math.random() * candidates.length)];
      } else {
        next = [...candidates].sort((left, right) => (
          (hitCounts.get(left.id) || 0) - (hitCounts.get(right.id) || 0)
          || left.position.row - right.position.row
          || left.position.col - right.position.col
        ))[0];
      }
    }

    if (next) {
      current = next;
      targets.push({ target: next, hits: 1 });
      hitCounts.set(next.id, (hitCounts.get(next.id) || 0) + 1);
      visited.add(next.id);
      path.push(next);
      jumpsLeft -= 1;
      continue;
    }

    if (!noRepeat && current) {
      targets.push({ target: current, hits: 1 });
      hitCounts.set(current.id, (hitCounts.get(current.id) || 0) + 1);
      jumpsLeft -= 1;
      continue;
    }

    let rewound = false;
    for (let index = path.length - 2; index >= 0; index -= 1) {
      const previous = path[index];
      const previousCandidates = getNeighbors(previous, allChars, sideToAffect, visited);
      if (previousCandidates.length > 0) {
        current = previous;
        path.length = index + 1;
        rewound = true;
        break;
      }
    }

    if (!rewound) break;
  }

  return targets;
}

function resolveTargetsForAction(attacker, anchorChar, allChars, actionDef, sideToAffect) {
  if (Number(actionDef.chainJumps || 0) > 0) {
    return getChainTargets(anchorChar, allChars, actionDef, sideToAffect);
  }

  return resolveAreaTargets(attacker, anchorChar, allChars, actionDef.damageAoe, sideToAffect);
}

function applyStatuses(target, statusMap = {}) {
  Object.entries(statusMap || {}).forEach(([statusId, config]) => {
    const chance = typeof config === 'object' && config !== null ? Number(config.chance ?? 1) : 1;
    if (chance <= 0) return;

    if (chance < 1 && Math.random() > chance) return;

    const count = typeof config === 'object' && config !== null ? Number(config.count ?? 1) : Number(config ?? 1);
    if (!count) return;

    target.statuses = target.statuses || {};
    target.statuses[statusId] = Number(target.statuses[statusId] || 0) + count;
  });
}

function applyImpactToTarget(target, actionDef, hits = 1) {
  const targetStats = getEffectiveStats(target);
  const min = Number(actionDef.min || 0);
  const max = Number(actionDef.max || 0);
  const averageMagnitude = Math.max(0, Math.round((Math.abs(min) + Math.abs(max)) / 2));
  const totalMagnitude = averageMagnitude * Math.max(1, hits);
  const isHealing = min < 0 || max < 0;
  const isDamage = !isHealing && totalMagnitude > 0;

  if (isHealing) {
    target.health = Number(target.health || 0) + totalMagnitude;
    target.justHitEffect = actionDef.hitEffect || 'heal2';
  } else if (isDamage) {
    const defence = Math.max(0, Number(targetStats.defence || 0));
    const damage = Math.max(0, totalMagnitude - defence);
    target.health = Math.max(0, Number(target.health || 0) - damage);
    target.justHitEffect = actionDef.hitEffect || targetStats.hitEffect || 'blade';
  } else if (actionDef.hitEffect) {
    target.justHitEffect = actionDef.hitEffect;
  }

  applyStatuses(target, actionDef.status);
}

function applyPhase(attacker, anchorChar, allChars, actionDef, sideToAffect) {
  const targets = resolveTargetsForAction(attacker, anchorChar, allChars, actionDef, sideToAffect);
  targets.forEach(({ target, hits }) => {
    applyImpactToTarget(target, actionDef, hits);
  });

  return targets.map(({ target }) => target.id);
}

function markActorAsActed(draft, actorId, side) {
  draft.session = draft.session || {};
  draft.session.battle = draft.session.battle || {};

  if (side === 'enemy') {
    const responded = new Set(draft.session.battle.enemiesResponded || []);
    responded.add(actorId);
    draft.session.battle.enemiesResponded = Array.from(responded);
    return;
  }

  const acted = new Set(draft.session.battle.actedCharacters || []);
  acted.add(actorId);
  draft.session.battle.actedCharacters = Array.from(acted);
}

export function applyCardActionToBattle(draft, actorId, targetId, actionCard, catalogs = {}) {
  if (!actionCard?.resolvedAction) return null;

  const allChars = [...(draft.validChars || []), ...(draft.enemyChars || [])];
  const actor = allChars.find((char) => char.id === actorId);
  if (!actor || !isAlive(actor)) return null;

  const validTargets = getAvailableTargetsForAction(actor, allChars, actionCard.resolvedAction, catalogs);
  const target = validTargets.find((char) => char.id === targetId);
  if (!target) return null;

  const affectedIds = applyPhase(actor, target, allChars, actionCard.resolvedAction, target.side);

  if (actionCard.resolvedAction.afterEffect) {
    const afterEffectAnchor = actionCard.resolvedAction.afterEffect.anchor === 'self' ? actor : target;
    const afterEffectSide = afterEffectAnchor.side;
    applyPhase(actor, afterEffectAnchor, allChars, actionCard.resolvedAction.afterEffect, afterEffectSide);
  }

  if (actionCard.type === 'ability' && Number.isInteger(actionCard.abilityIndex)) {
    actor.abilityCooldowns = Array.isArray(actor.abilityCooldowns) ? actor.abilityCooldowns : [];
    actor.abilityCooldowns[actionCard.abilityIndex] = Number(actionCard.resolvedAction.cooldown || 0);
  }

  markActorAsActed(draft, actor.id, actor.side);

  return {
    actorId: actor.id,
    targetId: target.id,
    affectedIds,
    actionCardId: actionCard.id,
  };
}
