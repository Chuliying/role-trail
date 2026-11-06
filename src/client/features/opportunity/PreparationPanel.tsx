import { useEffect, useMemo, useState } from 'react';
import { applicationReadiness } from '../../../../web/outcomes.mjs';
import { useWorkspace } from '../../workspace';
import { t, sha, latestResume, taskFor, qualification } from '../../domain';
import { Link, usePending } from '../../components/controls';
import { Markdown } from '../../components/Markdown';
import { Todo } from '../preparation/Preparation';
import { ResumeSection } from './ResumeSection';
import type { Job } from '../../types';
export function PreparationPanel({ job: j }: { job: Job }) {
  const { state, staleResumes } = useWorkspace();
  const r = latestResume(state!, j.id),
    preparation = state!.preparations
      ?.filter((p) => p.jobId === j.id)
      .sort((a, b) => b.version - a.version)[0];
  const inputs = useMemo(
    () => ({ j, preparation, r, state, staleResumes }),
    [j, preparation, r, state, staleResumes],
  );
  const [binding, setBinding] = useState<{ inputs: typeof inputs; stale: boolean } | null>(null);
  const preparationStale = binding?.inputs === inputs ? binding.stale : null;
  const checking = !!preparation && preparationStale === null;
  useEffect(() => {
    let canceled = false;
    void (async () => {
      if (!preparation) {
        setBinding({ inputs, stale: true });
        return;
      }
      const stale =
        !r ||
        staleResumes.has(r.jobId + ':' + r.version) ||
        preparation.jdHash !== (await sha([j.company, j.title, j.description])) ||
        preparation.resumeVersion !== r.version ||
        preparation.resumeContentHash !== (await sha(r.content, true)) ||
        (preparation.bindingKind === 'legacy'
          ? preparation.resumePdfHash !== r.pdfHash
          : preparation.capabilityHash !==
            (await sha(
              preparation.capabilityIds.map((id) => state!.capabilities.find((c) => c.id === id)),
            )));
      if (!canceled) setBinding({ inputs, stale });
    })();
    return () => {
      canceled = true;
    };
  }, [inputs]);
  const roleTasks = state!.tasks.filter((task) => taskFor(task, j.id));
  const readiness = applicationReadiness({
    resume: {
      exists: !!r,
      pdf: !!r?.pdfHash,
      adjustments: !!r?.adjustments?.length,
      reviewStatus: r?.reviewStatus,
      stale: !!r && staleResumes.has(r.jobId + ':' + r.version),
    },
    preparation: { exists: !!preparation, stale: preparationStale === true },
    tasks: roleTasks,
    qualification: qualification(state!, j),
    submitted:
      !!state!.submissions?.some((x) => x.jobId === j.id) ||
      state!.reviews[j.id]?.status === 'applied',
  });
  const names: Record<string, string> = {
    resume: 'Create a tailored resume',
    resume_stale: 'Regenerate the stale resume',
    pdf: 'Save a PDF artifact for this resume version',
    adjustments: 'Explain the resume adjustments',
    resume_changes: 'Revise the resume',
    preparation: 'Prepare interview examples and employer questions',
    preparation_stale: 'Update interview preparation',
    tasks: 'Complete the preparation tasks',
    review: 'Review and approve the resume',
    qualification: 'Resolve eligibility checks',
  };
  const pdfURL = r
    ? '/api/resume?job=' + j.id + '&version=' + r.version + (r.pdfHash ? '&format=pdf' : '')
    : '';
  return (
    <>
      <section className="detail-section package-overview" id="application-package">
        <h2>{t('Application package')}</h2>
        <dl className="status-grid">
          {[
            [
              'Materials',
              checking ? 'Checking…' : readiness.materialsReady ? 'complete' : 'incomplete',
            ],
            ['Resume review', r?.reviewStatus || 'not started'],
            ['Eligibility', qualification(state!, j)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{t(label)}</dt>
              <dd>{t(value)}</dd>
            </div>
          ))}
        </dl>
        <p className="muted">
          {t(readiness.submitted ? 'Application reported by you.' : 'No application recorded.')}
        </p>
        {checking ? (
          <p role="status">{t('Checking…')}</p>
        ) : readiness.missing.length ? (
          <ul>
            {readiness.missing.map((k) => (
              <li key={k}>{t(names[k])}</li>
            ))}
          </ul>
        ) : (
          <p>{t('Ready for your final check and manual application.')}</p>
        )}
        {r ? (
          <>
            <Link url={pdfURL}>{t(r.pdfHash ? 'Open saved PDF ↗' : 'Print / save PDF ↗')}</Link>
            <p className="muted">
              {t(
                r.pdfHash
                  ? 'Original PDF saved.'
                  : 'Print export is available. Use the agent PDF command to save the original file in this workspace.',
              )}
            </p>
          </>
        ) : null}
      </section>
      <ResumeSection job={j} />
      <section className="detail-section" id="interview-section">
        <h2>{t('Interview preparation')}</h2>
        {preparation ? (
          <>
            <p className="meta">
              {t('Preparation v') +
                preparation.version +
                ' · ' +
                t(checking ? 'Checking…' : preparationStale ? 'stale' : 'ready for review')}
            </p>
            <Markdown text={preparation.content} />
            <details>
              <summary>{t('Evidence used')}</summary>
              {preparation.evidence.map((c, i) => (
                <div key={i}>
                  <p>{c.claim}</p>
                  <ul>
                    {c.evidence.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </details>
          </>
        ) : (
          <p className="muted">
            {t(
              'Your agent can prepare interview examples and employer questions from this JD and your confirmed experience.',
            )}
          </p>
        )}
      </section>
      <section className="detail-section" id="task-section">
        <h2>{t('Tasks')}</h2>
        {roleTasks.map((task) => (
          <Todo key={task.id} task={task} />
        ))}
        <AddTask jobId={j.id} />
      </section>
    </>
  );
}
function AddTask({ jobId }: { jobId: string }) {
  const [text, setText] = useState(''),
    busy = usePending(),
    { action, mutationPending } = useWorkspace();
  return (
    <form
      className="form-inline"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        void busy.run(async () => {
          const saved = await action({ type: 'task', jobId, text, done: false });
          if (saved) setText('');
          return saved;
        });
      }}
    >
      <input
        placeholder={t('Add a preparation task')}
        aria-label={t('New preparation task')}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        type="submit"
        disabled={busy.pending || mutationPending}
        aria-busy={busy.pending || undefined}
        className={busy.className}
      >
        {t('Add task')}
      </button>
    </form>
  );
}
