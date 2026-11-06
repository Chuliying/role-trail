import { t } from './i18n.mjs';
import { verificationIcon } from './verification.mjs';
export function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'class') n.className = v;
    else if (k === 'checked') n.checked = v;
    else if (v !== undefined && v !== null) n.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c !== null && c !== undefined)
      n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return n;
}
// Keep the control's layout and accessible name while a request is in flight.
export function busy(control) {
  control.classList.remove('request-complete');
  const disabled = control.disabled;
  control.style.setProperty('--busy-ink', getComputedStyle(control).color);
  control.disabled = true;
  control.setAttribute('aria-busy', 'true');
  const timer = setTimeout(() => control.classList.add('busy-visible'), 180);
  return (success = false) => {
    clearTimeout(timer);
    control.disabled = disabled;
    control.removeAttribute('aria-busy');
    control.classList.remove('busy-visible');
    if (success && control.isConnected) {
      control.classList.add('request-complete');
      setTimeout(() => control.classList.remove('request-complete'), 700);
    }
  };
}

export function createControls({ notify, workspaceSkeleton }) {
  function skeleton(kind, label) {
    if (kind === 'workspace') {
      const region = workspaceSkeleton?.cloneNode(true) || skeleton('reader', label);
      region.className = 'workspace-skeleton';
      region.setAttribute('aria-label', label);
      region.querySelector('.sr-only').textContent = label;
      return region;
    }
    const line = (cls = '') => el('span', { class: 'skeleton-line ' + cls });
    const region = el('div', { class: kind + '-skeleton', role: 'status', 'aria-label': label });
    region.append(el('span', { class: 'sr-only' }, label));
    const shapes = el('div', { class: 'skeleton-shapes', 'aria-hidden': 'true' });
    shapes.append(line('skeleton-company'), line('skeleton-heading'));
    for (let i = 0; i < 2; i++)
      shapes.append(
        el(
          'div',
          { class: 'skeleton-paragraph' },
          line('skeleton-title'),
          line(),
          line(),
          line('short'),
        ),
      );
    region.append(shapes);
    return region;
  }
  const button = (label, fn, cls = '') =>
    el(
      'button',
      {
        type: 'button',
        class: cls,
        onclick: async (event) => {
          const control = event.currentTarget;
          try {
            const result = fn(event);
            if (result?.then) {
              const done = busy(control);
              let saved = false;
              try {
                saved = (await result) === true;
              } finally {
                done(saved);
              }
            }
          } catch (error) {
            notify(error.message);
          }
        },
      },
      label,
    );
  function iconButton(label, path, click, cls = '') {
    const b = button(null, click, 'icon-button ' + cls);
    b.setAttribute('aria-label', label);
    b.title = label;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    shape.setAttribute('d', path);
    svg.append(shape);
    b.append(svg);
    return b;
  }
  const link = (label, url) =>
    el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', class: 'button' }, label);
  function sourceLink(url) {
    const a = link(null, url);
    a.classList.add('icon-button', 'source-link');
    a.setAttribute('aria-label', t('Source ↗'));
    a.title = t('Source ↗');
    a.append(verificationIcon('M14 3h7v7M21 3l-11 11M10 5H3v16h16v-7'));
    return a;
  }
  function timeMark(label, value, path, detail = value) {
    const text = label + ' ' + detail;
    return el(
      'span',
      { class: 'time-mark', 'aria-label': text, title: text },
      verificationIcon(path),
      el('span', {}, value),
    );
  }

  function disclosure(label, ...content) {
    return el('details', { class: 'disclosure' }, el('summary', {}, t(label)), ...content);
  }
  const badge = (label, type = '') =>
    el(
      'span',
      { class: 'badge ' + type },
      t(
        {
          remote: t('Remote'),
          hybrid: t('Hybrid'),
          onsite: t('Onsite'),
          unknown: t('Unknown'),
          confirmed: t('Confirmed'),
          excluded: t('Excluded'),
          open: t('Open'),
          closed: t('Closed'),
          partial: t('Partial'),
          searched: t('Searched'),
          blocked: t('Blocked'),
          not_run: t('Not run'),
          empty: t('Empty'),
        }[label] || label,
      ),
    );

  return { skeleton, button, iconButton, link, sourceLink, timeMark, disclosure, badge };
}
