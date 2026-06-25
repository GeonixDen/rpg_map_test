import { charTemplates, statusDefinitions } from './battleData';

const LEVEL_GROWTH = {
  maxHealth: 0.1,
  defence: 0.15,
  dodgeChance: 0,
  attack: 0.1,
};

const SHARPNESS_GROWTH = 0.05;
const LEVELS_PER_TIER = 10;

const lineMelee = 190;
const lineRange = 60;
const Yline1 = 112;
const Yline2 = Yline1 + 136;
const Yline3 = Yline1 + 136 * 2;
const Xline1of = 0;
const Xline2of = 54;
const Xline3of = 0;

const slotPositions = [
  [
    { x: lineRange + Xline1of, y: Yline1 },
    { x: lineMelee + Xline1of, y: Yline1 },
    { x: -lineMelee - Xline3of, y: Yline1 },
    { x: -lineRange - Xline3of, y: Yline1 },
  ],
  [
    { x: lineRange + Xline2of, y: Yline2 },
    { x: lineMelee + Xline2of, y: Yline2 },
    { x: -lineMelee - Xline2of, y: Yline2 },
    { x: -lineRange - Xline2of, y: Yline2 },
  ],
  [
    { x: lineRange + Xline3of, y: Yline3 },
    { x: lineMelee + Xline3of, y: Yline3 },
    { x: -lineMelee - Xline1of, y: Yline3 },
    { x: -lineRange - Xline1of, y: Yline3 },
  ],
];

export function getSlotPosition(row, col) {
  return slotPositions[row]?.[col] ?? { x: 0, y: 0 };
}

export function parseTemplateId(templateId = '') {
  const value = String(templateId);
  const lastChar = value.slice(-1);

  if (!Number.isNaN(Number(lastChar)) && Number.isInteger(Number(lastChar))) {
    return {
      baseId: value.slice(0, -1),
      tier: Number(lastChar),
    };
  }

  return {
    baseId: value,
    tier: 1,
  };
}

function tierStep(statName, growthMap = LEVEL_GROWTH) {
  const rate = growthMap?.[statName] ?? 0;
  return 1 + rate * LEVELS_PER_TIER;
}

function tierMult(statName, tier = 1, growthMap = LEVEL_GROWTH) {
  const step = tierStep(statName, growthMap);
  const normalizedTier = Math.max(1, tier | 0);
  return step ** (normalizedTier - 1);
}

function growTiered(base, level, tier, statName, growthMap = LEVEL_GROWTH, sharpness = 0) {
  const rate = growthMap?.[statName] ?? 0;
  const normalizedLevel = Math.max(0, level | 0);
  const normalizedSharpness = Math.max(0, sharpness | 0);
  const multTier = tierMult(statName, tier, growthMap);
  const value = (base ?? 0) * multTier * (1 + rate * normalizedLevel + SHARPNESS_GROWTH * normalizedSharpness);
  return statName === 'dodgeChance' ? value : Math.round(value);
}

export function getTierTemplate(templateId, tier = 1, attackParams = {}, templateOverrides = null) {
  const tpl = charTemplates[templateId];

  if (!tpl) {
    throw new Error(`Unknown character template: ${templateId}`);
  }

  const mergedTpl = templateOverrides ? { ...tpl, ...templateOverrides } : tpl;
  const hasAttackParams = Object.keys(attackParams).length > 0;

  return {
    ...mergedTpl,
    tier,
    templateId,
    maxHealth: mergedTpl.maxHealth,
    defence: mergedTpl.defence,
    dodgeChance: mergedTpl.dodgeChance,
    attack: hasAttackParams ? attackParams : { ...(mergedTpl.attack || tpl.attack) },
  };
}

export function getAllAbilityIds(char, templatesCatalog = charTemplates, abilitiesCatalog = null) {
  const { baseId } = parseTemplateId(char.templateId);
  const templates = templatesCatalog || charTemplates;
  const tpl = templates[char.templateId] || templates[baseId] || charTemplates[char.templateId] || charTemplates[baseId];
  const tier = char.tier ?? 1;
  const ids = new Set();

  if (tpl) {
    for (let currentTier = 1; currentTier <= tier; currentTier += 1) {
      const tierKey = `abilityIds${currentTier}`;
      if (Array.isArray(tpl[tierKey])) {
        tpl[tierKey].forEach((id) => ids.add(id));
      }
    }
  }

  if (Array.isArray(char.abilityIds)) {
    char.abilityIds.forEach((id) => ids.add(id));
  }

  if (char.side !== 'player' && tier === 3 && abilitiesCatalog) {
    Object.keys(abilitiesCatalog).forEach((id) => {
      if (id.includes(baseId)) ids.add(id);
    });
  }

  return Array.from(ids);
}

function applyLimits(baseValue, finalValue, isStrictZero = false) {
  if (isStrictZero && baseValue === 0) return 0;
  if (baseValue < 0) return Math.min(finalValue, 0);
  return Math.max(finalValue, 0);
}

function invertIfNegative(baseValue, value) {
  return baseValue < 0 ? -value : value;
}

export function getEffectiveStats(char, attackParams = {}) {
  const tpl = getTierTemplate(char.templateId, char.tier, attackParams, char?.templateOverrides || null);
  const sharpness = Math.max(0, char.sharpness | 0);

  const baseAttack = {
    min: growTiered(tpl.attack.min, char.level, char.tier, 'attack', LEVEL_GROWTH, sharpness),
    max: growTiered(tpl.attack.max, char.level, char.tier, 'attack', LEVEL_GROWTH, sharpness),
  };
  const baseDefence = growTiered(tpl.defence, char.level, char.tier, 'defence', LEVEL_GROWTH, sharpness);
  const baseMaxHealth = growTiered(tpl.maxHealth, char.level, char.tier, 'maxHealth', LEVEL_GROWTH, sharpness);
  const baseDodge = growTiered(tpl.dodgeChance ?? 0, char.level, char.tier, 'dodgeChance');

  const mergedStatuses = {};
  [char.statuses, char.statusesEnv].forEach((source) => {
    if (!source) return;

    Object.entries(source).forEach(([id, statusData]) => {
      const stacks = typeof statusData === 'object' && statusData !== null
        ? Number(statusData.count)
        : Number(statusData);

      if (Number.isNaN(stacks) || stacks === 0) return;
      mergedStatuses[id] = (mergedStatuses[id] || 0) + stacks;
    });
  });

  const add = { attack: 0, defence: 0, dodgeChance: 0, maxHealth: 0 };
  const mult = { attack: 1, defence: 1, dodgeChance: 1, maxHealth: 1 };

  Object.entries(mergedStatuses).forEach(([id, stacks]) => {
    const statusDef = statusDefinitions[id];
    if (!statusDef || !stacks) return;

    Object.entries(statusDef).forEach(([key, mod]) => {
      if (['name', 'src', 'id'].includes(key)) return;
      if (!mod) return;

      const stackCount = statusDef.mult === 'true' ? stacks : 1;

      if (typeof mod === 'string') {
        if (mod.startsWith('*')) {
          const value = parseFloat(mod.slice(1));
          if (!Number.isNaN(value)) mult[key] = (mult[key] ?? 1) * (value ** stackCount);
          return;
        }

        if (mod.startsWith('/')) {
          const value = parseFloat(mod.slice(1));
          if (!Number.isNaN(value) && value !== 0) {
            mult[key] = (mult[key] ?? 1) / (value ** stackCount);
          }
          return;
        }

        const value = Number(mod);
        if (!Number.isNaN(value)) {
          add[key] = (add[key] ?? 0) + value * stackCount;
        }
        return;
      }

      if (typeof mod === 'number') {
        add[key] = (add[key] ?? 0) + mod * stackCount;
      }
    });
  });

  const finalDefence = applyLimits(
    baseDefence,
    Math.round((baseDefence + (add.defence ?? 0)) * (mult.defence ?? 1)),
  );

  let finalDodge = (baseDodge + (add.dodgeChance ?? 0)) * (mult.dodgeChance ?? 1);
  finalDodge = Math.max(0, Math.min(0.8, finalDodge));

  let finalMaxHealth = applyLimits(
    baseMaxHealth,
    Math.round((baseMaxHealth + (add.maxHealth ?? 0)) * (mult.maxHealth ?? 1)),
  );
  finalMaxHealth = Math.max(finalMaxHealth, 1);

  const finalHealth = Math.min(char.health, finalMaxHealth);

  const baseMin = baseAttack.min;
  const addAttackMin = invertIfNegative(baseMin, add.attack ?? 0);
  let finalAttackMin = applyLimits(baseMin, Math.round((baseMin + addAttackMin) * (mult.attack ?? 1)), true);

  if (baseMin > 0) {
    finalAttackMin = Math.max(finalAttackMin, 1);
  } else if (baseMin < 0) {
    finalAttackMin = Math.min(finalAttackMin, -1);
  }

  const baseMax = baseAttack.max;
  const addAttackMax = invertIfNegative(baseMax, add.attack ?? 0);
  let finalAttackMax = applyLimits(baseMax, Math.round((baseMax + addAttackMax) * (mult.attack ?? 1)), true);

  if (baseMax > 0) {
    finalAttackMax = Math.max(finalAttackMax, 1);
  } else if (baseMax < 0) {
    finalAttackMax = Math.min(finalAttackMax, -1);
  }

  return {
    defence: finalDefence,
    dodgeChance: finalDodge,
    maxHealth: finalMaxHealth,
    health: finalHealth,
    attack: {
      min: finalAttackMin,
      max: baseMin >= 0 ? Math.max(finalAttackMin, finalAttackMax) : Math.min(finalAttackMin, finalAttackMax),
    },
    statuses: mergedStatuses,
    name: tpl.name,
    emoji: tpl.emoji,
    hitEffect: tpl.hitEffect,
    src: tpl.src,
  };
}

function shortId(length = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < length; i += 1) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export function instantiateLocalChar(item) {
  const newId = item.id || shortId(8);
  const parsed = parseTemplateId(item.templateId);
  const baseId = parsed.baseId;
  const tier = Number(item.tier) || parsed.tier;
  const tpl = getTierTemplate(baseId, tier);
  const level = item.level || 0;
  const sharpness = item.sharpness || 0;
  const statuses = item.statuses || item.status || {};
  const statusesEnv = item.statusesEnv || {};
  const abilityIds = Array.isArray(item.abilityIds) ? item.abilityIds.slice() : [];

  const provisionalChar = {
    id: newId,
    templateId: baseId,
    tier: tpl.tier,
    level,
    sharpness,
    side: item.side,
    health: growTiered(tpl.maxHealth, level, tier, 'maxHealth', LEVEL_GROWTH, sharpness),
    position: { ...(item.position || {}) },
    statuses,
    statusesEnv,
    abilityIds,
    abilityCooldowns: Array.isArray(item.abilityCooldowns) ? item.abilityCooldowns.slice() : [],
    templateOverrides: item.templateOverrides ? { ...item.templateOverrides } : undefined,
    justHitEffect: item.justHitEffect || null,
  };

  const { maxHealth } = getEffectiveStats(provisionalChar);
  const newChar = {
    ...provisionalChar,
    health: item.health ?? maxHealth,
  };

  const allIds = getAllAbilityIds(newChar);
  if (!Array.isArray(newChar.abilityCooldowns) || newChar.abilityCooldowns.length !== allIds.length) {
    newChar.abilityCooldowns = Array(allIds.length).fill(0);
  }

  return newChar;
}
