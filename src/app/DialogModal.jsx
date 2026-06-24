import React, { memo } from 'react';

function DialogModal({ dialog, busy = false, onAction }) {
  if (!dialog) return null;

  return (
    <div className="dialog-layer" role="presentation">
      <div className="dialog-backdrop" aria-hidden="true" />
      <section className="dialog-modal" role="dialog" aria-modal="true" aria-label="Диалог">
        {dialog.image ? (
          <div className="dialog-modal__media">
            <img src={dialog.image} alt="" />
          </div>
        ) : null}

        <div className="dialog-modal__content">
          {dialog.text ? <div className="dialog-modal__text">{dialog.text}</div> : null}

          {dialog.choices.length ? (
            <div className="dialog-modal__choices">
              {dialog.choices.map((choice) => (
                <button
                  key={choice.id}
                  className="dialog-modal__choice"
                  type="button"
                  disabled={busy}
                  onClick={() => onAction(choice.action)}
                >
                  {choice.text}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export default memo(DialogModal);
