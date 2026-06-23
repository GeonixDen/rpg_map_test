export function formatNumber(value, locale = 'ru-RU') {
  return new Intl.NumberFormat(locale).format(value);
}
