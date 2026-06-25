import { abilityDefinitions, charTemplates, statusDefinitions } from './battleData';
import { getAllAbilityIds, getEffectiveStats } from './battleMath';

const STATUS_FIELDS = {
  attack: '⚔',
  defence: '🛡',
  health: '💚',
  dodgeChance: '💨',
  maxHealth: '❤️',
};

const OUT_OF_TURN_ABILITY_IDS = new Set(['enslave']);

const RANGE_EMOJI = new Map([
  ['0,1', '➡️'],
  ['0,2', '➡️'],
  ['-1,1', '↗️'],
  ['-1,2', '↗️'],
  ['1,1', '↘️'],
  ['1,2', '↘️'],
]);

const NUM_EMOJI = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

function getCatalogEntry(catalog, fallback, id) {
  return catalog?.[id] || fallback?.[id] || null;
}

function getEffectiveStatuses(char) {
  return getEffectiveStats(char).statuses || {};
}

function getCardTone(attack) {
  const min = Number(attack?.min || 0);
  const max = Number(attack?.max || 0);

  if (min < 0 || max < 0) return 'support';
  if (min === 0 && max === 0) return 'utility';
  return 'attack';
}

function getAverageMagnitude(attack) {
  const min = Math.abs(Number(attack?.min || 0));
  const max = Math.abs(Number(attack?.max || 0));
  return Math.round((min + max) / 2) * getActionHitCount(attack);
}

function countCenterHits(damageAoe) {
  if (!Array.isArray(damageAoe)) return 0;
  return damageAoe.reduce((total, point) => (
    Array.isArray(point) && point[0] === 0 && point[1] === 0 ? total + 1 : total
  ), 0);
}

function getMaxCellHits(damageAoe) {
  if (!Array.isArray(damageAoe) || damageAoe.length === 0) return 1;

  const counts = new Map();
  damageAoe.forEach((point) => {
    if (!Array.isArray(point)) return;

    const key = `${point[0]}:${point[1]}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return Math.max(1, ...counts.values());
}

function getActionHitCount(action) {
  const centerHits = Math.max(1, countCenterHits(action?.damageAoe));
  const multiHits = Math.max(1, Number(action?.multiHits || 1));

  return centerHits * multiHits;
}

function formatNumberRange(min, max) {
  const low = Math.min(Number(min || 0), Number(max || 0));
  const high = Math.max(Number(min || 0), Number(max || 0));

  return low === high ? String(low) : `${low}-${high}`;
}

function isOnlyMultiOnSingleTarget(damageAoe) {
  return Array.isArray(damageAoe)
    && damageAoe.length > 0
    && damageAoe.every((point) => Array.isArray(point) && point[0] === 0 && point[1] === 0);
}

function drawRangeGridRows(ranges, size = 3) {
  if (ranges === 'anyEnemies') return ['Любой враг'];
  if (ranges === 'anyAllies') return ['Любой союзник'];
  if (ranges === 'any') return ['Любая цель'];
  if (ranges === 'self') return ['Только на себя'];

  const rangeSet = new Set(Array.isArray(ranges) ? ranges.map((pos) => pos.join(',')) : []);
  const half = Math.floor(size / 2);
  const rows = [];

  for (let dr = -half; dr <= half; dr += 1) {
    let row = '';

    for (let dc = 0; dc < size; dc += 1) {
      if (dc === 0) {
        row += dr === 0 ? '🟢' : '⬛';
        continue;
      }

      const key = `${dr},${dc}`;
      row += rangeSet.has(key) ? (RANGE_EMOJI.get(key) || '•') : '⬛';
    }

    rows.push(row);
  }

  return rows;
}

function drawAoeGridRows(damageAoe) {
  if (!Array.isArray(damageAoe) || damageAoe.length === 0 || isOnlyMultiOnSingleTarget(damageAoe)) {
    return null;
  }

  const counts = {};
  damageAoe.forEach(([dr, dc]) => {
    const key = `${dr},${dc}`;
    counts[key] = (counts[key] || 0) + 1;
  });

  const rows = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    let row = '';

    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) {
        row += '💢';
        continue;
      }

      const count = counts[`${dr},${dc}`] || 0;
      row += count === 0 ? '⬛' : NUM_EMOJI[Math.min(count, 10)];
    }

    rows.push(row);
  }

  return rows;
}

function drawRangeAndAoeGrid(ranges, damageAoe, size = 3) {
  const areaRows = drawAoeGridRows(damageAoe);
  const rangeRows = drawRangeGridRows(ranges, size);

  if (!areaRows) {
    return {
      label: 'Дальность:',
      rows: rangeRows,
    };
  }

  const maxRows = Math.max(areaRows.length, rangeRows.length);
  const rows = Array.from({ length: maxRows }, (_, index) => {
    const left = areaRows[index] || '';
    const right = rangeRows[index] || '';
    return `${left}➖${right}`;
  });

  return {
    label: 'Область / Дальность:',
    rows,
  };
}

function formatSignedPercent(value) {
  const rounded = Math.round(value * 100);
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

function formatMultiplier(raw, stacks = 1) {
  const base = parseFloat(String(raw).slice(1));
  if (!Number.isFinite(base)) return null;

  const mult = base ** stacks;
  const percent = Math.round((mult - 1) * 100);
  return `${percent >= 0 ? '+' : ''}${percent}%`;
}

function formatStatusModifierValue(key, raw, stacks = 1, isMult = false) {
  if (raw == null || raw === '' || raw === '0' || raw === 0) return null;

  if (typeof raw === 'string' && raw.startsWith('*')) {
    return formatMultiplier(raw, isMult ? stacks : 1);
  }

  if (typeof raw === 'string' && raw.startsWith('/')) {
    const base = parseFloat(raw.slice(1));
    if (!Number.isFinite(base) || base === 0) return null;

    const mult = 1 / (base ** (isMult ? stacks : 1));
    const percent = Math.round((mult - 1) * 100);
    return `${percent >= 0 ? '+' : ''}${percent}%`;
  }

  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return null;

  const scaled = numeric * (isMult ? stacks : 1);
  if ((key === 'dodgeChance' || key === 'maxHealth') && Math.abs(scaled) < 1) {
    return formatSignedPercent(scaled);
  }

  const rounded = Number.isInteger(scaled) ? scaled : Number(scaled.toFixed(2));
  return `${rounded > 0 ? '+' : ''}${rounded}`;
}

function buildStatusEffectSummary(statusDef = {}, stacks = 1) {
  const isMult = statusDef.mult === 'true';
  const changes = [];

  Object.entries(STATUS_FIELDS).forEach(([key, icon]) => {
    const formatted = formatStatusModifierValue(key, statusDef[key], stacks, isMult);
    if (!formatted) return;

    const displayIcon = key === 'health' && formatted.startsWith('-') ? '🩸' : icon;
    changes.push(`${displayIcon} ${formatted}`);
  });

  return changes.join(', ');
}

function normalizeStatusConfig(config) {
  if (typeof config === 'object' && config !== null) {
    return {
      chance: Number(config.chance ?? 1),
      count: Number(config.count ?? 1),
    };
  }

  return {
    chance: 1,
    count: Number(config || 1),
  };
}

function formatStatusSummary(statusMap = {}, statusCatalogs = {}) {
  const entries = Object.entries(statusMap || {});
  if (entries.length === 0) return '—';

  return entries.map(([id, config]) => {
    const { count, chance } = normalizeStatusConfig(config);
    const status = getCatalogEntry(statusCatalogs, statusDefinitions, id);
    const name = status?.name || id;
    const countLabel = count > 1 ? ` ×${count}` : '';
    const chanceLabel = Number.isFinite(chance) && chance > 0 && chance < 1 ? ` (${Math.round(chance * 100)}%)` : '';
    return `${name}${countLabel}${chanceLabel}`;
  }).join(', ');
}

function formatAppliedStatuses(statusMap = {}, statusCatalogs = {}) {
  const entries = Object.entries(statusMap || {});
  if (entries.length === 0) return ['—'];

  return entries.map(([id, config]) => {
    const { count, chance } = normalizeStatusConfig(config);
    const status = getCatalogEntry(statusCatalogs, statusDefinitions, id);
    const name = status?.name || id;
    const countLabel = count > 1 ? ` ×${count}` : '';
    const chanceLabel = `(${Math.round((Number.isFinite(chance) ? chance : 1) * 100)}%)`;
    const summary = buildStatusEffectSummary(status || {}, count);
    return `${name}${countLabel} ${chanceLabel}${summary ? `: ${summary}` : ''}`;
  });
}

function formatDamageLabel(attack) {
  const rawMin = Number(attack?.min || 0);
  const rawMax = Number(attack?.max || 0);
  const min = Math.abs(rawMin);
  const max = Math.abs(rawMax);
  const hitCount = getActionHitCount(attack);
  const multi = hitCount > 1 ? ` ×${hitCount}` : '';

  if (rawMin === 0 && rawMax === 0) return '• Без прямого урона';
  if (rawMin < 0 || rawMax < 0) return `💚 Лечение: ${formatNumberRange(min, max)}${multi}`;
  return `⚔ До защиты: ${formatNumberRange(min, max)}${multi}`;
}

function formatTargetLabel(ranges) {
  if (ranges === 'self') return 'Только на себя';
  if (ranges === 'anyAllies') return 'Любой союзник';
  if (ranges === 'anyEnemies') return 'Любой враг';
  if (ranges === 'any') return 'Любая цель';

  if (!Array.isArray(ranges) || ranges.length === 0) return 'Без цели';

  const front = ranges.some(([, col]) => col === 1);
  const back = ranges.some(([, col]) => col === 2);

  if (front && back) return 'Передний / задний ряд';
  if (front) return 'Передний ряд';
  if (back) return 'Задний ряд';
  return 'Выбор по шаблону';
}

function formatAoeLabel(damageAoe, chainJumps = 0, multiHits = 1) {
  const hitRepeats = Math.max(1, Number(multiHits || 1));

  if (Number(chainJumps) > 0) {
    return `⛓ Цепь x${Number(chainJumps) + 1}${hitRepeats > 1 ? ` • удары x${hitRepeats}` : ''}`;
  }

  if (!Array.isArray(damageAoe) || damageAoe.length === 0) return 'Одна цель';

  const uniqueCells = new Set(damageAoe.map(([row, col]) => `${row}:${col}`)).size;
  const centerHits = countCenterHits(damageAoe);
  const maxCellHits = getMaxCellHits(damageAoe) * hitRepeats;

  if (uniqueCells <= 1 && centerHits > 1) return `Мультиудар x${centerHits * hitRepeats}`;
  if (uniqueCells <= 1 && hitRepeats > 1) return `Мультиудар x${hitRepeats}`;
  if (uniqueCells <= 1) return 'Одна цель';
  return `Область x${uniqueCells}${maxCellHits > 1 ? ` • удары x${maxCellHits}` : ''}`;
}

function formatCooldownMeta(type, baseCooldown, cooldown) {
  if (type === 'attack') {
    return '⌛️: готово';
  }

  return `⏳: ${baseCooldown} • ⌛️: ${cooldown || 'готово'}`;
}

function formatChainSummary(block) {
  if (!block || Number(block.chainJumps || 0) <= 0) return '';

  const parts = [`прыжков: ${Number(block.chainJumps || 0)}`];
  parts.push(`режим: ${block.chainMode === 'sequential' ? 'последовательный' : 'случайный'}`);

  if (block.chainNoRepeat) {
    parts.push('без повторов');
  }

  return `⛓ Цепь (${parts.join(', ')})`;
}

function formatInfluenceText(value, icon) {
  const percent = Math.round(Number(value || 0) * 100);
  return `${icon} ${percent}% от влияния`;
}

function formatAfterEffectLines(actor, afterEffect, statusCatalogs) {
  if (!afterEffect) return [];

  const resolved = resolvePhaseAction(actor, afterEffect);
  const lines = ['⤵️ После-эффект'];

  if (afterEffect.fromDealtDamagePct != null) {
    lines.push(formatInfluenceText(afterEffect.fromDealtDamagePct, '⚔'));
  } else if (afterEffect.healFromDamagePct != null) {
    lines.push(formatInfluenceText(afterEffect.healFromDamagePct, '💚'));
  } else {
    lines.push(formatDamageLabel({
      ...resolved,
      damageAoe: resolved.damageAoe,
    }));
  }

  lines.push(`Якорь: ${afterEffect.anchor === 'target' ? 'от цели' : 'от себя'}`);

  if (Number(resolved.chainJumps || 0) > 0) {
    lines.push(formatChainSummary(resolved));
  } else {
    const aoeRows = drawAoeGridRows(resolved.damageAoe);
    if (aoeRows?.length) {
      lines.push('Область:');
      lines.push(...aoeRows);
    }
  }

  const appliesRows = formatAppliedStatuses(resolved.status, statusCatalogs);
  if (!(appliesRows.length === 1 && appliesRows[0] === '—')) {
    lines.push('Накладывает:');
    lines.push(...appliesRows);
  }

  return lines;
}

function getAbilityBlockedReason(actor, action, cooldown) {
  const statuses = getEffectiveStatuses(actor);

  if ((statuses.debuff_stun || 0) > 0) return 'Оглушение';
  if ((statuses.debuff_silence || 0) > 0 && action.type === 'ability' && action.abilityId !== 'enslave') {
    return 'Безмолвие';
  }
  if (cooldown > 0) return `Перезарядка ${cooldown}`;
  return null;
}

function resolvePhaseAction(actor, sourceAction = {}) {
  if (sourceAction.serverResolved) {
    return {
      ...sourceAction,
      id: sourceAction.id || null,
      abilityId: sourceAction.abilityId || sourceAction.id || null,
      min: Number(sourceAction.min || 0),
      max: Number(sourceAction.max || 0),
      hitEffect: sourceAction.hitEffect || 'blade',
      ranges: sourceAction.ranges ?? 'anyEnemies',
      damageAoe: Array.isArray(sourceAction.damageAoe) ? sourceAction.damageAoe : null,
      status: sourceAction.status || {},
      afterEffect: sourceAction.afterEffect ? resolvePhaseAction(actor, sourceAction.afterEffect) : null,
      cooldown: Number(sourceAction.cooldown || 0),
      chainJumps: Number(sourceAction.chainJumps || 0),
      chainMode: sourceAction.chainMode || '',
      chainNoRepeat: Boolean(sourceAction.chainNoRepeat),
      multiHits: Math.max(1, Number(sourceAction.multiHits || 1)),
    };
  }

  const effectiveStats = getEffectiveStats(actor, sourceAction);
  return {
    ...sourceAction,
    id: sourceAction.id || null,
    abilityId: sourceAction.abilityId || sourceAction.id || null,
    min: effectiveStats.attack?.min ?? Number(sourceAction.min || 0),
    max: effectiveStats.attack?.max ?? Number(sourceAction.max || 0),
    hitEffect: sourceAction.hitEffect || effectiveStats.hitEffect || 'blade',
    ranges: sourceAction.ranges ?? 'anyEnemies',
    damageAoe: Array.isArray(sourceAction.damageAoe) ? sourceAction.damageAoe : null,
    status: sourceAction.status || {},
    afterEffect: sourceAction.afterEffect ? resolvePhaseAction(actor, sourceAction.afterEffect) : null,
    cooldown: Number(sourceAction.cooldown || 0),
    chainJumps: Number(sourceAction.chainJumps || 0),
    chainMode: sourceAction.chainMode || '',
    chainNoRepeat: Boolean(sourceAction.chainNoRepeat),
    multiHits: Math.max(1, Number(sourceAction.multiHits || 1)),
  };
}

function buildCardPresentation(actor, action, resolvedAction, options = {}) {
  const isChain = Number(resolvedAction.chainJumps || 0) > 0;
  const geometry = drawRangeAndAoeGrid(
    resolvedAction.ranges,
    isChain ? null : resolvedAction.damageAoe,
  );
  const appliesRows = formatAppliedStatuses(resolvedAction.status, options.statusCatalogs);

  return {
    displayTitle: `${action.emoji ? `${action.emoji} ` : ''}${action.name || (options.type === 'attack' ? 'Обычная атака' : 'Способность')}`,
    metaLine: formatCooldownMeta(options.type, Number(action.cooldown || 0), Number(options.cooldown || 0)),
    description: action.description || '',
    attackLine: formatDamageLabel({
      ...resolvedAction,
      damageAoe: resolvedAction.damageAoe,
    }),
    chainLine: isChain ? formatChainSummary(resolvedAction) : '',
    geometryLabel: geometry.label,
    geometryRows: geometry.rows,
    appliesLabel: 'Накладывает:',
    appliesRows,
    afterEffectLines: formatAfterEffectLines(actor, resolvedAction.afterEffect, options.statusCatalogs),
  };
}

function buildCard(actor, action, options = {}) {
  const resolvedAction = resolvePhaseAction(actor, action);
  const cooldown = Number(options.cooldown || 0);
  const blockedReason = getAbilityBlockedReason(actor, options.meta || {}, cooldown);
  const tone = getCardTone(resolvedAction);

  return {
    id: options.id,
    type: options.type,
    actorId: actor.id,
    abilityId: options.abilityId || null,
    abilityIndex: Number.isInteger(options.abilityIndex) ? options.abilityIndex : null,
    title: action.name || (options.type === 'attack' ? 'Обычная атака' : 'Способность'),
    description: action.description || '',
    cooldown,
    blockedReason,
    tone,
    resolvedAction,
    summary: {
      damage: formatDamageLabel({
        ...resolvedAction,
        damageAoe: resolvedAction.damageAoe,
      }),
      target: formatTargetLabel(resolvedAction.ranges),
      area: formatAoeLabel(resolvedAction.damageAoe, resolvedAction.chainJumps, resolvedAction.multiHits),
      statuses: formatStatusSummary(resolvedAction.status, options.statusCatalogs),
      average: getAverageMagnitude(resolvedAction),
    },
    presentation: buildCardPresentation(actor, action, resolvedAction, options),
  };
}

export function applyServerResolvedActionToCard(card, resolvedAction, options = {}) {
  if (!card || !resolvedAction) return card;

  const nextResolvedAction = resolvePhaseAction(options.actor || {}, {
    ...resolvedAction,
    serverResolved: true,
  });
  const presentationSource = {
    ...nextResolvedAction,
    name: card.title,
    description: card.description,
    emoji: resolvedAction.emoji || '',
  };

  return {
    ...card,
    tone: getCardTone(nextResolvedAction),
    resolvedAction: nextResolvedAction,
    targetImpacts: options.targetImpacts || resolvedAction.targetImpacts || card.targetImpacts || {},
    summary: {
      ...card.summary,
      damage: formatDamageLabel(nextResolvedAction),
      target: formatTargetLabel(nextResolvedAction.ranges),
      area: formatAoeLabel(
        nextResolvedAction.damageAoe,
        nextResolvedAction.chainJumps,
        nextResolvedAction.multiHits,
      ),
      statuses: formatStatusSummary(nextResolvedAction.status, options.statusCatalogs),
      average: getAverageMagnitude(nextResolvedAction),
    },
    presentation: {
      ...buildCardPresentation(options.actor || {}, presentationSource, nextResolvedAction, {
        ...options,
        type: card.type,
        cooldown: card.cooldown,
      }),
      displayTitle: card.presentation?.displayTitle || card.title,
    },
  };
}

export function formatTargetImpactLine(action, target) {
  if (!action || !target) return '';

  const rawMin = Number(action.min || 0);
  const rawMax = Number(action.max || 0);
  const low = Math.min(rawMin, rawMax);
  const high = Math.max(rawMin, rawMax);
  const hitCount = getActionHitCount(action);
  const hitLabel = hitCount > 1 ? `, ${hitCount} уд.` : '';

  if (rawMin < 0 || rawMax < 0) {
    const healLow = Math.min(Math.abs(rawMin), Math.abs(rawMax)) * hitCount;
    const healHigh = Math.max(Math.abs(rawMin), Math.abs(rawMax)) * hitCount;
    return `🎯 Лечение: ${formatNumberRange(healLow, healHigh)}${hitLabel}`;
  }

  if (high <= 0) return '🎯 Прямого урона нет';

  const targetStats = getEffectiveStats(target);
  const defence = Math.max(0, Number(targetStats.defence || 0));
  const dodgeChance = Math.max(0, Math.min(0.8, Number(targetStats.dodgeChance || 0)));
  const totalMin = Math.max(0, low - defence) * hitCount;
  const totalMax = Math.max(0, high - defence) * hitCount;
  const dodgeLabel = dodgeChance > 0 ? `, уклон ${Math.round(dodgeChance * 100)}%` : '';

  if (totalMax <= 0) {
    return `🎯 Урон: 0 (блок, защ. ${defence}${dodgeLabel})`;
  }

  return `🎯 Урон: ${formatNumberRange(totalMin, totalMax)}${hitLabel} (защ. ${defence}${dodgeLabel})`;
}

export function buildActionCardsForActor(actor, catalogs = {}) {
  if (!actor) return [];

  const charTemplate = getCatalogEntry(catalogs.chars, charTemplates, actor.templateId) || {};
  const cards = [];
  const baseAttack = {
    id: `${actor.templateId}:basic`,
    abilityId: `${actor.templateId}:basic`,
    name: 'Обычная атака',
    description: 'Базовая атака персонажа.',
    min: Number(charTemplate.attack?.min || 0),
    max: Number(charTemplate.attack?.max || 0),
    ranges: charTemplate.attack?.ranges ?? 'anyEnemies',
    damageAoe: charTemplate.attack?.damageAoe ?? null,
    status: charTemplate.attack?.status || {},
    afterEffect: charTemplate.attack?.afterEffect || null,
    hitEffect: charTemplate.hitEffect || charTemplate.attack?.hitEffect || null,
    cooldown: 0,
    chainJumps: Number(charTemplate.attack?.chainJumps || 0),
    chainMode: charTemplate.attack?.chainMode || '',
    chainNoRepeat: Boolean(charTemplate.attack?.chainNoRepeat),
    multiHits: Math.max(1, Number(charTemplate.attack?.multiHits || 1)),
  };

  cards.push(buildCard(actor, baseAttack, {
    id: `${actor.id}:attack`,
    type: 'attack',
    statusCatalogs: catalogs.statuses,
    meta: {
      type: 'attack',
      abilityId: null,
    },
  }));

  const abilityIds = getAllAbilityIds(actor, catalogs.chars, catalogs.abilities);

  abilityIds.forEach((abilityId, abilityIndex) => {
    if (OUT_OF_TURN_ABILITY_IDS.has(abilityId)) return;

    const ability = getCatalogEntry(catalogs.abilities, abilityDefinitions, abilityId);
    if (!ability) return;

    cards.push(buildCard(actor, ability, {
      id: `${actor.id}:ability:${abilityId}:${abilityIndex}`,
      type: 'ability',
      abilityId,
      abilityIndex,
      cooldown: Number(actor.abilityCooldowns?.[abilityIndex] || 0),
      statusCatalogs: catalogs.statuses,
      meta: {
        type: 'ability',
        abilityId,
      },
    }));
  });

  return cards;
}
