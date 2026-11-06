import { useResearch } from '../../api/research';
import { useRef, useState } from 'react';
import { researchOutcomes } from '../../../../web/outcomes.mjs';
import { currentScore } from '../../../../web/status.mjs';
import { useWorkspace } from '../../workspace';
import { t, sourceLabel, qualification, errorText } from '../../domain';
import {
  Badge,
  Button,
  MutationButton,
  Disclosure,
  Heading,
  IconButton,
  Link,
  paths,
  Skeleton,
  useModal,
} from '../../components/controls';
import { Markdown } from '../../components/Markdown';
import type { Run } from '../../types';
function OutcomeSummary() {
  const { state, showJob } = useWorkspace();
  if (!state) return null;
  const q = researchOutcomes({
    jobs: state.jobs.map((j) => ({
      id: j.id,
      url: j.url,
      company: j.company,
      title: j.title,
      firstSeenAt: j.firstSeenAt,
      score: currentScore(j),
      decision: state.reviews[j.id]?.status,
      excluded: qualification(state, j) === 'excluded',
      verified: qualification(state, j) === 'verified',
    })),
    history: state.runs.some((r) => Array.isArray(r.observations))
      ? state.runs.map((r) => ({ ...r, jobs: r.observations || [] }))
      : null,
    historyComplete: state.runs.every((r) => Array.isArray(r.observations)),
    timeZone: state.profile?.timezone || 'UTC',
  });
  return (
    <section className="card outcome-summary">
      <h2>{t('Seven-day outcomes')}</h2>
      <p className="muted">{q.startDate + ' – ' + q.endDate + ' · ' + q.timeZone}</p>
      <Disclosure label={t('Counting method')}>
        <p className="muted">
          {t(
            'Newly discovered roles, not newly posted jobs. Counts use current fit and eligibility; imports and repeat observations are excluded.',
          )}
        </p>
      </Disclosure>
      {!q.historyAvailable ? (
        <p>
          {t(
            'Historical observations were not saved. Outcomes will be recorded with the next research import.',
          )}
        </p>
      ) : (
        <>
          {!q.historyComplete ? (
            <p>
              {t(
                'Partial history: earlier runs lack observation snapshots. These counts are a lower bound.',
              )}
            </p>
          ) : null}
          {(
            [
              ['newHighFit', 'New high-fit roles'],
              ['qualifying', 'Currently meet all checks'],
              ['kept', 'Currently shortlisted or applied'],
              ['resolvedPositive', 'Checks resolved positively'],
              ['resolvedNegative', 'Checks resolved negatively'],
            ] as const
          ).map(([key, label]) => {
            const items = q[key] as {
              id: string;
              company: string;
              title: string;
              key?: string;
              label?: string;
              to?: string;
            }[];
            return (
              <details key={key}>
                <summary>{t(label) + ' · ' + items.length}</summary>
                {items.length ? (
                  items.map((item, i) => (
                    <Button
                      key={item.id + ':' + i}
                      onClick={() => showJob(item.id)}
                    >{`${item.company} · ${item.title}${item.key ? ' · ' + item.label + ' → ' + t(item.to || '') : ''}`}</Button>
                  ))
                ) : (
                  <p className="muted">{t('No supported records in this window.')}</p>
                )}
              </details>
            );
          })}
        </>
      )}
    </section>
  );
}
function Reader({
  run,
  onClose,
  trigger,
}: {
  run: Run;
  onClose: () => void;
  trigger: HTMLElement | null;
}) {
  const { date } = useWorkspace(),
    ref = useRef<HTMLDialogElement>(null);
  const query = useResearch(run.id, run.archiveHash),
    bundle = query.data;
  const error = query.error
    ? errorText(query.error) === 'Failed to fetch'
      ? t('Could not load research.')
      : errorText(query.error)
    : '';
  useModal(ref, onClose, 'h2', () => trigger);
  const url = '/api/research?run=' + encodeURIComponent(run.id);
  const saved = bundle?.run;
  return (
    <dialog ref={ref} className="research-reader" aria-labelledby="research-reader-title">
      <header className="dialog-bar">
        <h2 id="research-reader-title" tabIndex={-1}>
          {t('Full research record')}
        </h2>
        <IconButton
          label={t('Close research')}
          path={paths.close}
          className="quiet"
          onClick={onClose}
        />
      </header>
      <div
        className={'research-reader-body' + (bundle ? ' content-arrived' : '')}
        aria-busy={query.isFetching || undefined}
      >
        {error ? (
          <>
            <p className="request-note" role="alert">
              {error}
            </p>
            <Button disabled={query.isFetching} onClick={() => query.refetch()}>
              {t('Retry')}
            </Button>
          </>
        ) : bundle && saved ? (
          <>
            <p className="meta">{date(saved.finishedAt || saved.startedAt)}</p>
            {saved.note ? <Markdown text={saved.note} /> : null}
            <h3>{t('Source coverage')}</h3>
            <div className="research-reader-coverage">
              {saved.coverage.map((c, i) => {
                const counts = c.metrics || c;
                return (
                  <section key={c.source + ':' + i}>
                    <div className="research-source-heading">
                      <h4>{sourceLabel(c.source)}</h4>
                      <Badge label={c.status} />
                    </div>
                    {Number.isFinite(counts.screened) && Number.isFinite(counts.fullJd) ? (
                      <p className="meta">{`${t('Screened')}: ${counts.screened} · ${t('Full JDs')}: ${counts.fullJd}`}</p>
                    ) : Number.isFinite(c.inspected) ? (
                      <p className="meta">{`${t('Legacy count')}: ${c.inspected}`}</p>
                    ) : null}
                    {c.query ? <p className="query-text">{c.query}</p> : null}
                    {c.note ? <Markdown text={c.note} /> : null}
                  </section>
                );
              })}
            </div>
            <h3>{t('Saved jobs')}</h3>
            {!bundle.jobs.length ? (
              <p className="muted">{t('No jobs were saved in this run.')}</p>
            ) : null}
            {bundle.jobs.map((j, i) => {
              let safeURL = '';
              try {
                const u = new URL(j.url || '');
                if (u.protocol === 'https:' && !u.username && !u.password) safeURL = u.href;
              } catch {}
              return (
                <Disclosure
                  key={i}
                  label={[j.company, j.title].filter(Boolean).join(' · ') || t('Saved job')}
                >
                  {j.description?.trim() ? (
                    <Markdown text={j.description} />
                  ) : (
                    <p className="muted">{t('No job description was saved.')}</p>
                  )}
                  {safeURL ? <Link url={safeURL}>{t('Original job ↗')}</Link> : null}
                  <Disclosure label={t('Stored fields')}>
                    <pre>{JSON.stringify(j, null, 2)}</pre>
                  </Disclosure>
                </Disclosure>
              );
            })}
            <Disclosure label={t('Original JSON')}>
              <pre>{JSON.stringify(bundle, null, 2)}</pre>
            </Disclosure>
          </>
        ) : (
          <Skeleton kind="reader" label={t('Loading research…')} />
        )}
      </div>
      <footer className="dialog-footer" hidden={!bundle}>
        <a href={url + '&download=1'} className="button" download>
          {t('Download JSON')}
        </a>
      </footer>
    </dialog>
  );
}
export function Research() {
  const { state, collect, date } = useWorkspace(),
    [reader, setReader] = useState<Run | null>(null),
    readerTrigger = useRef<HTMLElement | null>(null);
  if (!state) return null;
  return (
    <>
      <Heading title={t('Research log')}>
        <MutationButton className="primary" onClick={collect}>
          {t('Search now')}
        </MutationButton>
      </Heading>
      <OutcomeSummary />
      {[...state.runs].reverse().map((run) => (
        <section className="card research-card" key={run.id}>
          <h2>{date(run.finishedAt)}</h2>
          {run.note ? (
            <Disclosure label={t('Run notes')}>
              <p className="muted research-note">{run.note}</p>
            </Disclosure>
          ) : null}
          {run.archiveHash ? (
            <Button
              onClick={(e) => {
                readerTrigger.current = e.currentTarget;
                setReader(run);
              }}
            >
              {t('View full research')}
            </Button>
          ) : null}
          <div className="coverage">
            {run.coverage.map((c, i) => (
              <article key={c.source + ':' + i}>
                <h3>{sourceLabel(c.source)}</h3>
                <Badge
                  label={c.status}
                  type={c.status === 'blocked' ? 'danger' : c.status === 'not_run' ? 'warning' : ''}
                />
                <p className="meta">
                  {c.depthKnown === false
                    ? t('Legacy count: {count} · screening/JD depth not recorded', {
                        count: c.legacyInspected ?? t('Unknown'),
                      })
                    : t('{screened} screened · {fullJd} full JDs', {
                        screened: c.screened,
                        fullJd: c.fullJd,
                      })}
                </p>
                {c.query || c.note ? (
                  <Disclosure label={t('Search details')}>
                    {c.query ? <p className="query-text">{c.query}</p> : null}
                    {c.note ? <p className="muted">{c.note}</p> : null}
                  </Disclosure>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ))}
      {!state.runs.length ? (
        <p className="empty">{t('Search attempts and their limits will appear here.')}</p>
      ) : null}
      {reader ? (
        <Reader
          key={reader.id}
          run={reader}
          trigger={readerTrigger.current}
          onClose={() => setReader(null)}
        />
      ) : null}
    </>
  );
}
