import sources from '../config/sources.json' with { type: 'json' };
import ui from '../config/ui.json' with { type: 'json' };
import verification from '../config/verification.json' with { type: 'json' };
import en from '../config/locales/en.json' with { type: 'json' };
import zh from '../config/locales/zh-TW.json' with { type: 'json' };

// Executable capabilities are a code boundary, not strings that can load modules.
const adapters = [
  'himalayas',
  'greenhouse',
  'lever',
  'google-jobs',
  'indeed',
  '104',
  'job-frog',
  'we-work-remotely',
];
const fail = () => {
  throw Error('Invalid application configuration');
};
const object = (v) => v && typeof v === 'object' && !Array.isArray(v);
function fields(v, names) {
  if (!object(v) || Object.keys(v).some((k) => !names.includes(k)) || names.some((k) => !(k in v)))
    fail();
}
function text(v, max = 500) {
  if (typeof v !== 'string' || !v.trim() || v.length > max) fail();
}
function unique(rows) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 100) fail();
  const ids = rows.map((r) => r?.id);
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id) => typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(id))
  )
    fail();
}
function enumRows(rows, ids, extra = []) {
  unique(rows);
  if (rows.length !== ids.length || rows.some((r) => !ids.includes(r.id))) fail();
  for (const r of rows) {
    fields(r, ['id', 'label', ...extra]);
    text(r.label);
    for (const k of extra) text(r[k]);
  }
}
export function validateConfiguration(c) {
  fields(c, ['sources', 'ui', 'verification', 'messages']);
  fields(c.sources, ['version', 'sources', 'feeds']);
  if (c.sources.version !== 1) fail();
  unique(c.sources.sources);
  unique(c.sources.feeds);
  for (const f of c.sources.feeds) {
    fields(f, ['id', 'required', 'options']);
    if (!adapters.includes(f.id) || !Array.isArray(f.required) || !object(f.options)) fail();
    if (f.required.some((k) => !['board', 'company', 'category'].includes(k))) fail();
    for (const [key, values] of Object.entries(f.options)) {
      if (
        !['category', 'country', 'timezone'].includes(key) ||
        !Array.isArray(values) ||
        !values.length ||
        new Set(values).size !== values.length
      )
        fail();
      values.forEach((v) => text(v));
    }
  }
  for (const s of c.sources.sources) {
    fields(s, ['id', 'label', 'homepage', 'feedTypes', 'route']);
    text(s.label);
    text(s.route, 3000);
    if (s.homepage !== null) {
      let u;
      try {
        u = new URL(s.homepage);
      } catch {
        fail();
      }
      if (u.protocol !== 'https:' || u.username || u.password) fail();
    }
    if (
      !Array.isArray(s.feedTypes) ||
      new Set(s.feedTypes).size !== s.feedTypes.length ||
      s.feedTypes.some((id) => !c.sources.feeds.some((f) => f.id === id))
    )
      fail();
  }
  fields(c.ui, [
    'version',
    'brand',
    'title',
    'defaults',
    'navigation',
    'decisions',
    'sortOptions',
    'fitFilters',
    'tools',
  ]);
  if (c.ui.version !== 1) fail();
  text(c.ui.brand, 60);
  text(c.ui.title, 60);
  enumRows(c.ui.navigation, ['jobs', 'tasks', 'research']);
  enumRows(c.ui.decisions, ['review', 'shortlisted', 'applied', 'passed']);
  enumRows(c.ui.sortOptions, ['recent', 'score', 'company'], ['description', 'direction']);
  if (c.ui.sortOptions.some((s) => !['asc', 'desc'].includes(s.direction))) fail();
  enumRows(
    c.ui.tools,
    ['paste-jd', 'import-research', 'collect', 'profile-toggle', 'refresh'],
    ['group'],
  );
  if (c.ui.tools.some((s) => !['research', 'workspace'].includes(s.group))) fail();
  fields(c.ui.defaults, ['pageSize', 'sort', 'minimumFit', 'decision']);
  const d = c.ui.defaults;
  if (
    !Number.isInteger(d.pageSize) ||
    d.pageSize < 1 ||
    d.pageSize > 100 ||
    !c.ui.sortOptions.some((s) => s.id === d.sort) ||
    !c.ui.decisions.some((s) => s.id === d.decision)
  )
    fail();
  if (!Array.isArray(c.ui.fitFilters) || !c.ui.fitFilters.length || c.ui.fitFilters.length > 11)
    fail();
  const values = c.ui.fitFilters.map((f) => f.value);
  if (new Set(values).size !== values.length || !values.includes(d.minimumFit)) fail();
  for (const f of c.ui.fitFilters) {
    fields(f, ['value', 'label']);
    text(f.label);
    if (!Number.isInteger(f.value) || f.value < 0 || f.value > 10) fail();
  }
  fields(c.verification, ['version', 'icons', 'aliases', 'fallback', 'freshness']);
  const v = c.verification;
  if (v.version !== 1 || !object(v.icons) || !object(v.aliases)) fail();
  const svg = (path) => {
    text(path, 1000);
    if (!/^[MmLlHhVvCcSsQqTtAaZz0-9.,+\s-]+$/.test(path)) fail();
  };
  svg(v.fallback);
  for (const [key, icon] of Object.entries(v.icons)) {
    if (!/^[a-z][a-z0-9]*$/.test(key) || !Array.isArray(icon) || icon.length !== 3) fail();
    text(icon[0]);
    text(icon[1]);
    svg(icon[2]);
  }
  for (const [key, target] of Object.entries(v.aliases))
    if (!/^[a-z][a-z0-9]*$/.test(key) || !Object.hasOwn(v.icons, target)) fail();
  fields(v.freshness, ['availabilityDays', 'checkDays']);
  if (Object.values(v.freshness).some((n) => !Number.isInteger(n) || n < 1 || n > 365)) fail();
  fields(c.messages, ['en', 'zh-TW']);
  if (!object(c.messages['zh-TW'])) fail();
  for (const pack of Object.values(c.messages)) {
    if (!object(pack)) fail();
    for (const [key, value] of Object.entries(pack)) {
      text(key, 3000);
      text(value, 3000);
    }
  }
  if (
    Object.keys(c.messages.en || {})
      .sort()
      .join() !== Object.keys(c.messages['zh-TW']).sort().join()
  )
    fail();
  return c;
}
function freeze(v) {
  if (v && typeof v === 'object') {
    Object.values(v).forEach(freeze);
    Object.freeze(v);
  }
  return v;
}
export const configuration = freeze(
  validateConfiguration({ sources, ui, verification, messages: { en, 'zh-TW': zh } }),
);
export const feedDefinition = (id) => configuration.sources.feeds.find((f) => f.id === id);
export const sourceDefinition = (id) => {
  const found = configuration.sources.sources.find((s) => s.id === id);
  return found
    ? { ...found, registered: true }
    : {
        id,
        label: id,
        homepage: null,
        feedTypes: [],
        registered: false,
        route:
          'Custom source. Verify access and record the actual scope; no built-in collector is implied.',
      };
};
export const browserConfiguration = (c) => ({
  sources: c.sources.sources,
  ui: c.ui,
  verification: c.verification,
  messages: c.messages,
});
