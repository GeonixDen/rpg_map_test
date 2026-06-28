import React from 'react';

export default function LoadingScreen({ title, message, error = null, overlay = false }) {
  return (
    <div className={`loading-screen ${overlay ? 'loading-screen--overlay' : ''}`} role={error ? 'alert' : 'status'}>
      <div className="loading-screen__content">
        <div className="loading-screen__sigil" aria-hidden="true">
          <span />
        </div>
        <div className="loading-screen__text">
          <strong>{title || (error ? 'Не удалось войти в мир' : 'Добро пожаловать')}</strong>
          <span>{error || message || 'Загружаем Grimhold...'}</span>
        </div>
      </div>
    </div>
  );
}
