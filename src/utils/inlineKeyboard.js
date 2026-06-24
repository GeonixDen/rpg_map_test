const ENTITY_MAP = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

function isTileGridAction(action) {
  return (
    action === 'showSq' ||
    action.startsWith('move_to:') ||
    action.startsWith('pickup_consumable:') ||
    action.startsWith('noop')
  );
}

export function stripTelegramMarkup(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(nbsp|amp|lt|gt|quot);|&#39;/g, (entity) => ENTITY_MAP[entity] || entity)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function getInlineButtonAction(button) {
  if (!button || typeof button !== 'object') return '';
  return String(button.callback_data || button.callbackData || button.action || button.data || '').trim();
}

export function normalizeInlineKeyboardRows(keyboard) {
  if (!Array.isArray(keyboard)) return [];

  return keyboard
    .map((row, rowIndex) => {
      const buttons = (Array.isArray(row) ? row : [row])
        .filter((button) => button && typeof button === 'object')
        .map((button, buttonIndex) => {
          const action = getInlineButtonAction(button);
          const text = stripTelegramMarkup(button.text);

          return {
            id: `${rowIndex}:${buttonIndex}:${action || text}`,
            text,
            action,
            raw: button,
          };
        })
        .filter((button) => button.text || button.action);

      return {
        id: `row:${rowIndex}:${buttons.map((button) => button.id).join('|')}`,
        buttons,
      };
    })
    .filter((row) => row.buttons.length);
}

export function flattenInlineKeyboard(keyboard) {
  return normalizeInlineKeyboardRows(keyboard).flatMap((row) => row.buttons);
}

export function createMapKeyboardRows(keyboard) {
  const rows = normalizeInlineKeyboardRows(keyboard).filter((row) => {
    if (row.buttons.length >= 5) return false;
    if (row.buttons.length > 2 && row.buttons.every((button) => isTileGridAction(button.action))) return false;
    return true;
  });
  const hasMapControlsRow = rows.some((row) => {
    const actions = new Set(row.buttons.map((button) => button.action));
    return actions.has('showSq') && actions.has('journal');
  });

  return hasMapControlsRow ? rows : [];
}
