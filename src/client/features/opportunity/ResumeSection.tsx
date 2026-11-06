import { useWorkspace } from '../../workspace';
import { t, latestResume } from '../../domain';
import { Button, MutationButton, Disclosure, Link } from '../../components/controls';
import { Markdown } from '../../components/Markdown';
import type { Job } from '../../types';
export function ResumeSection({ job: j }: { job: Job }) {
  const { state, staleResumes, action, jsonEditor, notify } = useWorkspace();
  const r = latestResume(state!, j.id);
  const request = state!.resumeRequests?.filter((x) => x.jobId === j.id).at(-1),
    queued = request?.status === 'queued';
  const pdfURL = r
    ? '/api/resume?job=' + j.id + '&version=' + r.version + (r.pdfHash ? '&format=pdf' : '')
    : '';
  return (
    <section className="detail-section" id="resume-section">
      <h2>{t('Tailored resume')}</h2>
      <div className="actions">
        <MutationButton
          disabled={queued}
          className="primary"
          onClick={async () => {
            const ok = await action({ type: 'requestResume', jobId: j.id });
            if (ok) notify(t('Queued for Codex / Claude.'));
            return ok;
          }}
        >
          {t(queued ? 'Queued for agent' : 'Request resume')}
        </MutationButton>
      </div>
      {queued ? (
        <>
          <p className="muted">{t('Waiting for your next agent run.')}</p>
          <MutationButton
            className="quiet"
            onClick={() =>
              action({ type: 'resumeRequestStatus', id: request.id, status: 'canceled' })
            }
          >
            {t('Cancel request')}
          </MutationButton>
        </>
      ) : null}
      {request?.status === 'blocked' ? (
        <p className="request-note">
          <strong>{t('Needs information')}</strong>
          <br />
          {request.note}
        </p>
      ) : null}
      <Disclosure label={t('How resume requests work')}>
        <ol>
          {[
            'Save a request in this workspace.',
            'Codex / Claude reads it on its next manual or scheduled run.',
            'The agent checks the JD and experience, then saves a draft and adjustment notes.',
            'Review the draft here. Nothing is submitted.',
          ].map((line) => (
            <li key={line}>{t(line)}</li>
          ))}
        </ol>
        <p className="muted">
          {t(
            'This button does not start an AI session. An agent must be connected to this workspace.',
          )}
        </p>
      </Disclosure>
      {r ? (
        <>
          <p className="meta">
            {t('Version ') +
              r.version +
              ' · ' +
              (staleResumes.has(r.jobId + ':' + r.version)
                ? t('Source changed — regenerate')
                : t(r.reviewStatus))}
          </p>
          <h3>{t('What changed for this role')}</h3>
          <ul>
            {r.adjustments.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
          <Markdown text={r.content} />
          <div className="actions">
            <Link url={pdfURL}>{t(r.pdfHash ? 'Open saved PDF ↗' : 'Print / save PDF ↗')}</Link>
            <Button
              onClick={() =>
                jsonEditor(
                  t('Resume draft'),
                  {
                    content: r.content,
                    capabilityIds: r.capabilityIds,
                    adjustments: r.adjustments,
                    jdHash: r.jdHash,
                  },
                  (v) => action({ type: 'resume', jobId: j.id, ...v }),
                )
              }
            >
              {t('Edit draft')}
            </Button>
            <MutationButton
              onClick={() =>
                action({
                  type: 'resumeReview',
                  jobId: j.id,
                  version: r.version,
                  status: 'approved',
                })
              }
            >
              {t('Approve')}
            </MutationButton>
            <MutationButton
              onClick={() =>
                action({
                  type: 'resumeReview',
                  jobId: j.id,
                  version: r.version,
                  status: 'changes_requested',
                })
              }
            >
              {t('Request changes')}
            </MutationButton>
          </div>
        </>
      ) : (
        <p className="muted">
          {t('Codex / Claude will tailor this JD to your experience and save a draft for review.')}
        </p>
      )}
    </section>
  );
}
