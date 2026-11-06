import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type RefObject,
} from 'react';
import { t, errorText } from '../domain';
export const NoticeContext = createContext<(message: string) => void>(() => {});
export const MutationPendingContext = createContext(false);
export function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={path} />
    </svg>
  );
}
export const paths = {
  close: 'm6 6 12 12M6 18 18 6',
  source: 'M14 3h7v7M21 3l-11 11M10 5H3v16h16v-7',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  restore: 'M4 10a8 8 0 1 1 1 8M4 4v6h6',
  resume: 'M6 3h8l4 4v14H6zM14 3v5h5M9 12h6M9 16h6',
  application: 'M22 2 9 15M22 2l-7 20-6-7-7-6z',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2',
  calendar: 'M4 5h16v16H4zM8 3v4M16 3v4M4 10h16',
  adjust: 'M4 6h7m4 0h5M4 12h2m4 0h10M4 18h10m4 0h2M11 4v4M6 10v4M14 16v4',
};
export function useInvocationGuard() {
  const held = useRef(false);
  return {
    enter() {
      if (held.current) return false;
      held.current = true;
      return true;
    },
    leave() {
      held.current = false;
    },
  };
}
export function usePending() {
  const [pending, setPending] = useState(false),
    [visible, setVisible] = useState(false),
    [complete, setComplete] = useState(false);
  const lock = useRef(false),
    mounted = useRef(true),
    timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      timers.current.forEach(clearTimeout);
    };
  }, []);
  async function run(fn: () => unknown) {
    if (lock.current) return;
    lock.current = true;
    setComplete(false);
    setPending(true);
    const timer = setTimeout(() => setVisible(true), 180);
    timers.current.push(timer);
    try {
      const result = await fn();
      if (result === true && mounted.current) {
        setComplete(true);
        timers.current.push(setTimeout(() => setComplete(false), 700));
      }
      return result;
    } finally {
      clearTimeout(timer);
      lock.current = false;
      if (mounted.current) {
        setPending(false);
        setVisible(false);
      }
    }
  }
  return {
    pending,
    run,
    className: [visible ? 'busy-visible' : '', complete ? 'request-complete' : '']
      .filter(Boolean)
      .join(' '),
  };
}
interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => unknown;
}
export function Button({ onClick, className = '', disabled, ...props }: ButtonProps) {
  const notify = useContext(NoticeContext),
    busy = usePending(),
    invoking = useInvocationGuard();
  return (
    <button
      type="button"
      {...props}
      className={[className, busy.className].filter(Boolean).join(' ')}
      disabled={disabled || busy.pending}
      aria-busy={busy.pending || undefined}
      onClick={async (e) => {
        if (!invoking.enter()) return;
        try {
          const result = onClick?.(e);
          if (result instanceof Promise) await busy.run(() => result);
        } catch (error) {
          notify(errorText(error));
        } finally {
          invoking.leave();
        }
      }}
    />
  );
}
// All write controls share the mutation cache's pending state. The button's
// synchronous lock still protects the interval before React commits that state.
export function MutationButton(props: ButtonProps) {
  const pending = useContext(MutationPendingContext);
  return <Button {...props} disabled={pending || props.disabled} />;
}
export function IconButton({
  label,
  path,
  className = '',
  ...props
}: ButtonProps & { label: string; path: string }) {
  return (
    <Button {...props} className={'icon-button ' + className} aria-label={label} title={label}>
      <Icon path={path} />
    </Button>
  );
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={['select-control', props.className].filter(Boolean).join(' ')} />
  );
}
export function Link({
  children,
  url,
  className = '',
}: {
  children: ReactNode;
  url: string;
  className?: string;
}) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={'button ' + className}>
      {children}
    </a>
  );
}
export function SourceLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="button icon-button source-link"
      aria-label={t('Source ↗')}
      title={t('Source ↗')}
    >
      <Icon path={paths.source} />
    </a>
  );
}
export function TimeMark({
  label,
  value,
  path,
  detail = value,
}: {
  label: string;
  value: string;
  path: string;
  detail?: string;
}) {
  return (
    <span className="time-mark" aria-label={label + ' ' + detail} title={label + ' ' + detail}>
      <Icon path={path} />
      <span>{value}</span>
    </span>
  );
}
export function Disclosure({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <details className="disclosure">
      <summary>{t(label)}</summary>
      {children}
    </details>
  );
}
const badgeLabels: Record<string, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'Onsite',
  unknown: 'Unknown',
  confirmed: 'Confirmed',
  excluded: 'Excluded',
  open: 'Open',
  closed: 'Closed',
  partial: 'Partial',
  searched: 'Searched',
  blocked: 'Blocked',
  not_run: 'Not run',
  empty: 'Empty',
};
export function Badge({ label, type = '' }: { label: string; type?: string }) {
  return <span className={'badge ' + type}>{t(badgeLabels[label] || label)}</span>;
}
export function Heading({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}
export function Skeleton({ kind, label }: { kind: 'workspace' | 'reader'; label: string }) {
  const line = (cls = '') => <span className={'skeleton-line ' + cls} />;
  return (
    <div className={kind + '-skeleton'} role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div className="skeleton-shapes" aria-hidden="true">
        {kind === 'workspace' ? (
          <>
            {line('skeleton-heading')}
            {line('skeleton-toolbar')}
            {[0, 1, 2].map((i) => (
              <div className="skeleton-card" key={i}>
                <div className="skeleton-top">
                  {line('skeleton-company')}
                  {line('skeleton-score')}
                </div>
                {line('skeleton-title')}
                {line('skeleton-title short')}
                {line('skeleton-meta')}
              </div>
            ))}
          </>
        ) : (
          <>
            {line('skeleton-company')}
            {line('skeleton-heading')}
            {[0, 1].map((i) => (
              <div className="skeleton-paragraph" key={i}>
                {line('skeleton-title')}
                {line()}
                {line()}
                {line('short')}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
export function useModal(
  ref: RefObject<HTMLDialogElement | null>,
  onClose: () => void | boolean,
  focusSelector?: string,
  restoreTarget?: () => HTMLElement | null,
) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const trigger = restoreTarget?.() || document.activeElement;
    let focused: HTMLElement | null = null;
    const rememberFocus = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement) focused = event.target;
    };
    dialog.addEventListener('focusin', rememberFocus);
    dialog.showModal();
    if (focusSelector)
      dialog.querySelector<HTMLElement>(focusSelector)?.focus({ preventScroll: true });
    const close = () => {
      if (closeRef.current() === false) {
        const restoreFocus = focused;
        dialog.showModal();
        restoreFocus?.focus({ preventScroll: true });
      }
    };
    dialog.addEventListener('close', close);
    return () => {
      dialog.removeEventListener('close', close);
      dialog.removeEventListener('focusin', rememberFocus);
      if (dialog.open) dialog.close();
      // Restore after React removes the closed dialog; WebKit otherwise resets focus.
      queueMicrotask(() => {
        if (trigger instanceof HTMLElement && trigger.isConnected)
          trigger.focus({ preventScroll: true });
      });
    };
  }, [ref, focusSelector]);
}
