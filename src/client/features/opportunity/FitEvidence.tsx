import { useWorkspace } from '../../workspace';
import { t, sha, positiveFresh, freshness } from '../../domain';
import { Badge, Button, Link } from '../../components/controls';
import type { Job } from '../../types';
export function FitEvidence({ job: j }: { job: Job }) {
  const { state, action, jsonEditor } = useWorkspace();
  async function editAssessment() {
    const binding = {
      jdHash: await sha([j.company, j.title, j.description]),
      profileHash: await sha(state!.profile),
      capabilityHash: await sha(
        state!.capabilities
          .filter((c) => c.status === 'confirmed')
          .map(({ id, claim, tags, evidence, status }) => ({ id, claim, tags, evidence, status })),
      ),
    };
    jsonEditor(
      t('Evidence-backed assessment'),
      {
        ...(j.assessment
          ? Object.fromEntries(Object.entries(j.assessment).filter(([k]) => k !== 'stale'))
          : { score: 7, reason: '', evidence: [], gaps: [] }),
        binding,
        checkedAt: new Date().toISOString(),
      },
      (v) => action({ type: 'assessment', jobId: j.id, ...v }),
    );
  }
  return (
    <>
      <div className="detail-section" id="fit-evidence">
        <h2>{t('Fit & evidence')}</h2>
        {j.assessment ? (
          <div>
            {j.assessment.stale ? (
              <p className="muted">{t('Stale assessment — reassess before using this score.')}</p>
            ) : null}
            <Badge
              label={(j.assessment.stale ? t('Previous: ') : '') + j.assessment.score + ' / 10'}
            />
            <p>{j.assessment.reason}</p>
            <ul>
              {j.assessment.evidence.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
            {j.assessment.score >= 7 ? (
              <div>
                <h3>{t('Learning gaps')}</h3>
                <ul>
                  {j.assessment.gaps.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="muted">
            {t(
              'Not assessed. Have your agent compare this JD with your confirmed capability evidence.',
            )}
          </p>
        )}
        <Button onClick={editAssessment}>{t('Edit assessment')}</Button>
      </div>
      <div className="detail-section" id="verification-evidence" tabIndex={-1}>
        <h2>{t('Eligibility & availability')}</h2>
        <Badge
          label={
            j.availability.status === 'open' &&
            !positiveFresh(j.availability, freshness.availabilityDays)
              ? 'stale'
              : j.availability.status
          }
          type={j.availability.status === 'closed' ? 'danger' : 'warning'}
        />
        <p>{j.availability.evidence || t('Opening has not been verified.')}</p>
        {j.availability.source ? (
          <Link url={j.availability.source}>{t('Opening evidence ↗')}</Link>
        ) : null}
        {j.checks.map((c, i) => (
          <div key={c.key || i}>
            <h3>
              {t(c.label || c.key || '') +
                ' · ' +
                t(c.status === 'confirmed' && !positiveFresh(c) ? 'stale' : c.status)}
            </h3>
            <p>{c.evidence}</p>
            {c.source ? <Link url={c.source}>{t('Evidence ↗')}</Link> : null}
          </div>
        ))}
        {!j.checks.length ? (
          <p className="muted">{t('No eligibility checks recorded. Unknown is not approval.')}</p>
        ) : null}
      </div>
    </>
  );
}
