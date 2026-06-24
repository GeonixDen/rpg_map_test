import React, { memo, useEffect } from 'react';
import { X } from 'lucide-react';

const DISMISS_MS = 4200;

const ToastItem = memo(function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [onDismiss, toast.id]);

  return (
    <div className={`toast toast--${toast.type}`} role="status">
      <div className="toast__text">{toast.text}</div>
      <button className="toast__close" type="button" onClick={() => onDismiss(toast.id)} title="Закрыть">
        <X size={14} />
      </button>
    </div>
  );
});

function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div className="toast-stack" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export default memo(ToastStack);
