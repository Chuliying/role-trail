// Keep unsaved filters local to the overlay. The shared URL changes only on Apply.
export function filterControl(context) {
  const { el, t, ui, view } = context;
  const trigger = context.iconButton(
    t('Filters'),
    'M4 6h7m4 0h5M4 12h2m4 0h10M4 18h10m4 0h2M11 4v4M6 10v4M14 16v4',
    open,
    'quiet list-filter-toggle',
  );
  trigger.id = 'filter-toggle';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  const defaultDirection = ui.sortOptions.find((s) => s.id === ui.defaults.sort).direction;
  if (
    view.query ||
    view.minimum !== ui.defaults.minimumFit ||
    view.sort !== ui.defaults.sort ||
    view.sortDirection !== defaultDirection
  )
    trigger.classList.add('has-filters');
  function open() {
    if (document.getElementById('list-filters')) return;
    const search = el('input', {
      type: 'search',
      value: view.query,
      'aria-label': t('Search opportunities'),
      placeholder: t('Search roles, companies or skills'),
    });
    const fit = el(
      'select',
      { 'aria-label': t('Minimum fit') },
      ui.fitFilters.map((f) => el('option', { value: f.value }, t(f.label))),
    );
    fit.value = String(view.minimum);
    const sort = el(
      'select',
      { 'aria-label': t('Sort opportunities') },
      ui.sortOptions.map((s) => el('option', { value: s.id }, t(s.label))),
    );
    sort.value = view.sort;
    let direction = view.sortDirection;
    sort.addEventListener('change', () => {
      direction = ui.sortOptions.find((s) => s.id === sort.value).direction;
    });
    const panel = el('dialog', { id: 'list-filters', 'aria-labelledby': 'list-filters-title' });
    const close = () => panel.close();
    const reset = context.button(
      t('Reset'),
      () => {
        search.value = '';
        fit.value = String(ui.defaults.minimumFit);
        sort.value = ui.defaults.sort;
        direction = defaultDirection;
      },
      'quiet',
    );
    const apply = el('button', { type: 'submit', class: 'primary' }, t('Apply'));
    const field = (label, input) =>
      el('label', { class: 'filter-field' }, el('span', {}, t(label)), input);
    const form = el(
      'form',
      {
        onsubmit: (event) => {
          event.preventDefault();
          Object.assign(view, {
            query: search.value.slice(0, 500),
            minimum: Number(fit.value),
            sort: sort.value,
            sortDirection: direction,
            limit: ui.defaults.pageSize,
          });
          close();
          context.render();
        },
      },
      el(
        'div',
        { class: 'filter-panel-heading' },
        el('h2', { id: 'list-filters-title' }, t('Filters')),
        context.iconButton(t('Close'), 'M6 6l12 12M18 6 6 18', close, 'quiet'),
      ),
      el(
        'div',
        { class: 'filter-fields' },
        field('Search opportunities', search),
        field('Minimum fit', fit),
        field('Sort opportunities', sort),
      ),
      el('div', { class: 'filter-panel-actions' }, reset, apply),
    );
    panel.append(form);
    document.body.append(panel);
    trigger.setAttribute('aria-expanded', 'true');
    panel.showModal();
    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !event.isComposing) {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    });
    function position() {
      if (matchMedia('(max-width: 720px)').matches) {
        panel.style.removeProperty('left');
        panel.style.removeProperty('top');
        return;
      }
      const r = trigger.getBoundingClientRect();
      panel.style.left =
        Math.max(12, Math.min(r.right - panel.offsetWidth, innerWidth - panel.offsetWidth - 12)) +
        'px';
      panel.style.top =
        Math.max(12, Math.min(r.bottom + 8, innerHeight - panel.offsetHeight - 12)) + 'px';
    }
    position();
    window.addEventListener('resize', position);
    panel.addEventListener('click', (event) => {
      if (event.target !== panel) return;
      const r = panel.getBoundingClientRect();
      if (
        event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom
      )
        close();
    });
    panel.addEventListener(
      'close',
      () => {
        window.removeEventListener('resize', position);
        panel.remove();
        const current = document.getElementById('filter-toggle');
        current?.setAttribute('aria-expanded', 'false');
        current?.focus({ preventScroll: true });
      },
      { once: true },
    );
  }
  return trigger;
}
