import { useRef } from 'react';
import { useWorkspace } from '../../workspace';
import {
  Badge,
  Button,
  MutationButton,
  Disclosure,
  Heading,
  Link,
} from '../../components/controls';
import { t, errorText } from '../../domain';
export function Profile() {
  const { state, jsonEditor, action, logout, restore, notify } = useWorkspace(),
    file = useRef<HTMLInputElement>(null);
  if (!state) return null;
  const sample = {
      name: t('Your name'),
      targetRoles: [t('Your target role')],
      location: t('Your legal work location'),
      remotePolicy: t('Your remote requirements'),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      languages: ['English'],
      ownershipPolicy: t('None'),
      platforms: ['himalayas'],
      portfolio: '',
      feeds: [{ type: 'himalayas', query: t('Your target role') }],
    },
    profile = state.profile;
  return (
    <>
      <Heading title={t('Profile & workspace')}>
        <Button
          className="primary"
          onClick={() =>
            jsonEditor(t('Profile'), profile || sample, (v) =>
              action({ type: 'profile', profile: v }),
            )
          }
        >
          {t('Edit profile')}
        </Button>
      </Heading>
      <div className="grid">
        <section className="card">
          <h2>{t('Search profile')}</h2>
          {profile ? (
            <div>
              <dl className="profile-fields">
                {[
                  ['Name', profile.name],
                  ['Target roles', profile.targetRoles.join(' · ')],
                  ['Location', profile.location],
                  ['Timezone', profile.timezone],
                  ['Remote', profile.remotePolicy],
                  ['Languages', profile.languages.join(', ')],
                  ['Ownership', profile.ownershipPolicy],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{t(label)}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="meta">
                {t('{count} automatic feeds configured', { count: profile.feeds?.length || 0 })}
              </p>
            </div>
          ) : (
            <p className="muted">{t('Create your profile to begin.')}</p>
          )}
        </section>
        <section className="card">
          <h2>{t('Daily schedule')}</h2>
          <p>
            {state.schedule
              ? `${t(state.schedule.status)} · ${state.schedule.time} ${state.schedule.timezone}`
              : t('Not configured')}
          </p>
          <p className="muted">
            {t(
              'A saved time needs a running CLI daemon, host automation, or cloud runner. Saving this form does not install one.',
            )}
          </p>
          {state.schedule ? (
            <p className="meta">{t('Last result: ') + t(state.schedule.lastResult || 'Not run')}</p>
          ) : null}
          <Button
            onClick={() =>
              jsonEditor(
                t('Daily schedule'),
                state.schedule || {
                  status: 'paused',
                  time: '09:00',
                  timezone: profile?.timezone || 'UTC',
                },
                (v) => action({ type: 'schedule', schedule: v }),
              )
            }
          >
            {t('Configure schedule')}
          </Button>
        </section>
      </div>
      <section className="card detail-section capability-section">
        <h2>{t('Capability evidence')}</h2>
        <Disclosure label={t('Evidence guidance')}>
          <p className="muted">
            {t(
              'Your agent can propose claims from selected Git commits or resume text. Confirm only your own contribution.',
            )}
          </p>
        </Disclosure>
        <Button
          onClick={() =>
            jsonEditor(
              t('Capability'),
              { claim: '', tags: [], evidence: [], status: 'proposed' },
              (v) => action({ type: 'capability', ...v }),
            )
          }
        >
          {t('Add capability')}
        </Button>
        {state.capabilities.map((c) => (
          <article key={c.id}>
            <h3>{c.claim}</h3>
            <Badge label={c.status} type={c.status === 'confirmed' ? 'success' : 'warning'} />
            <p className="mono">{c.evidence.join('\n')}</p>
            <Button
              onClick={() =>
                jsonEditor(
                  t('Capability'),
                  {
                    id: c.id,
                    claim: c.claim,
                    tags: c.tags,
                    evidence: c.evidence,
                    status: c.status,
                  },
                  (v) => action({ type: 'capability', ...v }),
                )
              }
            >
              {t('Review / edit')}
            </Button>
          </article>
        ))}
      </section>
      <section className="card detail-section">
        <h2>{t('Backup & restore')}</h2>
        <div className="actions">
          <Link url="/api/export">{t('Download backup')}</Link>
          <MutationButton
            onClick={async () => {
              await logout();
              location.reload();
            }}
          >
            {t('Sign out')}
          </MutationButton>
        </div>
        <p className="muted">
          {t(
            'This JSON export contains private state and artifact references. Use the CLI backup command for original PDFs and full source bundles. Keep both outside Git.',
          )}
        </p>
        <input ref={file} type="file" accept=".json" aria-label={t('Backup file')} />
        <MutationButton
          onClick={async () => {
            const selected = file.current?.files?.[0];
            if (!selected) return notify(t('Select a backup file'));
            if (!confirm(t('Replace this workspace with the selected backup?'))) return;
            try {
              await restore(JSON.parse(await selected.text()));
              notify(t('Backup restored'));
            } catch (e) {
              notify(errorText(e));
            }
          }}
        >
          {t('Restore selected backup')}
        </MutationButton>
      </section>
    </>
  );
}
