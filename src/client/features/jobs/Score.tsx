import { useEffect, useId, useRef, useState } from 'react';
import type { Job } from '../../types';
import { useWorkspace } from '../../workspace';
import { t } from '../../domain';
import { Button } from '../../components/controls';
export function Score({ job }: { job: Job }) {
  const { date, showJob } = useWorkspace();
  const a = job.assessment,
    rated = Number.isFinite(a?.score),
    id = 'score-explanation-' + useId().replace(/:/g, ''),
    trigger = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLElement>(null),
    pinned = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    [open, setOpen] = useState(false);
  const place = () => {
    const p = panel.current;
    if (!p?.matches(':popover-open') || !trigger.current) return;
    const r = trigger.current.getBoundingClientRect();
    p.style.left =
      Math.max(12, Math.min(r.right - p.offsetWidth, innerWidth - p.offsetWidth - 12)) + 'px';
    p.style.top =
      (r.bottom + 8 + p.offsetHeight <= innerHeight - 12
        ? r.bottom + 8
        : Math.max(12, r.top - p.offsetHeight - 8)) + 'px';
  };
  const hide = () => {
    clearTimeout(timer.current);
    if (panel.current?.matches(':popover-open')) panel.current.hidePopover();
  };
  const show = () => {
    clearTimeout(timer.current);
    panel.current?.showPopover();
    place();
  };
  const leave = () => {
    if (!pinned.current) timer.current = setTimeout(hide, 160);
  };
  useEffect(() => {
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, []);
  return (
    <span className="score-anchor">
      <button
        ref={trigger}
        type="button"
        className="score-trigger"
        aria-label={
          (rated ? t(a?.stale ? 'Previous fit' : 'Fit') + ' ' + a!.score : t('Not assessed')) +
          '; ' +
          t('Show assessment')
        }
        aria-controls={id}
        aria-expanded={open}
        onClick={() => {
          if (pinned.current && panel.current?.matches(':popover-open')) {
            hide();
            pinned.current = false;
          } else {
            show();
            pinned.current = true;
          }
        }}
        onPointerEnter={() => {
          if (matchMedia('(hover: hover) and (pointer: fine)').matches) show();
        }}
        onPointerLeave={leave}
      >
        <span className={rated ? 'score' + (a?.stale ? ' historical-fit' : '') : 'score-missing'}>
          {rated ? a!.score : '—'}
        </span>
      </button>
      <section
        ref={panel}
        id={id}
        popover="auto"
        className="score-explanation"
        aria-label={t('Assessment evidence')}
        onToggle={(e) => {
          const isOpen = e.currentTarget.matches(':popover-open');
          setOpen(isOpen);
          if (!isOpen) pinned.current = false;
        }}
        onPointerEnter={() => clearTimeout(timer.current)}
        onPointerLeave={leave}
      >
        <p className="score-explanation-meta">
          {a?.stale ? t('Previous assessment') : t('Assessment evidence')}
          {a?.checkedAt ? ' · ' + date(a.checkedAt) : ''}
        </p>
        <p>
          {rated
            ? a?.reason || t('No assessment explanation saved.')
            : t('No assessment has been saved yet. This is not a zero score.')}
        </p>
        {a?.evidence?.length ? (
          <ul>
            {a.evidence.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        ) : null}
        <Button
          className="quiet"
          onClick={() => {
            hide();
            showJob(job.id, 'fit');
          }}
        >
          {t('View assessment')}
        </Button>
      </section>
    </span>
  );
}
