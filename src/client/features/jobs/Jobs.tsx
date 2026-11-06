import { useState } from 'react';
import { verifiedItems } from '../../../../web/verification.mjs';
import type { Job, Decision } from '../../types';
import { useWorkspace } from '../../workspace';
import { archived, latestResume, locale, settings, t } from '../../domain';
import {
  Badge,
  Button,
  Heading,
  Icon,
  IconButton,
  paths,
  Select,
  useInvocationGuard,
  SourceLink,
  TimeMark,
} from '../../components/controls';
import { Filters } from './Filters';
import { Score } from './Score';
export function Verification({ job }: { job: Job }) {
  const { showJob } = useWorkspace();
  const items = verifiedItems(job, Date.now(), locale),
    zh = locale === 'zh-TW';
  return (
    <div className="rt-verifications" aria-label={zh ? '已通過查證的項目' : 'Verified checks'}>
      {items.length ? (
        items.map((item) => (
          <button
            type="button"
            key={item.key}
            className="rt-verification"
            data-verify-key={item.key}
            aria-label={item.label + (zh ? '，已確認，查看查核證據' : ', verified; view evidence')}
            title={`${item.label}\n${item.fact.evidence}\n${item.fact.source}\n${item.fact.checkedAt}`}
            onClick={() => showJob(job.id, 'fit', 'verification-evidence')}
          >
            <Icon path={item.path} />
            {item.custom ? <span>{item.label}</span> : null}
          </button>
        ))
      ) : (
        <button
          type="button"
          className="rt-verification rt-verification-empty"
          onClick={() => showJob(job.id, 'fit', 'verification-evidence')}
        >
          {zh ? '待查證' : 'Not verified'}
        </button>
      )}
    </div>
  );
}
function SortHeader({ sortKey, label }: { sortKey: string; label: string }) {
  const { view, setView } = useWorkspace(),
    active = view.sort === sortKey;
  return (
    <th
      scope="col"
      aria-sort={active ? (view.sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <Button
        className="sort-control"
        onClick={() =>
          setView({
            sort: sortKey,
            sortDirection: active
              ? view.sortDirection === 'asc'
                ? 'desc'
                : 'asc'
              : settings.ui.sortOptions.find((s) => s.id === sortKey)!.direction,
          })
        }
      >
        {t(label)}
        <Icon
          path={
            active
              ? view.sortDirection === 'asc'
                ? 'm6 15 6-6 6 6'
                : 'm6 9 6 6 6-6'
              : 'm8 9 4-4 4 4M8 15l4 4 4-4'
          }
        />
      </Button>
    </th>
  );
}
function DecisionSelect({ job }: { job: Job }) {
  const { state, action, mutationPending } = useWorkspace();
  const invocation = useInvocationGuard();
  const saved = state!.reviews[job.id]?.status || 'review';
  const [pending, setPending] = useState<Decision | null>(null);
  return (
    <span className="decision-field" data-pending={pending ? 'true' : undefined}>
      <Select
        aria-label={t('Decision for ') + job.title}
        value={pending || saved}
        disabled={!!pending || mutationPending}
        aria-busy={pending ? true : undefined}
        onChange={async (e) => {
          if (!invocation.enter()) return;
          const next = e.target.value as Decision;
          setPending(next);
          try {
            await action({ type: 'review', jobId: job.id, status: next });
          } finally {
            setPending(null);
            invocation.leave();
          }
        }}
      >
        {settings.ui.decisions.map((d) => (
          <option value={d.id} key={d.id}>
            {t(d.label)}
          </option>
        ))}
      </Select>
      <span className="decision-progress" role="status">
        <span className="sr-only">{t('Saving…')}</span>
      </span>
    </span>
  );
}
export function JobRow({ job: j }: { job: Job }) {
  const { state, staleResumes, showJob, date } = useWorkspace(),
    r = latestResume(state!, j.id),
    dec = state!.reviews[j.id]?.status || 'review';
  return (
    <tr className="job-row">
      <td>
        <span className="company">{j.company}</span>
        <Button className="job-title" onClick={() => showJob(j.id)}>
          {j.title}
        </Button>
        {j.posting.date ? (
          <div className="meta">{t(j.posting.kind) + ': ' + j.posting.date}</div>
        ) : null}
        <div className="job-summary">
          <div className="facts">
            <Verification job={j} />
          </div>
          <div className="mobile-dates">
            {j.posting.date ? (
              <TimeMark label={t('Opened')} value={j.posting.date} path={paths.calendar} />
            ) : null}
            <TimeMark
              label={t('Searched')}
              value={date(j.searchedAt, true)}
              detail={date(j.searchedAt)}
              path={paths.clock}
            />
          </div>
        </div>
      </td>
      <td>
        <Score job={j} />
      </td>
      <td>{j.remoteMode !== 'unknown' ? <Badge label={j.remoteMode} /> : null}</td>
      <td>
        <time dateTime={j.searchedAt} title={date(j.searchedAt)}>
          {date(j.searchedAt, true)}
        </time>
      </td>
      <td>
        <div className="row-actions">
          <DecisionSelect job={j} />
          <div className="row-links">
            {state!.submissions?.some((x) => x.jobId === j.id) || dec === 'applied' ? (
              <IconButton
                label={t('Application recorded')}
                path={paths.application}
                className="quiet"
                onClick={() => showJob(j.id, 'preparation', 'application-package')}
              />
            ) : null}
            {r ? (
              <IconButton
                label={
                  t('Resume v') +
                  r.version +
                  ' · ' +
                  (staleResumes.has(r.jobId + ':' + r.version) ? 'stale' : r.reviewStatus)
                }
                path={paths.resume}
                className="quiet"
                onClick={() => showJob(j.id, 'preparation', 'resume-section')}
              />
            ) : null}
            <SourceLink url={j.url} />
          </div>
        </div>
      </td>
    </tr>
  );
}
export function Jobs() {
  const { state, view, setView, pasteJD } = useWorkspace();
  if (!state) return null;
  const inBucket = (j: Job, tab: string) => {
    const decision = state.reviews[j.id]?.status || 'review';
    return tab === 'passed'
      ? archived(state, j) || decision === 'passed'
      : !archived(state, j) && decision === tab;
  };
  const score = (j: Job) => (Number.isFinite(j.assessment?.score) ? j.assessment!.score : -1);
  const rows = state.jobs
    .filter(
      (j) =>
        inBucket(j, view.tab) &&
        (j.company + ' ' + j.title + ' ' + j.description)
          .toLowerCase()
          .includes(view.query.toLowerCase()) &&
        (!view.minimum || score(j) >= view.minimum),
    )
    .sort((a, b) => {
      const direction = view.sortDirection === 'asc' ? 1 : -1;
      if (view.sort === 'score') {
        const x = score(a),
          y = score(b);
        if (x < 0 || y < 0)
          return (
            Number(x < 0) - Number(y < 0) || Date.parse(b.searchedAt) - Date.parse(a.searchedAt)
          );
        return direction * (x - y) || Date.parse(b.searchedAt) - Date.parse(a.searchedAt);
      }
      return view.sort === 'company'
        ? direction * a.company.localeCompare(b.company)
        : direction * (Date.parse(a.searchedAt) - Date.parse(b.searchedAt)) || score(b) - score(a);
    });
  return (
    <>
      <div className="list-heading">
        <Heading title={t('Opportunities')} />
        <Filters />
        <div className="tabs" role="group" aria-label={t('Application decisions')}>
          {settings.ui.decisions.map((d) => (
            <Button
              key={d.id}
              className={view.tab === d.id ? 'active' : ''}
              aria-label={t(d.label)}
              aria-pressed={view.tab === d.id}
              onClick={() =>
                setView({ tab: d.id as Decision, limit: settings.ui.defaults.pageSize })
              }
            >
              {t(d.label)}
              <span className="tab-count" aria-hidden="true">
                {state.jobs.filter((j) => inBucket(j, d.id)).length}
              </span>
            </Button>
          ))}
        </div>
      </div>
      {rows.length ? (
        <>
          <div className="table-wrap">
            <table className="job-table">
              <thead>
                <tr>
                  <SortHeader sortKey="company" label="Role / company" />
                  <SortHeader sortKey="score" label="Fit" />
                  <th>{t('Work mode')}</th>
                  <SortHeader sortKey="recent" label="Searched" />
                  <th>{t('Next step')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, view.limit).map((j) => (
                  <JobRow key={j.id} job={j} />
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > view.limit ? (
            <Button
              className="load-more"
              onClick={() => setView({ limit: view.limit + settings.ui.defaults.pageSize })}
            >
              {t('Show more')}
            </Button>
          ) : null}
        </>
      ) : (
        <div className="empty">
          <h2>{t('Room for the right opportunity')}</h2>
          <p className="muted">
            {state.profile
              ? t('Paste a JD, import your agent’s research, or configure a source in Profile.')
              : t('Start with your own profile and confirmed experience.')}
          </p>
          <Button
            className="primary"
            onClick={() => (state.profile ? pasteJD() : setView({ page: 'profile' }))}
          >
            {t(state.profile ? 'Paste a JD' : 'Set up profile')}
          </Button>
        </div>
      )}
    </>
  );
}
