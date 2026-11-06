import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useWorkspaceData } from './api/workspace';
import { useDeploymentVersion } from './api/deployment';
import { useNavigation } from './navigation';
export { defaultView } from './navigation';
import { t, locale, errorText } from './domain';
import type { Workspace, View, Action, EditorRequest, JsonSave, DetailTab } from './types';
interface Context {
  state: Workspace | null;
  staleResumes: Set<string>;
  view: View;
  setView: (patch: Partial<View>) => void;
  refresh: (options?: { checkVersion?: boolean }) => Promise<boolean>;
  refreshing: boolean;
  collect: () => Promise<boolean>;
  action: (action: Action) => Promise<boolean>;
  writeAction: (action: Action) => Promise<Workspace>;
  login: (key: string) => Promise<unknown>;
  logout: () => Promise<unknown>;
  restore: (state: unknown) => Promise<unknown>;
  mutationPending: boolean;
  notify: (s: string) => void;
  notice: string;
  detailNotice: string;
  editorNotice: string;
  currentJob: string | null;
  detailTab: DetailTab;
  showJob: (id: string, tab?: DetailTab, section?: string) => void;
  closeJob: () => void;
  setDetailTab: (tab: DetailTab) => void;
  detailSection: string | undefined;
  editor: EditorRequest | null;
  jsonEditor: (title: string, value: unknown, save: JsonSave) => void;
  pasteJD: () => void;
  importResearch: () => void;
  closeEditor: () => void;
  leaveEditor: React.MutableRefObject<() => boolean>;
  unauthorized: boolean;
  error: string;
  date: (s?: string, compact?: boolean) => string;
  mounted: boolean;
}
const WorkContext = createContext<Context | null>(null);
export function useWorkspace() {
  const c = useContext(WorkContext);
  if (!c) throw Error('Workspace provider required');
  return c;
}
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const data = useWorkspaceData(),
    checkVersion = useDeploymentVersion();
  const state = data.snapshot?.state || null,
    staleResumes = data.snapshot?.staleResumes || new Set<string>();
  const [refreshing, setRefreshing] = useState(false),
    refreshLock = useRef(false),
    collectLock = useRef(false);
  const unauthorized = data.unauthorized;
  const error = data.query.error ? errorText(data.query.error) : '';
  const [notice, setNotice] = useState(''),
    [detailNotice, setDetailNotice] = useState(''),
    [editorNotice, setEditorNotice] = useState(''),
    noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [currentJob, setCurrentJob] = useState<string | null>(null),
    jobRef = useRef(currentJob),
    [detailTab, setDetailTabState] = useState<DetailTab>('jd'),
    [detailSection, setDetailSection] = useState<string | undefined>();
  const [editor, setEditor] = useState<EditorRequest | null>(null),
    editorRef = useRef(editor),
    leaveEditor = useRef<() => boolean>(() => true);
  const { view, setView, mounted } = useNavigation(leaveEditor);
  jobRef.current = currentJob;
  editorRef.current = editor;
  const notify = (message: string) => {
    message = t(message);
    if (editorRef.current) {
      setEditorNotice(message);
      return;
    }
    if (jobRef.current) {
      setDetailNotice(message);
      return;
    }
    setNotice(message);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 6000);
  };
  async function refresh({ checkVersion: probe = false } = {}) {
    if (refreshLock.current) return false;
    refreshLock.current = true;
    setRefreshing(true);
    try {
      if (probe) {
        const next = await checkVersion(),
          current = document.querySelector('script[src^="/app.js"]')?.getAttribute('src');
        if (next && current && next !== current) {
          location.reload();
          return true;
        }
      }
      await data.refresh();
      return true;
    } catch (e) {
      if (state) notify(errorText(e));
      return false;
    } finally {
      refreshLock.current = false;
      setRefreshing(false);
    }
  }
  async function action(payload: Action) {
    try {
      await data.action.mutateAsync(payload);
      return true;
    } catch (e) {
      notify(errorText(e));
      return false;
    }
  }
  async function collect() {
    if (collectLock.current) return false;
    collectLock.current = true;
    notify(t('Searching configured sources…'));
    try {
      await data.collect.mutateAsync();
      notify(t('Search recorded. Review source coverage for limitations.'));
      return true;
    } catch (e) {
      notify(errorText(e));
      return false;
    } finally {
      collectLock.current = false;
    }
  }
  function closeEditor() {
    setEditor(null);
    setEditorNotice('');
  }
  function jsonEditor(title: string, value: unknown, save: JsonSave) {
    if (!leaveEditor.current()) return;
    setEditorNotice('');
    setEditor({ kind: 'json', title, initial: JSON.stringify(value, null, 2), save });
  }
  function pasteJD() {
    if (!leaveEditor.current()) return;
    setEditorNotice('');
    setEditor({
      kind: 'jd',
      title: t('Paste a job description'),
      initial: '',
      save: async (values) =>
        action({
          type: 'research',
          run: {
            id: 'manual-' + crypto.randomUUID(),
            kind: 'manual',
            coverage: [
              {
                source: 'manual',
                status: 'partial',
                query: 'User-pasted JD',
                screened: 1,
                fullJd: 1,
                note: 'User-supplied text; not a new external verification.',
              },
            ],
          },
          jobs: [{ ...values, source: 'manual', descriptionKind: 'full' }],
        }),
    });
  }
  function importResearch() {
    jsonEditor(
      t('Import research'),
      { run: { id: 'agent-' + crypto.randomUUID(), kind: 'manual', coverage: [] }, jobs: [] },
      (value) => action({ type: 'research', ...value }),
    );
  }
  function showJob(id: string, tab: DetailTab = 'jd', section?: string) {
    setDetailNotice('');
    setCurrentJob(id);
    setDetailTabState(tab);
    setDetailSection(section);
  }
  function setDetailTab(tab: DetailTab) {
    setDetailTabState(tab);
    setDetailSection(undefined);
  }
  useEffect(() => () => clearTimeout(noticeTimer.current), []);
  const date = (s?: string, compact = false) =>
    s
      ? new Intl.DateTimeFormat(locale, {
          month: '2-digit',
          day: '2-digit',
          ...(compact ? {} : { hour: '2-digit', minute: '2-digit' }),
          hour12: false,
          timeZone: state?.profile?.timezone || 'UTC',
        }).format(new Date(s))
      : t('Unknown');
  return (
    <WorkContext.Provider
      value={{
        state,
        staleResumes,
        view,
        setView,
        refresh,
        refreshing: refreshing || data.query.isFetching,
        collect,
        action,
        writeAction: async (payload) => {
          await data.action.mutateAsync(payload);
          return data.currentState()!;
        },
        login: data.login.mutateAsync,
        logout: data.logout.mutateAsync,
        restore: data.restore.mutateAsync,
        mutationPending: data.pending,
        notify,
        notice,
        detailNotice,
        editorNotice,
        currentJob,
        detailTab,
        showJob,
        closeJob: () => setCurrentJob(null),
        setDetailTab,
        detailSection,
        editor,
        jsonEditor,
        pasteJD,
        importResearch,
        closeEditor,
        leaveEditor,
        unauthorized,
        error,
        date,
        mounted,
      }}
    >
      {children}
    </WorkContext.Provider>
  );
}
