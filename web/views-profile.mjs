// Rendering only; effects and current workspace are supplied by the controller.
export function createViewsProfile(context) {
  function profile() {
    const sample = {
      name: context.t('Your name'),
      targetRoles: [context.t('Your target role')],
      location: context.t('Your legal work location'),
      remotePolicy: context.t('Your remote requirements'),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      languages: ['English'],
      ownershipPolicy: context.t('None'),
      platforms: ['himalayas'],
      portfolio: '',
      feeds: [{ type: 'himalayas', query: context.t('Your target role') }],
    };
    context.main.replaceChildren(
      context.heading(
        context.t('Profile & workspace'),
        null,
        context.button(
          context.t('Edit profile'),
          () =>
            context.jsonEditor(context.t('Profile'), context.state.profile || sample, (v) =>
              context.action({ type: 'profile', profile: v }),
            ),
          'primary',
        ),
      ),
    );
    context.main.append(
      context.el(
        'div',
        { class: 'grid' },
        context.el(
          'section',
          { class: 'card' },
          context.el('h2', {}, context.t('Search profile')),
          context.state.profile
            ? context.el(
                'div',
                {},
                context.el(
                  'dl',
                  { class: 'profile-fields' },
                  ...[
                    [context.t('Name'), context.state.profile.name],
                    [context.t('Target roles'), context.state.profile.targetRoles.join(' · ')],
                    [context.t('Location'), context.state.profile.location],
                    [context.t('Timezone'), context.state.profile.timezone],
                    [context.t('Remote'), context.state.profile.remotePolicy],
                    [context.t('Languages'), context.state.profile.languages.join(', ')],
                    [context.t('Ownership'), context.state.profile.ownershipPolicy],
                  ].map(([label, value]) =>
                    context.el(
                      'div',
                      {},
                      context.el('dt', {}, context.t(label)),
                      context.el('dd', {}, value),
                    ),
                  ),
                ),
                context.el(
                  'p',
                  { class: 'meta' },
                  context.t('{count} automatic feeds configured', {
                    count: (context.state.profile.feeds || []).length,
                  }),
                ),
              )
            : context.el('p', { class: 'muted' }, context.t('Create your profile to begin.')),
        ),
        context.el(
          'section',
          { class: 'card' },
          context.el('h2', {}, context.t('Daily schedule')),
          context.el(
            'p',
            {},
            context.state.schedule
              ? `${context.t(context.state.schedule.status)} · ${context.state.schedule.time} ${context.state.schedule.timezone}`
              : context.t('Not configured'),
          ),
          context.el(
            'p',
            { class: 'muted' },
            context.t(
              'A saved time needs a running CLI daemon, host automation, or cloud runner. Saving this form does not install one.',
            ),
          ),
          context.state.schedule
            ? context.el(
                'p',
                { class: 'meta' },
                context.t('Last result: ') +
                  context.t(context.state.schedule.lastResult || 'Not run'),
              )
            : null,
          context.button(context.t('Configure schedule'), () =>
            context.jsonEditor(
              context.t('Daily schedule'),
              context.state.schedule || {
                status: 'paused',
                time: '09:00',
                timezone: context.state.profile?.timezone || 'UTC',
              },
              (v) => context.action({ type: 'schedule', schedule: v }),
            ),
          ),
        ),
      ),
    );
    context.main.append(
      context.el(
        'section',
        { class: 'card detail-section capability-section' },
        context.el('h2', {}, context.t('Capability evidence')),
        context.disclosure(
          context.t('Evidence guidance'),
          context.el(
            'p',
            { class: 'muted' },
            context.t(
              'Your agent can propose claims from selected Git commits or resume text. Confirm only your own contribution.',
            ),
          ),
        ),
        context.button(context.t('Add capability'), () =>
          context.jsonEditor(
            context.t('Capability'),
            { claim: '', tags: [], evidence: [], status: 'proposed' },
            (v) => context.action({ type: 'capability', ...v }),
          ),
        ),
        ...context.state.capabilities.map((c) =>
          context.el(
            'article',
            {},
            context.el('h3', {}, c.claim),
            context.badge(c.status, c.status === 'confirmed' ? 'success' : 'warning'),
            context.el('p', { class: 'mono' }, c.evidence.join('\n')),
            context.button(context.t('Review / edit'), () =>
              context.jsonEditor(
                context.t('Capability'),
                { id: c.id, claim: c.claim, tags: c.tags, evidence: c.evidence, status: c.status },
                (v) => context.action({ type: 'capability', ...v }),
              ),
            ),
          ),
        ),
      ),
    );
    const file = context.el('input', {
      type: 'file',
      accept: '.json',
      'aria-label': context.t('Backup file'),
    });
    context.main.append(
      context.el(
        'section',
        { class: 'card detail-section' },
        context.el('h2', {}, context.t('Backup & restore')),
        context.el(
          'div',
          { class: 'actions' },
          context.link(context.t('Download backup'), '/api/export'),
          context.button(context.t('Sign out'), async () => {
            await context.api('logout', {});
            location.reload();
          }),
        ),
        context.el(
          'p',
          { class: 'muted' },
          context.t(
            'This JSON export contains private state and artifact references. Use the CLI backup command for original PDFs and full source bundles. Keep both outside Git.',
          ),
        ),
        file,
        context.button(context.t('Restore selected backup'), async () => {
          if (!file.files[0]) return context.notify(context.t('Select a backup file'));
          if (!confirm(context.t('Replace this workspace with the selected backup?'))) return;
          try {
            await context.applyState(
              await context.api('restore', {
                revision: context.state.revision,
                state: JSON.parse(await file.files[0].text()),
              }),
            );
            context.render();
            context.notify(context.t('Backup restored'));
          } catch (e) {
            context.notify(e.message);
          }
        }),
      ),
    );
  }
  return { profile };
}
