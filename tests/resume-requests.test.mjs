import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, transition } from '../src/workbench.mjs';
import { demoActions } from '../src/demo.mjs';
import { draftAction } from '../src/resume.mjs';
import { workPacket, checkWork } from '../src/agent-workflow.mjs';
test('resume requests queue without confirming claims or creating a draft, dedupe and enter agent packet', () => {
  let s = demoActions().reduce(transition, emptyState());
  const id = s.jobs[0].id;
  s.capabilities.forEach((c) => (c.status = 'proposed'));
  const before = structuredClone({
    reviews: s.reviews,
    tasks: s.tasks,
    capabilities: s.capabilities,
    resumes: s.resumes,
  });
  s = transition(s, { type: 'requestResume', jobId: id });
  const request = s.resumeRequests[0];
  assert.equal(request.status, 'queued');
  s = transition(s, { type: 'requestResume', jobId: id });
  assert.equal(s.resumeRequests.length, 1);
  assert.deepEqual(
    { reviews: s.reviews, tasks: s.tasks, capabilities: s.capabilities, resumes: s.resumes },
    before,
  );
  assert.equal(workPacket(s, 'shortlist').resumeRequests[0].id, request.id);
  assert.ok(
    checkWork(s, workPacket(s, 'shortlist')).issues.some(
      (i) => i.code === 'resume_request_pending',
    ),
  );
  assert.throws(
    () =>
      transition(s, {
        type: 'resumeRequestStatus',
        id: request.id,
        status: 'completed',
        resumeVersion: 1,
      }),
    /resume|draft/i,
  );
  s = transition(s, {
    type: 'resumeRequestStatus',
    id: request.id,
    status: 'blocked',
    note: 'Confirm the personal contribution in the cited project.',
  });
  assert.equal(s.resumeRequests[0].status, 'blocked');
  s = transition(s, { type: 'requestResume', jobId: id });
  assert.equal(s.resumeRequests[0].status, 'queued');
  s = transition(s, { type: 'resumeRequestStatus', id: request.id, status: 'canceled' });
  assert.equal(workPacket(s, 'shortlist').resumeRequests.length, 0);
});
test('completion needs a new current resume and preserves user approval and decisions', () => {
  let s = demoActions().reduce(transition, emptyState());
  const id = s.jobs[0].id;
  s = transition(s, { type: 'requestResume', jobId: id });
  const request = s.resumeRequests[0];
  s = transition(s, draftAction(s, id));
  s = transition(s, {
    type: 'resumeRequestStatus',
    id: request.id,
    status: 'completed',
    resumeVersion: 1,
  });
  assert.equal(s.resumeRequests[0].resumeVersion, 1);
  assert.equal(s.resumes[0].reviewStatus, 'pending');
  assert.notEqual(s.reviews[id]?.status, 'applied');
  s = transition(s, { type: 'requestResume', jobId: id });
  const next = s.resumeRequests[1];
  assert.throws(
    () =>
      transition(s, {
        type: 'resumeRequestStatus',
        id: next.id,
        status: 'completed',
        resumeVersion: 1,
      }),
    /resume|draft/i,
  );
  const old = structuredClone(s.resumeRequests);
  s = transition(s, { type: 'research', run: { id: 'preserve-requests', coverage: [] }, jobs: [] });
  assert.deepEqual(s.resumeRequests, old);
});
