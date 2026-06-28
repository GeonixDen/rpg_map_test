import {
  CHARACTER_DRAW_HEIGHT,
  EFFECT_DRAW_HEIGHT,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  STATUS_ICON_SIZE,
  abilityDefinitions,
  charImages,
  effectDefinitions,
  getBattleBackground,
  statusDefinitions,
  toPublicAssetPath,
} from './battleData';
import { getAllAbilityIds, getEffectiveStats, getSlotPosition } from './battleMath';
import {
  buildBossHudSvg,
  buildCountBadgesSvg,
  buildPlatformSvgs,
  buildStatSvg,
  getBossHudLayout,
} from './battleSvg';
import { APP_CONFIG } from '../../config/appConfig.js';

const LIFE_ANIMATION = APP_CONFIG.battle?.animations?.life || {};
const BOSS_CONFIG = APP_CONFIG.battle?.boss || {};
const UNMASK_INDICATOR_CONFIG = APP_CONFIG.battle?.unmaskIndicator || {};

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getStatusTone(statusId = '') {
  return String(statusId).startsWith('debuff_') ? 'debuff' : 'buff';
}

function mergeServerEffectiveStats(serverStats, fallbackStats) {
  if (!serverStats) return fallbackStats;

  return {
    ...fallbackStats,
    ...serverStats,
    attack: {
      ...(fallbackStats.attack || {}),
      ...(serverStats.attack || {}),
    },
    statuses: serverStats.statuses || fallbackStats.statuses || {},
    name: serverStats.name || fallbackStats.name,
    emoji: serverStats.emoji || fallbackStats.emoji,
    hitEffect: serverStats.hitEffect || fallbackStats.hitEffect,
    src: serverStats.src || fallbackStats.src,
  };
}

function buildServerStatsFallback(char) {
  const serverStats = char?.effectiveStats || {};
  const template = char?.templateOverrides || {};
  const fallbackAttack = template.attack || {};

  return {
    maxHealth: Number(serverStats.maxHealth ?? template.maxHealth ?? char?.health ?? 1) || 1,
    health: Number(serverStats.health ?? char?.health ?? template.maxHealth ?? 0) || 0,
    defence: Number(serverStats.defence ?? template.defence ?? 0) || 0,
    dodgeChance: Number(serverStats.dodgeChance ?? template.dodgeChance ?? 0) || 0,
    attack: {
      ...fallbackAttack,
      ...(serverStats.attack || {}),
      min: Number(serverStats.attack?.min ?? fallbackAttack.min ?? 0) || 0,
      max: Number(serverStats.attack?.max ?? fallbackAttack.max ?? 0) || 0,
    },
    statuses: serverStats.statuses || char?.statuses || {},
    name: serverStats.name || template.name || char?.name || char?.id || '—',
    emoji: serverStats.emoji || template.emoji || char?.emoji || '',
    hitEffect: serverStats.hitEffect || template.hitEffect || fallbackAttack.hitEffect || null,
    src: serverStats.src || template.src || null,
  };
}

function getDisplayEffectiveStats(char, displayChar, visualEffectiveStats, hasVisualStatusOverride) {
  let fallbackStats;

  try {
    fallbackStats = getEffectiveStats(displayChar);
  } catch {
    fallbackStats = buildServerStatsFallback(displayChar || char);
  }

  const mergedStats = mergeServerEffectiveStats(visualEffectiveStats || char.effectiveStats, fallbackStats);

  if (hasVisualStatusOverride && !visualEffectiveStats) {
    return {
      ...mergedStats,
      statuses: fallbackStats.statuses,
    };
  }

  return mergedStats;
}

function isBossChar(char) {
  return Boolean(char?.isBoss || char?.bossId);
}

function getSpriteUrl(char, effectiveStats = null) {
  return toPublicAssetPath(
    char?.templateOverrides?.src
    || effectiveStats?.src
    || charImages?.[char?.templateId]?.[char?.tier],
  );
}

function getUnmaskTargetSet(unmaskTargetIds = []) {
  return new Set(
    (Array.isArray(unmaskTargetIds) ? unmaskTargetIds : [])
      .map((id) => String(id || ''))
      .filter(Boolean),
  );
}

function getUnmaskIndicatorEffectName(catalogs = {}, effectCatalog = {}) {
  const configured = UNMASK_INDICATOR_CONFIG.effectName;
  const enslaveEffect = catalogs.abilities?.enslave?.hitEffect || abilityDefinitions.enslave?.hitEffect;
  const fallback = 'magic_mask';

  return [configured, enslaveEffect, fallback].find((effectName) => effectCatalog[effectName]) || fallback;
}

function pushUnmaskIndicatorEffect({
  overlay,
  effectCatalog,
  catalogs,
  targetSet,
  char,
  centerX,
  centerY,
  size = EFFECT_DRAW_HEIGHT,
  yOffset = 0,
}) {
  if (!targetSet.has(String(char?.id || ''))) return;

  const effectName = getUnmaskIndicatorEffectName(catalogs, effectCatalog);
  const effect = effectCatalog[effectName];
  if (!effect) return;

  overlay.push({
    id: `${char.id}:unmask-indicator:${effectName}`,
    kind: 'persistent-effect',
    src: effect.src,
    left: centerX,
    top: centerY + yOffset,
    width: size,
    height: Number(effect.height) || size,
    centered: true,
    effectType: 'unmask',
    style: {
      '--battle-unmask-opacity': numberOr(UNMASK_INDICATOR_CONFIG.opacity, 0.82),
      '--battle-unmask-opacity-dim': numberOr(UNMASK_INDICATOR_CONFIG.opacity, 0.82) * 0.72,
      '--battle-unmask-pulse-scale': numberOr(UNMASK_INDICATOR_CONFIG.pulseScale, 1.08),
      '--battle-unmask-pulse-ms': `${numberOr(UNMASK_INDICATOR_CONFIG.pulseMs, 1450)}ms`,
      '--battle-unmask-glow': UNMASK_INDICATOR_CONFIG.glowColor || 'rgba(255, 220, 140, 0.52)',
    },
  });
}

function buildLifeUiStyle(animation = {}, _opts = {}) {
  const removingDead = Boolean(animation.removingDead);
  const fadeMs = numberOr(LIFE_ANIMATION.removeDeadFadeMs, 320);
  const transition = `opacity ${fadeMs}ms ease`;

  if (removingDead) {
    return {
      opacity: 0,
      transition,
      willChange: 'opacity',
    };
  }

  return {
    opacity: 1,
    transition,
    willChange: 'opacity',
  };
}


export function buildBattleSceneModel({
  mapId,
  validChars,
  enemyChars,
  bossScene = null,
  actedCharacters,
  enemiesResponded,
  animations = {},
  statusOverridesByCharId = {},
  effectiveStatsOverridesByCharId = {},
  catalogs = {},
  unmaskTargetIds = [],
}) {
  const background = getBattleBackground(mapId, catalogs.maps);
  const effectCatalog = catalogs.effects || effectDefinitions;
  const statusCatalog = catalogs.statuses || statusDefinitions;
  const unmaskTargetSet = getUnmaskTargetSet(unmaskTargetIds);
  const playersAttackedSet = new Set(Array.isArray(actedCharacters) ? actedCharacters : []);
  const enemiesAttackedSet = new Set(Array.isArray(enemiesResponded) ? enemiesResponded : []);
  const bossChar = enemyChars.find(isBossChar) || null;
  const hasBossScene = Boolean(bossChar);
  const regularEnemyChars = hasBossScene
    ? enemyChars.filter((char) => !isBossChar(char))
    : enemyChars;

  const allChars = [...validChars, ...regularEnemyChars]
    .filter((char) => {
      const visualHealth = effectiveStatsOverridesByCharId?.[char.id]
        ? Number(effectiveStatsOverridesByCharId[char.id].health ?? 0)
        : Number(char?.health ?? 0);
      return visualHealth > 0 || Boolean(animations?.[char?.id]?.keepVisible);
    })
    .sort((a, b) => a.position.row - b.position.row);

  const underlay = [];
  const sprites = [];
  const overlay = [];
  const floatingTexts = [];
  const countBadges = [];

  allChars.forEach((char, index) => {
    const visualStatuses = statusOverridesByCharId?.[char.id];
    const visualEffectiveStats = effectiveStatsOverridesByCharId?.[char.id];
    const hasVisualStatusOverride = Boolean(visualStatuses);
    const displayChar = visualStatuses
      ? { ...char, statuses: visualStatuses }
      : char;
    const { x, y } = getSlotPosition(char.position.row, char.position.col);
    const shouldFlip = char.side === 'enemy';
    const centerX = shouldFlip ? SCENE_WIDTH + x : x;
    const spriteTop = y - Math.floor(CHARACTER_DRAW_HEIGHT / 2);
    const spriteCenterY = spriteTop + CHARACTER_DRAW_HEIGHT / 2;
    const effectiveStats = getDisplayEffectiveStats(
      char,
      displayChar,
      visualEffectiveStats,
      hasVisualStatusOverride,
    );
    const spriteUrl = getSpriteUrl(char, effectiveStats);
    const allAbilityIds = getAllAbilityIds(displayChar, catalogs.chars, catalogs.abilities);
    const animation = animations[char.id] || {};
    const lifeUiStyle = buildLifeUiStyle(animation);
    const lifeDetailStyle = buildLifeUiStyle(animation, { detail: true });
    const stunned = Number(effectiveStats.statuses?.debuff_stun || 0) > 0;
    const activeChar = char.side === 'player'
      ? !playersAttackedSet.has(char.id)
      : !enemiesAttackedSet.has(char.id);

    const platformSvgs = buildPlatformSvgs(
      {
        ...displayChar,
        __allAbilityIds: allAbilityIds,
      },
      effectiveStats,
      activeChar,
    );

    const svgTop = spriteTop + CHARACTER_DRAW_HEIGHT - 33;
    const svgLeft = centerX - Math.floor(platformSvgs.svgW / 2);

    underlay.push({
      id: `${char.id}:platform`,
      charId: char.id,
      uri: platformSvgs.platformUri,
      left: svgLeft,
      top: svgTop,
      width: platformSvgs.svgW,
      height: platformSvgs.totalH,
      style: lifeUiStyle,
    });

    sprites.push({
      id: `${char.id}:sprite`,
      charId: char.id,
      side: char.side,
      centerX,
      centerY: spriteCenterY - 4,
      drawHeight: CHARACTER_DRAW_HEIGHT,
      row: char.position.row,
      shouldFlip,
      spriteUrl,
      label: effectiveStats.name,
      stunned,
      attackDirection: char.side === 'enemy' ? -1 : 1,
      animation: {
        attackToken: animation.attackToken || 0,
        hitToken: animation.hitToken || 0,
        healToken: animation.healToken || 0,
        deathToken: animation.deathToken || 0,
        dead: Boolean(animation.dead || char.health <= 0),
        removingDead: Boolean(animation.removingDead),
        impactType: animation.impact?.type || null,
        impactToken: animation.impact?.token || 0,
      },
    });

    if (animation.floatText?.id && animation.floatText?.text) {
      floatingTexts.push({
        id: animation.floatText.id,
        charId: char.id,
        type: animation.floatText.type || 'damage',
        text: animation.floatText.text,
        left: centerX + (char.side === 'enemy' ? -10 : 10),
        top: spriteCenterY - CHARACTER_DRAW_HEIGHT * 0.32,
        row: char.position.row,
      });
    }

    const statSvg = buildStatSvg(effectiveStats, char.side === 'enemy');
    const statTop = svgTop - 28;
    const statLeft = char.side === 'enemy'
      ? (svgLeft - statSvg.width + 76)
      : (svgLeft + platformSvgs.svgW - 76);

    overlay.push({
      id: `${char.id}:stats`,
      kind: 'svg',
      uri: statSvg.uri,
      left: statLeft,
      top: statTop,
      width: statSvg.width,
      height: statSvg.height,
      style: lifeDetailStyle,
    });

    if (platformSvgs.ticksUri) {
      overlay.push({
        id: `${char.id}:ticks`,
        kind: 'svg',
        uri: platformSvgs.ticksUri,
        left: svgLeft,
        top: svgTop,
        width: platformSvgs.svgW,
        height: platformSvgs.totalH,
        style: lifeDetailStyle,
      });
    }

    const effectState = animation.effect;
    const effectName = effectState?.name || null;

    if (effectName && effectCatalog[effectName]) {
      const effect = effectCatalog[effectName];
      overlay.push({
        id: `${char.id}:effect:${effectState?.token || 'static'}`,
        kind: 'effect',
        src: effect.src,
        left: centerX,
        top: spriteCenterY,
        width: EFFECT_DRAW_HEIGHT,
        height: effect.height || EFFECT_DRAW_HEIGHT,
        effectType: effectState?.type || (effectName.startsWith('heal') ? 'heal' : 'damage'),
      });
    }

    pushUnmaskIndicatorEffect({
      overlay,
      effectCatalog,
      catalogs,
      targetSet: unmaskTargetSet,
      char,
      centerX,
      centerY: spriteCenterY,
      size: numberOr(UNMASK_INDICATOR_CONFIG.size, EFFECT_DRAW_HEIGHT),
      yOffset: numberOr(UNMASK_INDICATOR_CONFIG.yOffset, 0),
    });

    if (effectiveStats.statuses && Object.keys(effectiveStats.statuses).length > 0) {
      const allStatuses = Object.keys(effectiveStats.statuses)
        .map((id) => ({
          id,
          count: effectiveStats.statuses[id],
          zindex: statusCatalog[id]?.zindex ?? 100,
        }))
        .sort((a, b) => a.zindex - b.zindex);

      const categories = {};
      allStatuses.forEach((status) => {
        const catKey = Math.floor(status.zindex / 10);
        if (!categories[catKey]) categories[catKey] = [];
        categories[catKey].push(status);
      });

      const categoryKeys = Object.keys(categories).map(Number).sort((a, b) => a - b);

      categoryKeys.forEach((catKey, categoryIndex) => {
        const items = categories[catKey];

        for (let rowIndex = items.length - 1; rowIndex >= 0; rowIndex -= 1) {
          const item = items[rowIndex];
          const top = Math.floor(svgTop - categoryIndex * STATUS_ICON_SIZE);
          const offsetStep = STATUS_ICON_SIZE * 0.7;
          const rowOffset = rowIndex * offsetStep;
          const startX = shouldFlip
            ? svgLeft + platformSvgs.svgW - 18
            : svgLeft - STATUS_ICON_SIZE + 18;

          const left = shouldFlip
            ? Math.floor(startX - rowOffset)
            : Math.floor(startX + rowOffset);

          overlay.push({
            id: `${char.id}:status:${item.id}:${categoryIndex}:${rowIndex}`,
            kind: 'status',
            src: statusCatalog[item.id]?.src,
            left,
            top,
            width: STATUS_ICON_SIZE,
            height: STATUS_ICON_SIZE,
            tone: getStatusTone(item.id),
            style: lifeDetailStyle,
          });

          if (item.count > 1 && !animation.dead) {
            const badgeRadius = Math.floor(STATUS_ICON_SIZE / 4);
            const cxLocal = !shouldFlip ? (STATUS_ICON_SIZE - badgeRadius) : badgeRadius;
            const cyLocal = badgeRadius + 2;

            countBadges.push({
              x: left + cxLocal,
              y: top + cyLocal,
              text: String(item.count),
            });
          }
        }
      });
    }

    overlay.push({
      id: `${char.id}:meta`,
      kind: 'meta',
      charId: char.id,
      name: effectiveStats.name,
      side: char.side,
      active: activeChar,
      index,
      position: char.position,
      stats: effectiveStats,
      abilityIds: allAbilityIds,
      abilityCooldowns: char.abilityCooldowns,
      statuses: effectiveStats.statuses,
    });
  });

  if (
    hasBossScene &&
    (
      Number(bossChar?.health || 0) > 0 ||
      Boolean(animations?.[bossChar?.id]?.keepVisible)
    )
  ) {
    const visualStatuses = statusOverridesByCharId?.[bossChar.id];
    const visualEffectiveStats = effectiveStatsOverridesByCharId?.[bossChar.id];
    const hasVisualStatusOverride = Boolean(visualStatuses);
    const displayChar = visualStatuses
      ? { ...bossChar, statuses: visualStatuses }
      : bossChar;
    const animation = animations[bossChar.id] || {};
    const effectiveStats = getDisplayEffectiveStats(
      bossChar,
      displayChar,
      visualEffectiveStats,
      hasVisualStatusOverride,
    );
    const bossSceneWidth = numberOr(bossScene?.scene?.width, numberOr(BOSS_CONFIG.sceneWidth, 300));
    const bossSceneHeight = numberOr(bossScene?.scene?.height, numberOr(BOSS_CONFIG.sceneHeight, 480));
    const drawHeight = numberOr(BOSS_CONFIG.spriteDrawHeight, bossSceneHeight);
    const centerX = SCENE_WIDTH - bossSceneWidth / 2;
    const centerY = SCENE_HEIGHT - bossSceneHeight / 2 + numberOr(BOSS_CONFIG.spriteCenterYOffset, 0);
    const spriteUrl = getSpriteUrl(bossChar, effectiveStats);
    const lifeDetailStyle = buildLifeUiStyle(animation, { detail: true });
    const stunned = Number(effectiveStats.statuses?.debuff_stun || 0) > 0;
    const bossHudModel = {
      ...(bossScene || {}),
      bossName: bossScene?.bossName || effectiveStats.name || bossChar.id,
      phaseName: bossScene?.phaseName || 'Фаза',
      phase: bossScene?.phase || 1,
      totalPhases: bossScene?.totalPhases || 1,
      roundNumber: bossScene?.roundNumber || 1,
      actionPoints: bossScene?.actionPoints || 0,
      roundActionPoints: bossScene?.roundActionPoints || 0,
      roundLimit: bossScene?.roundLimit || 0,
      queue: Array.isArray(bossScene?.queue) ? bossScene.queue : [],
      health: Math.max(0, Number(effectiveStats.health) || 0),
      maxHealth: Math.max(1, Number(effectiveStats.maxHealth) || 1),
      defence: Math.max(0, Number(effectiveStats.defence) || 0),
      dodgePct: Math.max(0, Math.round((effectiveStats.dodgeChance || 0) * 100)),
      statusEntries: Object.keys(effectiveStats.statuses || {})
        .map((id) => ({
          id,
          count: Number(effectiveStats.statuses[id]) || 0,
          zindex: statusCatalog[id]?.zindex ?? 100,
        }))
        .filter((status) => status.count > 0)
        .sort((a, b) => a.zindex - b.zindex),
      scene: {
        width: bossSceneWidth,
        height: bossSceneHeight,
      },
    };
    const bossHudConfig = {
      ...(BOSS_CONFIG.hud || {}),
      sceneWidth: bossSceneWidth,
    };
    const bossHudUri = buildBossHudSvg(bossHudModel, SCENE_WIDTH, SCENE_HEIGHT, bossHudConfig);

    sprites.push({
      id: `${bossChar.id}:boss-sprite`,
      charId: bossChar.id,
      side: bossChar.side || 'enemy',
      centerX,
      centerY,
      drawWidth: bossSceneWidth,
      drawHeight,
      hitWidth: bossSceneWidth,
      hitHeight: bossSceneHeight * 0.92,
      row: 1,
      shouldFlip: false,
      spriteUrl,
      label: effectiveStats.name,
      stunned,
      isBoss: true,
      attackDirection: -1,
      animation: {
        attackToken: animation.attackToken || 0,
        hitToken: animation.hitToken || 0,
        healToken: animation.healToken || 0,
        deathToken: animation.deathToken || 0,
        dead: Boolean(animation.dead || bossChar.health <= 0),
        removingDead: Boolean(animation.removingDead),
        impactType: animation.impact?.type || null,
        impactToken: animation.impact?.token || 0,
      },
    });

    if (animation.floatText?.id && animation.floatText?.text) {
      floatingTexts.push({
        id: animation.floatText.id,
        charId: bossChar.id,
        type: animation.floatText.type || 'damage',
        text: animation.floatText.text,
        left: centerX,
        top: centerY - bossSceneHeight * 0.18,
        row: 1,
      });
    }

    const effectState = animation.effect;
    const effectName = effectState?.name || null;

    if (effectName && effectCatalog[effectName]) {
      const effect = effectCatalog[effectName];
      const effectOffsetScale = numberOr(BOSS_CONFIG.effectOffsetScale, 1);
      const offsetX = numberOr(bossChar.justHitEffectOffset?.x, 0) * effectOffsetScale;
      const offsetY = numberOr(bossChar.justHitEffectOffset?.y, 0) * effectOffsetScale;

      overlay.push({
        id: `${bossChar.id}:boss-effect:${effectState?.token || 'static'}`,
        kind: 'effect',
        src: effect.src,
        left: centerX + offsetX,
        top: centerY + offsetY,
        width: EFFECT_DRAW_HEIGHT,
        height: effect.height || EFFECT_DRAW_HEIGHT,
        effectType: effectState?.type || (effectName.startsWith('heal') ? 'heal' : 'damage'),
      });
    }

    pushUnmaskIndicatorEffect({
      overlay,
      effectCatalog,
      catalogs,
      targetSet: unmaskTargetSet,
      char: bossChar,
      centerX,
      centerY,
      size: numberOr(UNMASK_INDICATOR_CONFIG.bossSize, numberOr(UNMASK_INDICATOR_CONFIG.size, EFFECT_DRAW_HEIGHT)),
      yOffset: numberOr(UNMASK_INDICATOR_CONFIG.bossYOffset, numberOr(UNMASK_INDICATOR_CONFIG.yOffset, 0)),
    });

    if (bossHudUri) {
      overlay.push({
        id: `${bossChar.id}:boss-hud`,
        kind: 'boss-hud',
        uri: bossHudUri,
        left: 0,
        top: 0,
        width: SCENE_WIDTH,
        height: SCENE_HEIGHT,
        style: lifeDetailStyle,
      });
    }

    if (bossHudModel.statusEntries.length > 0) {
      const layout = getBossHudLayout(SCENE_WIDTH, SCENE_HEIGHT, bossHudModel, bossHudConfig);
      const categories = {};

      bossHudModel.statusEntries
        .slice(0, Math.max(1, numberOr(BOSS_CONFIG.maxStatusIcons, 6)))
        .forEach((item) => {
          const catKey = Math.floor((Number(item.zindex) || 0) / 10);
          if (!categories[catKey]) categories[catKey] = [];
          categories[catKey].push(item);
        });

      Object.keys(categories).map(Number).sort((a, b) => a - b).forEach((catKey, categoryIndex) => {
        const items = categories[catKey];

        for (let rowIndex = items.length - 1; rowIndex >= 0; rowIndex -= 1) {
          const item = items[rowIndex];
          const top = Math.floor(layout.status.bottom - STATUS_ICON_SIZE - categoryIndex * STATUS_ICON_SIZE);
          const rowOffset = rowIndex * STATUS_ICON_SIZE * 0.7;
          const left = Math.floor(layout.status.right - STATUS_ICON_SIZE - rowOffset);

          overlay.push({
            id: `${bossChar.id}:boss-status:${item.id}:${categoryIndex}:${rowIndex}`,
            kind: 'status',
            src: statusCatalog[item.id]?.src,
            left,
            top,
            width: STATUS_ICON_SIZE,
            height: STATUS_ICON_SIZE,
            tone: getStatusTone(item.id),
            style: lifeDetailStyle,
          });

          if (item.count > 1 && !animation.dead) {
            const badgeRadius = Math.floor(STATUS_ICON_SIZE / 4);
            countBadges.push({
              x: left + badgeRadius,
              y: top + badgeRadius + 2,
              text: String(item.count),
            });
          }
        }
      });
    }

    overlay.push({
      id: `${bossChar.id}:boss-meta`,
      kind: 'meta',
      charId: bossChar.id,
      name: effectiveStats.name,
      side: bossChar.side || 'enemy',
      active: false,
      index: allChars.length,
      position: bossChar.position,
      stats: effectiveStats,
      abilityIds: [],
      abilityCooldowns: [],
      statuses: effectiveStats.statuses,
      isBoss: true,
      boss: bossHudModel,
    });
  }

  const countsUri = buildCountBadgesSvg(countBadges, SCENE_WIDTH, SCENE_HEIGHT);

  return {
    scene: {
      width: SCENE_WIDTH,
      height: SCENE_HEIGHT,
      background: background.src,
      backgroundMeta: background,
    },
    underlay,
    sprites,
    overlay,
    floatingTexts,
    countsUri,
  };
}
