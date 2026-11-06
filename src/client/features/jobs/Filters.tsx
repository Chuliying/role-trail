import { useEffect, useRef, useState } from 'react';
import { useWorkspace, defaultView } from '../../workspace';
import { t, settings } from '../../domain';
import { Button, IconButton, paths, Select, useModal } from '../../components/controls';
export function Filters() {
  const { view, setView } = useWorkspace();
  const [open, setOpen] = useState(false),
    trigger = useRef<HTMLSpanElement>(null);
  const active =
    !!view.query ||
    view.minimum !== defaultView.minimum ||
    view.sort !== defaultView.sort ||
    view.sortDirection !== defaultView.sortDirection;
  return (
    <>
      <span className="filter-anchor" ref={trigger}>
        <IconButton
          label={t('Filters')}
          path={paths.adjust}
          id="filter-toggle"
          className={'quiet list-filter-toggle' + (active ? ' has-filters' : '')}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        />
      </span>
      {open ? (
        <FilterDialog
          initial={view}
          onApply={setView}
          onClose={() => setOpen(false)}
          trigger={trigger}
        />
      ) : null}
    </>
  );
}
function FilterDialog({
  initial,
  onApply,
  onClose,
  trigger,
}: {
  initial: ReturnType<typeof useWorkspace>['view'];
  onApply: ReturnType<typeof useWorkspace>['setView'];
  onClose: () => void;
  trigger: React.RefObject<HTMLSpanElement | null>;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    [draft, setDraft] = useState(initial),
    [closing, setClosing] = useState(false),
    closingRef = useRef<Promise<void> | null>(null),
    form = useRef<HTMLFormElement>(null),
    search = useRef<HTMLInputElement>(null);
  useModal(ref, onClose, 'h2', () => trigger.current?.querySelector('button') || null);
  useEffect(() => {
    const position = () => {
      const panel = ref.current;
      if (!panel) return;
      if (matchMedia('(max-width:720px)').matches) {
        panel.style.removeProperty('left');
        panel.style.removeProperty('top');
        return;
      }
      const r = trigger.current!.querySelector('button')!.getBoundingClientRect();
      panel.style.left =
        Math.max(12, Math.min(r.right - panel.offsetWidth, innerWidth - panel.offsetWidth - 12)) +
        'px';
      panel.style.top =
        Math.max(12, Math.min(r.bottom + 8, innerHeight - panel.offsetHeight - 12)) + 'px';
    };
    position();
    window.addEventListener('resize', position);
    return () => window.removeEventListener('resize', position);
  }, [trigger]);
  function close() {
    if (closingRef.current) return closingRef.current;
    setClosing(true);
    const panel = ref.current!;
    panel.dataset.closing = 'true';
    if (form.current) form.current.inert = true;
    closingRef.current = (async () => {
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
        await Promise.all(panel.getAnimations().map((a) => a.finished.catch(() => {})));
      panel.close();
    })();
    return closingRef.current;
  }
  return (
    <dialog
      ref={ref}
      id="list-filters"
      aria-labelledby="list-filters-title"
      data-closing={closing ? 'true' : undefined}
      onCancel={(e) => {
        e.preventDefault();
        void close();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !e.nativeEvent.isComposing) {
          e.preventDefault();
          e.stopPropagation();
          void close();
        }
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
          void close();
      }}
    >
      <form
        ref={form}
        onSubmit={async (e) => {
          e.preventDefault();
          if (closing) return;
          const next = {
            minimum: draft.minimum,
            sort: draft.sort,
            sortDirection: draft.sortDirection,
            query: (search.current?.value || '').slice(0, 500),
            limit: settings.ui.defaults.pageSize,
          };
          await close();
          onApply(next);
        }}
      >
        <div className="dialog-bar filter-panel-heading">
          <h2 id="list-filters-title" tabIndex={-1} autoFocus>
            {t('Filters')}
          </h2>
          <IconButton label={t('Close')} path={paths.close} className="quiet" onClick={close} />
        </div>
        <div className="filter-fields">
          <label className="filter-field">
            <span>{t('Search opportunities')}</span>
            <input
              ref={search}
              type="search"
              defaultValue={initial.query}
              aria-label={t('Search opportunities')}
              placeholder={t('Search roles, companies or skills')}
            />
          </label>
          <label className="filter-field">
            <span>{t('Minimum fit')}</span>
            <Select
              aria-label={t('Minimum fit')}
              value={draft.minimum}
              onChange={(e) => setDraft({ ...draft, minimum: Number(e.target.value) })}
            >
              {settings.ui.fitFilters.map((f) => (
                <option value={f.value} key={f.value}>
                  {t(f.label)}
                </option>
              ))}
            </Select>
          </label>
          <label className="filter-field">
            <span>{t('Sort opportunities')}</span>
            <Select
              aria-label={t('Sort opportunities')}
              value={draft.sort}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  sort: e.target.value,
                  sortDirection: settings.ui.sortOptions.find((s) => s.id === e.target.value)!
                    .direction,
                })
              }
            >
              {settings.ui.sortOptions.map((s) => (
                <option value={s.id} key={s.id}>
                  {t(s.label)}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <div className="filter-panel-actions">
          <Button
            onClick={() => {
              setDraft({
                ...draft,
                query: '',
                minimum: defaultView.minimum,
                sort: defaultView.sort,
                sortDirection: defaultView.sortDirection,
              });
              if (search.current) search.current.value = '';
            }}
          >
            {t('Reset')}
          </Button>
          <button type="submit" className="primary">
            {t('Apply')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
