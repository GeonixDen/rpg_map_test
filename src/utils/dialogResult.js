import { flattenInlineKeyboard, stripTelegramMarkup } from './inlineKeyboard.js';

export { stripTelegramMarkup };

export function getActionResultUiType(result) {
  return String(result?.uiState?.type || result?.ui?.type || '').trim().toLowerCase();
}

export function isDialogActionResult(result) {
  if (!result || typeof result !== 'object') return false;

  const uiType = getActionResultUiType(result);
  if (uiType) return uiType === 'dialog';

  return flattenInlineKeyboard(result.keyboard).some((button) => button.action.startsWith('dialog:'));
}

export function createDialogModalFromActionResult(result, { fallbackImage = '' } = {}) {
  if (!isDialogActionResult(result)) return null;

  const choices = flattenInlineKeyboard(result.keyboard)
    .filter((button) => button.text && button.action)
    .map((button, index) => ({
      id: `${index}:${button.action}`,
      text: button.text,
      action: button.action,
  }));
  const text = stripTelegramMarkup(result.caption || result.text || result.message);
  const image = typeof result.image === 'string' && result.image ? result.image : fallbackImage;

  if (!text && !image && !choices.length) return null;

  return {
    id: `${Date.now()}:${choices.map((choice) => choice.action).join('|')}`,
    image,
    text,
    choices,
  };
}
