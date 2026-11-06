import { createScorePopover } from './score-popover.mjs';
import { el, busy, createControls } from './controls.mjs';
import { sha, deriveSnapshot } from './snapshot.mjs';
import { createViewsJobs } from './views-jobs.mjs';
import { createViewsOpportunity } from './views-opportunity.mjs';
import { createViewsPreparation } from './views-preparation.mjs';
import { createViewsResearch } from './views-research.mjs';
import { createViewsProfile } from './views-profile.mjs';
import { createTransport } from './transport.mjs';
import { createNavigation } from './navigation.mjs';
import { createEditor } from './editor.mjs';
import { renderMarkdown as structured } from './markdown.mjs';
import { locale, t, setLocale } from './i18n.mjs';
import { createVerificationGroup, verificationIcon } from './verification.mjs';
import { researchOutcomes, applicationReadiness } from './outcomes.mjs';
import { positiveFresh, currentScore, freshness } from './status.mjs';
import { settings } from './configuration.mjs';
const ui = settings.ui;
const sourceLabel = (id) => settings.sources.find((s) => s.id === id)?.label || id;
let staleResumes = new Set();
let collecting = false;
let refreshing = false;
let renderedView = null;
let detailTab = 'jd';
let filtersOpen = true;
let state,
  currentJob = null;
const $ = (s) => document.querySelector(s),
  main = $('#main');
// The HTML owns the first-paint skeleton; retries clone the same markup.
const workspaceSkeleton = main.querySelector('.workspace-skeleton')?.cloneNode(true);
const labels = {
  ...Object.fromEntries(ui.decisions.map((d) => [d.id, t(d.label)])),
  archive: t('Archive'),
};
const { skeleton, button, iconButton, link, sourceLink, timeMark, disclosure, badge } =
  createControls({ notify, workspaceSkeleton });
const date = (s, compact = false) =>
  s
    ? new Intl.DateTimeFormat(locale, {
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
function notify(message) {
  message = t(message);
  if ($('#editor').open) {
    $('#editor-notice').textContent = message;
    $('#editor-notice').hidden = false;
    return;
  }
  if ($('#detail').open) {
    $('#detail-notice').textContent = message;
    $('#detail-notice').hidden = false;
    return;
  }
  $('#notice').textContent = message;
  $('#notice').classList.add('visible');
  setTimeout(() => $('#notice').classList.remove('visible'), 6000);
}
const api = createTransport({ getState: () => state, onUnauthorized: login });
async function applyState(b) {
  if (state && b.revision < state.revision) return;
  const snapshot = await deriveSnapshot(b);
  // Hashing is asynchronous; a newer write may have completed in the meantime.
  if (state && b.revision < state.revision) return;
  state = snapshot.state;
  staleResumes = snapshot.staleResumes;
}
async function refresh({ checkVersion = false } = {}) {
  if (refreshing) return;
  refreshing = true;
  const initial = !state;
  main.setAttribute('aria-busy', 'true');
  if (initial) {
    if (!main.querySelector('.workspace-skeleton'))
      main.replaceChildren(skeleton('workspace', t('Loading workspace…')));
    document
      .querySelectorAll('nav button, #tools-toggle, #profile-toggle')
      .forEach((n) => (n.disabled = true));
  }
  try {
    if (checkVersion) {
      const response = await fetch('/', { cache: 'no-store' });
      if (!response.ok) throw Error(t('Could not refresh workspace.'));
      const html = new DOMParser().parseFromString(await response.text(), 'text/html');
      const next = html.querySelector('script[src^="/app.js"]')?.getAttribute('src');
      const current = document.querySelector('script[src^="/app.js"]')?.getAttribute('src');
      if (next && current && next !== current) {
        location.reload();
        return;
      }
    }
    await applyState(await api('state'));
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
    await applyState(await api('action', { revision: state.revision, action: a }));
    render();
    if (currentJob && $('#detail').open) await showJob(currentJob);
    return true;
  } catch (e) {
    notify(e.message);
    return false;
  }
}
async function changeControl(control, payload, rollback) {
  control.disabled = true;
  control.setAttribute('aria-busy', 'true');
  const field = control.closest('.decision-field');
  if (field) field.dataset.pending = 'true';
  try {
    if (!(await action(payload))) rollback();
  } finally {
    control.disabled = false;
    control.removeAttribute('aria-busy');
    if (field) delete field.dataset.pending;
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
        t('Use your private workspace access key. It is not saved in browser storage.'),
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
const editor = createEditor({ el, busy, notify, t });
const edit = editor.open;
const navigation = createNavigation(ui, render, editor.leave);
const view = navigation.state;
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
        t(
          'Review this structured data before saving. Credentials belong in server environment variables.',
        ),
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
  navigation.write();
  const viewKey = view.page === 'jobs' ? view.page + ':' + view.tab : view.page;
  const changedView = viewKey !== renderedView;
  renderedView = viewKey;
  document
    .querySelectorAll('nav button')
    .forEach((n) => n.classList.toggle('active', n.dataset.page === view.page));
  if (view.page === 'jobs') jobs();
  if (view.page === 'tasks') tasks();
  if (view.page === 'research') research();
  if (view.page === 'profile') profile();
  main.getAnimations().forEach((a) => a.cancel());
  if (changedView && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const motion = getComputedStyle(main);
    main.animate([{ opacity: 0.65 }, { opacity: 1 }], {
      duration: parseFloat(motion.getPropertyValue('--motion-enter')),
      easing: motion.getPropertyValue('--motion-ease').trim(),
    });
  }
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
        t(
          'Saving a JD does not prove eligibility. Your agent can assess it against confirmed capabilities and import an evidence-backed score.',
        ),
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
  notify(t('Searching configured sources…'));
  try {
    await applyState(await api('collect', { revision: state.revision }));
    render();
    notify(t('Search recorded. Review source coverage for limitations.'));
  } catch (e) {
    notify(e.message);
  } finally {
    collecting = false;
  }
}

const scorePopover = createScorePopover({
  date,
  showJob: (id) => showJob(id),
  selectDetailTab: (key) => selectDetailTab(key),
});
const viewContext = {
  scorePopover,
  get $() {
    return $;
  },
  get action() {
    return action;
  },
  get api() {
    return api;
  },
  get applicationReadiness() {
    return applicationReadiness;
  },
  get applyState() {
    return applyState;
  },
  get archived() {
    return archived;
  },
  get badge() {
    return badge;
  },
  get busy() {
    return busy;
  },
  get button() {
    return button;
  },
  get changeControl() {
    return changeControl;
  },
  get collect() {
    return collect;
  },
  get createVerificationGroup() {
    return createVerificationGroup;
  },
  get currentJob() {
    return currentJob;
  },
  set currentJob(value) {
    currentJob = value;
  },
  get currentScore() {
    return currentScore;
  },
  get date() {
    return date;
  },
  get detailTab() {
    return detailTab;
  },
  set detailTab(value) {
    detailTab = value;
  },
  get disclosure() {
    return disclosure;
  },
  get el() {
    return el;
  },
  get filtersOpen() {
    return filtersOpen;
  },
  set filtersOpen(value) {
    filtersOpen = value;
  },
  get freshness() {
    return freshness;
  },
  get heading() {
    return heading;
  },
  get iconButton() {
    return iconButton;
  },
  get jsonEditor() {
    return jsonEditor;
  },
  get labels() {
    return labels;
  },
  get latestResume() {
    return latestResume;
  },
  get link() {
    return link;
  },
  get locale() {
    return locale;
  },
  get main() {
    return main;
  },
  get notify() {
    return notify;
  },
  get pasteJD() {
    return pasteJD;
  },
  get positiveFresh() {
    return positiveFresh;
  },
  get qualification() {
    return qualification;
  },
  get render() {
    return render;
  },
  get researchOutcomes() {
    return researchOutcomes;
  },
  get selectDetailTab() {
    return selectDetailTab;
  },
  get sha() {
    return sha;
  },
  get showJob() {
    return showJob;
  },
  get skeleton() {
    return skeleton;
  },
  get sourceLabel() {
    return sourceLabel;
  },
  get sourceLink() {
    return sourceLink;
  },
  get staleResumes() {
    return staleResumes;
  },
  get state() {
    return state;
  },
  get structured() {
    return structured;
  },
  get t() {
    return t;
  },
  get taskFor() {
    return taskFor;
  },
  get timeMark() {
    return timeMark;
  },
  get todo() {
    return todo;
  },
  get ui() {
    return ui;
  },
  get verificationIcon() {
    return verificationIcon;
  },
  get view() {
    return view;
  },
};
const { displayedScore, sortHeader, jobs } = createViewsJobs(viewContext);
const { selectDetailTab, showJob, qualification } = createViewsOpportunity(viewContext);
const { todo, tasks } = createViewsPreparation(viewContext);
const { outcomeSummary, showResearch, research } = createViewsResearch(viewContext);
const { profile } = createViewsProfile(viewContext);

$('#close-detail').onclick = () => {
  $('#detail').close();
  currentJob = null;
};
document.documentElement.lang = locale;
document.querySelectorAll('[data-i18n]').forEach((n) => {
  n.textContent = t(n.dataset.i18n);
});
document.querySelectorAll('[data-i18n-label]').forEach((n) => {
  n.setAttribute('aria-label', t(n.dataset.i18nLabel));
});
const menu = $('#workspace-tools'),
  toolsTrigger = $('#tools-toggle');
const toolActions = {
  'paste-jd': pasteJD,
  'import-research': importResearch,
  collect,
  'profile-toggle': () => {
    view.page = 'profile';
    render();
  },
  refresh: async () => {
    if (refreshing) return false;
    const done = busy(toolsTrigger);
    try {
      return await refresh({ checkVersion: true });
    } finally {
      done();
    }
  },
};
menu.replaceChildren(
  ...ui.tools.flatMap((tool, index) => {
    const control = button(
      t(tool.label),
      () => {
        menu.hidePopover();
        return toolActions[tool.id]();
      },
      'tool-item',
    );
    control.id = tool.id;
    control.dataset.group = tool.group;
    return index && ui.tools[index - 1].group !== tool.group
      ? [el('hr', { class: 'menu-separator' }), control]
      : [control];
  }),
);
menu.append(
  el('hr', { class: 'menu-separator' }),
  button(
    locale === 'zh-TW' ? 'English' : '繁體中文',
    () => setLocale(locale === 'zh-TW' ? 'en' : 'zh-TW'),
    'tool-item language-toggle',
  ),
);
toolsTrigger.onclick = () => {
  const rect = toolsTrigger.getBoundingClientRect();
  menu.style.top = Math.max(8, Math.min(rect.bottom + 8, innerHeight - 280)) + 'px';
  menu.style.right = Math.max(16, innerWidth - rect.right) + 'px';
};
menu.addEventListener('toggle', (e) => {
  toolsTrigger.setAttribute('aria-expanded', String(e.newState === 'open'));
  if (e.newState === 'open') menu.querySelector('button').focus({ preventScroll: true });
});
menu.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') toolsTrigger.focus({ preventScroll: true });
});
window.addEventListener('pageshow', (e) => {
  if (e.persisted) location.reload();
});
document.querySelectorAll('nav button').forEach(
  (n) =>
    (n.onclick = () => {
      view.page = n.dataset.page;
      render();
    }),
);
refresh();
