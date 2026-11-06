import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../workspace';
import { t, errorText } from '../domain';
import { Button, usePending, useModal } from './controls';
export function Editor() {
  const { editor, closeEditor, leaveEditor, editorNotice, notify, mutationPending } =
    useWorkspace();
  if (!editor) return null;
  return (
    <EditorForm
      key={editor.title + editor.initial}
      request={editor}
      onClose={closeEditor}
      leaveEditor={leaveEditor}
      pending={mutationPending}
      notice={editorNotice}
      notify={notify}
    />
  );
}
function EditorForm({
  request,
  pending,
  onClose,
  leaveEditor,
  notice,
  notify,
}: {
  pending: boolean;
  request: NonNullable<ReturnType<typeof useWorkspace>['editor']>;
  onClose: () => void;
  leaveEditor: React.MutableRefObject<() => boolean>;
  notice: string;
  notify: (s: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    formRef = useRef<HTMLFormElement>(null),
    [value, setValue] = useState(request.initial),
    [fields, setFields] = useState({ company: '', title: '', url: '', description: '' }),
    busy = usePending();
  const dirty =
    request.kind === 'json' ? value !== request.initial : Object.values(fields).some(Boolean);
  const latest = useRef({ dirty, pending: busy.pending });
  latest.current = { dirty, pending: busy.pending };
  const close = () => {
    if (latest.current.pending) return false;
    if (latest.current.dirty && !confirm(t('Discard unsaved changes?'))) return false;
    onClose();
    return true;
  };
  useModal(ref, close);
  useEffect(() => {
    leaveEditor.current = close;
    const unload = (event: BeforeUnloadEvent) => {
      if (latest.current.dirty || latest.current.pending) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', unload);
    return () => {
      leaveEditor.current = () => true;
      window.removeEventListener('beforeunload', unload);
    };
  }, []);
  return (
    <dialog
      ref={ref}
      id="editor"
      aria-labelledby="editor-title"
      onCancel={(e) => {
        if (e.cancelable) {
          e.preventDefault();
          close();
        }
      }}
    >
      <form
        id="editor-form"
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          void busy.run(async () => {
            try {
              const data = request.kind === 'json' ? JSON.parse(value) : fields;
              if ((await request.save(data)) !== false) {
                latest.current.dirty = false;
                onClose();
              }
            } catch (error) {
              notify(errorText(error));
            }
          });
        }}
      >
        <div className="dialog-bar">
          <h2 id="editor-title">{request.title}</h2>
          <Button id="close-editor" disabled={busy.pending || pending} onClick={close}>
            {t('Close')}
          </Button>
        </div>
        <div className="editor-body" id="editor-body">
          <div id="editor-notice" className="error" role="alert" hidden={!notice}>
            {notice}
          </div>
          {request.kind === 'json' ? (
            <>
              <p className="muted">
                {t(
                  'Review this structured data before saving. Credentials belong in server environment variables.',
                )}
              </p>
              <textarea
                rows={18}
                spellCheck={false}
                aria-label={request.title}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </>
          ) : (
            <>
              {(
                [
                  ['Company', 'company', 'text'],
                  ['Role title', 'title', 'text'],
                  ['Original HTTPS URL', 'url', 'url'],
                  ['Original job description', 'description', 'textarea'],
                ] as const
              ).map(([label, key, type]) => (
                <label key={key}>
                  {t(label)}
                  {type === 'textarea' ? (
                    <textarea
                      id="jd-text"
                      required
                      value={fields[key]}
                      onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
                    />
                  ) : (
                    <input
                      id={'jd-' + key}
                      required
                      type={type}
                      value={fields[key]}
                      onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
                    />
                  )}
                </label>
              ))}
              <p className="muted">
                {t(
                  'Saving a JD does not prove eligibility. Your agent can assess it against confirmed capabilities and import an evidence-backed score.',
                )}
              </p>
            </>
          )}
        </div>
        <div className="dialog-footer">
          <button
            type="submit"
            className={'primary ' + busy.className}
            disabled={busy.pending || pending}
            aria-busy={busy.pending || undefined}
          >
            {t('Save')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
