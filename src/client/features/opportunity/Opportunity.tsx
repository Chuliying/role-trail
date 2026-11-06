import { useLayoutEffect, useRef } from 'react';
import { useWorkspace } from '../../workspace';
import { t } from '../../domain';
import { Button, IconButton, Link, paths, useModal } from '../../components/controls';
import { Markdown } from '../../components/Markdown';
import { FitEvidence } from './FitEvidence';
import { PreparationPanel } from './PreparationPanel';
import type { Job } from '../../types';
export function Opportunity() {
  const { state, currentJob } = useWorkspace();
  const job = state?.jobs.find((j) => j.id === currentJob);
  return job ? <OpportunityDialog key={job.id} job={job} /> : null;
}
function OpportunityDialog({ job: j }: { job: Job }) {
  const {
    state,
    detailNotice,
    closeJob,
    detailTab,
    setDetailTab,
    detailSection,
    action,
    mutationPending,
    date,
  } = useWorkspace();
  const ref = useRef<HTMLDialogElement>(null),
    body = useRef<HTMLDivElement>(null);
  useModal(ref, closeJob, '#detail-title');
  useLayoutEffect(() => {
    if (body.current) body.current.scrollTop = 0;
    if (detailSection) {
      const section = document.getElementById(detailSection);
      section?.scrollIntoView({ block: 'start' });
      section?.focus({ preventScroll: true });
    }
  }, [detailTab, detailSection]);
  const tabs = [
    ['jd', 'JD'],
    ['fit', 'Fit & checks'],
    ['preparation', 'Preparation'],
  ] as const;
  return (
    <dialog id="detail" ref={ref} aria-labelledby="detail-title">
      <div className="dialog-bar">
        <span>OPPORTUNITY</span>
        <IconButton
          label={t('Close opportunity')}
          id="close-detail"
          path={paths.close}
          className="quiet"
          onClick={closeJob}
        />
      </div>
      <div
        id="detail-tabs"
        className="detail-jumps"
        role="tablist"
        aria-label="Opportunity sections"
      >
        {tabs.map(([key, label], index) => (
          <Button
            key={key}
            id={'tab-' + key}
            data-tab={key}
            role="tab"
            className="quiet"
            aria-controls={'panel-' + key}
            aria-selected={detailTab === key}
            tabIndex={detailTab === key ? 0 : -1}
            onClick={() => setDetailTab(key)}
            onKeyDown={(e) => {
              const next =
                e.key === 'ArrowRight'
                  ? (index + 1) % 3
                  : e.key === 'ArrowLeft'
                    ? (index + 2) % 3
                    : e.key === 'Home'
                      ? 0
                      : e.key === 'End'
                        ? 2
                        : -1;
              if (next >= 0) {
                e.preventDefault();
                setDetailTab(tabs[next][0]);
                document.getElementById('tab-' + tabs[next][0])?.focus();
              }
            }}
          >
            {t(label)}
          </Button>
        ))}
      </div>
      <div id="detail-notice" role="status" hidden={!detailNotice}>
        {detailNotice}
      </div>
      <div id="detail-body" ref={body}>
        <span className="company">{j.company}</span>
        <h1 id="detail-title" tabIndex={-1}>
          {j.title}
        </h1>
        <p className="muted">{j.location || t('Location not confirmed')}</p>
        <div
          id="panel-jd"
          role="tabpanel"
          aria-labelledby="tab-jd"
          tabIndex={0}
          hidden={detailTab !== 'jd'}
        >
          <div className="detail-section" id="job-description">
            <h2>{t('Job description')}</h2>
            <p className="muted">
              {t(j.descriptionKind + ' text') +
                ' · ' +
                j.source +
                ' · ' +
                t('captured') +
                ' ' +
                date(j.descriptionCheckedAt)}
            </p>
            <Markdown
              text={j.description || t('Description unavailable. Open the original source.')}
            />
          </div>
        </div>
        <div
          id="panel-fit"
          role="tabpanel"
          aria-labelledby="tab-fit"
          tabIndex={0}
          hidden={detailTab !== 'fit'}
        >
          <FitEvidence job={j} />
        </div>
        <div
          id="panel-preparation"
          role="tabpanel"
          aria-labelledby="tab-preparation"
          tabIndex={0}
          hidden={detailTab !== 'preparation'}
        >
          <PreparationPanel job={j} />
        </div>
      </div>
      <footer id="detail-footer" className="dialog-footer">
        <Link url={j.url} className="footer-source">
          {t('Original job ↗')}
        </Link>
        <IconButton
          disabled={mutationPending}
          label={t(state!.reviews[j.id]?.archived ? 'Restore manual archive' : 'Archive')}
          path={state!.reviews[j.id]?.archived ? paths.restore : paths.trash}
          className="quiet footer-archive"
          onClick={() =>
            action({ type: 'archive', jobId: j.id, archived: !state!.reviews[j.id]?.archived })
          }
        />
      </footer>
    </dialog>
  );
}
