// View state belongs in the URL; personal decisions stay on the server.
export function createNavigation(ui, onChange, canLeave = () => true) {
  const defaults = {
    page: 'jobs',
    tab: ui.defaults.decision,
    query: '',
    sort: ui.defaults.sort,
    sortDirection: ui.sortOptions.find((s) => s.id === ui.defaults.sort).direction,
    minimum: ui.defaults.minimumFit,
    limit: ui.defaults.pageSize,
  };
  function read() {
    const p = new URL(location.href).searchParams;
    const sort = ui.sortOptions.some((s) => s.id === p.get('sort')) ? p.get('sort') : defaults.sort;
    return {
      ...defaults,
      page: ['jobs', 'tasks', 'research', 'profile'].includes(p.get('view'))
        ? p.get('view')
        : defaults.page,
      tab: [...ui.decisions.map((d) => d.id), 'archive'].includes(p.get('decision'))
        ? p.get('decision')
        : defaults.tab,
      query: (p.get('q') || '').slice(0, 500),
      sort,
      sortDirection: ['asc', 'desc'].includes(p.get('direction'))
        ? p.get('direction')
        : ui.sortOptions.find((s) => s.id === sort).direction,
      minimum:
        p.has('fit') && ui.fitFilters.some((f) => f.value === Number(p.get('fit')))
          ? Number(p.get('fit'))
          : defaults.minimum,
    };
  }
  const state = read();
  let previous = { ...state },
    previousURL = location.href;
  function write({ replace = false } = {}) {
    const u = new URL(location.href);
    for (const [key, value, fallback] of [
      ['view', state.page, defaults.page],
      ['decision', state.tab, defaults.tab],
      ['q', state.query, ''],
      ['sort', state.sort, defaults.sort],
      ['direction', state.sortDirection, ui.sortOptions.find((s) => s.id === state.sort).direction],
      ['fit', state.minimum, defaults.minimum],
    ])
      value === fallback ? u.searchParams.delete(key) : u.searchParams.set(key, String(value));
    if (u.href !== location.href) {
      const onlyQuery = ['page', 'tab', 'sort', 'sortDirection', 'minimum'].every(
        (k) => state[k] === previous[k],
      );
      history[replace || onlyQuery ? 'replaceState' : 'pushState'](null, '', u);
    }
    previous = { ...state };
    previousURL = location.href;
  }
  window.addEventListener('popstate', () => {
    if (!canLeave()) {
      history.pushState(null, '', previousURL);
      return;
    }
    Object.assign(state, read());
    previous = { ...state };
    previousURL = location.href;
    onChange();
  });
  write({ replace: true });
  return { state, write };
}
