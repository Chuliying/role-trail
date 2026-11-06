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
export function verificationIcon(path, doc = globalThis.document) {
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const shape = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
  shape.setAttribute('d', path);
  svg.append(shape);
  return svg;
}
export function createVerificationGroup(
  input,
  { locale = 'en', onOpen, document: doc = globalThis.document, now = Date.now() } = {},
) {
  const zh = locale === 'zh-TW',
    group = doc.createElement('div');
  group.className = 'rt-verifications';
  group.setAttribute('aria-label', zh ? '已通過查證的項目' : 'Verified checks');
  const items = verifiedItems(input, now, locale);
  for (const item of items) {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = 'rt-verification';
    b.dataset.verifyKey = item.key;
    b.setAttribute(
      'aria-label',
      item.label + (zh ? '，已確認，查看查核證據' : ', verified; view evidence'),
    );
    b.title = `${item.label}\n${item.fact.evidence}\n${item.fact.source}\n${item.fact.checkedAt}`;
    b.append(verificationIcon(item.path, doc));
    if (item.custom) {
      const text = doc.createElement('span');
      text.textContent = item.label;
      b.append(text);
    }
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      onOpen?.(item);
    });
    group.append(b);
  }
  if (!items.length) {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = 'rt-verification rt-verification-empty';
    b.textContent = zh ? '待查證' : 'Not verified';
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      onOpen?.(null);
    });
    group.append(b);
  }
  return group;
}
