// Rendering only; effects and current workspace are supplied by the controller.
export function createViewsResearch(context) {
  function outcomeSummary() {
    const q = context.researchOutcomes({
      jobs: context.state.jobs.map((j) => ({
        id: j.id,
        url: j.url,
        company: j.company,
        title: j.title,
        firstSeenAt: j.firstSeenAt,
        score: context.currentScore(j),
        decision: context.state.reviews[j.id]?.status,
        excluded: context.qualification(j) === 'excluded',
        verified: context.qualification(j) === 'verified',
      })),
      history: context.state.runs.some((r) => Array.isArray(r.observations))
        ? context.state.runs.map((r) => ({ ...r, jobs: r.observations || [] }))
        : null,
      historyComplete: context.state.runs.every((r) => Array.isArray(r.observations)),
      timeZone: context.state.profile?.timezone || 'UTC',
    });
    const box = context.el(
      'section',
      { class: 'card outcome-summary' },
      context.el('h2', {}, context.t('Seven-day outcomes')),
      context.el('p', { class: 'muted' }, `${q.startDate} – ${q.endDate} · ${q.timeZone}`),
    );
    box.append(
      context.disclosure(
        context.t('Counting method'),
        context.el(
          'p',
          { class: 'muted' },
          context.t(
            'Newly discovered roles, not newly posted jobs. Counts use current fit and eligibility; imports and repeat observations are excluded.',
          ),
        ),
      ),
    );
    if (!q.historyAvailable) {
      box.append(
        context.el(
          'p',
          {},
          context.t(
            'Historical observations were not saved. Outcomes will be recorded with the next research import.',
          ),
        ),
      );
      return box;
    }
    if (!q.historyComplete)
      box.append(
        context.el(
          'p',
          {},
          context.t(
            'Partial history: earlier runs lack observation snapshots. These counts are a lower bound.',
          ),
        ),
      );
    for (const [key, label] of [
      ['newHighFit', context.t('New high-fit roles')],
      ['qualifying', context.t('Currently meet all checks')],
      ['kept', context.t('Currently shortlisted or applied')],
      ['resolvedPositive', context.t('Checks resolved positively')],
      ['resolvedNegative', context.t('Checks resolved negatively')],
    ]) {
      const detail = context.el(
        'details',
        {},
        context.el('summary', {}, `${label} · ${q[key].length}`),
      );
      for (const item of q[key])
        detail.append(
          context.button(
            `${item.company} · ${item.title}${item.key ? ' · ' + item.label + ' → ' + context.t(item.to) : ''}`,
            () => context.showJob(item.id),
          ),
        );
      if (!q[key].length)
        detail.append(
          context.el('p', { class: 'muted' }, context.t('No supported records in this window.')),
        );
      box.append(detail);
    }
    return box;
  }
  async function showResearch(run, trigger = document.activeElement) {
    const content = context.el('div', { class: 'research-reader-body' });
    const footer = context.el('footer', { class: 'dialog-footer', hidden: true });
    const close = context.iconButton(
      context.t('Close research'),
      'm6 6 12 12M6 18 18 6',
      () => dialog.close(),
      'quiet',
    );
    const dialog = context.el(
      'dialog',
      { class: 'research-reader', 'aria-labelledby': 'research-reader-title' },
      context.el(
        'header',
        { class: 'dialog-bar' },
        context.el(
          'h2',
          { id: 'research-reader-title', tabindex: '-1' },
          context.t('Full research record'),
        ),
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
      content.replaceChildren(context.skeleton('reader', context.t('Loading research…')));
      try {
        const url = '/api/research?run=' + encodeURIComponent(run.id);
        const response = await fetch(url, { signal: controller.signal });
        const bundle = await response.json();
        if (!response.ok) throw Error(bundle.error || context.t('Could not load research.'));
        if (!bundle.run || !Array.isArray(bundle.run.coverage) || !Array.isArray(bundle.jobs))
          throw Error(context.t('Saved research archive is invalid'));
        if (!dialog.open) return;
        const archived = bundle.run;
        content.replaceChildren(
          context.el(
            'p',
            { class: 'meta' },
            context.date(archived.finishedAt || archived.startedAt),
          ),
        );
        if (archived.note) content.append(context.structured(archived.note));
        content.append(context.el('h3', {}, context.t('Source coverage')));
        const coverage = context.el('div', { class: 'research-reader-coverage' });
        for (const c of archived.coverage) {
          const counts = c.metrics || c;
          const group = context.el(
            'section',
            {},
            context.el(
              'div',
              { class: 'research-source-heading' },
              context.el('h4', {}, context.sourceLabel(c.source)),
              context.badge(c.status),
            ),
          );
          if (Number.isFinite(counts.screened) && Number.isFinite(counts.fullJd))
            group.append(
              context.el(
                'p',
                { class: 'meta' },
                `${context.t('Screened')}: ${counts.screened} · ${context.t('Full JDs')}: ${counts.fullJd}`,
              ),
            );
          else if (Number.isFinite(c.inspected))
            group.append(
              context.el('p', { class: 'meta' }, `${context.t('Legacy count')}: ${c.inspected}`),
            );
          if (c.query) group.append(context.el('p', { class: 'query-text' }, c.query));
          if (c.note) group.append(context.structured(c.note));
          coverage.append(group);
        }
        content.append(coverage, context.el('h3', {}, context.t('Saved jobs')));
        if (!bundle.jobs.length)
          content.append(
            context.el('p', { class: 'muted' }, context.t('No jobs were saved in this run.')),
          );
        for (const j of bundle.jobs) {
          const title = [j.company, j.title].filter(Boolean).join(' · ') || context.t('Saved job');
          const job = context.disclosure(title);
          // Stored source content is untrusted: render through the safe Markdown reader.
          if (typeof j.description === 'string' && j.description.trim())
            job.append(context.structured(j.description));
          else
            job.append(
              context.el('p', { class: 'muted' }, context.t('No job description was saved.')),
            );
          try {
            const u = new URL(j.url);
            if (u.protocol === 'https:' && !u.username && !u.password)
              job.append(context.link(context.t('Original job ↗'), u.href));
          } catch {}
          job.append(
            context.disclosure(
              context.t('Stored fields'),
              context.el('pre', {}, JSON.stringify(j, null, 2)),
            ),
          );
          content.append(job);
        }
        content.append(
          context.disclosure(
            context.t('Original JSON'),
            context.el('pre', {}, JSON.stringify(bundle, null, 2)),
          ),
        );
        footer.replaceChildren(
          context.el(
            'a',
            { href: url + '&download=1', class: 'button', download: '' },
            context.t('Download JSON'),
          ),
        );
        footer.hidden = false;
        content.classList.add('content-arrived');
        content.scrollTop = 0;
      } catch (error) {
        if (controller.signal.aborted) return;
        content.replaceChildren(
          context.el(
            'p',
            { class: 'request-note', role: 'alert' },
            context.t(
              error.message === 'Failed to fetch'
                ? context.t('Could not load research.')
                : error.message,
            ),
          ),
          context.button(context.t('Retry'), load),
        );
      } finally {
        content.removeAttribute('aria-busy');
      }
    };
    await load();
  }
  function research() {
    context.main.replaceChildren(
      context.heading(
        context.t('Research log'),
        null,
        context.button(context.t('Search now'), context.collect, 'primary'),
      ),
    );
    context.main.append(outcomeSummary());
    for (const run of [...context.state.runs].reverse()) {
      context.main.append(
        context.el(
          'section',
          { class: 'card research-card' },
          context.el('h2', {}, context.date(run.finishedAt)),
          run.note
            ? context.disclosure(
                context.t('Run notes'),
                context.el('p', { class: 'muted research-note' }, run.note),
              )
            : null,
          run.archiveHash
            ? context.button(context.t('View full research'), (event) =>
                showResearch(run, event.currentTarget),
              )
            : null,
          context.el(
            'div',
            { class: 'coverage' },
            run.coverage.map((c) =>
              context.el(
                'article',
                {},
                context.el('h3', {}, context.sourceLabel(c.source)),
                context.badge(
                  c.status,
                  c.status === 'blocked' ? 'danger' : c.status === 'not_run' ? 'warning' : '',
                ),
                context.el(
                  'p',
                  { class: 'meta' },
                  c.depthKnown === false
                    ? context.t('Legacy count: {count} · screening/JD depth not recorded', {
                        count: c.legacyInspected ?? context.t('Unknown'),
                      })
                    : context.t('{screened} screened · {fullJd} full JDs', {
                        screened: c.screened,
                        fullJd: c.fullJd,
                      }),
                ),
                c.query || c.note
                  ? context.disclosure(
                      context.t('Search details'),
                      c.query ? context.el('p', { class: 'query-text' }, c.query) : null,
                      c.note ? context.el('p', { class: 'muted' }, c.note) : null,
                    )
                  : null,
              ),
            ),
          ),
        ),
      );
    }
    if (!context.state.runs.length)
      context.main.append(
        context.el(
          'p',
          { class: 'empty' },
          context.t('Search attempts and their limits will appear here.'),
        ),
      );
  }
  return { outcomeSummary, showResearch, research };
}
