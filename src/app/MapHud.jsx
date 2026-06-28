import React, { memo, useMemo } from 'react';
import { Binoculars, BookOpen, Compass, Crown, Flag, MapPin, Shield, Swords, UsersRound } from 'lucide-react';
import { getHealthPercent, getHealthTone } from '../utils/healthTone.js';

const FACTION_TONES = {
  Sign_of_the_Iron_Legion: 'iron',
  Sign_of_the_Ash_Crown: 'ash',
  Sign_of_the_Emerald_Circle: 'emerald',
};

const HERO_LABELS = {
  hero_warrior: 'W',
  hero_mage: 'M',
  hero_archer: 'A',
  hero_bleed: 'B',
  hero_necro: 'N',
  hero_fire: 'F',
  hero_aspid: 'S',
};
const SQUAD_ROWS = 3;
const SQUAD_COLS = 2;

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, number));
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return Math.round(number).toLocaleString('ru-RU');
}

function formatHp(health, maxHealth) {
  return `${formatNumber(health)}/${formatNumber(maxHealth)}`;
}

function getCompactFactionName(name) {
  return String(name || '')
    .replace(/^Железный\s+/i, '')
    .replace(/^Пепельная\s+/i, '')
    .replace(/^Изумрудный\s+/i, '')
    .replace(/^Iron\s+/i, '')
    .replace(/^Ashen\s+/i, '')
    .replace(/^Emerald\s+/i, '')
    .trim();
}

function getHeroLabel(item) {
  return HERO_LABELS[item?.class || item?.templateId] || String(item?.name || '?').trim().slice(0, 1).toUpperCase() || '?';
}

function getAutoNormalMask(char) {
  const masks = Array.isArray(char?.masks?.normal) ? char.masks.normal : [];
  const mask = masks.find((item) => item?.type !== 'echo' && item?.canUse && item?.action);
  if (!mask) return null;

  return {
    id: mask.id,
    name: mask.name || 'Маска',
    action: mask.action,
    tierRoman: mask.tierRoman || mask.tier || '',
  };
}

function buildFallbackSquadHealth(squad) {
  const members = (Array.isArray(squad?.chars) ? squad.chars : []).filter((char) => char?.placed);
  const health = members.reduce((sum, char) => sum + Number(char?.health || 0), 0);
  const maxHealth = members.reduce((sum, char) => sum + Number(char?.maxHealth || 0), 0);
  const ratio = maxHealth > 0 ? health / maxHealth : 0;

  return {
    health,
    maxHealth,
    ratio,
    percent: Math.round(clampPercent(ratio * 100)),
    status: ratio > 0.75 ? 'В норме' : ratio > 0.5 ? 'Ранено' : ratio > 0.25 ? 'Тяжелое' : 'Критическое',
    tone: ratio > 0.75 ? 'healthy' : ratio > 0.5 ? 'caution' : ratio > 0.25 ? 'warning' : 'danger',
    members,
  };
}

function enrichSquadHealth(squadHealth, squad) {
  const byId = new Map((Array.isArray(squad?.chars) ? squad.chars : []).map((char) => [String(char.id), char]));

  return {
    ...squadHealth,
    members: (Array.isArray(squadHealth?.members) ? squadHealth.members : []).map((member) => {
      const fullChar = byId.get(String(member?.id)) || member;
      return {
        ...member,
        masks: fullChar?.masks || member?.masks || null,
        maskUpgrade: getAutoNormalMask(fullChar),
      };
    }),
  };
}

function normalizeHud(hud, mapEntry, squad, player) {
  const squadHealth = enrichSquadHealth(hud?.squadHealth || buildFallbackSquadHealth(squad), squad);
  const partyMembers = Array.isArray(hud?.party?.members) && hud.party.members.length
    ? hud.party.members
    : [{
      id: player?.id || 'player',
      name: player?.name || player?.label || 'Игрок',
      class: player?.class || null,
      level: player?.level || 0,
      current: true,
      sameMap: true,
    }];

  return {
    location: {
      id: hud?.location?.id || mapEntry?.id || '',
      name: hud?.location?.name || mapEntry?.title || mapEntry?.map?.name || mapEntry?.id || 'Локация',
      coords: {
        x: Number(player?.x),
        y: Number(player?.y),
      },
    },
    squadHealth,
    factions: hud?.factions || null,
    party: {
      ...(hud?.party || {}),
      members: partyMembers,
    },
  };
}

function LocationBadge({ location, showMapButton, mapButtonActive, onToggleMap }) {
  const x = Number(location?.coords?.x);
  const y = Number(location?.coords?.y);
  const hasCoords = Number.isFinite(x) && Number.isFinite(y);
  const isClickable = Boolean(showMapButton && onToggleMap);
  const actionLabel = mapButtonActive ? 'К игроку' : 'Открыть карту';
  const title = mapButtonActive ? 'Вернуться к игроку' : 'Открыть полную карту';
  const content = (
    <>
      <span className="map-hud-location__icon">
        <MapPin size={15} />
      </span>
      <span className="map-hud-location__text">
        <small>{isClickable ? 'Локация / карта' : 'Локация'}</small>
        <strong>{location.name}</strong>
        <span className="map-hud-location__meta">
          {hasCoords ? <em>x:{Math.round(x)} y:{Math.round(y)}</em> : null}
          {isClickable ? <b>{actionLabel}</b> : null}
        </span>
      </span>
    </>
  );

  if (isClickable) {
    return (
      <button
        className={`map-hud-location is-clickable ${mapButtonActive ? 'is-active' : ''}`}
        type="button"
        aria-label={title}
        title={title}
        onClick={onToggleMap}
      >
        {content}
      </button>
    );
  }

  return (
    <section className="map-hud-location" aria-label="Текущая локация">
      {content}
    </section>
  );
}

function FactionBanner({ data, tone }) {
  if (!data) return null;
  const isCurrent = !!data.current;

  // Dimensions
  const isEmerald = tone === 'emerald';
  const width = 30;
  const height = isEmerald ? 88 : 82;
  const pathD = isEmerald
    ? 'M 1.25,0.5 L 28.75,0.5 L 28.75,78 L 15,86.5 L 1.25,78 Z'
    : 'M 1.25,0.5 L 28.75,0.5 L 28.75,72 L 15,80.5 L 1.25,72 Z';

  // Colors
  const strokeColor = isCurrent ? '#ffd86b' : (tone === 'iron' ? '#4a7ab5' : tone === 'emerald' ? '#3b7d51' : '#9d3e3e');
  const strokeWidth = isCurrent ? 2 : 1.2;

  // Gradients definition
  const gradId = `grad-${tone}`;
  let stop1, stop2;
  if (tone === 'iron') {
    stop1 = '#203c70';
    stop2 = '#0a1426';
  } else if (tone === 'emerald') {
    stop1 = '#123f20';
    stop2 = '#081c0e';
  } else {
    stop1 = '#521919';
    stop2 = '#1f0909';
  }

  return (
    <div
      className={`faction-banner faction-banner--${tone} ${isCurrent ? 'is-current' : ''} ${data.leader ? 'is-leader' : ''}`}
      style={{ width: `${width}px`, height: `${height}px` }}
      title={data.name}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="faction-banner__svg">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stop1} />
            <stop offset="100%" stopColor={stop2} />
          </linearGradient>
        </defs>
        <path d={pathD} fill={`url(#${gradId})`} stroke={strokeColor} strokeWidth={strokeWidth} />
      </svg>
      <div className="faction-banner__overlay">
        {data.leader ? <Crown size={14} className="faction-banner__icon" /> : null}
        <span className="faction-banner__count">{formatNumber(data.count)}</span>
      </div>
    </div>
  );
}

function FactionBanners({ factions }) {
  const items = Array.isArray(factions?.items) ? factions.items : [];
  if (!items.length) return null;

  const iron = items.find((item) => item.id === 'Sign_of_the_Iron_Legion');
  const emerald = items.find((item) => item.id === 'Sign_of_the_Emerald_Circle');
  const ash = items.find((item) => item.id === 'Sign_of_the_Ash_Crown');

  return (
    <div className="faction-banners">
      <FactionBanner data={iron} tone="iron" />
      <FactionBanner data={emerald} tone="emerald" />
      <FactionBanner data={ash} tone="ash" />
    </div>
  );
}

function ExplorationFactionsWidget({ factions, exploration, onToggleMap, mapButtonActive, location }) {
  const exploredPct = exploration?.exploredPct != null ? Math.round(exploration.exploredPct) : 80;
  const isExplored = exploredPct === 100 || !!exploration?.canShowMap;
  const isClickable = isExplored && typeof onToggleMap === 'function';

  const x = Number(location?.coords?.x);
  const y = Number(location?.coords?.y);
  const hasCoords = Number.isFinite(x) && Number.isFinite(y);

  const emblemContent = (
    <>
      <div className="exploration-emblem__inner">
        <div className="exploration-emblem__compass">
          <Compass size={16} className="exploration-emblem__compass-icon" />
        </div>
        {!isExplored && (
          <div className="exploration-emblem__label">
            <Binoculars size={14} className="exploration-emblem__label-icon" />
            <span className="exploration-emblem__label-text">РАЗВЕДКА</span>
          </div>
        )}
        <div className="exploration-emblem__percentage">
          {isExplored ? (mapButtonActive ? 'ЗАКРЫТЬ' : 'КАРТА') : `${exploredPct}%`}
        </div>
      </div>
      <div className="exploration-emblem__pin exploration-emblem__pin--top" />
      <div className="exploration-emblem__pin exploration-emblem__pin--right" />
      <div className="exploration-emblem__pin exploration-emblem__pin--bottom" />
      <div className="exploration-emblem__pin exploration-emblem__pin--left" />
    </>
  );

  const emblemClass = `exploration-emblem ${isClickable ? 'is-clickable' : ''} ${isExplored ? 'is-explored' : ''} ${mapButtonActive ? 'is-active' : ''}`;

  return (
    <div className="exploration-factions-widget">
      <div className="exploration-factions-widget__main-row">
        <div className="exploration-emblem-wrap">
          {isClickable ? (
            <button
              className={emblemClass}
              onClick={onToggleMap}
              type="button"
              aria-label="Открыть карту"
              title="Открыть карту"
            >
              {emblemContent}
            </button>
          ) : (
            <div className={emblemClass} aria-label="Прогресс исследования">
              {emblemContent}
            </div>
          )}
          <FactionBanners factions={factions} />
        </div>

        {location && (
          <div className="exploration-factions-widget__location">
            <h1 className="exploration-factions-widget__location-name">{location.name}</h1>
            {hasCoords && (
              <span className="exploration-factions-widget__location-coords">
                x:{Math.round(x)} y:{Math.round(y)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


function PartyPanel({ party }) {
  const members = Array.isArray(party?.members) ? party.members : [];
  if (!members.length) return null;

  return (
    <aside className="map-hud-party" aria-label="Группа на карте">
      <span className="map-hud-party__title">Группа</span>
      {members.map((member) => (
        <span
          key={member.id}
          className={`map-hud-party__member ${member.current ? 'is-current' : ''} ${member.sameMap ? '' : 'is-away'} ${member.leader ? 'is-leader' : ''}`}
          title={`${member.name}${member.sameMap ? '' : ' на другой карте'}`}
        >
          <span>{getHeroLabel(member)}</span>
          <strong>{member.current ? 'Вы' : member.name}</strong>
          {member.leader ? <Crown size={11} /> : null}
        </span>
      ))}
    </aside>
  );
}

function createSquadSlots(members) {
  const list = Array.isArray(members) ? members.slice(0, 6) : [];
  const usedIds = new Set();
  const bySlot = new Map();

  for (const member of list) {
    const row = Number(member?.position?.row);
    const col = Number(member?.position?.col);
    if (
      Number.isInteger(row) &&
      Number.isInteger(col) &&
      row >= 0 &&
      row < SQUAD_ROWS &&
      col >= 0 &&
      col < SQUAD_COLS
    ) {
      bySlot.set(`${row}:${col}`, member);
      usedIds.add(member.id);
    }
  }

  const fallback = list.filter((member) => !usedIds.has(member.id));

  return Array.from({ length: SQUAD_ROWS }, (_, row) => (
    Array.from({ length: SQUAD_COLS }, (_, col) => {
      const member = bySlot.get(`${row}:${col}`) || fallback.shift() || null;
      return { row, col, member };
    })
  ));
}

function SquadMiniatures({ members, busy, onAction, onOpenSquad }) {
  const rows = createSquadSlots(members);
  const hasMembers = rows.some((row) => row.some((slot) => slot.member));
  if (!hasMembers) return null;

  return (
    <span className="map-hud-squad__members" aria-label="Персонажи отряда">
      {rows.flatMap((row) => row.map(({ row: slotRow, col, member }) => {
        const hp = getHealthPercent(member);
        const hpTone = getHealthTone(member);
        const key = member?.id || `slot:${slotRow}:${col}`;
        const maskUpgrade = member?.maskUpgrade || null;
        const handleClick = () => {
          if (maskUpgrade?.action && onAction) {
            onAction(maskUpgrade.action);
          } else if (onOpenSquad) {
            onOpenSquad({ row: slotRow, col, charId: member?.id || null });
          }
        };

        if (!member) {
          return (
            <button
              key={key}
              className="map-hud-squad__member is-empty is-clickable"
              type="button"
              disabled={busy}
              title={`Пустая позиция: Ряд ${slotRow + 1}, слот ${col === 0 ? 'Дальний' : 'Ближний'}`}
              onClick={handleClick}
            />
          );
        }

        return (
          <button
            key={key}
            className={`map-hud-squad__member map-hud-squad__member--${member.rarity || 'standard'} map-hud-squad__member--hp-${hpTone} ${maskUpgrade ? 'has-mask-upgrade' : ''}`}
            type="button"
            disabled={busy}
            title={`${member.name}: ${formatHp(member.health, member.maxHealth)}`}
            onClick={handleClick}
          >
            {member.spriteUrl ? <img src={member.spriteUrl} alt="" draggable="false" /> : <em>{getHeroLabel(member)}</em>}
            {maskUpgrade ? <span className="map-hud-squad__upgrade" aria-hidden="true" /> : null}
            <i style={{ height: `${hp}%` }} />
          </button>
        );
      }))}
    </span>
  );
}

function SquadStatus({ squadHealth, busy, onAction, onOpenSquad }) {
  const members = Array.isArray(squadHealth?.members) ? squadHealth.members : [];

  return (
    <section
      className={`map-hud-squad map-hud-squad--${squadHealth?.tone || 'healthy'}`}
      aria-label="Отряд"
    >
      <button
        className="map-hud-squad__head"
        type="button"
        disabled={busy}
        onClick={onOpenSquad}
        title="Открыть отряд"
      >
        <span>
          <UsersRound size={14} />
          <small>Отряд</small>
        </span>
      </button>

      <span className="map-hud-squad__bottom">
        <SquadMiniatures
          members={members}
          busy={busy}
          onAction={onAction}
          onOpenSquad={onOpenSquad}
        />
      </span>
    </section>
  );
}

function MapHudControls({
  showJournalButton,
  journalButtonActive,
  onOpenJournal,
}) {
  if (!showJournalButton) return null;

  return (
    <div className="map-hud-actions" aria-label="Действия карты">
      {showJournalButton ? (
        <button
          className={`map-hud-action ${journalButtonActive ? 'is-active' : ''}`}
          type="button"
          onClick={onOpenJournal}
          title="Журнал"
        >
          <BookOpen size={15} />
          <span>Журнал</span>
        </button>
      ) : null}
    </div>
  );
}

function MapHud({
  hud,
  mapEntry,
  squad,
  player,
  exploration,
  visible = true,
  onOpenSquad,
  busy,
  onAction,
  showMapButton,
  mapButtonActive,
  onToggleMap,
  showJournalButton,
  journalButtonActive,
  onOpenJournal,
}) {
  const view = useMemo(
    () => normalizeHud(hud, mapEntry, squad, player),
    [hud, mapEntry, player, squad],
  );

  if (!visible) return null;

  return (
    <div className="map-hud" aria-label="Интерфейс карты">
      <div className="map-hud__top-left">
        <ExplorationFactionsWidget
          factions={view.factions}
          exploration={exploration}
          onToggleMap={onToggleMap}
          mapButtonActive={mapButtonActive}
          location={view.location}
        />
      </div>

      <div className="map-hud__top-right" />

      <div className="map-hud__bottom-left">
        <MapHudControls
          showJournalButton={showJournalButton}
          journalButtonActive={journalButtonActive}
          onOpenJournal={onOpenJournal}
        />
        <div className="map-hud__squad-row">
          <SquadStatus
            squadHealth={view.squadHealth}
            busy={busy}
            onAction={onAction}
            onOpenSquad={onOpenSquad}
          />
          <PartyPanel party={view.party} />
        </div>
      </div>
    </div>
  );
}

export default memo(MapHud);
