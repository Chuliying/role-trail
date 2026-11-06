import { useId, useState } from 'react';
import { useWorkspace } from '../../workspace';
import { t, taskFor, latestResume, errorText, settings } from '../../domain';
import {
  Button,
  MutationButton,
  Disclosure,
  Heading,
  useInvocationGuard,
} from '../../components/controls';
import type { Task } from '../../types';
export function Todo({ task }: { task: Task }) {
  const { state, action, mutationPending } = useWorkspace(),
    id = 'task-' + useId(),
    invocation = useInvocationGuard(),
    [pending, setPending] = useState<boolean | null>(null);
  return (
    <div className={'todo' + (task.done ? ' done' : '')}>
      <input
        id={id}
        type="checkbox"
        checked={pending ?? task.done}
        disabled={pending !== null || mutationPending}
        aria-busy={pending !== null || undefined}
        onChange={async (e) => {
          if (!invocation.enter()) return;
          setPending(e.target.checked);
          try {
            await action({ type: 'task', id: task.id, jobId: task.jobId, done: e.target.checked });
          } finally {
            setPending(null);
            invocation.leave();
          }
        }}
      />
      <div className="todo-content">
        <label htmlFor={id}>{task.text}</label>
        {task.acceptance || task.dependsOn?.length ? (
          <Disclosure label={t('Task details')}>
            {task.acceptance ? (
              <small className="muted">
                {typeof task.acceptance === 'string'
                  ? task.acceptance
                  : JSON.stringify(task.acceptance)}
              </small>
            ) : null}
            {task.dependsOn?.length ? (
              <small className="muted">
                {t('Depends on') +
                  ': ' +
                  task.dependsOn
                    .map((id) => state!.tasks.find((x) => x.id === id)?.text || id)
                    .join(', ')}
              </small>
            ) : null}
          </Disclosure>
        ) : null}
      </div>
    </div>
  );
}
export function Preparation() {
  const { state, staleResumes, showJob, writeAction, notify } = useWorkspace();
  if (!state) return null;
  const shortlisted = state.jobs.filter((j) => state.reviews[j.id]?.status === 'shortlisted');
  const list = state.jobs.filter(
      (j) => state.tasks.some((task) => taskFor(task, j.id)) || shortlisted.includes(j),
    ),
    general = state.tasks.filter((task) => !task.jobId && !task.jobIds?.length);
  async function requestAll() {
    let count = 0,
      current = state!;
    for (const job of shortlisted) {
      try {
        const before = (current.resumeRequests || []).filter((r) => r.status === 'queued').length;
        current = await writeAction({ type: 'requestResume', jobId: job.id });
        if ((current.resumeRequests || []).filter((r) => r.status === 'queued').length > before)
          count++;
      } catch (e) {
        notify(errorText(e));
        return;
      }
    }
    notify(count + ' ' + t('resume request(s) queued for Codex / Claude.'));
  }
  return (
    <>
      <Heading title={t('Preparation')}>
        <MutationButton className="primary" onClick={requestAll}>
          {t('Request shortlisted resumes')}
        </MutationButton>
      </Heading>
      <div className="grid preparation-grid">
        {list.map((j) => {
          const r = latestResume(state, j.id);
          return (
            <section className="card preparation-card" key={j.id}>
              <span className="company">{j.company}</span>
              <Button className="job-title" onClick={() => showJob(j.id)}>
                {j.title}
              </Button>
              <p className="meta">
                {t(
                  settings.ui.decisions.find(
                    (d) => d.id === (state.reviews[j.id]?.status || 'review'),
                  )!.label,
                ) +
                  ' · ' +
                  (r
                    ? staleResumes.has(j.id + ':' + r.version)
                      ? t('Resume stale')
                      : t('Resume ') + t(r.reviewStatus)
                    : t('No resume'))}
              </p>
              {state.tasks
                .filter((task) => taskFor(task, j.id))
                .map((task) => (
                  <Todo key={task.id} task={task} />
                ))}
              <Button className="preparation-open" onClick={() => showJob(j.id, 'preparation')}>
                {t('Open preparation')}
              </Button>
            </section>
          );
        })}
      </div>
      {general.length ? (
        <section className="card">
          <h2>{t('General preparation')}</h2>
          {general.map((task) => (
            <Todo task={task} key={task.id} />
          ))}
        </section>
      ) : null}
      {!list.length && !general.length ? (
        <p className="empty">{t('Shortlist an opportunity or add a task from its detail view.')}</p>
      ) : null}
    </>
  );
}
