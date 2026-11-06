import { settings } from './configuration.mjs';
const { icons, aliases, fallback, freshness } = settings.verification;
export function iconFor(key, locale = 'en') {
  const normalized = String(key).toLowerCase().replace(/[-_]/g, '');
  const kind = aliases[normalized] || normalized,
    icon = icons[kind];
  return {
    kind: icon ? kind : 'custom',
    path: icon?.[2] || fallback,
    custom: !icon,
    label: icon?.[locale === 'zh-TW' ? 1 : 0] || String(key),
  };
}
/** @param {{checks?: Array<{key?: string,label?: string,status:string,source?:string,evidence?:string,checkedAt?:string}>, availability?: {status:string,source?:string,evidence?:string,checkedAt?:string}}} input */
export function verifiedItems({ checks = [], availability }, now = Date.now(), locale = 'en') {
  const facts = [
    ...(availability ? [{ ...availability, key: 'availability' }] : []),
    ...checks.filter((c) => c.key !== 'availability'),
  ];
  return facts.flatMap((fact) => {
    const age = now - Date.parse(fact.checkedAt),
      opening = fact.key === 'availability';
    let webSource = false;
    try {
      webSource = ['https:', 'http:'].includes(new URL(fact.source).protocol);
    } catch {}
    if (
      fact.status !== (opening ? 'open' : 'confirmed') ||
      !webSource ||
      typeof fact.evidence !== 'string' ||
      !fact.evidence.trim() ||
      !Number.isFinite(age) ||
      age < 0 ||
      age > (opening ? freshness.availabilityDays : freshness.checkDays) * 86400000
    )
      return [];
    const icon = iconFor(fact.key, locale);
    return [{ ...icon, key: fact.key, label: fact.label?.trim() || icon.label, fact }];
  });
}
