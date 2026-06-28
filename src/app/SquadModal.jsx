import React, { memo, useEffect, useMemo, useState } from 'react';
import { Shield, Swords, X } from 'lucide-react';
import { getHealthPercent, getHealthTone } from '../utils/healthTone.js';

const COL_LABELS = ['Дальний слот', 'Ближний слот'];

function formatHp(char) {
  return `${Math.round(char?.health || 0)}/${Math.round(char?.maxHealth || 0)}`;
}

function formatAttack(char) {
  const min = Number(char?.attack?.min) || 0;
  const max = Number(char?.attack?.max) || min;
  return min === max ? `${min}` : `${min}-${max}`;
}

function getMaskLabel(mask) {
  if (mask.type === 'echo') return 'S';
  return mask.tierRoman || mask.tier || '?';
}

function getAutoNormalMask(char) {
  const masks = Array.isArray(char?.masks?.normal) ? char.masks.normal : [];
  return masks.find((mask) => mask?.type !== 'echo' && mask?.canUse && mask?.action) || null;
}

function getRowLabel(row) {
  return `Ряд ${Number(row) + 1}`;
}

function getColLabel(col) {
  return COL_LABELS[col] || `Слот ${col + 1}`;
}

function getCurrentPresetCharIds(squad) {
  const ids = new Set();

  for (const row of squad?.board || []) {
    for (const slot of row?.cols || []) {
      if (slot?.charId) ids.add(String(slot.charId));
    }
  }

  for (const char of squad?.chars || []) {
    if (char?.placed) ids.add(String(char.id));
  }

  return ids;
}

function MaskPill({ mask, busy, onAction }) {
  const canUse = !!mask?.canUse && !!mask?.action;

  return (
    <button
      className={`squad-mask ${canUse ? 'is-ready' : ''} ${mask.type === 'echo' ? 'is-echo' : ''}`}
      type="button"
      title={mask.name}
      disabled={busy || !canUse}
      onClick={(event) => {
        event.stopPropagation();
        onAction(mask.action);
      }}
    >
      <span>{getMaskLabel(mask)}</span>
      <strong>x{mask.quantity || 0}</strong>
    </button>
  );
}

function CharacterMasks({ masks, busy, onAction }) {
  return (
    <div className="squad-card__masks">
      {masks?.normal?.map((mask) => (
        <MaskPill key={mask.id} mask={mask} busy={busy} onAction={onAction} />
      ))}
      {masks?.echo ? <MaskPill mask={masks.echo} busy={busy} onAction={onAction} /> : null}
    </div>
  );
}

function MaskUpgradeArrow() {
  return <span className="squad-card__mask-upgrade" aria-hidden="true" />;
}

function CharacterPortrait({ char, busy, onAction }) {
  const maskUpgrade = getAutoNormalMask(char);
  const canUpgrade = !!maskUpgrade?.action;
  const content = (
    <>
      {char?.spriteUrl ? <img src={char.spriteUrl} alt="" draggable="false" /> : null}
      {canUpgrade ? <MaskUpgradeArrow /> : null}
      <div className="squad-card__tier">{char?.tierRoman}</div>
    </>
  );

  if (!canUpgrade) {
    return <div className="squad-card__portrait">{content}</div>;
  }

  return (
    <button
      className="squad-card__portrait has-mask-upgrade"
      type="button"
      disabled={busy}
      title={`Применить маску: ${maskUpgrade.name}`}
      onClick={(event) => {
        event.stopPropagation();
        onAction(maskUpgrade.action);
      }}
    >
      {content}
    </button>
  );
}

function CurrencyChip({ icon, label, value, tone = 'default' }) {
  return (
    <span className={`squad-currency squad-currency--${tone}`}>
      <span className="squad-currency__icon">{icon}</span>
      <span className="squad-currency__text">
        <strong>{value || 0}</strong>
        <small>{label}</small>
      </span>
    </span>
  );
}

function formatConsumableEffect(item) {
  const parts = [];
  const heal = Math.round(Number(item?.heal) || 0);
  const statuses = Array.isArray(item?.statuses) ? item.statuses : [];

  if (heal > 0) parts.push(`+${heal} HP`);
  if (statuses.length) {
    parts.push(statuses.map((status) => `${status.name} +${status.stacks}`).join(', '));
  }

  return parts.join(' • ') || item?.description || item?.targetLabel || 'Расходник';
}

function ConsumablesPanel({ consumables = [], selectedChar, busy, onAction }) {
  const selectedName = selectedChar?.name || 'Выберите персонажа';

  return (
    <aside className="squad-menu__side-panel squad-consumables-panel" aria-label="Расходники">
      <div className="squad-menu__panel-title">
        <span>Расходники</span>
        <strong>{selectedName}</strong>
      </div>

      {consumables.length ? (
        <div className="squad-consumables" role="list">
          {consumables.map((item) => {
            const action = selectedChar?.id && item.actionPrefix ? `${item.actionPrefix}_${selectedChar.id}` : null;
            const disabled = busy || !action;

            return (
              <button
                key={item.id}
                className="squad-consumable"
                type="button"
                role="listitem"
                disabled={disabled}
                onClick={() => action && onAction(action)}
                title={selectedChar ? `Применить: ${item.name}` : 'Сначала выберите персонажа в расстановке'}
              >
                <span className="squad-consumable__icon">{item.emoji || '✦'}</span>
                <span className="squad-consumable__body">
                  <span className="squad-consumable__top">
                    <strong>{item.name}</strong>
                    <em>x{item.quantity || 0}</em>
                  </span>
                  <span className="squad-consumable__effect">{formatConsumableEffect(item)}</span>
                  <span className="squad-consumable__target">{item.targetLabel}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="squad-consumables__empty">Нет доступных расходников</div>
      )}
    </aside>
  );
}

function SquadBoard({ squad, selectedSlot, busy, onSelectSlot, onAction }) {
  const charsById = useMemo(
    () => new Map((squad?.chars || []).map((char) => [char.id, char])),
    [squad?.chars],
  );
  const selectedChar = selectedSlot?.charId ? charsById.get(selectedSlot.charId) : null;
  const selectedLabel = selectedSlot
    ? `${getRowLabel(selectedSlot.row)} / ${getColLabel(selectedSlot.col)}`
    : 'Выберите слот для постановки персонажа';

  return (
    <section className="squad-menu" aria-label="Отряд и ресурсы">
      <div className="squad-menu__board-panel">
        {/*<div className="squad-menu__panel-title">*/}
        {/*  <span>Расстановка</span>*/}
        {/*  <strong>{selectedLabel}</strong>*/}
        {/*</div>*/}

        <div className="squad-board" aria-label="Расстановка">
          {(squad?.board || []).map((row) => (
            <div className="squad-board__row" key={`row:${row.row}`}>
              {row.cols.map((slot) => {
                const char = slot.charId ? charsById.get(slot.charId) : null;
                const selected = selectedSlot?.row === slot.row && selectedSlot?.col === slot.col;
                const hpPct = getHealthPercent(char);
                const hpTone = getHealthTone(char);
                const reserveAction = char?.actions?.reserve || null;
                const selectSlot = () => onSelectSlot(slot);
                const handleSlotKeyDown = (event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  selectSlot();
                };

                return (
                  <article
                    key={slot.id}
                    className={`squad-card squad-slot ${char ? `squad-card--${char.rarity || 'standard'} has-char` : 'is-empty'} ${selected ? 'is-selected' : ''}`}
                    aria-pressed={selected}
                    tabIndex={0}
                    onClick={selectSlot}
                    onKeyDown={handleSlotKeyDown}
                    title={char?.name || 'Пустая позиция'}
                  >
                    <span className="squad-slot__position">{getColLabel(slot.col)}</span>

                    {char ? (
                      <>
                        <CharacterPortrait char={char} busy={busy} onAction={onAction} />

                        <div className="squad-card__body">
                          <div className="squad-card__top">
                            <h3>{char.name}</h3>
                            <span>⭐ {char.level}{char.sharpness ? ` +${char.sharpness}` : ''}</span>
                          </div>
                          <div className={`squad-card__hp squad-card__hp--${hpTone}`} title={formatHp(char)}>
                            <i style={{ width: `${hpPct}%` }} />
                            <strong>{formatHp(char)}</strong>
                          </div>
                          <div className="squad-card__stats">
                            <span><Swords size={12} />{formatAttack(char)}</span>
                            <span><Shield size={12} />{char.defence}</span>
                            <span>{char.dodgePercent}%</span>
                          </div>
                          <CharacterMasks masks={char.masks} busy={busy} onAction={onAction} />
                          {reserveAction ? (
                            <div className="squad-card__actions">
                              <button
                                className="squad-action"
                                type="button"
                                disabled={busy}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onAction(reserveAction);
                                }}
                              >
                                Резерв
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <span className="squad-slot__empty">
                        <strong>+</strong>
                        <span>Пусто</span>
                      </span>
                    )}
                  </article>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <ConsumablesPanel
        consumables={squad?.consumables || []}
        selectedChar={selectedChar}
        busy={busy}
        onAction={onAction}
      />
    </section>
  );
}

function SquadCard({ char, selectedSlot, busy, onAction }) {
  const hpPct = getHealthPercent(char);
  const hpTone = getHealthTone(char);
  const canPlace =
    selectedSlot &&
    (char.position?.row !== selectedSlot.row || char.position?.col !== selectedSlot.col);
  const placeAction = canPlace
    ? `mvChar_${char.id}_${selectedSlot.row}_${selectedSlot.col}_${selectedSlot.charId ? 1 : 0}`
    : null;
  const reserveAction = char.actions?.reserve || null;
  const hasActions = !!placeAction || !!reserveAction;

  return (
    <article className={`squad-card squad-card--${char.rarity || 'standard'}`}>
      <CharacterPortrait char={char} busy={busy} onAction={onAction} />

      <div className="squad-card__body">
        <div className="squad-card__top">
          <h3>{char.name}</h3>
          <span>⭐ {char.level}{char.sharpness ? ` +${char.sharpness}` : ''}</span>
        </div>

        <div className={`squad-card__hp squad-card__hp--${hpTone}`} title={formatHp(char)}>
          <i style={{ width: `${hpPct}%` }} />
          <strong>{formatHp(char)}</strong>
        </div>

        <div className="squad-card__stats">
          <span><Swords size={13} />{formatAttack(char)}</span>
          <span><Shield size={13} />{char.defence}</span>
          <span>{char.dodgePercent}%</span>
        </div>

        <CharacterMasks masks={char.masks} busy={busy} onAction={onAction} />

        {hasActions ? (
          <div className="squad-card__actions">
            {placeAction ? (
              <button
                className="squad-action"
                type="button"
                disabled={busy}
                onClick={() => onAction(placeAction)}
              >
                Поставить
              </button>
            ) : null}
            {reserveAction ? (
              <button
                className="squad-action"
                type="button"
                disabled={busy}
                onClick={() => onAction(reserveAction)}
              >
                Резерв
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function RecruitCard({ recruit, busy, onAction }) {
  const masks = (recruit.masks || []).filter((mask) => Number(mask.quantity) > 0);
  if (!masks.length) return null;

  return (
    <article className={`squad-card squad-card--recruit squad-card--${recruit.rarity || 'standard'}`}>
      <div className="squad-card__portrait">
        {recruit.spriteUrl ? <img src={recruit.spriteUrl} alt="" /> : null}
      </div>

      <div className="squad-card__body squad-card__body--recruit">
        <div className="squad-card__top">
          <h3>{recruit.name}</h3>
        </div>

        <div className="squad-card__masks">
          {masks.map((mask) => (
            <MaskPill key={mask.id} mask={mask} busy={busy} onAction={onAction} />
          ))}
        </div>
      </div>
    </article>
  );
}

function SquadModal({ squad, visible = false, busy = false, onClose, onAction }) {
  const [selectedSlot, setSelectedSlot] = useState(null);
  const fragments = squad?.masks?.fragments ?? squad?.currencies?.fragments ?? 0;
  const reserveChars = useMemo(() => {
    const currentPresetCharIds = getCurrentPresetCharIds(squad);
    return (squad?.chars || []).filter((char) => !currentPresetCharIds.has(String(char.id)));
  }, [squad]);

  useEffect(() => {
    if (!visible) setSelectedSlot(null);
  }, [visible]);

  if (!visible || !squad?.ok) return null;

  return (
    <div className="squad-layer" role="presentation">
      <button className="squad-backdrop" type="button" aria-label="Закрыть отряд" onClick={onClose} />
      <section className="squad-modal" role="dialog" aria-modal="true" aria-label="Отряд">
        <header className="squad-modal__header">
          <div className="squad-modal__title">
            <h2>Отряд</h2>
          </div>
          <div className="squad-modal__header-actions">
            <div className="squad-currency-bar squad-currency-bar--header" aria-label="Валюты отряда">
              <CurrencyChip icon="✧" label="Осколки масок" value={squad?.masks?.shards || 0} tone="shards" />
              <CurrencyChip icon="🪞" label="Фрагменты" value={fragments} tone="fragments" />
              <CurrencyChip icon="🔰" label="Сила отряда" value={squad?.power || 0} tone="power" />
            </div>

            <div className="squad-presets-block squad-presets-block--header">
              <span>Пресет</span>
              <div className="squad-presets">
                {squad.presets?.slots?.map((slot) => (
                  <button
                    key={slot.slot}
                    className={slot.active ? 'is-active' : ''}
                    type="button"
                    disabled={busy || slot.active}
                    onClick={() => onAction(slot.action)}
                    title={`Переключить пресет отряда ${slot.slot}`}
                  >
                    {slot.slot}
                  </button>
                ))}
              </div>
            </div>

            <button className="squad-close" type="button" onClick={onClose} title="Закрыть">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="squad-modal__summary">
          <SquadBoard
            squad={squad}
            selectedSlot={selectedSlot}
            busy={busy}
            onSelectSlot={setSelectedSlot}
            onAction={onAction}
          />
        </div>

        <div className="squad-modal__content">
          <div className="squad-grid">
            {reserveChars.map((char) => (
              <SquadCard
                key={char.id}
                char={char}
                selectedSlot={selectedSlot}
                busy={busy}
                onAction={onAction}
              />
            ))}

            {(squad.recruitable || []).map((recruit) => (
              <RecruitCard
                key={`mask:${recruit.templateId}`}
                recruit={recruit}
                busy={busy}
                onAction={onAction}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default memo(SquadModal);
