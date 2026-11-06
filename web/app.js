import { renderMarkdown as structured } from './markdown.mjs';
import { locale, t } from './i18n.mjs';
import { createVerificationGroup, verificationIcon } from './verification.mjs';
import { researchOutcomes, applicationReadiness } from './outcomes.mjs';
import { positiveFresh, currentScore, canonical } from './status.mjs';
const staleResumes = new Set();
let collecting = false;
let refreshing = false;
let renderedView = null;
let detailTab = 'jd';
let toolsOpen = false,
  filtersOpen = true,
  limit = 20;
let state,
  page = 'jobs',
  tab = 'review',
  query = '',
  sort = 'recent',
  minimum = 0,
  currentJob = null;
const $ = (s) => document.querySelector(s),
  main = $('#main');
const labels = {
  review: 'To Review',
  shortlisted: 'Shortlisted',
  applied: 'Applied',
  passed: 'Passed',
  archive: t('Archive'),
};
function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'class') n.className = v;
    else if (k === 'checked') n.checked = v;
    else if (v !== undefined && v !== null) n.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c !== null && c !== undefined)
      n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return n;
}
// Keep the control's layout and accessible name while a request is in flight.
function busy(control) {
  control.classList.remove('request-complete');
  const disabled = control.disabled;
  control.style.setProperty('--busy-ink', getComputedStyle(control).color);
  control.disabled = true;
  control.setAttribute('aria-busy', 'true');
  const timer = setTimeout(() => control.classList.add('busy-visible'), 180);
  return (success = false) => {
    clearTimeout(timer);
    control.disabled = disabled;
    control.removeAttribute('aria-busy');
    control.classList.remove('busy-visible');
    if (success && control.isConnected) {
      control.classList.add('request-complete');
      setTimeout(() => control.classList.remove('request-complete'), 700);
    }
  };
}
function skeleton(kind, label) {
  const line = (cls = '') => el('span', { class: 'skeleton-line ' + cls });
  const region = el('div', { class: kind + '-skeleton', role: 'status', 'aria-label': label });
  region.append(el('span', { class: 'sr-only' }, label));
  const shapes = el('div', { class: 'skeleton-shapes', 'aria-hidden': 'true' });
  if (kind === 'workspace') {
    shapes.append(line('skeleton-heading'), line('skeleton-toolbar'));
    for (let i = 0; i < 3; i++)
      shapes.append(
        el(
          'div',
          { class: 'skeleton-card' },
          el('div', { class: 'skeleton-top' }, line('skeleton-company'), line('skeleton-score')),
          line('skeleton-title'),
          line('skeleton-title short'),
          line('skeleton-meta'),
        ),
      );
  } else {
    shapes.append(line('skeleton-company'), line('skeleton-heading'));
    for (let i = 0; i < 2; i++)
      shapes.append(
        el(
          'div',
          { class: 'skeleton-paragraph' },
          line('skeleton-title'),
          line(),
          line(),
          line('short'),
        ),
      );
  }
  region.append(shapes);
  return region;
}
const button = (label, fn, cls = '') =>
  el(
    'button',
    {
      type: 'button',
      class: cls,
      onclick: async (event) => {
        const control = event.currentTarget;
        try {
          const result = fn(event);
          if (result?.then) {
            const done = busy(control);
            let saved = false;
            try {
              saved = (await result) === true;
            } finally {
              done(saved);
            }
          }
        } catch (error) {
          notify(error.message);
        }
      },
    },
    label,
  );
function iconButton(label, path, click, cls = '') {
  const b = button(null, click, 'icon-button ' + cls);
  b.setAttribute('aria-label', label);
  b.title = label;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  shape.setAttribute('d', path);
  svg.append(shape);
  b.append(svg);
  return b;
}
const link = (label, url) =>
  el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', class: 'button' }, label);
function sourceLink(url) {
  const a = link(null, url);
  a.classList.add('icon-button', 'source-link');
  a.setAttribute('aria-label', t('Source ↗'));
  a.title = t('Source ↗');
  a.append(verificationIcon('M14 3h7v7M21 3l-11 11M10 5H3v16h16v-7'));
  return a;
}
function timeMark(label, value, path, detail = value) {
  const text = label + ' ' + detail;
  return el(
    'span',
    { class: 'time-mark', 'aria-label': text, title: text },
    verificationIcon(path),
    el('span', {}, value),
  );
}
function historicalScore(job) {
  const control = button(
    String(job.assessment.score),
    async () => {
      await showJob(job.id);
      selectDetailTab('fit');
    },
    'score-status historical-fit score',
  );
  const label = t('Previous fit') + ' ' + job.assessment.score + '/10';
  control.setAttribute('aria-label', label);
  control.title = label;
  return control;
}
function selectDetailTab(key, focus = false) {
  detailTab = key;
  document.querySelectorAll('#detail-tabs [role="tab"]').forEach((n) => {
    const selected = n.dataset.tab === key;
    n.setAttribute('aria-selected', String(selected));
    n.tabIndex = selected ? 0 : -1;
    if (selected && focus) n.focus();
  });
  document.querySelectorAll('#detail-body > [role="tabpanel"]').forEach((n) => {
    n.hidden = n.id !== 'panel-' + key;
  });
  $('#detail-body').scrollTop = 0;
}

function disclosure(label, ...content) {
  return el('details', { class: 'disclosure' }, el('summary', {}, t(label)), ...content);
}
const badge = (label, type = '') =>
  el(
    'span',
    { class: 'badge ' + type },
    t(
      {
        remote: 'Remote',
        hybrid: 'Hybrid',
        onsite: 'Onsite',
        unknown: 'Unknown',
        confirmed: 'Confirmed',
        excluded: 'Excluded',
        open: 'Open',
        closed: 'Closed',
        partial: 'Partial',
        searched: 'Searched',
        blocked: 'Blocked',
        not_run: 'Not run',
        empty: 'Empty',
      }[label] || label,
    ),
  );
const date = (s, compact = false) =>
  s
    ? new Intl.DateTimeFormat(undefined, {
        month: '2-digit',
        day: '2-digit',
        ...(compact ? {} : { hour: '2-digit', minute: '2-digit' }),
        hour12: false,
        timeZone: state.profile?.timezone || 'UTC',
      }).format(new Date(s))
    : t('Unknown');
const archived = (j) =>
  state.reviews[j.id]?.archived ||
  j.availability.status === 'closed' ||
  (j.expiresAt && Date.parse(j.expiresAt) < Date.now()) ||
  j.checks.some((c) => c.status === 'excluded');
const taskFor = (t, id) => t.jobId === id || t.jobIds?.includes(id);
const latestResume = (id) =>
  state.resumes.filter((r) => r.jobId === id).sort((a, b) => b.version - a.version)[0];
const sha = async (x, raw = false) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(raw ? x : JSON.stringify(canonical(x))),
      ),
    ),
  )
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
function notify(message) {
  if ($('#detail').open) {
    $('#detail-notice').textContent = message;
    $('#detail-notice').hidden = false;
    return;
  }
  $('#notice').textContent = message;
  $('#notice').classList.add('visible');
  setTimeout(() => $('#notice').classList.remove('visible'), 6000);
}
async function api(path, data) {
  const r = await fetch('/api/' + path, {
    method: data ? 'POST' : 'GET',
    headers: data ? { 'Content-Type': 'application/json', 'X-Role-Trail': '1' } : {},
    body: data ? JSON.stringify(data) : undefined,
  });
  const b = await r.json();
  if (!r.ok) {
    if (r.status === 401) login();
    throw Error(b.error || 'Request failed');
  }
  if (b.schemaVersion === 1 && Array.isArray(b.resumes) && Array.isArray(b.jobs)) {
    staleResumes.clear();
    const profileDigest = await sha(b.profile);
    await Promise.all(
      b.resumes.map(async (r) => {
        const j = b.jobs.find((j) => j.id === r.jobId);
        if (
          !j ||
          r.jdHash !== (await sha([j.company, j.title, j.description])) ||
          (r.bindingKind !== 'legacy' &&
            (r.profileHash !== profileDigest ||
              r.capabilityHash !==
                (await sha(r.capabilityIds.map((id) => b.capabilities.find((c) => c.id === id)))) ||
              r.capabilityIds.some(
                (id) => !b.capabilities.some((c) => c.id === id && c.status === 'confirmed'),
              )))
        )
          staleResumes.add(r.jobId + ':' + r.version);
      }),
    );
  }
  return b;
}
async function refresh({ checkVersion = false } = {}) {
  if (refreshing) return;
  refreshing = true;
  const initial = !state;
  main.setAttribute('aria-busy', 'true');
  if (initial) {
    main.replaceChildren(skeleton('workspace', t('Loading workspace…')));
    document
      .querySelectorAll('nav button, #tools-toggle, #profile-toggle')
      .forEach((n) => (n.disabled = true));
  }
  try {
    if (checkVersion) {
      const response = await fetch('/', { cache: 'no-store' });
      if (!response.ok) throw Error('Could not refresh workspace.');
      const html = new DOMParser().parseFromString(await response.text(), 'text/html');
      const next = html.querySelector('script[src^="/app.js"]')?.getAttribute('src');
      const current = document.querySelector('script[src^="/app.js"]')?.getAttribute('src');
      if (next && current && next !== current) {
        location.reload();
        return;
      }
    }
    state = await api('state');
    render();
    if (currentJob && $('#detail').open) await showJob(currentJob);
    return true;
  } catch (e) {
    if (!$('.login')) {
      if (initial)
        main.replaceChildren(
          el('div', { class: 'error', role: 'alert' }, e.message),
          button(t('Retry'), () => refresh()),
        );
      else notify(e.message);
    }
    return false;
  } finally {
    refreshing = false;
    main.removeAttribute('aria-busy');
    if (state)
      document
        .querySelectorAll('nav button, #tools-toggle, #profile-toggle')
        .forEach((n) => (n.disabled = false));
  }
}
async function action(a) {
  try {
    state = await api('action', { revision: state.revision, action: a });
    render();
    if (currentJob && $('#detail').open) await showJob(currentJob);
    return true;
  } catch (e) {
    notify(e.message);
    return false;
  }
}
function heading(title, subtitle, ...actions) {
  return el(
    'div',
    { class: 'page-heading' },
    el('div', {}, el('h1', {}, title), subtitle ? el('p', { class: 'muted' }, subtitle) : null),
    el('div', { class: 'actions' }, actions),
  );
}
function login() {
  main.replaceChildren(
    el(
      'form',
      {
        class: 'card login',
        onsubmit: async (e) => {
          e.preventDefault();
          const input = $('#access-key');
          const control = e.currentTarget.querySelector('[type=submit]');
          if (control.disabled) return;
          const done = busy(control);
          try {
            await api('login', { key: input.value });
            input.value = '';
            await refresh();
          } catch (x) {
            notify(x.message);
          } finally {
            done();
          }
        },
      },
      el('h1', {}, t('Open your workspace')),
      el(
        'p',
        { class: 'muted' },
        'Use your private workspace access key. It is not saved in browser storage.',
      ),
      el(
        'label',
        {},
        t('Access key'),
        el('input', {
          id: 'access-key',
          type: 'password',
          required: '',
          autocomplete: 'current-password',
        }),
      ),
      el('button', { type: 'submit', class: 'primary' }, t('Sign in')),
    ),
  );
}
function edit(title, fields, save) {
  $('#editor-title').textContent = title;
  $('#editor-body').replaceChildren(...fields);
  $('#editor-form').onsubmit = async (e) => {
    e.preventDefault();
    const control = e.currentTarget.querySelector('[type=submit]');
    if (control.disabled) return;
    const done = busy(control);
    try {
      if ((await save()) !== false) $('#editor').close();
    } catch (x) {
      notify(x.message);
    } finally {
      done();
    }
  };
  $('#editor').showModal();
}
function jsonEditor(title, value, save) {
  const input = el(
    'textarea',
    { rows: '18', spellcheck: 'false', 'aria-label': title },
    JSON.stringify(value, null, 2),
  );
  edit(
    title,
    [
      el(
        'p',
        { class: 'muted' },
        'Review this structured data before saving. Credentials belong in server environment variables.',
      ),
      input,
    ],
    () => save(JSON.parse(input.value)),
  );
}
function field(label, id, value = '', type = 'text') {
  return el(
    'label',
    {},
    label,
    el(
      type === 'textarea' ? 'textarea' : 'input',
      { id, type: type === 'textarea' ? undefined : type, required: '' },
      type === 'textarea' ? value : null,
    ),
  );
}
function render() {
  if (!state) return;
  const view = page === 'jobs' ? page + ':' + tab : page;
  const changedView = view !== renderedView;
  renderedView = view;
  document
    .querySelectorAll('nav button')
    .forEach((n) => n.classList.toggle('active', n.dataset.page === page));
  if (page === 'jobs') jobs();
  if (page === 'tasks') tasks();
  if (page === 'research') research();
  if (page === 'profile') profile();
  main.getAnimations().forEach((a) => a.cancel());
  if (changedView && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const motion = getComputedStyle(main);
    main.animate([{ opacity: 0.65 }, { opacity: 1 }], {
      duration: parseFloat(motion.getPropertyValue('--motion-enter')),
      easing: motion.getPropertyValue('--motion-ease').trim(),
    });
  }
}
function jobs() {
  const all = state.jobs.filter((j) =>
    tab === 'archive'
      ? archived(j)
      : !archived(j) && (state.reviews[j.id]?.status || 'review') === tab,
  );
  const rows = all
    .filter(
      (j) =>
        (j.company + ' ' + j.title + ' ' + j.description)
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (!minimum || currentScore(j) >= minimum),
    )
    .sort((a, b) =>
      sort === 'score'
        ? currentScore(b) - currentScore(a) || Date.parse(b.searchedAt) - Date.parse(a.searchedAt)
        : sort === 'company'
          ? a.company.localeCompare(b.company)
          : Date.parse(b.searchedAt) - Date.parse(a.searchedAt) ||
            currentScore(b) - currentScore(a),
    );
  const search = el('input', {
    type: 'search',
    placeholder: t('Search roles, companies or skills'),
    'aria-label': t('Search opportunities'),
    value: query,
    oninput: (e) => {
      query = e.target.value;
      const start = e.target.selectionStart;
      render();
      const n = $('input[type=search]');
      n.focus();
      n.setSelectionRange(start, start);
    },
  });
  const sorter = el(
    'select',
    {
      'aria-label': t('Sort opportunities'),
      title:
        sort === 'recent'
          ? t('Newest search, then fit')
          : sort === 'score'
            ? t('Highest fit, then search')
            : t('Company A–Z'),
      onchange: (e) => {
        sort = e.target.value;
        render();
      },
    },
    ...Object.entries({
      recent: t('Newest search'),
      score: t('Highest fit'),
      company: t('Company A–Z'),
    }).map(([v, t]) => el('option', { value: v }, t)),
  );
  sorter.value = sort;
  const filter = el(
    'select',
    {
      'aria-label': t('Minimum fit'),
      onchange: (e) => {
        minimum = Number(e.target.value);
        render();
      },
    },
    ...[
      [0, t('Any fit')],
      [7, t('Fit 7+')],
      [8, t('Fit 8+')],
      [9, t('Fit 9+')],
    ].map(([v, t]) => el('option', { value: v }, t)),
  );
  filter.value = String(minimum);
  main.replaceChildren(
    heading(
      t('Opportunities'),
      null,
      iconButton(
        t('Archive'),
        'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
        () => {
          tab = 'archive';
          render();
        },
        'quiet archive-view',
      ),
    ),
    el(
      'div',
      { class: 'tabs', role: 'group', 'aria-label': t('Application decisions') },
      Object.entries(labels)
        .filter(([v]) => v !== 'archive')
        .map(([v, label]) => {
          const count = state.jobs.filter(
            (j) => !archived(j) && (state.reviews[j.id]?.status || 'review') === v,
          ).length;
          const b = button(
            label,
            () => {
              tab = v;
              limit = 20;
              render();
            },
            tab === v ? 'active' : '',
          );
          b.setAttribute('aria-label', label);
          b.setAttribute('aria-pressed', String(tab === v));
          b.append(el('span', { class: 'tab-count', 'aria-hidden': 'true' }, count));
          return b;
        }),
    ),
    el(
      'div',
      { class: 'search-row' },
      search,
      button(
        t('Filters'),
        () => {
          filtersOpen = !filtersOpen;
          render();
        },
        'filter-toggle',
      ),
    ),
    el('div', { class: 'toolbar', hidden: !filtersOpen ? '' : null }, filter, sorter),
    el(
      'div',
      { class: 'actions workspace-tools', id: 'workspace-tools', hidden: !toolsOpen ? '' : null },
      button(t('Paste JD'), pasteJD),
      button(t('Import research'), importResearch),
      button(t('Search now'), collect),
    ),
  );
  if (!rows.length) {
    main.append(
      el(
        'div',
        { class: 'empty' },
        el('h2', {}, t('Room for the right opportunity')),
        el(
          'p',
          { class: 'muted' },
          state.profile
            ? t('Paste a JD, import your agent’s research, or configure a source in Profile.')
            : t('Start with your own profile and confirmed experience.'),
        ),
        button(
          state.profile ? t('Paste a JD') : t('Set up profile'),
          () => (state.profile ? pasteJD() : ((page = 'profile'), render())),
          'primary',
        ),
      ),
    );
    return;
  }
  const table = el(
    'table',
    { class: 'job-table' },
    el(
      'thead',
      {},
      el(
        'tr',
        {},
        el(
          'th',
          {},
          button(t('Role / company ↕'), () => {
            sort = 'company';
            render();
          }),
        ),
        el(
          'th',
          {},
          button(t('Fit ↓'), () => {
            sort = 'score';
            render();
          }),
        ),
        el('th', {}, t('Work mode')),
        el(
          'th',
          {},
          button(t('Searched ↓'), () => {
            sort = 'recent';
            render();
          }),
        ),
        el('th', {}, t('Next step')),
      ),
    ),
    el(
      'tbody',
      {},
      rows.slice(0, limit).map((j) => {
        const r = latestResume(j.id),
          dec = state.reviews[j.id]?.status || 'review';
        const select = el(
          'select',
          {
            'aria-label': 'Decision for ' + j.title,
            onchange: (e) => action({ type: 'review', jobId: j.id, status: e.target.value }),
          },
          Object.entries(labels)
            .filter(([v]) => v !== 'archive')
            .map(([v, t]) => el('option', { value: v }, t)),
        );
        select.value = dec;
        return el(
          'tr',
          { class: 'job-row' },
          el(
            'td',
            {},
            el('span', { class: 'company' }, j.company),
            button(j.title, () => showJob(j.id), 'job-title'),
            j.posting.date
              ? el('div', { class: 'meta' }, j.posting.kind + ': ' + j.posting.date)
              : null,
            el(
              'div',
              { class: 'job-summary' },
              el(
                'div',
                { class: 'facts' },
                createVerificationGroup(j, {
                  locale,
                  onOpen: async () => {
                    await showJob(j.id);
                    selectDetailTab('fit');
                    const evidence = document.getElementById('verification-evidence');
                    evidence?.scrollIntoView({ block: 'start' });
                    evidence?.focus({ preventScroll: true });
                  },
                }),
                archived(j) ? badge(t('Archived'), 'danger') : null,
              ),
              el(
                'div',
                { class: 'mobile-dates' },
                j.posting.date
                  ? timeMark(t('Opened'), j.posting.date, 'M4 5h16v16H4zM8 3v4M16 3v4M4 10h16')
                  : null,
                timeMark(
                  t('Searched'),
                  date(j.searchedAt, true),
                  'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2',
                  date(j.searchedAt),
                ),
              ),
            ),
          ),
          el(
            'td',
            {},
            currentScore(j)
              ? el(
                  'details',
                  { class: 'score-tip' },
                  el(
                    'summary',
                    { 'aria-label': 'Fit ' + j.assessment.score + '; show assessment' },
                    el('span', { class: 'score' }, j.assessment.score),
                  ),
                  el('p', {}, j.assessment.reason),
                )
              : j.assessment?.stale
                ? historicalScore(j)
                : null,
          ),
          el(
            'td',
            {},
            j.remoteMode !== 'unknown' ? badge(j.remoteMode) : null,
            j.location ? el('div', { class: 'meta' }, j.location) : null,
          ),
          el(
            'td',
            {},
            el(
              'time',
              { datetime: j.searchedAt, title: date(j.searchedAt) },
              date(j.searchedAt, true),
            ),
          ),
          el(
            'td',
            {},
            el(
              'div',
              { class: 'row-actions' },
              select,
              el(
                'div',
                { class: 'row-links' },
                (state.submissions || []).some((x) => x.jobId === j.id) || dec === 'applied'
                  ? iconButton(
                      t('Application recorded'),
                      'M22 2 9 15M22 2l-7 20-6-7-7-6z',
                      async () => {
                        await showJob(j.id);
                        selectDetailTab('preparation');
                        document
                          .getElementById('application-package')
                          .scrollIntoView({ block: 'start' });
                      },
                      'quiet',
                    )
                  : null,
                r
                  ? iconButton(
                      'Resume v' +
                        r.version +
                        ' · ' +
                        (staleResumes.has(r.jobId + ':' + r.version) ? 'stale' : r.reviewStatus),
                      'M6 3h8l4 4v14H6zM14 3v5h5M9 12h6M9 16h6',
                      async () => {
                        await showJob(j.id);
                        selectDetailTab('preparation');
                        document
                          .getElementById('resume-section')
                          .scrollIntoView({ block: 'start' });
                      },
                      'quiet',
                    )
                  : null,
                sourceLink(j.url),
              ),
            ),
          ),
        );
      }),
    ),
  );
  main.append(el('div', { class: 'table-wrap' }, table));
  if (rows.length > limit)
    main.append(
      button(
        t('Show more'),
        () => {
          limit += 20;
          render();
        },
        'load-more',
      ),
    );
}
function pasteJD() {
  const title = field(t('Role title'), 'jd-title'),
    company = field(t('Company'), 'jd-company'),
    url = field(t('Original HTTPS URL'), 'jd-url', '', 'url'),
    jd = field(t('Original job description'), 'jd-text', '', 'textarea');
  edit(
    t('Paste a job description'),
    [
      company,
      title,
      url,
      jd,
      el(
        'p',
        { class: 'muted' },
        'Saving a JD does not prove eligibility. Your agent can assess it against confirmed capabilities and import an evidence-backed score.',
      ),
    ],
    async () => {
      const ok = await action({
        type: 'research',
        run: {
          id: 'manual-' + crypto.randomUUID(),
          kind: 'manual',
          coverage: [
            {
              source: 'manual',
              status: 'partial',
              query: 'User-pasted JD',
              screened: 1,
              fullJd: 1,
              note: 'User-supplied text; not a new external verification.',
            },
          ],
        },
        jobs: [
          {
            company: $('#jd-company').value,
            title: $('#jd-title').value,
            url: $('#jd-url').value,
            source: 'manual',
            description: $('#jd-text').value,
            descriptionKind: 'full',
          },
        ],
      });
      return ok;
    },
  );
}
function importResearch() {
  jsonEditor(
    t('Import research'),
    { run: { id: 'agent-' + crypto.randomUUID(), kind: 'manual', coverage: [] }, jobs: [] },
    (b) => action({ type: 'research', ...b }),
  );
}
async function collect() {
  if (collecting) return;
  collecting = true;
  notify('Searching configured sources…');
  try {
    state = await api('collect', { revision: state.revision });
    render();
    notify('Search recorded. Review source coverage for limitations.');
  } catch (e) {
    notify(e.message);
  } finally {
    collecting = false;
  }
}
async function showJob(id) {
  const previousScroll = currentJob === id && $('#detail').open ? $('#detail-body').scrollTop : 0;
  if (currentJob !== id || !$('#detail').open) detailTab = 'jd';
  currentJob = id;
  const j = state.jobs.find((x) => x.id === id);
  if (!j) return;
  const binding = {
    jdHash: await sha([j.company, j.title, j.description]),
    profileHash: await sha(state.profile),
    capabilityHash: await sha(
      state.capabilities
        .filter((c) => c.status === 'confirmed')
        .map(({ id, claim, tags, evidence, status }) => ({ id, claim, tags, evidence, status })),
    ),
  };
  const d = $('#detail-body');
  $('#detail-notice').hidden = true;
  $('#detail-notice').textContent = '';
  const source = link(t('Original job ↗'), j.url);
  source.classList.add('footer-source');
  $('#detail-footer').replaceChildren(
    source,
    iconButton(
      state.reviews[id]?.archived ? t('Restore manual archive') : t('Archive'),
      state.reviews[id]?.archived
        ? 'M4 10a8 8 0 1 1 1 8M4 4v6h6'
        : 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
      () => action({ type: 'archive', jobId: id, archived: !state.reviews[id]?.archived }),
      'quiet icon-button footer-archive',
    ),
  );
  d.replaceChildren(
    el('span', { class: 'company' }, j.company),
    el('h1', { id: 'detail-title', tabindex: '-1' }, j.title),
    el('p', { class: 'muted' }, j.location || t('Location not confirmed')),
    el(
      'div',
      { class: 'detail-section', id: 'fit-evidence' },
      el('h2', {}, t('Fit & evidence')),
      j.assessment
        ? el(
            'div',
            {},
            j.assessment.stale
              ? el(
                  'p',
                  { class: 'muted' },
                  t('Stale assessment — reassess before using this score.'),
                )
              : null,
            badge((j.assessment.stale ? 'Previous: ' : '') + j.assessment.score + ' / 10'),
            el('p', {}, j.assessment.reason),
            el(
              'ul',
              {},
              j.assessment.evidence.map((e) => el('li', {}, e)),
            ),
            j.assessment.score >= 7
              ? el(
                  'div',
                  {},
                  el('h3', {}, t('Learning gaps')),
                  el(
                    'ul',
                    {},
                    j.assessment.gaps.map((e) => el('li', {}, e)),
                  ),
                )
              : null,
          )
        : el(
            'p',
            { class: 'muted' },
            'Not assessed. Have your agent compare this JD with your confirmed capability evidence.',
          ),
      button('Edit assessment', () =>
        jsonEditor(
          'Evidence-backed assessment',
          {
            ...(j.assessment
              ? Object.fromEntries(Object.entries(j.assessment).filter(([k]) => k !== 'stale'))
              : { score: 7, reason: '', evidence: [], gaps: [] }),
            binding,
            checkedAt: new Date().toISOString(),
          },
          (v) => action({ type: 'assessment', jobId: id, ...v }),
        ),
      ),
    ),
    el(
      'div',
      { class: 'detail-section', id: 'verification-evidence', tabindex: '-1' },
      el('h2', {}, 'Eligibility & availability'),
      badge(
        j.availability.status === 'open' && !positiveFresh(j.availability, 7)
          ? 'stale'
          : j.availability.status,
        j.availability.status === 'closed' ? 'danger' : 'warning',
      ),
      el('p', {}, j.availability.evidence || 'Opening has not been verified.'),
      j.availability.source ? link('Opening evidence ↗', j.availability.source) : null,
      ...j.checks.map((c) =>
        el(
          'div',
          {},
          el(
            'h3',
            {},
            c.label + ' · ' + (c.status === 'confirmed' && !positiveFresh(c) ? 'stale' : c.status),
          ),
          el('p', {}, c.evidence),
          c.source ? link('Evidence ↗', c.source) : null,
        ),
      ),
      !j.checks.length
        ? el('p', { class: 'muted' }, 'No eligibility checks recorded. Unknown is not approval.')
        : null,
    ),
    el(
      'div',
      { class: 'detail-section', id: 'job-description' },
      el('h2', {}, t('Job description')),
      el(
        'p',
        { class: 'muted' },
        j.descriptionKind + ' text · ' + j.source + ' · captured ' + date(j.descriptionCheckedAt),
      ),
      structured(j.description || 'Description unavailable. Open the original source.'),
    ),
  );
  const taskSection = el(
    'section',
    { class: 'detail-section', id: 'task-section' },
    el('h2', {}, t('Tasks')),
  );
  taskSection.append(...state.tasks.filter((t) => taskFor(t, id)).map(todo));
  const input = el('input', {
    placeholder: 'Add a preparation task',
    'aria-label': t('New preparation task'),
  });
  taskSection.append(
    el(
      'form',
      {
        class: 'form-inline',
        onsubmit: async (e) => {
          e.preventDefault();
          const control = e.currentTarget.querySelector('[type=submit]');
          if (control.disabled || !input.value.trim()) return;
          const done = busy(control);
          let saved = false;
          try {
            saved = await action({ type: 'task', jobId: id, text: input.value, done: false });
          } finally {
            done(saved);
          }
        },
      },
      input,
      el('button', { type: 'submit' }, t('Add task')),
    ),
  );
  d.append(taskSection);
  const request = (state.resumeRequests || []).filter((r) => r.jobId === id).at(-1);
  const queued = request?.status === 'queued';
  const requestButton = button(
    t(queued ? 'Queued for agent' : 'Request resume'),
    async () => {
      const ok = await action({ type: 'requestResume', jobId: id });
      if (ok) notify(t('Queued for Codex / Claude.'));
      return ok;
    },
    'primary',
  );
  requestButton.disabled = queued;
  const resume = el(
    'section',
    { class: 'detail-section', id: 'resume-section' },
    el('h2', {}, 'Tailored resume'),
    el('div', { class: 'actions' }, requestButton),
  );
  if (queued)
    resume.append(
      el('p', { class: 'muted' }, t('Waiting for your next agent run.')),
      button(
        t('Cancel request'),
        () => action({ type: 'resumeRequestStatus', id: request.id, status: 'canceled' }),
        'quiet',
      ),
    );
  if (request?.status === 'blocked')
    resume.append(
      el(
        'p',
        { class: 'request-note' },
        el('strong', {}, t('Needs information')),
        el('br'),
        request.note,
      ),
    );
  resume.append(
    disclosure(
      'How resume requests work',
      el(
        'ol',
        {},
        ...[
          'Save a request in this workspace.',
          'Codex / Claude reads it on its next manual or scheduled run.',
          'The agent checks the JD and experience, then saves a draft and adjustment notes.',
          'Review the draft here. Nothing is submitted.',
        ].map((line) => el('li', {}, t(line))),
      ),
      el(
        'p',
        { class: 'muted' },
        t(
          'This button does not start an AI session. An agent must be connected to this workspace.',
        ),
      ),
    ),
  );
  const r = latestResume(id);
  if (r) {
    const stale = staleResumes.has(r.jobId + ':' + r.version);
    resume.append(
      el(
        'p',
        { class: 'meta' },
        'Version ' + r.version + ' · ' + (stale ? 'Source changed — regenerate' : r.reviewStatus),
      ),
      el('h3', {}, t('What changed for this role')),
      el(
        'ul',
        {},
        r.adjustments.map((a) => el('li', {}, a)),
      ),
      structured(r.content),
      el(
        'div',
        { class: 'actions' },
        link(
          r.pdfHash ? t('Open saved PDF ↗') : 'Print / save PDF ↗',
          '/api/resume?job=' + id + '&version=' + r.version + (r.pdfHash ? '&format=pdf' : ''),
        ),
        button('Edit draft', () =>
          jsonEditor(
            'Resume draft',
            {
              content: r.content,
              capabilityIds: r.capabilityIds,
              adjustments: r.adjustments,
              jdHash: r.jdHash,
            },
            (v) => action({ type: 'resume', jobId: id, ...v }),
          ),
        ),
        button(t('Approve'), () =>
          action({ type: 'resumeReview', jobId: id, version: r.version, status: 'approved' }),
        ),
        button(t('Request changes'), () =>
          action({
            type: 'resumeReview',
            jobId: id,
            version: r.version,
            status: 'changes_requested',
          }),
        ),
      ),
    );
  } else
    resume.append(
      el(
        'p',
        { class: 'muted' },
        t('Codex / Claude will tailor this JD to your experience and save a draft for review.'),
      ),
    );
  d.append(resume);
  const preparation = (state.preparations || [])
    .filter((p) => p.jobId === id)
    .sort((a, b) => b.version - a.version)[0];
  const prepSection = el(
    'section',
    { class: 'detail-section', id: 'interview-section' },
    el('h2', {}, t('Interview preparation')),
  );
  let preparationStale = true;
  if (preparation) {
    const stale =
      !r ||
      staleResumes.has(r.jobId + ':' + r.version) ||
      preparation.jdHash !== (await sha([j.company, j.title, j.description])) ||
      preparation.resumeVersion !== r.version ||
      preparation.resumeContentHash !== (await sha(r.content, true)) ||
      (preparation.bindingKind === 'legacy'
        ? preparation.resumePdfHash !== r.pdfHash
        : preparation.capabilityHash !==
          (await sha(
            preparation.capabilityIds.map((id) => state.capabilities.find((c) => c.id === id)),
          )));
    preparationStale = stale;
    prepSection.append(
      el(
        'p',
        { class: 'meta' },
        'Preparation v' + preparation.version + ' · ' + (stale ? 'stale' : 'ready for review'),
      ),
      structured(preparation.content),
      el(
        'details',
        {},
        el('summary', {}, 'Evidence used'),
        ...preparation.evidence.map((c) =>
          el(
            'div',
            {},
            el('p', {}, c.claim),
            el(
              'ul',
              {},
              c.evidence.map((e) => el('li', {}, e)),
            ),
          ),
        ),
      ),
    );
  } else
    prepSection.append(
      el(
        'p',
        { class: 'muted' },
        'Your agent can prepare interview examples and employer questions from this JD and your confirmed experience.',
      ),
    );
  d.append(prepSection);
  const readiness = applicationReadiness({
    resume: {
      exists: !!r,
      pdf: !!r?.pdfHash,
      adjustments: !!r?.adjustments?.length,
      reviewStatus: r?.reviewStatus,
      stale: !!r && staleResumes.has(r.jobId + ':' + r.version),
    },
    preparation: { exists: !!preparation, stale: preparationStale },
    tasks: state.tasks.filter((t) => taskFor(t, id)),
    qualification: qualification(j),
    submitted:
      !!state.submissions?.some((x) => x.jobId === id) || state.reviews[id]?.status === 'applied',
  });
  const names = {
    resume: 'Create a tailored resume',
    resume_stale: 'Regenerate the stale resume',
    pdf: 'Save a PDF artifact for this resume version',
    adjustments: 'Explain the resume adjustments',
    resume_changes: 'Revise the resume',
    preparation: 'Prepare interview examples and employer questions',
    preparation_stale: 'Update interview preparation',
    tasks: 'Complete the preparation tasks',
    review: 'Review and approve the resume',
    qualification: 'Resolve eligibility checks',
  };
  const overview = el(
    'section',
    { class: 'detail-section package-overview', id: 'application-package' },
    el('h2', {}, t('Application package')),
    el(
      'dl',
      { class: 'status-grid' },
      ...[
        ['Materials', readiness.materialsReady ? 'complete' : 'incomplete'],
        ['Resume review', r?.reviewStatus || 'not started'],
        ['Eligibility', qualification(j)],
      ].map(([label, value]) => el('div', {}, el('dt', {}, t(label)), el('dd', {}, t(value)))),
    ),
    el(
      'p',
      { class: 'muted' },
      readiness.submitted ? 'Application reported by you.' : 'No application recorded.',
    ),
  );
  if (readiness.missing.length)
    overview.append(
      el(
        'ul',
        {},
        readiness.missing.map((k) => el('li', {}, names[k])),
      ),
    );
  else overview.append(el('p', {}, 'Ready for your final check and manual application.'));
  if (r)
    overview.append(
      link(
        r.pdfHash ? t('Open saved PDF ↗') : 'Print / save PDF ↗',
        '/api/resume?job=' + id + '&version=' + r.version + (r.pdfHash ? '&format=pdf' : ''),
      ),
      el(
        'p',
        { class: 'muted' },
        r.pdfHash
          ? 'Original PDF saved.'
          : 'Print export is available. Use the agent PDF command to save the original file in this workspace.',
      ),
    );
  const jd = d.querySelector('#job-description');
  const groups = [
    ['jd', 'JD', [jd]],
    [
      'fit',
      'Fit & checks',
      [d.querySelector('#fit-evidence'), d.querySelector('#verification-evidence')],
    ],
    ['preparation', 'Preparation', [overview, resume, prepSection, taskSection]],
  ];
  const tabs = $('#detail-tabs');
  tabs.replaceChildren(
    ...groups.map(([key, label]) => {
      const control = button(t(label), () => selectDetailTab(key), 'quiet');
      control.id = 'tab-' + key;
      control.dataset.tab = key;
      control.setAttribute('role', 'tab');
      control.setAttribute('aria-controls', 'panel-' + key);
      control.onkeydown = (event) => {
        const index = groups.findIndex((g) => g[0] === key);
        const next =
          event.key === 'ArrowRight'
            ? (index + 1) % groups.length
            : event.key === 'ArrowLeft'
              ? (index + groups.length - 1) % groups.length
              : event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? groups.length - 1
                  : -1;
        if (next >= 0) {
          event.preventDefault();
          selectDetailTab(groups[next][0], true);
        }
      };
      return control;
    }),
  );
  for (const [key, , sections] of groups)
    d.append(
      el(
        'div',
        {
          id: 'panel-' + key,
          role: 'tabpanel',
          'aria-labelledby': 'tab-' + key,
          tabindex: '0',
        },
        ...sections,
      ),
    );
  selectDetailTab(detailTab);
  d.scrollTop = previousScroll;
  if (!$('#detail').open) {
    $('#detail').showModal();
    d.scrollTop = 0;
    $('#detail-title').focus({ preventScroll: true });
  }
}
let taskControlId = 0;
function todo(task) {
  const id = 'task-control-' + ++taskControlId;
  return el(
    'div',
    { class: 'todo' + (task.done ? ' done' : '') },
    el('input', {
      id,
      type: 'checkbox',
      checked: task.done,
      onchange: (e) =>
        action({ type: 'task', id: task.id, jobId: task.jobId, done: e.target.checked }),
    }),
    el(
      'div',
      { class: 'todo-content' },
      el('label', { for: id }, task.text),
      task.acceptance || task.dependsOn?.length
        ? disclosure(
            'Task details',
            task.acceptance
              ? el(
                  'small',
                  { class: 'muted' },
                  typeof task.acceptance === 'string'
                    ? task.acceptance
                    : JSON.stringify(task.acceptance),
                )
              : null,
            task.dependsOn?.length
              ? el(
                  'small',
                  { class: 'muted' },
                  t('Depends on') +
                    ': ' +
                    task.dependsOn
                      .map((id) => state.tasks.find((x) => x.id === id)?.text || id)
                      .join(', '),
                )
              : null,
          )
        : null,
    ),
  );
}

function tasks() {
  const shortlisted = state.jobs.filter((j) => state.reviews[j.id]?.status === 'shortlisted');
  main.replaceChildren(
    heading(
      t('Preparation'),
      null,
      button(
        t('Request shortlisted resumes'),
        async () => {
          let count = 0;
          for (const j of shortlisted) {
            try {
              const before = (state.resumeRequests || []).filter(
                (r) => r.status === 'queued',
              ).length;
              state = await api('action', {
                revision: state.revision,
                action: { type: 'requestResume', jobId: j.id },
              });
              if ((state.resumeRequests || []).filter((r) => r.status === 'queued').length > before)
                count++;
            } catch (e) {
              notify(e.message);
              render();
              return;
            }
          }
          render();
          notify(count + ' ' + t('resume request(s) queued for Codex / Claude.'));
        },
        'primary',
      ),
    ),
  );
  const list = state.jobs.filter(
    (j) => state.tasks.some((t) => taskFor(t, j.id)) || shortlisted.includes(j),
  );
  main.append(
    el(
      'div',
      { class: 'grid preparation-grid' },
      list.map((j) =>
        el(
          'section',
          { class: 'card preparation-card' },
          el('span', { class: 'company' }, j.company),
          button(j.title, () => showJob(j.id), 'job-title'),
          el(
            'p',
            { class: 'meta' },
            labels[state.reviews[j.id]?.status || 'review'] +
              ' · ' +
              (latestResume(j.id)
                ? staleResumes.has(j.id + ':' + latestResume(j.id).version)
                  ? 'Resume stale'
                  : 'Resume ' + latestResume(j.id).reviewStatus
                : t('No resume')),
          ),
          ...state.tasks.filter((t) => taskFor(t, j.id)).map(todo),
          button(
            t('Open preparation'),
            async () => {
              await showJob(j.id);
              selectDetailTab('preparation');
            },
            'preparation-open',
          ),
        ),
      ),
    ),
  );
  const general = state.tasks.filter((t) => !t.jobId && !t.jobIds?.length);
  if (general.length)
    main.append(
      el('section', { class: 'card' }, el('h2', {}, 'General preparation'), ...general.map(todo)),
    );
  if (!list.length && !general.length)
    main.append(
      el('p', { class: 'empty' }, 'Shortlist an opportunity or add a task from its detail view.'),
    );
}

function qualification(j) {
  if (
    j.availability.status === 'closed' ||
    (j.expiresAt && Date.parse(j.expiresAt) < Date.now()) ||
    j.checks.some((c) => c.status === 'excluded')
  )
    return 'excluded';
  const required = state.profile?.requiredChecks || [];
  return j.checks.length &&
    required.every((k) => j.checks.some((c) => c.key === k.key)) &&
    j.checks.every((c) => positiveFresh(c) && c.source && c.evidence) &&
    positiveFresh(j.availability, 7) &&
    j.availability.source &&
    j.availability.evidence
    ? 'verified'
    : 'unknown';
}
function outcomeSummary() {
  const q = researchOutcomes({
    jobs: state.jobs.map((j) => ({
      id: j.id,
      url: j.url,
      company: j.company,
      title: j.title,
      firstSeenAt: j.firstSeenAt,
      score: currentScore(j),
      decision: state.reviews[j.id]?.status,
      excluded: qualification(j) === 'excluded',
      verified: qualification(j) === 'verified',
    })),
    history: state.runs.some((r) => Array.isArray(r.observations))
      ? state.runs.map((r) => ({ ...r, jobs: r.observations || [] }))
      : null,
    historyComplete: state.runs.every((r) => Array.isArray(r.observations)),
    timeZone: state.profile?.timezone || 'UTC',
  });
  const box = el(
    'section',
    { class: 'card outcome-summary' },
    el('h2', {}, t('Seven-day outcomes')),
    el('p', { class: 'muted' }, `${q.startDate} – ${q.endDate} · ${q.timeZone}`),
  );
  box.append(
    disclosure(
      'Counting method',
      el(
        'p',
        { class: 'muted' },
        'Newly discovered roles, not newly posted jobs. Counts use current fit and eligibility; imports and repeat observations are excluded.',
      ),
    ),
  );
  if (!q.historyAvailable) {
    box.append(
      el(
        'p',
        {},
        'Historical observations were not saved. Outcomes will be recorded with the next research import.',
      ),
    );
    return box;
  }
  if (!q.historyComplete)
    box.append(
      el(
        'p',
        {},
        'Partial history: earlier runs lack observation snapshots. These counts are a lower bound.',
      ),
    );
  for (const [key, label] of [
    ['newHighFit', 'New high-fit roles'],
    ['qualifying', 'Currently meet all checks'],
    ['kept', 'Currently shortlisted or applied'],
    ['resolvedPositive', 'Checks resolved positively'],
    ['resolvedNegative', 'Checks resolved negatively'],
  ]) {
    const detail = el('details', {}, el('summary', {}, `${label} · ${q[key].length}`));
    for (const item of q[key])
      detail.append(
        button(
          `${item.company} · ${item.title}${item.key ? ' · ' + item.label + ' → ' + item.to : ''}`,
          () => showJob(item.id),
        ),
      );
    if (!q[key].length)
      detail.append(el('p', { class: 'muted' }, 'No supported records in this window.'));
    box.append(detail);
  }
  return box;
}

async function showResearch(run, trigger = document.activeElement) {
  const content = el('div', { class: 'research-reader-body' });
  const footer = el('footer', { class: 'dialog-footer', hidden: true });
  const close = iconButton(
    t('Close research'),
    'm6 6 12 12M6 18 18 6',
    () => dialog.close(),
    'quiet',
  );
  const dialog = el(
    'dialog',
    { class: 'research-reader', 'aria-labelledby': 'research-reader-title' },
    el(
      'header',
      { class: 'dialog-bar' },
      el('h2', { id: 'research-reader-title', tabindex: '-1' }, t('Full research record')),
      close,
    ),
    content,
    footer,
  );
  const controller = new AbortController();
  dialog.addEventListener(
    'close',
    () => {
      controller.abort();
      dialog.remove();
      requestAnimationFrame(() => {
        if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      });
    },
    { once: true },
  );
  document.body.append(dialog);
  dialog.showModal();
  dialog.querySelector('h2').focus({ preventScroll: true });
  const load = async () => {
    footer.hidden = true;
    content.classList.remove('content-arrived');
    content.setAttribute('aria-busy', 'true');
    content.replaceChildren(skeleton('reader', t('Loading research…')));
    try {
      const url = '/api/research?run=' + encodeURIComponent(run.id);
      const response = await fetch(url, { signal: controller.signal });
      const bundle = await response.json();
      if (!response.ok) throw Error(bundle.error || 'Could not load research.');
      if (!bundle.run || !Array.isArray(bundle.run.coverage) || !Array.isArray(bundle.jobs))
        throw Error('Saved research archive is invalid');
      if (!dialog.open) return;
      const archived = bundle.run;
      content.replaceChildren(
        el('p', { class: 'meta' }, date(archived.finishedAt || archived.startedAt)),
      );
      if (archived.note) content.append(structured(archived.note));
      content.append(el('h3', {}, t('Source coverage')));
      const coverage = el('div', { class: 'research-reader-coverage' });
      for (const c of archived.coverage) {
        const counts = c.metrics || c;
        const group = el(
          'section',
          {},
          el('div', { class: 'research-source-heading' }, el('h4', {}, c.source), badge(c.status)),
        );
        if (Number.isFinite(counts.screened) && Number.isFinite(counts.fullJd))
          group.append(
            el(
              'p',
              { class: 'meta' },
              `${t('Screened')}: ${counts.screened} · ${t('Full JDs')}: ${counts.fullJd}`,
            ),
          );
        else if (Number.isFinite(c.inspected))
          group.append(el('p', { class: 'meta' }, `${t('Legacy count')}: ${c.inspected}`));
        if (c.query) group.append(el('p', { class: 'query-text' }, c.query));
        if (c.note) group.append(structured(c.note));
        coverage.append(group);
      }
      content.append(coverage, el('h3', {}, t('Saved jobs')));
      if (!bundle.jobs.length)
        content.append(el('p', { class: 'muted' }, t('No jobs were saved in this run.')));
      for (const j of bundle.jobs) {
        const title = [j.company, j.title].filter(Boolean).join(' · ') || t('Saved job');
        const job = disclosure(title);
        // Stored source content is untrusted: render through the safe Markdown reader.
        if (typeof j.description === 'string' && j.description.trim())
          job.append(structured(j.description));
        else job.append(el('p', { class: 'muted' }, t('No job description was saved.')));
        try {
          const u = new URL(j.url);
          if (u.protocol === 'https:' && !u.username && !u.password)
            job.append(link(t('Original job ↗'), u.href));
        } catch {}
        job.append(disclosure('Stored fields', el('pre', {}, JSON.stringify(j, null, 2))));
        content.append(job);
      }
      content.append(disclosure('Original JSON', el('pre', {}, JSON.stringify(bundle, null, 2))));
      footer.replaceChildren(
        el('a', { href: url + '&download=1', class: 'button', download: '' }, t('Download JSON')),
      );
      footer.hidden = false;
      content.classList.add('content-arrived');
      content.scrollTop = 0;
    } catch (error) {
      if (controller.signal.aborted) return;
      content.replaceChildren(
        el(
          'p',
          { class: 'request-note', role: 'alert' },
          t(error.message === 'Failed to fetch' ? 'Could not load research.' : error.message),
        ),
        button(t('Retry'), load),
      );
    } finally {
      content.removeAttribute('aria-busy');
    }
  };
  await load();
}

function research() {
  main.replaceChildren(
    heading(t('Research log'), null, button(t('Search now'), collect, 'primary')),
  );
  main.append(outcomeSummary());
  for (const run of [...state.runs].reverse()) {
    main.append(
      el(
        'section',
        { class: 'card research-card' },
        el('h2', {}, date(run.finishedAt)),
        run.note
          ? disclosure('Run notes', el('p', { class: 'muted research-note' }, run.note))
          : null,
        run.archiveHash
          ? button(t('View full research'), (event) => showResearch(run, event.currentTarget))
          : null,
        el(
          'div',
          { class: 'coverage' },
          run.coverage.map((c) =>
            el(
              'article',
              {},
              el('h3', {}, c.source),
              badge(
                c.status,
                c.status === 'blocked' ? 'danger' : c.status === 'not_run' ? 'warning' : '',
              ),
              el(
                'p',
                { class: 'meta' },
                c.depthKnown === false
                  ? locale === 'zh-TW'
                    ? `歷史紀錄 ${c.legacyInspected ?? '未知'} 筆；初篩與完整JD數未分開記錄`
                    : `Legacy count: ${c.legacyInspected ?? 'unknown'} · screening/JD depth not recorded`
                  : locale === 'zh-TW'
                    ? `初篩 ${c.screened} 筆 · 完整 JD ${c.fullJd} 筆`
                    : `${c.screened} screened · ${c.fullJd} full JDs`,
              ),
              c.query || c.note
                ? disclosure(
                    'Search details',
                    c.query ? el('p', { class: 'query-text' }, c.query) : null,
                    c.note ? el('p', { class: 'muted' }, c.note) : null,
                  )
                : null,
            ),
          ),
        ),
      ),
    );
  }
  if (!state.runs.length)
    main.append(
      el('p', { class: 'empty' }, t('Search attempts and their limits will appear here.')),
    );
}
function profile() {
  const sample = {
    name: 'Your name',
    targetRoles: ['Your target role'],
    location: 'Your legal work location',
    remotePolicy: 'Your remote requirements',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    languages: ['English'],
    ownershipPolicy: 'None',
    platforms: ['himalayas'],
    portfolio: '',
    feeds: [{ type: 'himalayas', query: 'Your target role' }],
  };
  main.replaceChildren(
    heading(
      t('Profile & workspace'),
      null,
      button(
        t('Edit profile'),
        () =>
          jsonEditor(t('Profile'), state.profile || sample, (v) =>
            action({ type: 'profile', profile: v }),
          ),
        'primary',
      ),
    ),
  );
  main.append(
    el(
      'div',
      { class: 'grid' },
      el(
        'section',
        { class: 'card' },
        el('h2', {}, 'Search profile'),
        state.profile
          ? el(
              'div',
              {},
              el(
                'dl',
                { class: 'profile-fields' },
                ...[
                  ['Name', state.profile.name],
                  ['Target roles', state.profile.targetRoles.join(' · ')],
                  ['Location', state.profile.location],
                  ['Timezone', state.profile.timezone],
                  ['Remote', state.profile.remotePolicy],
                  ['Languages', state.profile.languages.join(', ')],
                  ['Ownership', state.profile.ownershipPolicy],
                ].map(([label, value]) =>
                  el('div', {}, el('dt', {}, t(label)), el('dd', {}, value)),
                ),
              ),
              el(
                'p',
                { class: 'meta' },
                (state.profile.feeds || []).length + ' automatic feeds configured',
              ),
            )
          : el('p', { class: 'muted' }, 'Create your profile to begin.'),
      ),
      el(
        'section',
        { class: 'card' },
        el('h2', {}, 'Daily schedule'),
        el(
          'p',
          {},
          state.schedule
            ? `${state.schedule.status} · ${state.schedule.time} ${state.schedule.timezone}`
            : 'Not configured',
        ),
        el(
          'p',
          { class: 'muted' },
          'A saved time needs a running CLI daemon, host automation, or cloud runner. Saving this form does not install one.',
        ),
        state.schedule
          ? el('p', { class: 'meta' }, 'Last result: ' + (state.schedule.lastResult || 'Not run'))
          : null,
        button('Configure schedule', () =>
          jsonEditor(
            'Daily schedule',
            state.schedule || {
              status: 'paused',
              time: '09:00',
              timezone: state.profile?.timezone || 'UTC',
            },
            (v) => action({ type: 'schedule', schedule: v }),
          ),
        ),
      ),
    ),
  );
  main.append(
    el(
      'section',
      { class: 'card detail-section capability-section' },
      el('h2', {}, t('Capability evidence')),
      disclosure(
        'Evidence guidance',
        el(
          'p',
          { class: 'muted' },
          'Your agent can propose claims from selected Git commits or resume text. Confirm only your own contribution.',
        ),
      ),
      button(t('Add capability'), () =>
        jsonEditor('Capability', { claim: '', tags: [], evidence: [], status: 'proposed' }, (v) =>
          action({ type: 'capability', ...v }),
        ),
      ),
      ...state.capabilities.map((c) =>
        el(
          'article',
          {},
          el('h3', {}, c.claim),
          badge(c.status, c.status === 'confirmed' ? 'success' : 'warning'),
          el('p', { class: 'mono' }, c.evidence.join('\n')),
          button('Review / edit', () =>
            jsonEditor(
              'Capability',
              { id: c.id, claim: c.claim, tags: c.tags, evidence: c.evidence, status: c.status },
              (v) => action({ type: 'capability', ...v }),
            ),
          ),
        ),
      ),
    ),
  );
  const file = el('input', { type: 'file', accept: '.json', 'aria-label': 'Backup file' });
  main.append(
    el(
      'section',
      { class: 'card detail-section' },
      el('h2', {}, t('Backup & restore')),
      el(
        'div',
        { class: 'actions' },
        link('Download backup', '/api/export'),
        button('Sign out', async () => {
          await api('logout', {});
          location.reload();
        }),
      ),
      el(
        'p',
        { class: 'muted' },
        'This JSON export contains private state and artifact references. Use the CLI backup command for original PDFs and full source bundles. Keep both outside Git.',
      ),
      file,
      button('Restore selected backup', async () => {
        if (!file.files[0]) return notify('Select a backup file');
        if (!confirm('Replace this workspace with the selected backup?')) return;
        try {
          state = await api('restore', {
            revision: state.revision,
            state: JSON.parse(await file.files[0].text()),
          });
          render();
          notify('Backup restored');
        } catch (e) {
          notify(e.message);
        }
      }),
    ),
  );
}
$('#close-detail').onclick = () => {
  $('#detail').close();
  currentJob = null;
};
$('#close-editor').onclick = () => $('#editor').close();
document.documentElement.lang = locale;
document.querySelectorAll('[data-i18n]').forEach((n) => {
  n.textContent = t(n.dataset.i18n);
});
document.querySelectorAll('[data-i18n-label]').forEach((n) => {
  n.setAttribute('aria-label', t(n.dataset.i18nLabel));
});
// Preserve content on data refresh; navigate only when the deployed entry version changed.
$('#refresh').onclick = async () => {
  if (refreshing) return;
  const done = busy($('#refresh'));
  try {
    await refresh({ checkVersion: true });
  } finally {
    done();
  }
};
$('#tools-toggle').onclick = () => {
  toolsOpen = !toolsOpen;
  $('#tools-toggle').setAttribute('aria-expanded', String(toolsOpen));
  page = 'jobs';
  render();
};
$('#profile-toggle').onclick = () => {
  page = 'profile';
  render();
};
window.addEventListener('pageshow', (e) => {
  if (e.persisted) location.reload();
});
document.querySelectorAll('nav button').forEach(
  (n) =>
    (n.onclick = () => {
      page = n.dataset.page;
      render();
    }),
);
refresh();
