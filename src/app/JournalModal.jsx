import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Compass, MapPin, X } from 'lucide-react';

const DEFAULT_TABS = Object.freeze([
  { id: 'main', label: 'Задания', count: 0 },
  { id: 'side', label: 'Второстепенные', count: 0 },
]);

function getTargetLabel(entry) {
  const target = entry?.target;
  if (!target?.mapId) return 'Маршрут пока недоступен';
  if (target.hasPosition && Number.isFinite(Number(target.x)) && Number.isFinite(Number(target.y))) {
    return `${target.mapId} · ${target.x}, ${target.y}`;
  }
  return target.mapId;
}

function getDefaultTab(journal) {
  const trackedCategory = journal?.tracked?.category;
  if (trackedCategory) return trackedCategory;
  const firstWithItems = (journal?.tabs || DEFAULT_TABS).find((tab) => Number(tab.count) > 0);
  return firstWithItems?.id || 'main';
}

export default function JournalModal({
  journal,
  visible,
  busy = false,
  onClose,
  onAction,
}) {
  const [activeTab, setActiveTab] = useState('main');

  useEffect(() => {
    if (visible) {
      setActiveTab(getDefaultTab(journal));
    }
  }, [journal?.trackedQuestId, visible]);

  const tabs = useMemo(() => {
    const source = Array.isArray(journal?.tabs) && journal.tabs.length ? journal.tabs : DEFAULT_TABS;
    return source.map((tab) => ({
      id: tab.id,
      label: tab.label || (tab.id === 'side' ? 'Второстепенные' : 'Задания'),
      count: Number(tab.count) || 0,
    }));
  }, [journal?.tabs]);

  const entries = useMemo(() => {
    const source = Array.isArray(journal?.entries) ? journal.entries : [];
    return source.filter((entry) => entry.category === activeTab);
  }, [activeTab, journal?.entries]);

  if (!visible || !journal) return null;

  return (
    <div className="journal-layer" role="dialog" aria-modal="true" aria-label="Журнал">
      <button className="journal-backdrop" type="button" aria-label="Закрыть журнал" onClick={onClose} />

      <section className="journal-modal">
        <header className="journal-modal__header">
          <div className="journal-modal__title">
            <BookOpen size={19} />
            <div>
              <h2>Журнал</h2>
              <p>{journal.tracked?.title ? `Отслеживается: ${journal.tracked.title}` : 'Выберите квест для маршрута'}</p>
            </div>
          </div>

          <button className="journal-close" type="button" aria-label="Закрыть" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="journal-tabs" role="tablist" aria-label="Разделы журнала">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`journal-tabs__button ${activeTab === tab.id ? 'is-active' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.label}</span>
              <b>{tab.count}</b>
            </button>
          ))}
        </div>

        <div className="journal-list">
          {entries.length ? (
            entries.map((entry) => (
              <button
                key={entry.id}
                className={`journal-entry ${entry.tracked ? 'is-tracked' : ''} ${entry.trackable ? '' : 'is-disabled'}`}
                type="button"
                disabled={busy || !entry.trackable || entry.tracked}
                onClick={() => (entry.action ? onAction(entry.action) : null)}
              >
                <span className="journal-entry__mark">
                  {entry.tracked ? <Compass size={18} /> : <MapPin size={17} />}
                </span>
                <span className="journal-entry__body">
                  <span className="journal-entry__head">
                    <strong>{entry.title || entry.id}</strong>
                    <em>{entry.tracked ? 'Ведет' : entry.trackable ? 'Поставить маршрут' : 'Нет маршрута'}</em>
                  </span>
                  <span className="journal-entry__text">{entry.description || journal.emptyText}</span>
                  {/*<span className="journal-entry__target">{getTargetLabel(entry)}</span>*/}
                </span>
              </button>
            ))
          ) : (
            <div className="journal-empty">{journal.emptyText || 'Нет активных заданий.'}</div>
          )}
        </div>
      </section>
    </div>
  );
}
