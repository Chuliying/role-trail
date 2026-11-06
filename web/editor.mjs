// One owner for editor lifecycle, dirty state and asynchronous submission.
export function createEditor({ el, busy, notify, t }) {
  const dialog = document.querySelector('#editor'),
    form = document.querySelector('#editor-form');
  let baseline = null,
    saving = false;
  const snapshot = () =>
    JSON.stringify(
      [...form.querySelectorAll('input,select,textarea')].map((n) => [
        n.type,
        n.value,
        n.checked,
        n.files ? [...n.files].map((f) => [f.name, f.size, f.lastModified]) : null,
      ]),
    );
  const dirty = () => dialog.open && baseline !== null && snapshot() !== baseline;
  function close() {
    if (saving) return false;
    if (dirty() && !confirm(t('Discard unsaved changes?'))) return false;
    baseline = null;
    dialog.close();
    return true;
  }
  dialog.querySelector('#close-editor').onclick = close;
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  window.addEventListener('beforeunload', (event) => {
    if (dirty() || saving) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  return {
    leave: () => !dialog.open || close(),
    open(title, fields, save) {
      if (dialog.open && !close()) return false;
      document.querySelector('#editor-title').textContent = title;
      document
        .querySelector('#editor-body')
        .replaceChildren(
          el('div', { id: 'editor-notice', class: 'error', role: 'alert', hidden: '' }),
          ...fields,
        );
      baseline = snapshot();
      form.onsubmit = async (event) => {
        event.preventDefault();
        if (saving) return;
        const control = form.querySelector('[type=submit]'),
          closer = form.querySelector('#close-editor');
        saving = true;
        closer.disabled = true;
        document.querySelector('#editor-notice').hidden = true;
        const done = busy(control);
        try {
          if ((await save()) !== false) {
            baseline = null;
            dialog.close();
          }
        } catch (error) {
          notify(error.message);
        } finally {
          saving = false;
          closer.disabled = false;
          done();
        }
      };
      dialog.showModal();
      return true;
    },
  };
}
