import React, { memo, useMemo } from 'react';
import { BookOpen, Crown, Flag, Map as MapIcon, MapPin, UsersRound } from 'lucide-react';

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

function getHpPercent(member) {
  if (!member?.maxHealth) return 0;
  return clampPercent((Number(member.health || 0) / Number(member.maxHealth || 1)) * 100);
}

function getHeroLabel(item) {
  return HERO_LABELS[item?.class || item?.templateId] || String(item?.name || '?').trim().slice(0, 1).toUpperCase() || '?';
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

function normalizeHud(hud, mapEntry, squad, player) {
  const squadHealth = hud?.squadHealth || buildFallbackSquadHealth(squad);
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

function LocationBadge({ location }) {
  const x = Number(location?.coords?.x);
  const y = Number(location?.coords?.y);
  const hasCoords = Number.isFinite(x) && Number.isFinite(y);

  return (
    <section className="map-hud-location" aria-label="Текущая локация">
      <span className="map-hud-location__icon">
        <MapPin size={15} />
      </span>
      <span className="map-hud-location__text">
        <small>Локация</small>
        <strong>{location.name}</strong>
        {hasCoords ? <em>x:{Math.round(x)} y:{Math.round(y)}</em> : null}
      </span>
    </section>
  );
}

function FactionSituation({ factions }) {
  const items = Array.isArray(factions?.items) ? factions.items : [];
  if (!items.length) return null;

  return (
    <section className="map-hud-factions" aria-label="Ситуация по фракциям">
      <span className="map-hud-factions__title">
        <Flag size={13} />
        <span>Фракции</span>
      </span>
      <span className="map-hud-factions__list">
        {items.map((item) => {
          const tone = FACTION_TONES[item.id] || 'neutral';
          const compactName = getCompactFactionName(item.name);

          return (
            <span
              key={item.id}
              className={`map-hud-faction map-hud-faction--${tone} ${item.current ? 'is-current' : ''} ${item.leader ? 'is-leader' : ''}`}
              title={item.name}
            >
              <span className="map-hud-faction__mark">{item.emoji || '•'}</span>
              <span className="map-hud-faction__body">
                <strong>{formatNumber(item.count)}</strong>
                <small>{compactName || item.name}</small>
              </span>
              {item.leader ? <Crown className="map-hud-faction__leader" size={13} /> : null}
              {item.current && (item.activePoints || item.passivePoints) ? (
                <span className="map-hud-faction__personal">
                  {item.activePoints ? `+${item.activePoints}` : ''}
                  {item.passivePoints ? `/${item.passivePoints}` : ''}
                </span>
              ) : null}
            </span>
          );
        })}
      </span>
    </section>
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

function SquadMiniatures({ members }) {
  const rows = createSquadSlots(members);
  const hasMembers = rows.some((row) => row.some((slot) => slot.member));
  if (!hasMembers) return null;

  return (
    <span className="map-hud-squad__members" aria-label="Персонажи отряда">
      {rows.flatMap((row) => row.map(({ row: slotRow, col, member }) => {
        const hp = getHpPercent(member);
        const key = member?.id || `slot:${slotRow}:${col}`;

        return (
          <span
            key={key}
            className={`map-hud-squad__member ${member ? `map-hud-squad__member--${member.rarity || 'standard'}` : 'is-empty'}`}
            title={member ? `${member.name}: ${formatHp(member.health, member.maxHealth)}` : `Пустой слот ${slotRow + 1}:${col + 1}`}
          >
            {member?.spriteUrl ? <img src={member.spriteUrl} alt="" draggable="false" /> : <em>{member ? getHeroLabel(member) : ''}</em>}
            {member ? <i style={{ height: `${hp}%` }} /> : null}
          </span>
        );
      }))}
    </span>
  );
}

function SquadStatus({ squadHealth, onOpenSquad }) {
  const members = Array.isArray(squadHealth?.members) ? squadHealth.members : [];

  return (
    <button
      className={`map-hud-squad map-hud-squad--${squadHealth?.tone || 'healthy'}`}
      type="button"
      onClick={onOpenSquad}
      title="Открыть отряд"
    >
      <span className="map-hud-squad__head">
        <span>
          <UsersRound size={14} />
          <small>Отряд</small>
        </span>
      </span>

      <span className="map-hud-squad__bottom">
        <SquadMiniatures members={members} />
      </span>
    </button>
  );
}

function MapHudControls({
  showMapButton,
  mapButtonActive,
  onToggleMap,
  showJournalButton,
  journalButtonActive,
  onOpenJournal,
}) {
  if (!showMapButton && !showJournalButton) return null;

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
      {showMapButton ? (
        <button
          className={`map-hud-action ${mapButtonActive ? 'is-active' : ''}`}
          type="button"
          onClick={onToggleMap}
          title={mapButtonActive ? 'Следовать за игроком' : 'Карта'}
        >
          <MapIcon size={15} />
          <span>{mapButtonActive ? 'Игрок' : 'Карта'}</span>
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
  visible = true,
  onOpenSquad,
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
        <LocationBadge location={view.location} />
      </div>

      <div className="map-hud__top-right">
        <FactionSituation factions={view.factions} />
      </div>

      <div className="map-hud__bottom-left">
        <MapHudControls
          showMapButton={showMapButton}
          mapButtonActive={mapButtonActive}
          onToggleMap={onToggleMap}
          showJournalButton={showJournalButton}
          journalButtonActive={journalButtonActive}
          onOpenJournal={onOpenJournal}
        />
        <div className="map-hud__squad-row">
          <SquadStatus
            squadHealth={view.squadHealth}
            onOpenSquad={onOpenSquad}
          />
          <PartyPanel party={view.party} />
        </div>
      </div>
    </div>
  );
}

export default memo(MapHud);
