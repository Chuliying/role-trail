// Rendering only; effects and current workspace are supplied by the controller.
export function createViewsPreparation(context) {
  let taskControlId = 0;
  function todo(task) {
    const id = 'task-control-' + ++taskControlId;
    return context.el(
      'div',
      { class: 'todo' + (task.done ? ' done' : '') },
      context.el('input', {
        id,
        type: 'checkbox',
        checked: task.done,
        onchange: (e) =>
          context.changeControl(
            e.target,
            { type: 'task', id: task.id, jobId: task.jobId, done: e.target.checked },
            () => {
              e.target.checked =
                context.state.tasks.find((current) => current.id === task.id)?.done ?? task.done;
            },
          ),
      }),
      context.el(
        'div',
        { class: 'todo-content' },
        context.el('label', { for: id }, task.text),
        task.acceptance || task.dependsOn?.length
          ? context.disclosure(
              context.t('Task details'),
              task.acceptance
                ? context.el(
                    'small',
                    { class: 'muted' },
                    typeof task.acceptance === 'string'
                      ? task.acceptance
                      : JSON.stringify(task.acceptance),
                  )
                : null,
              task.dependsOn?.length
                ? context.el(
                    'small',
                    { class: 'muted' },
                    context.t('Depends on') +
                      ': ' +
                      task.dependsOn
                        .map((id) => context.state.tasks.find((x) => x.id === id)?.text || id)
                        .join(', '),
                  )
                : null,
            )
          : null,
      ),
    );
  }
  function tasks() {
    const shortlisted = context.state.jobs.filter(
      (j) => context.state.reviews[j.id]?.status === 'shortlisted',
    );
    context.main.replaceChildren(
      context.heading(
        context.t('Preparation'),
        null,
        context.button(
          context.t('Request shortlisted resumes'),
          async () => {
            let count = 0;
            for (const j of shortlisted) {
              try {
                const before = (context.state.resumeRequests || []).filter(
                  (r) => r.status === 'queued',
                ).length;
                await context.applyState(
                  await context.api('action', {
                    revision: context.state.revision,
                    action: { type: 'requestResume', jobId: j.id },
                  }),
                );
                if (
                  (context.state.resumeRequests || []).filter((r) => r.status === 'queued').length >
                  before
                )
                  count++;
              } catch (e) {
                context.notify(e.message);
                context.render();
                return;
              }
            }
            context.render();
            context.notify(count + ' ' + context.t('resume request(s) queued for Codex / Claude.'));
          },
          'primary',
        ),
      ),
    );
    const list = context.state.jobs.filter(
      (j) =>
        context.state.tasks.some((task) => context.taskFor(task, j.id)) || shortlisted.includes(j),
    );
    context.main.append(
      context.el(
        'div',
        { class: 'grid preparation-grid' },
        list.map((j) =>
          context.el(
            'section',
            { class: 'card preparation-card' },
            context.el('span', { class: 'company' }, j.company),
            context.button(j.title, () => context.showJob(j.id), 'job-title'),
            context.el(
              'p',
              { class: 'meta' },
              context.labels[context.state.reviews[j.id]?.status || 'review'] +
                ' · ' +
                (context.latestResume(j.id)
                  ? context.staleResumes.has(j.id + ':' + context.latestResume(j.id).version)
                    ? context.t('Resume stale')
                    : context.t('Resume ') + context.t(context.latestResume(j.id).reviewStatus)
                  : context.t('No resume')),
            ),
            ...context.state.tasks.filter((task) => context.taskFor(task, j.id)).map(todo),
            context.button(
              context.t('Open preparation'),
              async () => {
                await context.showJob(j.id);
                context.selectDetailTab('preparation');
              },
              'preparation-open',
            ),
          ),
        ),
      ),
    );
    const general = context.state.tasks.filter((task) => !task.jobId && !task.jobIds?.length);
    if (general.length)
      context.main.append(
        context.el(
          'section',
          { class: 'card' },
          context.el('h2', {}, context.t('General preparation')),
          ...general.map(todo),
        ),
      );
    if (!list.length && !general.length)
      context.main.append(
        context.el(
          'p',
          { class: 'empty' },
          context.t('Shortlist an opportunity or add a task from its detail view.'),
        ),
      );
  }
  return { todo, tasks };
}
