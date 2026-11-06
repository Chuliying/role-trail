import { filterControl } from './filters.mjs';
// Rendering only; effects and current workspace are supplied by the controller.
export function createViewsJobs(context) {
  const displayedScore = (job) =>
    Number.isFinite(job.assessment?.score) ? job.assessment.score : -1;
  function sortHeader(key, label) {
    const active = context.view.sort === key;
    const control = context.button(
      context.t(label),
      () => {
        context.view.sortDirection =
          context.view.sort === key
            ? context.view.sortDirection === 'asc'
              ? 'desc'
              : 'asc'
            : context.ui.sortOptions.find((s) => s.id === key).direction;
        context.view.sort = key;
        context.render();
      },
      'sort-control',
    );
    control.append(
      context.verificationIcon(
        active
          ? context.view.sortDirection === 'asc'
            ? 'm6 15 6-6 6 6'
            : 'm6 9 6 6 6-6'
          : 'm8 9 4-4 4 4M8 15l4 4 4-4',
      ),
    );
    return context.el(
      'th',
      {
        scope: 'col',
        'aria-sort': active
          ? context.view.sortDirection === 'asc'
            ? 'ascending'
            : 'descending'
          : undefined,
      },
      control,
    );
  }
  function jobs() {
    const inBucket = (j, tab) => {
      const decision = context.state.reviews[j.id]?.status || 'review';
      return tab === 'passed'
        ? context.archived(j) || decision === 'passed'
        : !context.archived(j) && decision === tab;
    };
    const all = context.state.jobs.filter((j) => inBucket(j, context.view.tab));
    const rows = all
      .filter(
        (j) =>
          (j.company + ' ' + j.title + ' ' + j.description)
            .toLowerCase()
            .includes(context.view.query.toLowerCase()) &&
          (!context.view.minimum || displayedScore(j) >= context.view.minimum),
      )
      .sort((a, b) => {
        const direction = context.view.sortDirection === 'asc' ? 1 : -1;
        if (context.view.sort === 'score') {
          const x = displayedScore(a),
            y = displayedScore(b);
          if (x < 0 || y < 0)
            return (x < 0) - (y < 0) || Date.parse(b.searchedAt) - Date.parse(a.searchedAt);
          return direction * (x - y) || Date.parse(b.searchedAt) - Date.parse(a.searchedAt);
        }
        return context.view.sort === 'company'
          ? direction * a.company.localeCompare(b.company)
          : direction * (Date.parse(a.searchedAt) - Date.parse(b.searchedAt)) ||
              displayedScore(b) - displayedScore(a);
      });
    context.main.replaceChildren(
      context.heading(context.t('Opportunities'), null, filterControl(context)),
      context.el(
        'div',
        { class: 'tabs', role: 'group', 'aria-label': context.t('Application decisions') },
        Object.entries(context.labels)
          .filter(([v]) => v !== 'archive')
          .map(([v, label]) => {
            const count = context.state.jobs.filter((j) => inBucket(j, v)).length;
            const b = context.button(
              label,
              () => {
                context.view.tab = v;
                context.view.limit = context.ui.defaults.pageSize;
                context.render();
              },
              context.view.tab === v ? 'active' : '',
            );
            b.setAttribute('aria-label', label);
            b.setAttribute('aria-pressed', String(context.view.tab === v));
            b.append(context.el('span', { class: 'tab-count', 'aria-hidden': 'true' }, count));
            return b;
          }),
      ),
    );
    if (!rows.length) {
      context.main.append(
        context.el(
          'div',
          { class: 'empty' },
          context.el('h2', {}, context.t('Room for the right opportunity')),
          context.el(
            'p',
            { class: 'muted' },
            context.state.profile
              ? context.t(
                  'Paste a JD, import your agent’s research, or configure a source in Profile.',
                )
              : context.t('Start with your own profile and confirmed experience.'),
          ),
          context.button(
            context.state.profile ? context.t('Paste a JD') : context.t('Set up profile'),
            () =>
              context.state.profile
                ? context.pasteJD()
                : ((context.view.page = 'profile'), context.render()),
            'primary',
          ),
        ),
      );
      return;
    }
    const table = context.el(
      'table',
      { class: 'job-table' },
      context.el(
        'thead',
        {},
        context.el(
          'tr',
          {},
          sortHeader('company', context.t('Role / company')),
          sortHeader('score', context.t('Fit')),
          context.el('th', {}, context.t('Work mode')),
          sortHeader('recent', context.t('Searched')),
          context.el('th', {}, context.t('Next step')),
        ),
      ),
      context.el(
        'tbody',
        {},
        rows.slice(0, context.view.limit).map((j) => {
          const r = context.latestResume(j.id),
            dec = context.state.reviews[j.id]?.status || 'review';
          const select = context.el(
            'select',
            {
              'aria-label': context.t('Decision for ') + j.title,
              onchange: (e) =>
                context.changeControl(
                  e.target,
                  { type: 'review', jobId: j.id, status: e.target.value },
                  () => {
                    select.value = context.state.reviews[j.id]?.status || 'review';
                  },
                ),
            },
            Object.entries(context.labels)
              .filter(([v]) => v !== 'archive')
              .map(([v, label]) => context.el('option', { value: v }, label)),
          );
          select.value = dec;
          return context.el(
            'tr',
            { class: 'job-row' },
            context.el(
              'td',
              {},
              context.el('span', { class: 'company' }, j.company),
              context.button(j.title, () => context.showJob(j.id), 'job-title'),
              j.posting.date
                ? context.el(
                    'div',
                    { class: 'meta' },
                    context.t(j.posting.kind) + ': ' + j.posting.date,
                  )
                : null,
              context.el(
                'div',
                { class: 'job-summary' },
                context.el(
                  'div',
                  { class: 'facts' },
                  context.createVerificationGroup(j, {
                    locale: context.locale,
                    onOpen: async () => {
                      await context.showJob(j.id);
                      context.selectDetailTab('fit');
                      const evidence = document.getElementById('verification-evidence');
                      evidence?.scrollIntoView({ block: 'start' });
                      evidence?.focus({ preventScroll: true });
                    },
                  }),
                ),
                context.el(
                  'div',
                  { class: 'mobile-dates' },
                  j.posting.date
                    ? context.timeMark(
                        context.t('Opened'),
                        j.posting.date,
                        'M4 5h16v16H4zM8 3v4M16 3v4M4 10h16',
                      )
                    : null,
                  context.timeMark(
                    context.t('Searched'),
                    context.date(j.searchedAt, true),
                    'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2',
                    context.date(j.searchedAt),
                  ),
                ),
              ),
            ),
            context.el('td', {}, context.scorePopover(j)),
            context.el('td', {}, j.remoteMode !== 'unknown' ? context.badge(j.remoteMode) : null),
            context.el(
              'td',
              {},
              context.el(
                'time',
                { datetime: j.searchedAt, title: context.date(j.searchedAt) },
                context.date(j.searchedAt, true),
              ),
            ),
            context.el(
              'td',
              {},
              context.el(
                'div',
                { class: 'row-actions' },
                context.el(
                  'span',
                  { class: 'decision-field' },
                  select,
                  context.el(
                    'span',
                    { class: 'decision-progress', role: 'status' },
                    context.el('span', { class: 'sr-only' }, context.t('Saving…')),
                  ),
                ),
                context.el(
                  'div',
                  { class: 'row-links' },
                  (context.state.submissions || []).some((x) => x.jobId === j.id) ||
                    dec === 'applied'
                    ? context.iconButton(
                        context.t('Application recorded'),
                        'M22 2 9 15M22 2l-7 20-6-7-7-6z',
                        async () => {
                          await context.showJob(j.id);
                          context.selectDetailTab('preparation');
                          document
                            .getElementById('application-package')
                            .scrollIntoView({ block: 'start' });
                        },
                        'quiet',
                      )
                    : null,
                  r
                    ? context.iconButton(
                        context.t('Resume v') +
                          r.version +
                          ' · ' +
                          (context.staleResumes.has(r.jobId + ':' + r.version)
                            ? 'stale'
                            : r.reviewStatus),
                        'M6 3h8l4 4v14H6zM14 3v5h5M9 12h6M9 16h6',
                        async () => {
                          await context.showJob(j.id);
                          context.selectDetailTab('preparation');
                          document
                            .getElementById('resume-section')
                            .scrollIntoView({ block: 'start' });
                        },
                        'quiet',
                      )
                    : null,
                  context.sourceLink(j.url),
                ),
              ),
            ),
          );
        }),
      ),
    );
    context.main.append(context.el('div', { class: 'table-wrap' }, table));
    if (rows.length > context.view.limit)
      context.main.append(
        context.button(
          context.t('Show more'),
          () => {
            context.view.limit += context.ui.defaults.pageSize;
            context.render();
          },
          'load-more',
        ),
      );
  }
  return { displayedScore, sortHeader, jobs };
}
