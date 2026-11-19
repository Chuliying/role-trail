import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { emptyState, transition, validateState } from '../src/workbench.mjs';
import { demoActions } from '../src/demo.mjs';
import { draftAction } from '../src/resume.mjs';
import { workspaceDelta, mergeWorkspaceDelta } from '../web/sync.mjs';
import { workPacket, checkWork } from '../src/agent-workflow.mjs';
import {
  validateRubric,
  scorePacket,
  scoreResult,
  scoreResults,
  aggregate,
} from '../src/resume-score.mjs';
const cli = fileURLToPath(new URL('../bin/role-trail.mjs', import.meta.url));
const rubric = JSON.parse(
  await readFile(new URL('../examples/rubric.json', import.meta.url), 'utf8'),
);
// Synthetic resume. No real person, employer or project.
const resume = `# Alex Morgan (synthetic)

## Experience
- Built an accessible component library used by four product teams and tested keyboard navigation.
- Designed a typed API client with retries, reducing failed checkout requests from 3.1% to 0.4%.
- Reviewed pull requests weekly with two designers and wrote the onboarding guide.

Portfolio: https://example.com/alex
`;
const quote = {
  delivery: 'Built an accessible component library used by four product teams',
  technical_depth: 'Designed a typed API client with retries',
  collaboration: 'Reviewed pull requests weekly with two designers',
  clarity: 'reducing failed checkout requests from 3.1% to 0.4%',
};
function result(packet, change = {}) {
  return {
    ...packet.resultShape,
    checkedAt: new Date().toISOString(),
    summary: 'Synthetic scoring run.',
    categories: packet.resultShape.categories.map((c) => ({
      ...c,
      score: 10,
      evidence: [quote[c.key]],
      note: 'Synthetic note.',
      gaps: ['Synthetic gap.'],
    })),
    ...change,
  };
}
const withCategory = (packet, key, change) => ({
  categories: result(packet).categories.map((c) => (c.key === key ? { ...c, ...change } : c)),
});

test('the shipped example rubric is valid and rubric validation rejects unsafe shapes', () => {
  const r = validateRubric(rubric);
  assert.equal(r.categories.length, 4);
  assert.throws(() => validateRubric({ ...rubric, extra: 1 }), /Unexpected field/);
  assert.throws(() => validateRubric({ ...rubric, categories: [] }), /categories/);
  assert.throws(
    () => validateRubric({ ...rubric, categories: [...rubric.categories, rubric.categories[0]] }),
    /category key/,
  );
  assert.throws(
    () =>
      validateRubric({
        ...rubric,
        categories: [{ ...rubric.categories[0], max: 0 }],
      }),
    /max/,
  );
  assert.throws(() => validateRubric({ ...rubric, bonusMax: 0 }), /bonusMax/);
});

test('packet binds rubric and resume, lists every category and refuses PDF bytes', () => {
  const p = scorePacket({ rubric, content: resume });
  assert.equal(p.kind, 'resume-score');
  assert.match(p.rubricHash, /^[a-f0-9]{64}$/);
  assert.equal(p.resultShape.resumeHash, p.resume.hash);
  assert.deepEqual(
    p.resultShape.categories.map((c) => c.key),
    rubric.categories.map((c) => c.key),
  );
  assert.match(p.instruction, /untrusted/);
  assert.equal(p.actionShape, undefined);
  assert.throws(() => scorePacket({ rubric, content: '%PDF-1.7 binary' }), /plain text/);
  assert.throws(() => scorePacket({ rubric, content: '   ' }), /required/);
});

test('totals are computed by code: base, capped bonus and capped deductions', () => {
  const p = scorePacket({ rubric, content: resume });
  const scored = scoreResult(
    rubric,
    resume,
    result(p, {
      bonus: [
        { key: 'public_work', points: 4, evidence: ['Portfolio: https://example.com/alex'] },
        { key: 'measured_outcome', points: 3, evidence: [quote.clarity] },
      ],
      deductions: [
        { reason: 'Synthetic inconsistency A.', points: 8 },
        { reason: 'Synthetic inconsistency B.', points: 8 },
      ],
    }),
  );
  assert.equal(scored.base, 40);
  assert.equal(scored.bonusTotal, 6, 'bonus 7 is capped at bonusMax 6');
  assert.equal(scored.deductionTotal, 10, 'deductions 16 are capped at deductionMax 10');
  assert.equal(scored.total, 36);
  assert.equal(scored.maxTotal, 106);
  assert.equal(scored.categories[0].label, rubric.categories[0].label);
});

test('a result cannot exceed a category maximum or score without a verbatim quote', () => {
  const p = scorePacket({ rubric, content: resume });
  const bad = (change, pattern) =>
    assert.throws(() => scoreResult(rubric, resume, result(p, change)), pattern);
  bad(withCategory(p, 'clarity', { score: 16 }), /out of range/);
  bad(withCategory(p, 'clarity', { score: 1.5 }), /out of range/);
  bad(withCategory(p, 'clarity', { evidence: [] }), /quote required/);
  bad(
    withCategory(p, 'clarity', { evidence: ['Led a 40-person platform organisation'] }),
    /not found in resume/,
  );
  bad(withCategory(p, 'clarity', { evidence: ['Built'] }), /too short/);
  bad({ categories: result(p).categories.slice(1) }, /exactly once/);
  bad({ total: 100 }, /Unexpected field/);
  const zero = scoreResult(
    rubric,
    resume,
    result(p, withCategory(p, 'clarity', { score: 0, evidence: [] })),
  );
  assert.equal(zero.base, 30, 'a zero needs no quote');
  const spaced = scoreResult(
    rubric,
    resume,
    result(
      p,
      withCategory(p, 'clarity', { evidence: ['REDUCING failed   checkout\nrequests from 3.1%'] }),
    ),
  );
  assert.equal(spaced.base, 40, 'whitespace and case differences are tolerated');
});

test('bonus points must be listed values with evidence; unknown bonuses are rejected', () => {
  const p = scorePacket({ rubric, content: resume });
  const bad = (bonus, pattern) =>
    assert.throws(() => scoreResult(rubric, resume, result(p, { bonus })), pattern);
  bad([{ key: 'public_work', points: 3, evidence: [quote.delivery] }], /not allowed/);
  bad([{ key: 'public_work', points: 2, evidence: [] }], /quote required/);
  bad([{ key: 'famous_school', points: 2, evidence: [quote.delivery] }], /Unknown/);
  const noDeductions = { ...rubric, deductionMax: 0 };
  const q = scorePacket({ rubric: noDeductions, content: resume });
  assert.throws(
    () =>
      scoreResult(
        noDeductions,
        resume,
        result(q, { deductions: [{ reason: 'Synthetic.', points: 1 }] }),
      ),
    /does not allow deductions/,
  );
});

test('a changed resume or rubric makes earlier results stale', () => {
  const p = scorePacket({ rubric, content: resume });
  assert.throws(
    () => scoreResult(rubric, resume + '\n- Added line.', result(p)),
    /Stale resume binding/,
  );
  const changed = { ...rubric, bonusMax: 5 };
  assert.throws(() => scoreResult(changed, resume, result(p)), /Stale rubric binding/);
});

test('repeated runs report the median run and the observed range', () => {
  const p = scorePacket({ rubric, content: resume });
  const report = scoreResults(
    rubric,
    resume,
    [12, 4, 9].map((score) => result(p, withCategory(p, 'clarity', { score }))),
  );
  assert.equal(report.runs, 3);
  assert.equal(report.total, 39);
  assert.deepEqual(report.totalRange, [34, 42]);
  assert.deepEqual(report.categories.find((c) => c.key === 'clarity').range, [4, 12]);
  assert.equal(
    report.total,
    report.base + report.bonusTotal - report.deductionTotal,
    'the reported run stays internally consistent',
  );
  assert.equal(scoreResults(rubric, resume, result(p)).runs, 1);
  assert.throws(() => aggregate([]), /Provide/);
  assert.throws(
    () =>
      scoreResults(
        rubric,
        resume,
        Array.from({ length: 6 }, () => result(p)),
      ),
    /Provide/,
  );
});

function workspaceWithResume() {
  let s = demoActions().reduce(transition, emptyState());
  s = transition(s, draftAction(s, s.jobs[0].id));
  return s;
}
function quoteFrom(content) {
  return content
    .split('\n')
    .find((line) => line.startsWith('- '))
    .slice(2, 60);
}
function storedAction(s, change = {}) {
  const r = s.resumes[0];
  const p = scorePacket({
    rubric,
    content: r.content,
    source: 'workspace',
    action: { type: 'resumeScore', jobId: r.jobId, version: r.version, rubric },
  });
  const one = {
    ...p.resultShape,
    checkedAt: new Date().toISOString(),
    summary: 'Synthetic scoring run.',
    categories: p.resultShape.categories.map((c) => ({
      ...c,
      score: 5,
      evidence: [quoteFrom(r.content)],
    })),
  };
  return { ...p.actionShape, results: [one], ...change };
}

test('resumeScore saves one record per resume version without touching personal state', () => {
  let s = workspaceWithResume();
  s = transition(s, { type: 'review', jobId: s.jobs[0].id, status: 'shortlisted' });
  const before = structuredClone({
    reviews: s.reviews,
    tasks: s.tasks,
    resumes: s.resumes,
    jobs: s.jobs,
    capabilities: s.capabilities,
    submissions: s.submissions,
  });
  const action = storedAction(s);
  s = transition(s, action);
  assert.equal(s.resumeScores.length, 1);
  assert.equal(s.resumeScores[0].total, 20);
  assert.equal(s.resumeScores[0].maxTotal, 106);
  assert.equal(s.resumeScores[0].rubric.id, rubric.id);
  assert.deepEqual(
    {
      reviews: s.reviews,
      tasks: s.tasks,
      resumes: s.resumes,
      jobs: s.jobs,
      capabilities: s.capabilities,
      submissions: s.submissions,
    },
    before,
  );
  s = transition(s, { ...action, results: [action.results[0], action.results[0]] });
  assert.equal(s.resumeScores.length, 1, 'rescoring the same version replaces the record');
  assert.equal(s.resumeScores[0].runs, 2);
  validateState(structuredClone(s));
});

test('resumeScore rejects unknown versions, client totals and tampered stored records', () => {
  const s = workspaceWithResume();
  const action = storedAction(s);
  assert.throws(() => transition(s, { ...action, version: 9 }), /Unknown resume version/);
  assert.throws(() => transition(s, { ...action, total: 106 }), /Unexpected field/);
  assert.throws(() => transition(s, { ...action, results: [] }), /Provide/);
  assert.throws(
    () =>
      transition(s, {
        ...action,
        results: [
          {
            ...action.results[0],
            categories: action.results[0].categories.map((c) => ({ ...c, score: 99 })),
          },
        ],
      }),
    /out of range/,
  );
  const saved = transition(s, action);
  const tampered = structuredClone(saved);
  tampered.resumeScores[0].total = 106;
  assert.throws(() => validateState(tampered), /Invalid resume score/);
  const orphan = structuredClone(saved);
  orphan.resumeScores[0].version = 7;
  assert.throws(() => validateState(orphan), /Invalid resume score/);
});

test('workspace deltas carry resume scores keyed by job and version', () => {
  const before = workspaceWithResume(),
    after = transition(before, storedAction(before));
  const delta = workspaceDelta(before, after);
  assert.equal(delta.changes.resumeScores.upsert.length, 1);
  assert.deepEqual(mergeWorkspaceDelta(before, delta), after);
});

test('CLI writes a packet outside Git, checks results and never prints resume text', async () => {
  const root = await mkdtemp(join(tmpdir(), 'role-score-'));
  try {
    const run = (args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
    const files = Object.fromEntries(
      ['rubric', 'resume', 'packet', 'results', 'report'].map((k) => [
        k,
        join(root, k + (k === 'resume' ? '.md' : '.json')),
      ]),
    );
    await writeFile(files.rubric, JSON.stringify(rubric));
    await writeFile(files.resume, resume);
    const made = run([
      'resume-score',
      '--rubric',
      files.rubric,
      '--file',
      files.resume,
      '--output',
      files.packet,
    ]);
    assert.equal(made.status, 0, made.stderr);
    assert.ok(!made.stdout.includes('Alex Morgan'));
    const packet = JSON.parse(await readFile(files.packet, 'utf8'));
    await writeFile(files.results, JSON.stringify([result(packet), result(packet)]));
    const checked = run([
      'resume-score-check',
      '--packet',
      files.packet,
      '--file',
      files.results,
      '--output',
      files.report,
    ]);
    assert.equal(checked.status, 0, checked.stderr);
    assert.deepEqual(JSON.parse(checked.stdout), {
      total: 40,
      maxTotal: 106,
      totalRange: [40, 40],
      runs: 2,
    });
    assert.equal(JSON.parse(await readFile(files.report, 'utf8')).categories.length, 4);
    await writeFile(
      files.results,
      JSON.stringify(result(packet, withCategory(packet, 'clarity', { score: 99 }))),
    );
    const rejected = run([
      'resume-score-check',
      '--packet',
      files.packet,
      '--file',
      files.results,
      '--output',
      join(root, 'second.json'),
    ]);
    assert.notEqual(rejected.status, 0);
    assert.ok(!rejected.stderr.includes('Alex Morgan'));
    const inRepo = run([
      'resume-score',
      '--rubric',
      files.rubric,
      '--file',
      files.resume,
      '--output',
      fileURLToPath(new URL('../leak.json', import.meta.url)),
    ]);
    assert.notEqual(inRepo.status, 0, 'output inside the Git checkout must be refused');
    assert.notEqual(
      run(['resume-score', '--rubric', files.rubric, '--output', join(root, 'x.json')]).status,
      0,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('CLI builds a workspace packet whose action saves through the action command', async () => {
  const root = await mkdtemp(join(tmpdir(), 'role-score-ws-'));
  try {
    const run = (args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
    const w = join(root, 'workspace'),
      rubricFile = join(root, 'rubric.json'),
      packetFile = join(root, 'packet.json'),
      actionFile = join(root, 'action.json');
    await writeFile(rubricFile, JSON.stringify(rubric));
    assert.equal(run(['demo', '--workspace', w]).status, 0);
    const state = () => JSON.parse(run(['state', '--workspace', w]).stdout);
    const jobId = state().jobs[0].id;
    const none = run([
      'resume-score',
      '--rubric',
      rubricFile,
      '--workspace',
      w,
      '--job',
      jobId,
      '--output',
      packetFile,
    ]);
    assert.notEqual(none.status, 0, 'a saved resume is required');
    assert.equal(run(['draft', '--workspace', w, '--job', jobId]).status, 0);
    const made = run([
      'resume-score',
      '--rubric',
      rubricFile,
      '--workspace',
      w,
      '--job',
      jobId,
      '--output',
      packetFile,
    ]);
    assert.equal(made.status, 0, made.stderr);
    const packet = JSON.parse(await readFile(packetFile, 'utf8'));
    assert.equal(packet.actionShape.type, 'resumeScore');
    const one = {
      ...packet.resultShape,
      checkedAt: new Date().toISOString(),
      summary: 'Synthetic scoring run.',
      categories: packet.resultShape.categories.map((c) => ({
        ...c,
        score: 3,
        evidence: [quoteFrom(packet.resume.content)],
      })),
    };
    await writeFile(actionFile, JSON.stringify({ ...packet.actionShape, results: [one] }));
    const saved = run(['action', '--workspace', w, '--file', actionFile]);
    assert.equal(saved.status, 0, saved.stderr);
    assert.equal(state().resumeScores[0].total, 12);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

const checkResult = (packet, score = 10) => ({
  ...packet.resultShape,
  checkedAt: new Date().toISOString(),
  summary: 'Synthetic scoring run.',
  categories: packet.resultShape.categories.map((c) => ({
    ...c,
    score,
    evidence: [quote[c.key]],
  })),
});
test('resumeCheck queues an original resume without a job; the agent result completes it', () => {
  let s = demoActions().reduce(transition, emptyState());
  const before = structuredClone({ jobs: s.jobs, reviews: s.reviews, resumes: s.resumes });
  s = transition(s, { type: 'resumeCheck', title: ' Master resume ', content: resume, rubric });
  const check = s.resumeChecks[0];
  assert.equal(check.status, 'queued');
  assert.equal(check.title, 'Master resume');
  assert.equal(check.score, null);
  const packet = workPacket(s, 'shortlist');
  assert.equal(packet.resumeChecks.length, 1);
  assert.deepEqual(packet.resumeChecks[0].packet.actionShape, {
    type: 'resumeCheckResult',
    id: check.id,
    results: [],
  });
  assert.ok(checkWork(s, packet).issues.some((i) => i.code === 'resume_check_pending'));
  const results = [8, 10].map((n) => checkResult(packet.resumeChecks[0].packet, n));
  s = transition(s, { ...packet.resumeChecks[0].packet.actionShape, results });
  assert.equal(s.resumeChecks[0].status, 'completed');
  assert.equal(s.resumeChecks[0].score.total, 32);
  assert.deepEqual(s.resumeChecks[0].score.totalRange, [32, 40]);
  assert.ok(!checkWork(s, packet).issues.some((i) => i.code === 'resume_check_pending'));
  assert.equal(workPacket(s, 'shortlist').resumeChecks.length, 0);
  assert.deepEqual({ jobs: s.jobs, reviews: s.reviews, resumes: s.resumes }, before);
  validateState(structuredClone(s));
  s = transition(s, { type: 'resumeCheckRemove', id: check.id });
  assert.equal(s.resumeChecks.length, 0);
});

test('resume checks reject bad input, unknown ids, forged scores and unbounded growth', () => {
  let s = demoActions().reduce(transition, emptyState());
  const add = { type: 'resumeCheck', title: 'Master resume', content: resume, rubric };
  assert.throws(() => transition(s, { ...add, title: ' ' }), /title/);
  assert.throws(() => transition(s, { ...add, content: '%PDF-1.7' }), /plain text/);
  assert.throws(() => transition(s, { ...add, rubric: { ...rubric, categories: [] } }), /categor/);
  assert.throws(() => transition(s, { ...add, score: { total: 99 } }), /Unexpected field/);
  assert.throws(
    () => transition(s, { type: 'resumeCheckResult', id: 'missing', results: [] }),
    /Unknown resume check/,
  );
  assert.throws(() => transition(s, { type: 'resumeCheckRemove', id: 'missing' }), /Unknown/);
  s = transition(s, add);
  const packet = workPacket(s, 'shortlist').resumeChecks[0].packet;
  assert.throws(
    () =>
      transition(s, {
        type: 'resumeCheckResult',
        id: s.resumeChecks[0].id,
        results: [{ ...checkResult(packet), resumeHash: 'f'.repeat(64) }],
      }),
    /Stale resume binding/,
  );
  const forged = structuredClone(
    transition(s, {
      type: 'resumeCheckResult',
      id: s.resumeChecks[0].id,
      results: [checkResult(packet)],
    }),
  );
  forged.resumeChecks[0].score.total = 105;
  assert.throws(() => validateState(forged), /Invalid resume score/);
  const queuedWithScore = structuredClone(s);
  queuedWithScore.resumeChecks[0].status = 'completed';
  assert.throws(() => validateState(queuedWithScore), /Invalid resume check/);
  for (let i = 1; i < 20; i++) s = transition(s, add);
  assert.throws(() => transition(s, add), /Too many/);
  const delta = workspaceDelta(emptyState(), s);
  assert.equal(delta.changes.resumeChecks.upsert.length, 20);
});

test('CLI writes a packet for a queued resume check and saves its result', async () => {
  const root = await mkdtemp(join(tmpdir(), 'role-check-'));
  try {
    const run = (args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
    const w = join(root, 'workspace'),
      file = (name) => join(root, name);
    assert.equal(run(['demo', '--workspace', w]).status, 0);
    await writeFile(
      file('add.json'),
      JSON.stringify({ type: 'resumeCheck', title: 'Master resume', content: resume, rubric }),
    );
    assert.equal(run(['action', '--workspace', w, '--file', file('add.json')]).status, 0);
    const state = () => JSON.parse(run(['state', '--workspace', w]).stdout);
    const id = state().resumeChecks[0].id;
    const made = run([
      'resume-score',
      '--workspace',
      w,
      '--check',
      id,
      '--output',
      file('packet.json'),
    ]);
    assert.equal(made.status, 0, made.stderr);
    assert.notEqual(
      run(['resume-score', '--workspace', w, '--check', 'nope', '--output', file('x.json')]).status,
      0,
    );
    const packet = JSON.parse(await readFile(file('packet.json'), 'utf8'));
    await writeFile(
      file('result.json'),
      JSON.stringify({ ...packet.actionShape, results: [checkResult(packet)] }),
    );
    const saved = run(['action', '--workspace', w, '--file', file('result.json')]);
    assert.equal(saved.status, 0, saved.stderr);
    assert.equal(state().resumeChecks[0].score.total, 40);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
