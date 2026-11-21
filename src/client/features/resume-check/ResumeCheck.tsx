import type { Dispatch, SetStateAction } from 'react';
import { useWorkspace } from '../../workspace';
import { t, errorText } from '../../domain';
import { Button, Heading, MutationButton, Disclosure } from '../../components/controls';
import { RubricScore } from '../../components/RubricScore';
import exampleRubric from '../../../../examples/rubric.json';
export const emptyResumeCheckDraft = {
  title: '',
  content: '',
  rubric: JSON.stringify(exampleRubric, null, 2),
};
type Draft = typeof emptyResumeCheckDraft;
export function ResumeCheck({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
}) {
  const { state, action, notify } = useWorkspace();
  const { title, content, rubric } = draft;
  if (!state) return null;
  const checks = [...(state.resumeChecks || [])].reverse();
  const confirmed = state.capabilities.filter((c) => c.status === 'confirmed');
  // Builds resume text from saved data only; nothing is inferred or added.
  function useProfile() {
    if ((title || content) && !confirm(t('Discard unsaved changes?'))) return;
    const p = state!.profile!;
    setDraft({
      ...draft,
      title: t('Current profile'),
      content: [
        '# ' + p.name,
        [p.location, p.languages.join(' / ')].filter(Boolean).join(' · '),
        ...(p.portfolio ? [p.portfolio] : []),
        '## Target roles',
        p.targetRoles.map((r) => '- ' + r).join('\n'),
        '## Confirmed experience',
        confirmed.map((c) => '- ' + c.claim).join('\n'),
      ].join('\n\n'),
    });
  }
  async function submit() {
    if (!content.trim()) {
      notify(t('Resume text is required.'));
      return false;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(rubric);
    } catch {
      notify(t('Rubric must be valid JSON.'));
      return false;
    }
    try {
      const ok = await action({
        type: 'resumeCheck',
        title: title.trim() || t('Resume check'),
        content,
        rubric: parsed,
      });
      if (ok) {
        setDraft((current) =>
          current === draft ? { ...current, title: '', content: '' } : current,
        );
        notify(t('Queued. Codex / Claude scores it on its next run.'));
      }
      return ok;
    } catch (error) {
      notify(errorText(error));
      return false;
    }
  }
  return (
    <>
      <Heading
        title={t('Resume check')}
        subtitle={t('Score an original resume against a rubric. It is not tied to a job.')}
      />
      <div className="grid resume-check">
        <section className="card" id="resume-check-form">
          <h2>{t('New resume check')}</h2>
          <div className="actions">
            <Button disabled={!state.profile || !confirmed.length} onClick={useProfile}>
              {t('Use current profile')}
            </Button>
          </div>
          <p className="muted">
            {t(
              'Fills the form from your saved profile and confirmed experience. You can edit it before queuing.',
            )}
          </p>
          <label>
            {t('Check name')}
            <input
              id="resume-check-title"
              maxLength={200}
              value={title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          <label>
            {t('Resume text')}
            <textarea
              id="resume-check-content"
              rows={12}
              maxLength={100000}
              value={content}
              onChange={(e) => setDraft({ ...draft, content: e.target.value })}
            />
          </label>
          <p className="muted">
            {t(
              'Paste plain text or Markdown. PDF files are not read here; ask your agent to extract the text.',
            )}
          </p>
          <Disclosure label="Rubric (JSON)">
            <p className="muted">
              {t(
                'The example rubric is a starting point, not a hiring standard. Rewrite it for your target role.',
              )}
            </p>
            <textarea
              id="resume-check-rubric"
              aria-label={t('Rubric (JSON)')}
              rows={14}
              spellCheck={false}
              value={rubric}
              onChange={(e) => setDraft({ ...draft, rubric: e.target.value })}
            />
          </Disclosure>
          <div className="actions">
            {!state.profile && <p>{t('Create your profile before queuing a resume check.')}</p>}
            <MutationButton disabled={!state.profile} className="primary" onClick={submit}>
              {t('Queue for agent')}
            </MutationButton>
          </div>
        </section>
        <section id="resume-check-list">
          {checks.length ? null : <p className="muted">{t('No resume checks yet.')}</p>}
          {checks.map((c) => (
            <article className="card resume-check-card" key={c.id}>
              <h2>{c.title}</h2>
              <p className="meta">
                {t(c.status === 'queued' ? 'Queued for agent · ' : 'Scored · ') +
                  c.createdAt.slice(0, 10)}
              </p>
              {c.score ? (
                <RubricScore score={c.score} />
              ) : (
                <p className="muted">
                  {t('Waiting for your next agent run. This page does not start an AI session.')}
                </p>
              )}
              <Disclosure label="Show resume text">
                <pre className="resume-check-text">{c.content}</pre>
              </Disclosure>
              <div className="actions">
                <MutationButton
                  className="quiet"
                  onClick={async () =>
                    confirm(t('Remove this resume check?'))
                      ? action({ type: 'resumeCheckRemove', id: c.id })
                      : false
                  }
                >
                  {t('Remove')}
                </MutationButton>
              </div>
            </article>
          ))}
        </section>
      </div>
    </>
  );
}
