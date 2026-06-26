import React, { memo, useEffect, useMemo, useState } from 'react';
import { Shield, Swords, X } from 'lucide-react';

const COL_LABELS = ['Дальний слот', 'Ближний слот'];

function formatHp(char) {
  return `${Math.round(char?.health || 0)}/${Math.round(char?.maxHealth || 0)}`;
}

function getHpPercent(char) {
  return char?.maxHealth > 0 ? Math.max(0, Math.min(100, (char.health / char.maxHealth) * 100)) : 0;
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

function getUpgradeLabel(action) {
  if (action.type === 'echo') return 'Эхо';
  if (action.kind === 'tier') return `Тир ${action.label?.replace(/^Тир\s+/i, '') || ''}`.trim();
  return '+Уровень';
}

function getRowLabel(row) {
  return `Ряд ${Number(row) + 1}`;
}

function getColLabel(col) {
  return COL_LABELS[col] || `Слот ${col + 1}`;
}

function MaskPill({ mask, busy, onAction }) {
  return (
    <button
      className={`squad-mask ${mask.canUse ? 'is-ready' : ''} ${mask.type === 'echo' ? 'is-echo' : ''}`}
      type="button"
      title={mask.name}
      disabled={busy || !mask.canUse || !mask.action}
      onClick={() => onAction(mask.action)}
    >
      <span>{getMaskLabel(mask)}</span>
      <strong>x{mask.quantity || 0}</strong>
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
                const hpPct = getHpPercent(char);

                return (
                  <button
                    key={slot.id}
                    className={`squad-slot ${char ? 'has-char' : 'is-empty'} ${selected ? 'is-selected' : ''}`}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelectSlot(slot)}
                    title={char?.name || 'Пустая позиция'}
                  >
                    <span className="squad-slot__position">{getColLabel(slot.col)}</span>

                    {char ? (
                      <>
                        <span className="squad-slot__portrait">
                          {char.spriteUrl ? <img src={char.spriteUrl} alt="" draggable="false" /> : null}
                          <strong>{char.tierRoman}</strong>
                        </span>

                        <span className="squad-slot__info">
                          <span className="squad-slot__name">{char.name}</span>
                          <span className="squad-slot__meta">
                            Уровень {char.level}{char.sharpness ? ` +${char.sharpness}` : ''}
                          </span>
                          <span className="squad-slot__hp" title={formatHp(char)}>
                            <i style={{ width: `${hpPct}%` }} />
                            <strong>{formatHp(char)}</strong>
                          </span>
                          <span className="squad-slot__mini-stats">
                            <span><Swords size={12} />{formatAttack(char)}</span>
                            <span><Shield size={12} />{char.defence}</span>
                            <span>{char.dodgePercent}%</span>
                          </span>
                        </span>
                      </>
                    ) : (
                      <span className="squad-slot__empty">
                        <strong>+</strong>
                        <span>Пусто</span>
                      </span>
                    )}
                  </button>
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
  const hpPct = char.maxHealth > 0 ? Math.max(0, Math.min(100, (char.health / char.maxHealth) * 100)) : 0;
  const canPlace =
    selectedSlot &&
    (char.position?.row !== selectedSlot.row || char.position?.col !== selectedSlot.col);
  const placeAction = canPlace
    ? `mvChar_${char.id}_${selectedSlot.row}_${selectedSlot.col}_${selectedSlot.charId ? 1 : 0}`
    : null;

  return (
    <article className={`squad-card squad-card--${char.rarity || 'standard'}`}>
      <div className="squad-card__portrait">
        {char.spriteUrl ? <img src={char.spriteUrl} alt="" /> : null}
        <div className="squad-card__tier">{char.tierRoman}</div>
      </div>

      <div className="squad-card__body">
        <div className="squad-card__top">
          <h3>{char.name}</h3>
          <span>⭐ {char.level}{char.sharpness ? ` +${char.sharpness}` : ''}</span>
        </div>

        <div className="squad-card__hp" title={formatHp(char)}>
          <i style={{ width: `${hpPct}%` }} />
          <strong>{formatHp(char)}</strong>
        </div>

        <div className="squad-card__stats">
          <span><Swords size={13} />{formatAttack(char)}</span>
          <span><Shield size={13} />{char.defence}</span>
          <span>{char.dodgePercent}%</span>
        </div>

        <div className="squad-card__masks">
          {char.masks?.normal?.map((mask) => (
            <MaskPill key={mask.id} mask={mask} busy={busy} onAction={onAction} />
          ))}
          {char.masks?.echo ? <MaskPill mask={char.masks.echo} busy={busy} onAction={onAction} /> : null}
        </div>

        <div className="squad-card__actions">
          {char.upgradeActions?.map((action) => (
            <button
              key={action.id}
              className="squad-action squad-action--primary"
              type="button"
              disabled={busy}
              onClick={() => onAction(action.action)}
            >
              {getUpgradeLabel(action)}
            </button>
          ))}
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
          {char.actions?.reserve ? (
            <button
              className="squad-action"
              type="button"
              disabled={busy}
              onClick={() => onAction(char.actions.reserve)}
            >
              Резерв
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function RecruitCard({ recruit, busy, onAction }) {
  return (
    <article className={`squad-recruit squad-recruit--${recruit.rarity || 'standard'}`}>
      {recruit.spriteUrl ? <img src={recruit.spriteUrl} alt="" /> : null}
      <div>
        <h3>{recruit.name}</h3>
        <div className="squad-card__masks">
          {recruit.masks?.map((mask) => (
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
            {(squad.chars || []).map((char) => (
              <SquadCard
                key={char.id}
                char={char}
                selectedSlot={selectedSlot}
                busy={busy}
                onAction={onAction}
              />
            ))}
          </div>

          {squad.recruitable?.length ? (
            <div className="squad-recruits">
              <h3>Новые маски</h3>
              <div className="squad-recruits__grid">
                {squad.recruitable.map((recruit) => (
                  <RecruitCard
                    key={recruit.templateId}
                    recruit={recruit}
                    busy={busy}
                    onAction={onAction}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export default memo(SquadModal);
