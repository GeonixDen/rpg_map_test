import {
  CHARACTER_DRAW_HEIGHT,
  EFFECT_DRAW_HEIGHT,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  STATUS_ICON_SIZE,
  charImages,
  effectDefinitions,
  getBattleBackground,
  statusDefinitions,
  toPublicAssetPath,
} from './battleData';
import { getAllAbilityIds, getEffectiveStats, getSlotPosition } from './battleMath';
import { buildCountBadgesSvg, buildPlatformSvgs, buildStatSvg } from './battleSvg';

export function buildBattleSceneModel({
  mapId,
  validChars,
  enemyChars,
  actedCharacters,
  enemiesResponded,
  animations = {},
  statusOverridesByCharId = {},
  catalogs = {},
}) {
  const background = getBattleBackground(mapId, catalogs.maps);
  const effectCatalog = catalogs.effects || effectDefinitions;
  const statusCatalog = catalogs.statuses || statusDefinitions;
  const playersAttackedSet = new Set(Array.isArray(actedCharacters) ? actedCharacters : []);
  const enemiesAttackedSet = new Set(Array.isArray(enemiesResponded) ? enemiesResponded : []);

  const allChars = [...validChars, ...enemyChars]
    .filter((char) => (
      Number(char?.health || 0) > 0 ||
      Boolean(animations?.[char?.id]?.keepVisible)
    ))
    .sort((a, b) => a.position.row - b.position.row);

  const underlay = [];
  const sprites = [];
  const overlay = [];
  const floatingTexts = [];
  const countBadges = [];

  allChars.forEach((char, index) => {
    const visualStatuses = statusOverridesByCharId?.[char.id];
    const displayChar = visualStatuses
      ? { ...char, statuses: visualStatuses }
      : char;
    const { x, y } = getSlotPosition(char.position.row, char.position.col);
    const shouldFlip = char.side === 'enemy';
    const centerX = shouldFlip ? SCENE_WIDTH + x : x;
    const spriteTop = y - Math.floor(CHARACTER_DRAW_HEIGHT / 2);
    const spriteCenterY = spriteTop + CHARACTER_DRAW_HEIGHT / 2;
    const spriteUrl = toPublicAssetPath(char.templateOverrides?.src || charImages?.[char.templateId]?.[char.tier]);
    const effectiveStats = getEffectiveStats(displayChar);
    const allAbilityIds = getAllAbilityIds(displayChar, catalogs.chars, catalogs.abilities);
    const animation = animations[char.id] || {};
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
            tone: item.id.startsWith('buff_') ? 'buff' : 'debuff',
          });

          if (item.count > 1) {
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
