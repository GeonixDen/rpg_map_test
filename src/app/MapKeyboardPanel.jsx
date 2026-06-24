import React, { memo } from 'react';

function MapKeyboardPanel({ rows, busy = false, onAction }) {
  if (!Array.isArray(rows) || !rows.length) return null;

  return (
    <div className="map-keyboard" aria-label="Кнопки карты">
      {rows.map((row) => (
        <div
          key={row.id}
          className="map-keyboard__row"
          style={{ '--columns': Math.max(1, row.buttons.length) }}
        >
          {row.buttons.map((button) => (
            <button
              key={button.id}
              className="map-keyboard__button"
              type="button"
              title={button.text}
              disabled={busy || !button.action}
              onClick={() => onAction(button.action)}
            >
              {button.text}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

export default memo(MapKeyboardPanel);
