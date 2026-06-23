export function getLoc(lang = 'ru', obj, prop) {
  if (!obj || !prop) return '';

  if (lang && lang !== 'ru') {
    const localizedVal = obj[`${prop}_${lang}`];
    if (localizedVal) return localizedVal;
  }

  return obj[prop] || '';
}
