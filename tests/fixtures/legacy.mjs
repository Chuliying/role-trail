import { hash } from '../../src/workbench.mjs';
import { artifactHash } from '../../src/artifacts.mjs';
export function legacyFixture() {
  const at = '2026-11-01T01:00:00Z',
    unknown = { status: 'unknown', source: null, evidence: '', checkedAt: null };
  const jobs = ['a', 'b'].map((id) => ({
    id,
    company: 'Synthetic',
    title: id,
    url: 'https://example.test/' + id,
    source: 'official',
    description: '## Role\n- Build synthetic UI',
    descriptionKind: 'full',
    posting: { date: null, kind: 'unknown', raw: '' },
    location: 'Remote',
    remoteMode: 'remote',
    salary: { display: 'Not listed', note: '' },
    availability: unknown,
    checks: { frontend: unknown },
    firstObservedAt: at,
    lastObservedAt: at,
    fitScore: 80,
    fitReason: 'Historical fit',
    gaps: ['Synthetic gap'],
  }));
  const pdf = Buffer.from('%PDF-1.4\n' + 'synthetic '.repeat(30));
  return {
    format: 'job-board-postgres-v1',
    exportedAt: at,
    tables: {
      job_board_state: [
        {
          id: 1,
          revision: 12,
          board: { jobs, runs: [], updatedAt: at },
          tracker: {
            jobs: jobs.map((j) => ({
              id: 'tracked-' + j.id,
              url: j.url,
              application_status: 'preparing',
            })),
            prep_tasks: [
              {
                id: 'shared-task',
                title: 'Practice',
                status: 'in_progress',
                job_ids: ['tracked-a', 'tracked-b'],
                acceptance: 'Explain scope',
                depends_on: [],
              },
            ],
          },
          schedule: null,
        },
      ],
      job_board_reviews: [
        { job_id: 'a', status: 'shortlisted', version: 2, updated_at: at },
        { job_id: 'b', status: 'passed', version: 1, updated_at: at },
      ],
      job_board_submissions: [{ job_id: 'b', recorded_at: at, source: 'manual' }],
      job_board_runs: [],
      job_board_evidence: [],
      job_board_preparation: [],
      job_board_resumes: [
        {
          job_id: 'a',
          version: 1,
          status: 'approved',
          jd_hash: hash(JSON.stringify([jobs[0].title, jobs[0].company, jobs[0].description])),
          source_hash: 'c'.repeat(64),
          pdf_hash: artifactHash(pdf),
          filename: 'synthetic.pdf',
          summary: '## Changes\nSelected UI',
          gaps: [],
          content: { summary: 'Original content' },
          pdf: { type: 'Buffer', data: [...pdf] },
          created_at: at,
          review_version: 3,
        },
      ],
    },
  };
}
