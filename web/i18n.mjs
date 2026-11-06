// Only interface literals are translated; JD, evidence and personal content stay verbatim.
import { settings } from './configuration.mjs';
const supported = ['en', 'zh-TW'];
function preferredLanguage() {
  try {
    const saved = localStorage.getItem('role-trail.language');
    if (supported.includes(saved)) return saved;
  } catch {}
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh')
    ? 'zh-TW'
    : 'en';
}
export const locale = preferredLanguage();
export const t = (key, params = {}) => {
  const text = settings.messages[locale]?.[key] || settings.messages.en?.[key] || key;
  return typeof text === 'string'
    ? text.replace(/\{(\w+)\}/g, (match, name) =>
        Object.hasOwn(params, name) ? String(params[name]) : match,
      )
    : text;
};
export function setLocale(next) {
  if (!supported.includes(next)) throw Error('Unsupported interface language');
  localStorage.setItem('role-trail.language', next);
  location.reload();
}
