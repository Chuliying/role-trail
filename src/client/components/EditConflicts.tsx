import { useEffect, useRef, useState } from 'react';
import { t } from '../domain';
import { Button } from './controls';
import { resolveField, type Reconciliation, type RecordValue } from '../api/editor-merge';
const display = (value: unknown) =>
  value === undefined || value === null ? t('Not present') : JSON.stringify(value, null, 2);
export function EditConflicts({
  comparison,
  onResolve,
}: {
  comparison: Reconciliation;
  onResolve: (record: RecordValue) => void;
}) {
  const [choices, setChoices] = useState<Record<number, 'draft' | 'latest'>>({});
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  function choose(index: number, side: 'draft' | 'latest') {
    const selected = { ...choices, [index]: side };
    setChoices(selected);
    if (Object.keys(selected).length !== comparison.conflicts.length) return;
    let merged = comparison.merged;
    comparison.conflicts.forEach((conflict, i) => {
      merged = resolveField(merged, conflict.path, conflict[selected[i]]);
    });
    onResolve(merged);
  }
  return (
    <section className="edit-conflicts" aria-label={t('Compare changes')}>
      <h3 ref={heading} tabIndex={-1}>
        {t('Compare changes')}
      </h3>
      <p>{t('Your draft is kept. Choose a value for each conflicting field, then save again.')}</p>
      {comparison.conflicts.map((conflict, index) => (
        <article key={JSON.stringify(conflict.path)} data-editor-conflict>
          <h4 className="mono">
            {conflict.path.length ? conflict.path.join(' / ') : t('Entire record')}
          </h4>
          <details>
            <summary>{t('Before editing')}</summary>
            <pre>{display(conflict.base)}</pre>
          </details>
          <div className="conflict-values">
            {(['draft', 'latest'] as const).map((side) => (
              <div key={side}>
                <h4>{t(side === 'draft' ? 'My draft' : 'Latest saved')}</h4>
                <pre>{display(conflict[side])}</pre>
                <Button aria-pressed={choices[index] === side} onClick={() => choose(index, side)}>
                  {t(side === 'draft' ? 'Use my draft' : 'Use latest')}
                </Button>
              </div>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}
