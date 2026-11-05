// Shared verification vocabulary and DOM component. Labels come from the user's checks.
const icons = {
  availability: ['Recruiting', '開缺', 'M8 6V4h8v2M3 7h18v14H3zM3 11h18M8 16l3 3 5-5'],
  remote: [
    'Remote work',
    '遠端資格',
    'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z',
  ],
  ownership: ['Ownership policy', '資本背景', 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6'],
  ai: [
    'AI product work',
    'AI 產品',
    'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4M18 4h4',
  ],
  frontend: [
    'Frontend responsibility',
    '前端職責',
    'M3 4h18v16H3zM3 9h18M8 9v11M6 6.5h.01M9 6.5h.01',
  ],
  backend: [
    'Backend responsibility',
    '後端職責',
    'M3 3h18v7H3zM3 14h18v7H3zM7 6h.01M7 17h.01M12 6h5M12 17h5',
  ],
  fullstack: ['Full-stack responsibility', '全端職責', 'm8 5-6 7 6 7M16 5l6 7-6 7M14 3l-4 18'],
  design: ['Design responsibility', '設計職責', 'm15 3 6 6-12 12H3v-6zM12 6l6 6M3 15l6 6'],
  language: [
    'Working language',
    '工作語言',
    'M3 5h12M9 3v2M6 5c0 7 8 11 8 11M13 5c0 7-9 12-9 12M13 21l4-10 4 10M15 17h4',
  ],
  timezone: ['Working hours', '協作時段', 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l4 2'],
  salary: [
    'Compensation',
    '薪資條件',
    'M3 5h18v14H3zM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM6 12h.01M18 12h.01',
  ],
  employment: ['Employment terms', '聘用形式', 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7'],
};
const aliases = {
  taiwanremote: 'remote',
  remotework: 'remote',
  aiproduct: 'ai',
  aiproductwork: 'ai',
  languagepolicy: 'language',
  workinglanguage: 'language',
  workinghours: 'timezone',
  timezoneoverlap: 'timezone',
  compensation: 'salary',
  employmenttype: 'employment',
  hiring: 'employment',
};
const fallback = 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM8 12l3 3 5-6';
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
      age > (opening ? 7 : 30) * 86400000
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
