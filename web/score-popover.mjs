import { el } from './controls.mjs';
import { t } from './i18n.mjs';
// One floating explanation at a time; hover and touch share the same evidence.
export function createScorePopover({ date, showJob, selectDetailTab }) {
  let current = null,
    serial = 0;
  function place() {
    if (!current?.panel.isConnected || !current.panel.matches(':popover-open')) return;
    const r = current.trigger.getBoundingClientRect(),
      p = current.panel;
    p.style.left =
      Math.max(12, Math.min(r.right - p.offsetWidth, innerWidth - p.offsetWidth - 12)) + 'px';
    p.style.top =
      (r.bottom + 8 + p.offsetHeight <= innerHeight - 12
        ? r.bottom + 8
        : Math.max(12, r.top - p.offsetHeight - 8)) + 'px';
  }
  window.addEventListener('resize', place);
  window.addEventListener('scroll', place, true);
  return (job) => {
    const a = job.assessment;
    if (!Number.isFinite(a?.score)) return null;
    const id = 'score-explanation-' + ++serial;
    const trigger = el(
      'button',
      {
        type: 'button',
        class: 'score-trigger',
        'aria-label':
          t(a.stale ? 'Previous fit' : 'Fit') + ' ' + a.score + '; ' + t('Show assessment'),
        'aria-controls': id,
        'aria-expanded': 'false',
      },
      el('span', { class: 'score' + (a.stale ? ' historical-fit' : '') }, a.score),
    );
    const panel = el(
      'section',
      { id, popover: 'auto', class: 'score-explanation', 'aria-label': t('Assessment evidence') },
      el(
        'p',
        { class: 'score-explanation-meta' },
        a.stale ? t('Previous assessment') : t('Assessment evidence'),
        a.checkedAt ? ' · ' + date(a.checkedAt) : '',
      ),
      el('p', {}, a.reason || t('No assessment explanation saved.')),
      a.evidence?.length ? el('ul', {}, ...a.evidence.map((e) => el('li', {}, e))) : null,
      el(
        'button',
        {
          type: 'button',
          class: 'quiet',
          onclick: async () => {
            panel.hidePopover();
            await showJob(job.id);
            selectDetailTab('fit');
          },
        },
        t('View assessment'),
      ),
    );
    let pinned = false,
      timer;
    const hide = () => {
      clearTimeout(timer);
      if (panel.matches(':popover-open')) panel.hidePopover();
    };
    const show = () => {
      clearTimeout(timer);
      if (current && current.panel !== panel && current.panel.matches(':popover-open'))
        current.panel.hidePopover();
      current = { panel, trigger };
      if (!panel.matches(':popover-open')) panel.showPopover();
      place();
    };
    trigger.onclick = () => {
      if (pinned && panel.matches(':popover-open')) {
        hide();
        pinned = false;
      } else {
        show();
        pinned = true;
      }
    };
    const hover = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
    trigger.onpointerenter = () => {
      if (hover()) show();
    };
    const leave = () => {
      if (!pinned) timer = setTimeout(hide, 160);
    };
    trigger.onpointerleave = leave;
    panel.onpointerenter = () => clearTimeout(timer);
    panel.onpointerleave = leave;
    panel.addEventListener('toggle', () => {
      const open = panel.matches(':popover-open');
      trigger.setAttribute('aria-expanded', String(open));
      if (!open) {
        pinned = false;
        if (current?.panel === panel) current = null;
      }
    });
    return el('span', { class: 'score-anchor' }, trigger, panel);
  };
}
