// Translate interface literals only; job descriptions and evidence remain verbatim.
import { settings } from './configuration.mjs';
export const locale =
  typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh')
    ? 'zh-TW'
    : 'en';
const zh = settings.messages['zh-TW'];
export const t = (value) => (locale === 'zh-TW' ? zh[value] || value : value);
