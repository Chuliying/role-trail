import { useEffect, useRef, useState } from 'react';
import { settings, locale } from './domain';
import type { View } from './types';
const ui = settings.ui;
export const defaultView: View = {
  page: 'jobs',
  tab: ui.defaults.decision as View['tab'],
  query: '',
  sort: ui.defaults.sort,
  sortDirection: ui.sortOptions.find((s) => s.id === ui.defaults.sort)!.direction,
  minimum: ui.defaults.minimumFit,
  limit: ui.defaults.pageSize,
};
function readView(): View {
  const p = new URL(location.href).searchParams;
  const sort = ui.sortOptions.some((s) => s.id === p.get('sort'))
    ? p.get('sort')!
    : defaultView.sort;
  const tab = p.get('decision');
  return {
    ...defaultView,
    page: ['jobs', 'tasks', 'research', 'profile'].includes(p.get('view') || '')
      ? (p.get('view') as View['page'])
      : 'jobs',
    tab: [...ui.decisions.map((d) => d.id), 'archive'].includes(tab || '')
      ? ((tab === 'archive' ? 'passed' : tab) as View['tab'])
      : defaultView.tab,
    query: (p.get('q') || '').slice(0, 500),
    sort,
    sortDirection: ['asc', 'desc'].includes(p.get('direction') || '')
      ? p.get('direction')!
      : ui.sortOptions.find((s) => s.id === sort)!.direction,
    minimum:
      p.has('fit') && ui.fitFilters.some((f) => f.value === Number(p.get('fit')))
        ? Number(p.get('fit'))
        : defaultView.minimum,
  };
}
function viewURL(view: View) {
  const u = new URL(location.href);
  for (const [key, value, fallback] of [
    ['view', view.page, defaultView.page],
    ['decision', view.tab, defaultView.tab],
    ['q', view.query, ''],
    ['sort', view.sort, defaultView.sort],
    ['direction', view.sortDirection, ui.sortOptions.find((s) => s.id === view.sort)!.direction],
    ['fit', view.minimum, defaultView.minimum],
  ])
    value === fallback
      ? u.searchParams.delete(String(key))
      : u.searchParams.set(String(key), String(value));
  return u;
}

export function useNavigation(leaveEditor: React.RefObject<() => boolean>) {
  const [view, setViewState] = useState<View>(defaultView),
    viewRef = useRef(view),
    committedURL = useRef(''),
    [mounted, setMounted] = useState(false);
  function setView(patch: Partial<View>) {
    if (!leaveEditor.current()) return;
    const previous = viewRef.current,
      next = { ...previous, ...patch };
    const u = viewURL(next);
    if (u.href !== location.href) {
      const onlyQuery = ['page', 'tab', 'sort', 'sortDirection', 'minimum'].every(
        (k) => next[k as keyof View] === previous[k as keyof View],
      );
      history[onlyQuery ? 'replaceState' : 'pushState'](null, '', u);
    }
    viewRef.current = next;
    committedURL.current = location.href;
    setViewState(next);
  }
  useEffect(() => {
    setMounted(true);
    document.documentElement.lang = locale;
    const initial = readView();
    viewRef.current = initial;
    setViewState(initial);
    history.replaceState(null, '', viewURL(initial));
    committedURL.current = location.href;
    const pop = () => {
      if (!leaveEditor.current()) {
        history.pushState(null, '', committedURL.current);
        return;
      }
      const next = readView();
      viewRef.current = next;
      setViewState(next);
      committedURL.current = location.href;
    };
    const pageShow = (e: PageTransitionEvent) => {
      if (e.persisted) location.reload();
    };
    window.addEventListener('popstate', pop);
    window.addEventListener('pageshow', pageShow);
    return () => {
      window.removeEventListener('popstate', pop);
      window.removeEventListener('pageshow', pageShow);
    };
  }, []);
  return { view, setView, mounted };
}
