import { positiveFresh, currentScore, canonical } from './status.mjs';
const staleResumes = new Set();
let collecting = false;
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
  archive: 'Archive',
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
const button = (label, fn, cls = '') =>
  el('button', { type: 'button', class: cls, onclick: fn }, label);
const link = (label, url) =>
  el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', class: 'button' }, label);
const badge = (label, type = '') => el('span', { class: 'badge ' + type }, label);
const date = (s) =>
  s
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: state.profile?.timezone || 'UTC',
      }).format(new Date(s))
    : 'Unknown';
const archived = (j) =>
  state.reviews[j.id]?.archived ||
  j.availability.status === 'closed' ||
  (j.expiresAt && Date.parse(j.expiresAt) < Date.now()) ||
  j.checks.some((c) => c.status === 'excluded');
const latestResume = (id) =>
  state.resumes.filter((r) => r.jobId === id).sort((a, b) => b.version - a.version)[0];
const sha = async (x) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(canonical(x)))),
    ),
  )
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
function notify(message) {
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
          r.profileHash !== profileDigest ||
          r.capabilityHash !==
            (await sha(r.capabilityIds.map((id) => b.capabilities.find((c) => c.id === id)))) ||
          r.capabilityIds.some(
            (id) => !b.capabilities.some((c) => c.id === id && c.status === 'confirmed'),
          )
        )
          staleResumes.add(r.jobId + ':' + r.version);
      }),
    );
  }
  return b;
}
async function refresh() {
  try {
    state = await api('state');
    render();
  } catch (e) {
    if (!$('.login')) main.replaceChildren(el('div', { class: 'error' }, e.message));
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
    el(
      'div',
      {},
      el('div', { class: 'eyebrow' }, 'YOUR WORKSPACE'),
      el('h1', {}, title),
      el('p', { class: 'muted' }, subtitle),
    ),
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
          try {
            await api('login', { key: input.value });
            input.value = '';
            await refresh();
          } catch (x) {
            notify(x.message);
          }
        },
      },
      el('h1', {}, 'Open your workspace'),
      el(
        'p',
        { class: 'muted' },
        'Use your private workspace access key. It is not saved in browser storage.',
      ),
      el(
        'label',
        {},
        'Access key',
        el('input', {
          id: 'access-key',
          type: 'password',
          required: '',
          autocomplete: 'current-password',
        }),
      ),
      el('button', { type: 'submit', class: 'primary' }, 'Sign in'),
    ),
  );
}
function edit(title, fields, save) {
  $('#editor-title').textContent = title;
  $('#editor-body').replaceChildren(...fields);
  $('#editor-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      if ((await save()) !== false) $('#editor').close();
    } catch (x) {
      notify(x.message);
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
  document
    .querySelectorAll('nav button')
    .forEach((n) => n.classList.toggle('active', n.dataset.page === page));
  if (page === 'jobs') jobs();
  if (page === 'tasks') tasks();
  if (page === 'research') research();
  if (page === 'profile') profile();
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
    placeholder: 'Search roles, companies or skills',
    'aria-label': 'Search opportunities',
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
      'aria-label': 'Sort opportunities',
      onchange: (e) => {
        sort = e.target.value;
        render();
      },
    },
    ...Object.entries({
      recent: 'Newest search, then fit',
      score: 'Highest fit, then search',
      company: 'Company A–Z',
    }).map(([v, t]) => el('option', { value: v }, t)),
  );
  sorter.value = sort;
  const filter = el(
    'select',
    {
      'aria-label': 'Minimum fit',
      onchange: (e) => {
        minimum = Number(e.target.value);
        render();
      },
    },
    ...[
      [0, 'Any fit'],
      [7, 'Fit 7+'],
      [8, 'Fit 8+'],
      [9, 'Fit 9+'],
    ].map(([v, t]) => el('option', { value: v }, t)),
  );
  filter.value = String(minimum);
  main.replaceChildren(
    heading(
      'Opportunities',
      `${rows.length} in this view · ${state.jobs.length} total`,
      button('Paste JD', pasteJD),
      button('Import research', importResearch),
      button('Search now', collect, 'primary'),
    ),
    el(
      'div',
      { class: 'tabs', role: 'group', 'aria-label': 'Application decisions' },
      Object.entries(labels).map(([v, t]) =>
        button(
          t,
          () => {
            tab = v;
            render();
          },
          tab === v ? 'active' : '',
        ),
      ),
    ),
    el('div', { class: 'toolbar' }, search, sorter, filter),
  );
  if (!rows.length) {
    main.append(
      el(
        'div',
        { class: 'empty' },
        el('h2', {}, 'Room for the right opportunity'),
        el(
          'p',
          { class: 'muted' },
          state.profile
            ? 'Paste a JD, import your agent’s research, or configure a source in Profile.'
            : 'Start with your own profile and confirmed experience.',
        ),
        button(
          state.profile ? 'Paste a JD' : 'Set up profile',
          () => (state.profile ? pasteJD() : ((page = 'profile'), render())),
          'primary',
        ),
      ),
    );
    return;
  }
  const table = el(
    'table',
    {},
    el(
      'thead',
      {},
      el(
        'tr',
        {},
        el(
          'th',
          {},
          button('Role / company ↕', () => {
            sort = 'company';
            render();
          }),
        ),
        el(
          'th',
          {},
          button('Fit ↓', () => {
            sort = 'score';
            render();
          }),
        ),
        el('th', {}, 'Work mode'),
        el(
          'th',
          {},
          button('Searched ↓', () => {
            sort = 'recent';
            render();
          }),
        ),
        el('th', {}, 'Next step'),
      ),
    ),
    el(
      'tbody',
      {},
      rows.map((j) => {
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
          {},
          el(
            'td',
            {},
            el('span', { class: 'company' }, j.company),
            button(j.title, () => showJob(j.id), 'job-title'),
            el(
              'div',
              { class: 'meta' },
              j.posting.kind + ': ' + (j.posting.date || 'date unknown'),
            ),
            el(
              'div',
              { class: 'facts' },
              j.checks
                .filter((c) => positiveFresh(c))
                .map((c) =>
                  el(
                    'span',
                    {
                      class: 'fact-icon',
                      title: c.label + ': ' + c.evidence,
                      'aria-label': c.label + ' verified',
                    },
                    '✓',
                  ),
                ),
              archived(j) ? badge('Archived', 'danger') : null,
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
                    el('span', { class: 'score' }, j.assessment.score, el('span', {}, ' / 10 ⓘ')),
                  ),
                  el('p', {}, j.assessment.reason),
                )
              : el('span', { class: 'muted' }, j.assessment?.stale ? 'Reassess' : 'Unrated'),
          ),
          el(
            'td',
            {},
            badge(j.remoteMode),
            el('div', { class: 'meta' }, j.location || 'Location unverified'),
          ),
          el('td', {}, date(j.searchedAt)),
          el(
            'td',
            {},
            el('div', { class: 'row-actions' }, select, link('Source ↗', j.url)),
            (state.submissions || []).some((x) => x.jobId === j.id) || dec === 'applied'
              ? el('div', { class: 'meta' }, 'Application recorded')
              : null,
            el(
              'div',
              { class: 'meta' },
              r
                ? 'Resume v' +
                    r.version +
                    ' · ' +
                    (staleResumes.has(r.jobId + ':' + r.version) ? 'stale' : r.reviewStatus)
                : 'No resume',
            ),
          ),
        );
      }),
    ),
  );
  main.append(el('div', { class: 'table-wrap' }, table));
}
function pasteJD() {
  const title = field('Role title', 'jd-title'),
    company = field('Company', 'jd-company'),
    url = field('Original HTTPS URL', 'jd-url', '', 'url'),
    jd = field('Original job description', 'jd-text', '', 'textarea');
  edit(
    'Paste a job description',
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
    'Import research',
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
function structured(text) {
  const box = el('div', { class: 'jd' });
  let list = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      list = null;
      continue;
    }
    if (/^(?:#{1,6}\s|【.+】$)/.test(line) || (line.length < 80 && /:$/.test(line))) {
      box.append(el('h3', {}, line.replace(/^#{1,6}\s+/, '')));
      list = null;
    } else if (/^(?:[-*•]\s*|\d+[.)]\s+)/.test(line)) {
      if (!list) {
        list = el('ul');
        box.append(list);
      }
      list.append(el('li', {}, line.replace(/^(?:[-*•]\s*|\d+[.)]\s+)/, '')));
    } else {
      box.append(el('p', {}, line));
      list = null;
    }
  }
  return box;
}
async function showJob(id) {
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
  d.replaceChildren(
    el('span', { class: 'company' }, j.company),
    el('h1', { id: 'detail-title' }, j.title),
    el('p', { class: 'muted' }, j.location || 'Location not confirmed'),
    el(
      'div',
      { class: 'actions' },
      link('Original job ↗', j.url),
      button(state.reviews[id]?.archived ? 'Restore manual archive' : 'Archive', () =>
        action({ type: 'archive', jobId: id, archived: !state.reviews[id]?.archived }),
      ),
    ),
    el(
      'div',
      { class: 'detail-section' },
      el('h2', {}, 'Fit & evidence'),
      j.assessment
        ? el(
            'div',
            {},
            j.assessment.stale
              ? el('p', { class: 'muted' }, 'Stale assessment — reassess before using this score.')
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
                  el('h3', {}, 'Learning gaps'),
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
      { class: 'detail-section' },
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
      { class: 'detail-section' },
      el('h2', {}, 'Job description'),
      el(
        'p',
        { class: 'muted' },
        j.descriptionKind + ' text · ' + j.source + ' · captured ' + date(j.descriptionCheckedAt),
      ),
      structured(j.description || 'Description unavailable. Open the original source.'),
    ),
  );
  const taskSection = el('section', { class: 'detail-section' }, el('h2', {}, 'Preparation'));
  taskSection.append(...state.tasks.filter((t) => t.jobId === id).map(todo));
  const input = el('input', {
    placeholder: 'Add a preparation task',
    'aria-label': 'New preparation task',
  });
  taskSection.append(
    el(
      'form',
      {
        class: 'form-inline',
        onsubmit: async (e) => {
          e.preventDefault();
          await action({ type: 'task', jobId: id, text: input.value, done: false });
        },
      },
      input,
      el('button', { type: 'submit' }, 'Add task'),
    ),
  );
  d.append(taskSection);
  const resume = el(
    'section',
    { class: 'detail-section' },
    el('h2', {}, 'Tailored resume'),
    el(
      'div',
      { class: 'actions' },
      button(
        'Generate draft',
        async () => {
          try {
            state = await api('draft', { revision: state.revision, jobId: id });
            await showJob(id);
            render();
          } catch (e) {
            notify(e.message);
          }
        },
        'primary',
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
      el('h3', {}, 'What changed for this role'),
      el(
        'ul',
        {},
        r.adjustments.map((a) => el('li', {}, a)),
      ),
      structured(r.content),
      el(
        'div',
        { class: 'actions' },
        link('Print / save PDF ↗', '/api/resume?job=' + id + '&version=' + r.version),
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
        button('Approve', () =>
          action({ type: 'resumeReview', jobId: id, version: r.version, status: 'approved' }),
        ),
        button('Request changes', () =>
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
        'Drafts use confirmed capabilities only and require your review. No job application is sent.',
      ),
    );
  d.append(resume);
  if (!$('#detail').open) $('#detail').showModal();
}
function todo(t) {
  return el(
    'label',
    { class: 'todo' + (t.done ? ' done' : '') },
    el('input', {
      type: 'checkbox',
      checked: t.done,
      onchange: (e) => action({ type: 'task', id: t.id, jobId: t.jobId, done: e.target.checked }),
    }),
    el('span', {}, t.text),
  );
}
function tasks() {
  const shortlisted = state.jobs.filter((j) => state.reviews[j.id]?.status === 'shortlisted');
  main.replaceChildren(
    heading(
      'Preparation',
      'Decide what to do next. Resume review and application status stay separate.',
      button(
        'Draft all shortlisted',
        async () => {
          let count = 0;
          for (const j of shortlisted) {
            try {
              const before = state.resumes.length;
              state = await api('draft', { revision: state.revision, jobId: j.id });
              if (state.resumes.length > before) count++;
            } catch (e) {
              notify(e.message);
              break;
            }
          }
          render();
          notify(count + ' draft(s) generated. Current pending or approved versions were kept.');
        },
        'primary',
      ),
    ),
  );
  const list = state.jobs.filter(
    (j) => state.tasks.some((t) => t.jobId === j.id) || shortlisted.includes(j),
  );
  main.append(
    el(
      'div',
      { class: 'grid' },
      list.map((j) =>
        el(
          'section',
          { class: 'card' },
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
                : 'No resume'),
          ),
          ...state.tasks.filter((t) => t.jobId === j.id).map(todo),
          button('Open preparation', () => showJob(j.id)),
        ),
      ),
    ),
  );
  if (!list.length)
    main.append(
      el('p', { class: 'empty' }, 'Shortlist an opportunity or add a task from its detail view.'),
    );
}
function research() {
  main.replaceChildren(
    heading(
      'Research log',
      'Counts distinguish screened rows from complete JDs. A partial run is not full platform coverage.',
      button('Search now', collect, 'primary'),
    ),
  );
  for (const run of [...state.runs].reverse()) {
    main.append(
      el(
        'section',
        { class: 'card' },
        el('h2', {}, date(run.finishedAt)),
        el('p', { class: 'muted' }, run.note || run.id),
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
              el('p', { class: 'meta' }, `${c.screened} screened · ${c.fullJd} full JDs`),
              el('p', {}, c.query),
              el('p', { class: 'muted' }, c.note),
            ),
          ),
        ),
      ),
    );
  }
  if (!state.runs.length)
    main.append(el('p', { class: 'empty' }, 'Search attempts and their limits will appear here.'));
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
      'Profile & workspace',
      'Your preferences and confirmed evidence shape the search.',
      button(
        'Edit profile',
        () =>
          jsonEditor('Profile', state.profile || sample, (v) =>
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
              el('p', {}, state.profile.name),
              el('p', {}, state.profile.targetRoles.join(' · ')),
              el('p', { class: 'muted' }, state.profile.location + ' · ' + state.profile.timezone),
              el('p', {}, state.profile.remotePolicy),
              el('p', {}, 'Languages: ' + state.profile.languages.join(', ')),
              el('p', {}, 'Ownership: ' + state.profile.ownershipPolicy),
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
      { class: 'card detail-section' },
      el('h2', {}, 'Capability evidence'),
      el(
        'p',
        { class: 'muted' },
        'Your agent can propose claims from selected Git commits or resume text. Confirm only your own contribution.',
      ),
      button('Add capability', () =>
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
      el('h2', {}, 'Backup & restore'),
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
        'A backup contains private job decisions, evidence and resumes. Keep it outside Git.',
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
$('#refresh').onclick = refresh;
document.querySelectorAll('nav button').forEach(
  (n) =>
    (n.onclick = () => {
      page = n.dataset.page;
      render();
    }),
);
refresh();
