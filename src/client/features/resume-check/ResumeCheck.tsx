import { useState } from 'react';
import { useWorkspace } from '../../workspace';
import { t, errorText } from '../../domain';
import { Heading, MutationButton, Disclosure } from '../../components/controls';
import { RubricScore } from '../../components/RubricScore';
import exampleRubric from '../../../../examples/rubric.json';
const initialRubric = JSON.stringify(exampleRubric, null, 2);
export function ResumeCheck() {
  const { state, action, notify } = useWorkspace(),
    [title, setTitle] = useState(''),
    [content, setContent] = useState(''),
    [rubric, setRubric] = useState(initialRubric);
  if (!state) return null;
  const checks = [...(state.resumeChecks || [])].reverse();
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
        setTitle('');
        setContent('');
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
          <label>
            {t('Check name')}
            <input
              id="resume-check-title"
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            {t('Resume text')}
            <textarea
              id="resume-check-content"
              rows={12}
              maxLength={100000}
              value={content}
              onChange={(e) => setContent(e.target.value)}
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
              onChange={(e) => setRubric(e.target.value)}
            />
          </Disclosure>
          <div className="actions">
            <MutationButton className="primary" onClick={submit}>
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
