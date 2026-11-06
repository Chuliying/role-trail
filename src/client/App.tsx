import { Fragment, useEffect, useRef, useState } from 'react';
import { WorkspaceProvider, useWorkspace } from './workspace';
import { t, locale, setLocale, settings, errorText } from './domain';
import { Button, Icon, NoticeContext, Skeleton, usePending } from './components/controls';
import { Jobs } from './features/jobs/Jobs';
import { Opportunity } from './features/opportunity/Opportunity';
import { Preparation } from './features/preparation/Preparation';
import { Profile } from './features/profile/Profile';
import { Research } from './features/research/Research';
import { Editor } from './components/Editor';
import type { Page } from './types';
import { DataProvider } from './api/client';
import { MutationPendingContext } from './components/controls';
function Login() {
  const { login, mutationPending, notify } = useWorkspace(),
    [key, setKey] = useState(''),
    busy = usePending();
  return (
    <form
      className="card login"
      onSubmit={(e) => {
        e.preventDefault();
        void busy.run(async () => {
          try {
            await login(key);
            setKey('');
          } catch (error) {
            notify(errorText(error));
          }
        });
      }}
    >
      <h1>{t('Open your workspace')}</h1>
      <p className="muted">
        {t('Use your private workspace access key. It is not saved in browser storage.')}
      </p>
      <label>
        {t('Access key')}
        <input
          id="access-key"
          type="password"
          required
          autoComplete="current-password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
      </label>
      <button
        type="submit"
        className={'primary ' + busy.className}
        disabled={busy.pending || mutationPending}
        aria-busy={busy.pending || undefined}
      >
        {t('Sign in')}
      </button>
    </form>
  );
}
function Shell() {
  const {
    state,
    view,
    setView,
    refresh,
    refreshing,
    collect,
    pasteJD,
    importResearch,
    notify,
    notice,
    unauthorized,
    error,
    mounted,
    mutationPending,
  } = useWorkspace();
  const main = useRef<HTMLElement>(null),
    menu = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    [menuOpen, setMenuOpen] = useState(false),
    motionKey = useRef('');
  const tr = (key: string) => (mounted ? t(key) : key);
  useEffect(() => {
    if (!state || !main.current) return;
    const key = view.page === 'jobs' ? view.page + ':' + view.tab : view.page;
    if (key !== motionKey.current && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      main.current.getAnimations().forEach((a) => a.cancel());
      const css = getComputedStyle(main.current);
      main.current.animate([{ opacity: 0.65 }, { opacity: 1 }], {
        duration: parseFloat(css.getPropertyValue('--motion-enter')),
        easing: css.getPropertyValue('--motion-ease').trim(),
      });
    }
    motionKey.current = key;
  }, [view.page, view.tab, state]);
  function tools(id: string) {
    menu.current?.hidePopover();
    if (id === 'paste-jd') pasteJD();
    if (id === 'import-research') importResearch();
    if (id === 'collect') return collect();
    if (id === 'profile-toggle') setView({ page: 'profile' });
    if (id === 'refresh') return refresh({ checkVersion: true });
  }
  return (
    <NoticeContext.Provider value={notify}>
      <MutationPendingContext.Provider value={mutationPending}>
        <a className="skip-link" href="#main" data-i18n="Skip to content">
          {tr('Skip to content')}
        </a>
        <header>
          <a className="brand" href="/">
            {settings.ui.brand}
          </a>
          <nav aria-label="Workspace">
            {settings.ui.navigation.map((n) => (
              <Button
                key={n.id}
                data-page={n.id}
                data-i18n={n.label}
                className={view.page === n.id ? 'active' : ''}
                disabled={!state && mounted}
                onClick={() => setView({ page: n.id as Page })}
              >
                {tr(n.label)}
              </Button>
            ))}
          </nav>
          <div className="header-actions">
            <button
              ref={trigger}
              id="tools-toggle"
              type="button"
              className="quiet icon-button"
              aria-label={tr('Tools')}
              data-i18n-label="Tools"
              aria-expanded={menuOpen}
              popoverTarget="workspace-tools"
              aria-controls="workspace-tools"
              disabled={!state && mounted}
              aria-busy={(refreshing && !!state) || undefined}
              onClick={() => {
                const r = trigger.current!.getBoundingClientRect(),
                  panel = menu.current!;
                panel.style.top = Math.max(8, Math.min(r.bottom + 8, innerHeight - 280)) + 'px';
                panel.style.right = Math.max(16, innerWidth - r.right) + 'px';
              }}
            >
              <Icon path="M5 6h14M5 12h14M5 18h14" />
            </button>
          </div>
        </header>
        <div
          ref={menu}
          id="workspace-tools"
          className="workspace-menu"
          popover="auto"
          aria-label="Workspace tools"
          onToggle={(e) => {
            const open = e.currentTarget.matches(':popover-open');
            setMenuOpen(open);
            if (open)
              e.currentTarget
                .querySelector<HTMLButtonElement>('button')
                ?.focus({ preventScroll: true });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') trigger.current?.focus({ preventScroll: true });
          }}
        >
          {settings.ui.tools.map((tool, i) => (
            <Fragment key={tool.id}>
              {i && settings.ui.tools[i - 1].group !== tool.group ? (
                <hr className="menu-separator" />
              ) : null}
              <Button
                id={tool.id}
                disabled={tool.id === 'collect' && mutationPending}
                className="tool-item"
                data-group={tool.group}
                onClick={() => tools(tool.id)}
              >
                {tr(tool.label)}
              </Button>
            </Fragment>
          ))}
          <hr className="menu-separator" />
          <Button
            className="tool-item language-toggle"
            onClick={() => setLocale(locale === 'zh-TW' ? 'en' : 'zh-TW')}
          >
            {mounted && locale === 'zh-TW' ? 'English' : '繁體中文'}
          </Button>
        </div>
        <main
          ref={main}
          id="main"
          tabIndex={-1}
          aria-busy={(!state && !error && !unauthorized) || refreshing || undefined}
        >
          {unauthorized ? (
            <Login />
          ) : !state ? (
            error ? (
              <>
                <div className="error" role="alert">
                  {error}
                </div>
                <Button onClick={() => refresh()}>{t('Retry')}</Button>
              </>
            ) : (
              <Skeleton kind="workspace" label={tr('Loading workspace…')} />
            )
          ) : view.page === 'jobs' ? (
            <Jobs />
          ) : view.page === 'tasks' ? (
            <Preparation />
          ) : view.page === 'research' ? (
            <Research />
          ) : (
            <Profile />
          )}
        </main>
        <div id="notice" role="status" aria-live="polite" className={notice ? 'visible' : ''}>
          {notice}
        </div>
        <Opportunity />
        <Editor />
      </MutationPendingContext.Provider>
    </NoticeContext.Provider>
  );
}
export function App() {
  return (
    <DataProvider>
      <WorkspaceProvider>
        <Shell />
      </WorkspaceProvider>
    </DataProvider>
  );
}
