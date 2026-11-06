// Rendering only; effects and current workspace are supplied by the controller.
export function createViewsOpportunity(context) {
  function selectDetailTab(key, focus = false) {
    context.detailTab = key;
    document.querySelectorAll('#detail-tabs [role="tab"]').forEach((n) => {
      const selected = n.dataset.tab === key;
      n.setAttribute('aria-selected', String(selected));
      n.tabIndex = selected ? 0 : -1;
      if (selected && focus) n.focus();
    });
    document.querySelectorAll('#detail-body > [role="tabpanel"]').forEach((n) => {
      n.hidden = n.id !== 'panel-' + key;
    });
    context.$('#detail-body').scrollTop = 0;
  }
  async function showJob(id) {
    const previousScroll =
      context.currentJob === id && context.$('#detail').open
        ? context.$('#detail-body').scrollTop
        : 0;
    if (context.currentJob !== id || !context.$('#detail').open) context.detailTab = 'jd';
    context.currentJob = id;
    const j = context.state.jobs.find((x) => x.id === id);
    if (!j) return;
    const binding = {
      jdHash: await context.sha([j.company, j.title, j.description]),
      profileHash: await context.sha(context.state.profile),
      capabilityHash: await context.sha(
        context.state.capabilities
          .filter((c) => c.status === 'confirmed')
          .map(({ id, claim, tags, evidence, status }) => ({ id, claim, tags, evidence, status })),
      ),
    };
    const d = context.$('#detail-body');
    context.$('#detail-notice').hidden = true;
    context.$('#detail-notice').textContent = '';
    const source = context.link(context.t('Original job ↗'), j.url);
    source.classList.add('footer-source');
    context.$('#detail-footer').replaceChildren(
      source,
      context.iconButton(
        context.state.reviews[id]?.archived
          ? context.t('Restore manual archive')
          : context.t('Archive'),
        context.state.reviews[id]?.archived
          ? 'M4 10a8 8 0 1 1 1 8M4 4v6h6'
          : 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
        () =>
          context.action({
            type: 'archive',
            jobId: id,
            archived: !context.state.reviews[id]?.archived,
          }),
        'quiet icon-button footer-archive',
      ),
    );
    d.replaceChildren(
      context.el('span', { class: 'company' }, j.company),
      context.el('h1', { id: 'detail-title', tabindex: '-1' }, j.title),
      context.el('p', { class: 'muted' }, j.location || context.t('Location not confirmed')),
      context.el(
        'div',
        { class: 'detail-section', id: 'fit-evidence' },
        context.el('h2', {}, context.t('Fit & evidence')),
        j.assessment
          ? context.el(
              'div',
              {},
              j.assessment.stale
                ? context.el(
                    'p',
                    { class: 'muted' },
                    context.t('Stale assessment — reassess before using this score.'),
                  )
                : null,
              context.badge(
                (j.assessment.stale ? context.t('Previous: ') : '') + j.assessment.score + ' / 10',
              ),
              context.el('p', {}, j.assessment.reason),
              context.el(
                'ul',
                {},
                j.assessment.evidence.map((e) => context.el('li', {}, e)),
              ),
              j.assessment.score >= 7
                ? context.el(
                    'div',
                    {},
                    context.el('h3', {}, context.t('Learning gaps')),
                    context.el(
                      'ul',
                      {},
                      j.assessment.gaps.map((e) => context.el('li', {}, e)),
                    ),
                  )
                : null,
            )
          : context.el(
              'p',
              { class: 'muted' },
              context.t(
                'Not assessed. Have your agent compare this JD with your confirmed capability evidence.',
              ),
            ),
        context.button(context.t('Edit assessment'), () =>
          context.jsonEditor(
            context.t('Evidence-backed assessment'),
            {
              ...(j.assessment
                ? Object.fromEntries(Object.entries(j.assessment).filter(([k]) => k !== 'stale'))
                : { score: 7, reason: '', evidence: [], gaps: [] }),
              binding,
              checkedAt: new Date().toISOString(),
            },
            (v) => context.action({ type: 'assessment', jobId: id, ...v }),
          ),
        ),
      ),
      context.el(
        'div',
        { class: 'detail-section', id: 'verification-evidence', tabindex: '-1' },
        context.el('h2', {}, context.t('Eligibility & availability')),
        context.badge(
          j.availability.status === 'open' &&
            !context.positiveFresh(j.availability, context.freshness.availabilityDays)
            ? 'stale'
            : j.availability.status,
          j.availability.status === 'closed' ? 'danger' : 'warning',
        ),
        context.el('p', {}, j.availability.evidence || context.t('Opening has not been verified.')),
        j.availability.source
          ? context.link(context.t('Opening evidence ↗'), j.availability.source)
          : null,
        ...j.checks.map((c) =>
          context.el(
            'div',
            {},
            context.el(
              'h3',
              {},
              context.t(c.label) +
                ' · ' +
                context.t(
                  c.status === 'confirmed' && !context.positiveFresh(c) ? 'stale' : c.status,
                ),
            ),
            context.el('p', {}, c.evidence),
            c.source ? context.link(context.t('Evidence ↗'), c.source) : null,
          ),
        ),
        !j.checks.length
          ? context.el(
              'p',
              { class: 'muted' },
              context.t('No eligibility checks recorded. Unknown is not approval.'),
            )
          : null,
      ),
      context.el(
        'div',
        { class: 'detail-section', id: 'job-description' },
        context.el('h2', {}, context.t('Job description')),
        context.el(
          'p',
          { class: 'muted' },
          context.t(j.descriptionKind + ' text') +
            ' · ' +
            j.source +
            ' · ' +
            context.t('captured') +
            ' ' +
            context.date(j.descriptionCheckedAt),
        ),
        context.structured(
          j.description || context.t('Description unavailable. Open the original source.'),
        ),
      ),
    );
    const taskSection = context.el(
      'section',
      { class: 'detail-section', id: 'task-section' },
      context.el('h2', {}, context.t('Tasks')),
    );
    taskSection.append(
      ...context.state.tasks.filter((task) => context.taskFor(task, id)).map(context.todo),
    );
    const input = context.el('input', {
      placeholder: context.t('Add a preparation task'),
      'aria-label': context.t('New preparation task'),
    });
    taskSection.append(
      context.el(
        'form',
        {
          class: 'form-inline',
          onsubmit: async (e) => {
            e.preventDefault();
            const control = e.currentTarget.querySelector('[type=submit]');
            if (control.disabled || !input.value.trim()) return;
            const done = context.busy(control);
            let saved = false;
            try {
              saved = await context.action({
                type: 'task',
                jobId: id,
                text: input.value,
                done: false,
              });
            } finally {
              done(saved);
            }
          },
        },
        input,
        context.el('button', { type: 'submit' }, context.t('Add task')),
      ),
    );
    d.append(taskSection);
    const request = (context.state.resumeRequests || []).filter((r) => r.jobId === id).at(-1);
    const queued = request?.status === 'queued';
    const requestButton = context.button(
      context.t(queued ? 'Queued for agent' : 'Request resume'),
      async () => {
        const ok = await context.action({ type: 'requestResume', jobId: id });
        if (ok) context.notify(context.t('Queued for Codex / Claude.'));
        return ok;
      },
      'primary',
    );
    requestButton.disabled = queued;
    const resume = context.el(
      'section',
      { class: 'detail-section', id: 'resume-section' },
      context.el('h2', {}, context.t('Tailored resume')),
      context.el('div', { class: 'actions' }, requestButton),
    );
    if (queued)
      resume.append(
        context.el('p', { class: 'muted' }, context.t('Waiting for your next agent run.')),
        context.button(
          context.t('Cancel request'),
          () => context.action({ type: 'resumeRequestStatus', id: request.id, status: 'canceled' }),
          'quiet',
        ),
      );
    if (request?.status === 'blocked')
      resume.append(
        context.el(
          'p',
          { class: 'request-note' },
          context.el('strong', {}, context.t('Needs information')),
          context.el('br'),
          request.note,
        ),
      );
    resume.append(
      context.disclosure(
        context.t('How resume requests work'),
        context.el(
          'ol',
          {},
          ...[
            context.t('Save a request in this workspace.'),
            context.t('Codex / Claude reads it on its next manual or scheduled run.'),
            context.t(
              'The agent checks the JD and experience, then saves a draft and adjustment notes.',
            ),
            context.t('Review the draft here. Nothing is submitted.'),
          ].map((line) => context.el('li', {}, context.t(line))),
        ),
        context.el(
          'p',
          { class: 'muted' },
          context.t(
            'This button does not start an AI session. An agent must be connected to this workspace.',
          ),
        ),
      ),
    );
    const r = context.latestResume(id);
    if (r) {
      const stale = context.staleResumes.has(r.jobId + ':' + r.version);
      resume.append(
        context.el(
          'p',
          { class: 'meta' },
          context.t('Version ') +
            r.version +
            ' · ' +
            (stale ? context.t('Source changed — regenerate') : context.t(r.reviewStatus)),
        ),
        context.el('h3', {}, context.t('What changed for this role')),
        context.el(
          'ul',
          {},
          r.adjustments.map((a) => context.el('li', {}, a)),
        ),
        context.structured(r.content),
        context.el(
          'div',
          { class: 'actions' },
          context.link(
            r.pdfHash ? context.t('Open saved PDF ↗') : context.t('Print / save PDF ↗'),
            '/api/resume?job=' + id + '&version=' + r.version + (r.pdfHash ? '&format=pdf' : ''),
          ),
          context.button(context.t('Edit draft'), () =>
            context.jsonEditor(
              context.t('Resume draft'),
              {
                content: r.content,
                capabilityIds: r.capabilityIds,
                adjustments: r.adjustments,
                jdHash: r.jdHash,
              },
              (v) => context.action({ type: 'resume', jobId: id, ...v }),
            ),
          ),
          context.button(context.t('Approve'), () =>
            context.action({
              type: 'resumeReview',
              jobId: id,
              version: r.version,
              status: 'approved',
            }),
          ),
          context.button(context.t('Request changes'), () =>
            context.action({
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
        context.el(
          'p',
          { class: 'muted' },
          context.t(
            'Codex / Claude will tailor this JD to your experience and save a draft for review.',
          ),
        ),
      );
    d.append(resume);
    const preparation = (context.state.preparations || [])
      .filter((p) => p.jobId === id)
      .sort((a, b) => b.version - a.version)[0];
    const prepSection = context.el(
      'section',
      { class: 'detail-section', id: 'interview-section' },
      context.el('h2', {}, context.t('Interview preparation')),
    );
    let preparationStale = true;
    if (preparation) {
      const stale =
        !r ||
        context.staleResumes.has(r.jobId + ':' + r.version) ||
        preparation.jdHash !== (await context.sha([j.company, j.title, j.description])) ||
        preparation.resumeVersion !== r.version ||
        preparation.resumeContentHash !== (await context.sha(r.content, true)) ||
        (preparation.bindingKind === 'legacy'
          ? preparation.resumePdfHash !== r.pdfHash
          : preparation.capabilityHash !==
            (await context.sha(
              preparation.capabilityIds.map((id) =>
                context.state.capabilities.find((c) => c.id === id),
              ),
            )));
      preparationStale = stale;
      prepSection.append(
        context.el(
          'p',
          { class: 'meta' },
          context.t('Preparation v') +
            preparation.version +
            ' · ' +
            context.t(stale ? 'stale' : 'ready for review'),
        ),
        context.structured(preparation.content),
        context.el(
          'details',
          {},
          context.el('summary', {}, context.t('Evidence used')),
          ...preparation.evidence.map((c) =>
            context.el(
              'div',
              {},
              context.el('p', {}, c.claim),
              context.el(
                'ul',
                {},
                c.evidence.map((e) => context.el('li', {}, e)),
              ),
            ),
          ),
        ),
      );
    } else
      prepSection.append(
        context.el(
          'p',
          { class: 'muted' },
          context.t(
            'Your agent can prepare interview examples and employer questions from this JD and your confirmed experience.',
          ),
        ),
      );
    d.append(prepSection);
    const readiness = context.applicationReadiness({
      resume: {
        exists: !!r,
        pdf: !!r?.pdfHash,
        adjustments: !!r?.adjustments?.length,
        reviewStatus: r?.reviewStatus,
        stale: !!r && context.staleResumes.has(r.jobId + ':' + r.version),
      },
      preparation: { exists: !!preparation, stale: preparationStale },
      tasks: context.state.tasks.filter((task) => context.taskFor(task, id)),
      qualification: qualification(j),
      submitted:
        !!context.state.submissions?.some((x) => x.jobId === id) ||
        context.state.reviews[id]?.status === 'applied',
    });
    const names = {
      resume: context.t('Create a tailored resume'),
      resume_stale: context.t('Regenerate the stale resume'),
      pdf: context.t('Save a PDF artifact for this resume version'),
      adjustments: context.t('Explain the resume adjustments'),
      resume_changes: context.t('Revise the resume'),
      preparation: context.t('Prepare interview examples and employer questions'),
      preparation_stale: context.t('Update interview preparation'),
      tasks: context.t('Complete the preparation tasks'),
      review: context.t('Review and approve the resume'),
      qualification: context.t('Resolve eligibility checks'),
    };
    const overview = context.el(
      'section',
      { class: 'detail-section package-overview', id: 'application-package' },
      context.el('h2', {}, context.t('Application package')),
      context.el(
        'dl',
        { class: 'status-grid' },
        ...[
          [context.t('Materials'), readiness.materialsReady ? 'complete' : 'incomplete'],
          [context.t('Resume review'), r?.reviewStatus || 'not started'],
          [context.t('Eligibility'), qualification(j)],
        ].map(([label, value]) =>
          context.el(
            'div',
            {},
            context.el('dt', {}, context.t(label)),
            context.el('dd', {}, context.t(value)),
          ),
        ),
      ),
      context.el(
        'p',
        { class: 'muted' },
        readiness.submitted
          ? context.t('Application reported by you.')
          : context.t('No application recorded.'),
      ),
    );
    if (readiness.missing.length)
      overview.append(
        context.el(
          'ul',
          {},
          readiness.missing.map((k) => context.el('li', {}, names[k])),
        ),
      );
    else
      overview.append(
        context.el('p', {}, context.t('Ready for your final check and manual application.')),
      );
    if (r)
      overview.append(
        context.link(
          r.pdfHash ? context.t('Open saved PDF ↗') : context.t('Print / save PDF ↗'),
          '/api/resume?job=' + id + '&version=' + r.version + (r.pdfHash ? '&format=pdf' : ''),
        ),
        context.el(
          'p',
          { class: 'muted' },
          r.pdfHash
            ? context.t('Original PDF saved.')
            : context.t(
                'Print export is available. Use the agent PDF command to save the original file in this workspace.',
              ),
        ),
      );
    const jd = d.querySelector('#job-description');
    const groups = [
      ['jd', context.t('JD'), [jd]],
      [
        'fit',
        context.t('Fit & checks'),
        [d.querySelector('#fit-evidence'), d.querySelector('#verification-evidence')],
      ],
      ['preparation', context.t('Preparation'), [overview, resume, prepSection, taskSection]],
    ];
    const tabs = context.$('#detail-tabs');
    tabs.replaceChildren(
      ...groups.map(([key, label]) => {
        const control = context.button(context.t(label), () => selectDetailTab(key), 'quiet');
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
        context.el(
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
    selectDetailTab(context.detailTab);
    d.scrollTop = previousScroll;
    if (!context.$('#detail').open) {
      context.$('#detail').showModal();
      d.scrollTop = 0;
      context.$('#detail-title').focus({ preventScroll: true });
    }
  }
  function qualification(j) {
    if (
      j.availability.status === 'closed' ||
      (j.expiresAt && Date.parse(j.expiresAt) < Date.now()) ||
      j.checks.some((c) => c.status === 'excluded')
    )
      return 'excluded';
    const required = context.state.profile?.requiredChecks || [];
    return j.checks.length &&
      required.every((k) => j.checks.some((c) => c.key === k.key)) &&
      j.checks.every((c) => context.positiveFresh(c) && c.source && c.evidence) &&
      context.positiveFresh(j.availability, context.freshness.availabilityDays) &&
      j.availability.source &&
      j.availability.evidence
      ? 'verified'
      : 'unknown';
  }
  return { selectDetailTab, showJob, qualification };
}
