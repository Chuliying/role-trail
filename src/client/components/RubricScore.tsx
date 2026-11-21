import { t } from '../domain';
import { Disclosure } from './controls';
import type { RubricResult } from '../types';
const spread = ([low, high]: [number, number]) => (low === high ? '' : ` (${low}–${high})`);
export function RubricScore({ score: s, id }: { score: RubricResult; id?: string }) {
  return (
    <div className="rubric-score" id={id}>
      <h3>{t('Rubric score')}</h3>
      <p className="meta">
        <strong>{s.total + ' / ' + s.maxTotal}</strong>
        {spread(s.totalRange) +
          ' · ' +
          s.rubricTitle +
          ' · ' +
          t('Scoring runs: ') +
          s.runs +
          ' · ' +
          s.checkedAt.slice(0, 10)}
      </p>
      <p className="muted">
        {t(
          'An agent estimate under this rubric. Scores vary between runs. Not a hiring probability or eligibility check.',
        )}
      </p>
      <p>{s.summary}</p>
      <Disclosure label="Score breakdown and evidence">
        {s.categories.map((c) => (
          <div key={c.key}>
            <h4>{c.label + ' · ' + c.score + ' / ' + c.max + spread(c.range)}</h4>
            {c.note ? <p>{c.note}</p> : null}
            <ul>
              {c.evidence.map((e, i) => (
                <li key={i}>“{e}”</li>
              ))}
              {c.gaps.map((g, i) => (
                <li key={'gap' + i} className="muted">
                  {t('Gap: ') + g}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {s.bonus.length ? (
          <div>
            <h4>{t('Bonus') + ' · +' + s.bonusTotal}</h4>
            <ul>
              {s.bonus.map((b) => (
                <li key={b.key}>{b.label + ' +' + b.points + ' — “' + b.evidence[0] + '”'}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {s.deductions.length ? (
          <div>
            <h4>{t('Deductions') + ' · −' + s.deductionTotal}</h4>
            <ul>
              {s.deductions.map((d, i) => (
                <li key={i}>{d.reason + ' −' + d.points}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Disclosure>
    </div>
  );
}
