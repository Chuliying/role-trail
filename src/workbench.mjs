import { artifactHash, artifactId, attachPDF, researchArtifact } from './artifacts.mjs';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, unlink, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { positiveFresh, canonical } from '../web/status.mjs';
import { validateSchedule } from './schedule-config.mjs';
import { privateWorkspace, validateProfile, validateFeeds } from './onboarding.mjs';
export const hash = (x) =>
  createHash('sha256')
    .update(typeof x === 'string' ? x : JSON.stringify(canonical(x)))
    .digest('hex');
export const now = () => new Date().toISOString();
export const object = (x) => x && typeof x === 'object' && !Array.isArray(x);
export function text(x, max = 10000) {
  if (typeof x !== 'string' || x.length > max) throw Error('Invalid text');
  return x;
}
export function safeURL(x) {
  const u = new URL(text(x, 8000));
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password)
    throw Error('Invalid URL');
  return u.href;
}
const date = (x, allowDay = false) => {
  if (
    typeof x !== 'string' ||
    (!/^\d{4}-\d\d-\d\dT/.test(x) && !(allowDay && /^\d{4}-\d\d-\d\d$/.test(x))) ||
    !Number.isFinite(Date.parse(x))
  )
    throw Error('Invalid timestamp');
  return x;
};
function keys(x, allowed) {
  if (!object(x) || Object.keys(x).some((k) => !allowed.includes(k)))
    throw Error('Unexpected field');
}
const profileHash = (p) => hash(p);
const capabilityHash = (s, ids) => hash(ids.map((id) => s.capabilities.find((c) => c.id === id)));
function profileCheck(p) {
  keys(p, [
    'schemaVersion',
    'name',
    'location',
    'remotePolicy',
    'timezone',
    'ownershipPolicy',
    'targetRoles',
    'languages',
    'platforms',
    'portfolio',
    'resumeSource',
    'confirmedCapabilities',
    'createdAt',
    'feeds',
    'searchNotes',
    'requiredChecks',
  ]);
  validateProfile(p);
  validateFeeds(p.feeds);
}
const statuses = ['review', 'shortlisted', 'applied', 'passed'];
export const emptyState = () => ({
  schemaVersion: 1,
  revision: 0,
  updatedAt: null,
  profile: null,
  capabilities: [],
  jobs: [],
  reviews: {},
  submissions: [],
  tasks: [],
  resumes: [],
  preparations: [],
  runs: [],
  schedule: null,
});
function fact(f, availability = false) {
  if (!f) return { status: 'unknown', source: null, evidence: '', checkedAt: null };
  keys(f, ['status', 'source', 'evidence', 'checkedAt']);
  if (
    !(availability ? ['open', 'closed', 'unknown'] : ['confirmed', 'excluded', 'unknown']).includes(
      f.status,
    )
  )
    throw Error('Invalid fact');
  if (f.status !== 'unknown') {
    safeURL(f.source);
    if (!text(f.evidence).trim()) throw Error('Evidence required');
    date(f.checkedAt, true);
    if (Date.parse(f.checkedAt) > Date.now() + 60000) throw Error('Future evidence');
  }
  return {
    status: f.status,
    source: f.source ? safeURL(f.source) : null,
    evidence: text(f.evidence || ''),
    checkedAt: f.checkedAt ? date(f.checkedAt, true) : null,
  };
}
function preserveFact(old, f) {
  if (!old) return f;
  if (old.checkedAt && (!f.checkedAt || Date.parse(f.checkedAt) < Date.parse(old.checkedAt)))
    return old;
  if (['closed', 'excluded'].includes(old.status) && f.status === 'unknown') return old;
  return f;
}
export function normalizeJob(j) {
  keys(j, [
    'id',
    'company',
    'title',
    'url',
    'source',
    'sourceURL',
    'description',
    'descriptionKind',
    'descriptionCheckedAt',
    'posting',
    'remoteMode',
    'location',
    'availability',
    'checks',
    'searchedAt',
    'firstSeenAt',
    'salary',
    'expiresAt',
  ]);
  const url = safeURL(j.url);
  const identityURL = new URL(url);
  for (const key of [...identityURL.searchParams.keys()])
    if (key.startsWith('utm_')) identityURL.searchParams.delete(key);
  const id = hash(identityURL.href).slice(0, 24);
  if (!text(j.company, 500).trim() || !text(j.title, 500).trim() || !text(j.source, 100).trim())
    throw Error('Job identity required');
  const checks = j.checks || [];
  if (!Array.isArray(checks) || checks.length > 20) throw Error('Invalid checks');
  const checkIds = new Set();
  for (const c of checks) {
    keys(c, ['key', 'label', 'status', 'source', 'evidence', 'checkedAt']);
    if (!/^[a-z][a-z0-9_-]{0,49}$/.test(c.key) || checkIds.has(c.key))
      throw Error('Invalid check key');
    checkIds.add(c.key);
    text(c.label, 200);
  }
  const posting = j.posting || { date: null, kind: 'unknown', raw: '' };
  keys(posting, ['date', 'kind', 'raw']);
  if (
    !['posted', 'updated', 'reposted', 'unknown'].includes(posting.kind) ||
    (posting.date && !/^\d{4}-\d\d-\d\d$/.test(posting.date))
  )
    throw Error('Invalid posting');
  text(posting.raw || '');
  if (!['full', 'excerpt', 'summary', 'unknown'].includes(j.descriptionKind || 'unknown'))
    throw Error('Invalid description kind');
  if (!['remote', 'hybrid', 'onsite', 'unknown'].includes(j.remoteMode || 'unknown'))
    throw Error('Invalid remote mode');
  return {
    id,
    company: j.company,
    title: j.title,
    url,
    source: j.source,
    sourceURL: j.sourceURL ? safeURL(j.sourceURL) : url,
    description: text(j.description || '', 150000),
    descriptionKind: j.descriptionKind || 'unknown',
    descriptionCheckedAt: j.descriptionCheckedAt
      ? date(j.descriptionCheckedAt)
      : j.description
        ? j.searchedAt
          ? date(j.searchedAt)
          : now()
        : null,
    posting,
    remoteMode: j.remoteMode || 'unknown',
    location: text(j.location || '', 1000),
    salary: text(j.salary || '', 1000),
    availability: fact(j.availability, true),
    checks: checks.map((c) => ({
      key: c.key,
      label: c.label,
      ...fact(
        Object.fromEntries(['status', 'source', 'evidence', 'checkedAt'].map((k) => [k, c[k]])),
      ),
    })),
    searchedAt: j.searchedAt ? date(j.searchedAt) : now(),
    firstSeenAt: j.firstSeenAt ? date(j.firstSeenAt) : now(),
    expiresAt: j.expiresAt ? date(j.expiresAt) : null,
  };
}
export const jdHash = (j) => hash([j.company, j.title, j.description]);
export const assessmentClaims = (s) =>
  s.capabilities
    .filter((c) => c.status === 'confirmed')
    .map(({ id, claim, tags, evidence, status }) => ({ id, claim, tags, evidence, status }));
export const assessmentBinding = (s, j) => ({
  jdHash: jdHash(j),
  profileHash: profileHash(s.profile),
  capabilityHash: hash(assessmentClaims(s)),
});
const matchesBinding = (s, j, binding) => {
  const current = assessmentBinding(s, j);
  return binding && Object.keys(current).every((k) => binding[k] === current[k]);
};
export function jobStatus(j, review = {}) {
  if (
    review.archived ||
    j.availability.status === 'closed' ||
    (j.expiresAt && Date.parse(j.expiresAt) < Date.now()) ||
    j.checks.some((c) => c.status === 'excluded')
  )
    return 'archived';
  return j.checks.length &&
    j.checks.every((c) => positiveFresh(c)) &&
    positiveFresh(j.availability, 7)
    ? 'verified'
    : 'needs_review';
}
export function validateState(s) {
  keys(s, [
    'migration',
    'schemaVersion',
    'revision',
    'updatedAt',
    'profile',
    'capabilities',
    'jobs',
    'reviews',
    'submissions',
    'tasks',
    'resumes',
    'preparations',
    'resumeRequests',
    'runs',
    'schedule',
  ]);
  if (s.schemaVersion !== 1 || !Number.isSafeInteger(s.revision) || s.revision < 0)
    throw Error('Invalid state version');
  for (const k of ['capabilities', 'jobs', 'tasks', 'resumes', 'runs'])
    if (!Array.isArray(s[k])) throw Error('Invalid collection');
  if (!object(s.reviews)) throw Error('Invalid reviews');
  if (s.profile) profileCheck(s.profile);
  const ids = new Set();
  for (const j of s.jobs) {
    const { assessment, ...base } = j;
    const n = normalizeJob(base);
    if (n.id !== j.id || ids.has(j.id)) throw Error('Invalid job ID');
    ids.add(j.id);
    if (assessment) {
      validateAssessment(assessment);
      if (!matchesBinding(s, j, assessment.binding)) assessment.stale = true;
    }
  }
  for (const [id, r] of Object.entries(s.reviews)) {
    if (!ids.has(id) || !statuses.includes(r.status) || typeof r.archived !== 'boolean')
      throw Error('Invalid review');
  }
  if (s.submissions !== undefined) {
    if (!Array.isArray(s.submissions)) throw Error('Invalid submissions');
    const seen = new Set();
    for (const entry of s.submissions) {
      keys(entry, ['jobId', 'recordedAt', 'source']);
      if (
        !ids.has(entry.jobId) ||
        seen.has(entry.jobId) ||
        !['manual', 'legacy'].includes(entry.source)
      )
        throw Error('Invalid submission');
      if (entry.recordedAt !== null || entry.source !== 'legacy') date(entry.recordedAt);
      seen.add(entry.jobId);
    }
  }
  if (s.resumeRequests !== undefined) {
    if (!Array.isArray(s.resumeRequests)) throw Error('Invalid resume requests');
    const seen = new Set();
    for (const r of s.resumeRequests) {
      keys(r, [
        'id',
        'jobId',
        'status',
        'note',
        'createdAt',
        'updatedAt',
        'baseVersion',
        'resumeVersion',
      ]);
      if (
        !text(r.id, 100) ||
        seen.has(r.id) ||
        !ids.has(r.jobId) ||
        !['queued', 'blocked', 'completed', 'canceled'].includes(r.status) ||
        !Number.isSafeInteger(r.baseVersion) ||
        r.baseVersion < 0
      )
        throw Error('Invalid resume request');
      text(r.note, 4000);
      date(r.createdAt);
      date(r.updatedAt);
      seen.add(r.id);
      if (
        r.status === 'completed' &&
        (!Number.isSafeInteger(r.resumeVersion) ||
          r.resumeVersion <= r.baseVersion ||
          !s.resumes.some((x) => x.jobId === r.jobId && x.version === r.resumeVersion))
      )
        throw Error('Invalid request resume');
    }
  }
  for (const t of s.tasks)
    if (
      (t.jobId !== null && !ids.has(t.jobId)) ||
      (t.jobIds && (!Array.isArray(t.jobIds) || t.jobIds.some((id) => !ids.has(id)))) ||
      typeof t.done !== 'boolean' ||
      !text(t.text, 4000).trim() ||
      typeof t.id !== 'string'
    )
      throw Error('Invalid task');
  for (const c of s.capabilities) {
    if (
      !text(c.id, 100) ||
      !text(c.claim, 4000) ||
      !Array.isArray(c.tags) ||
      c.tags.some((t) => typeof t !== 'string') ||
      !Array.isArray(c.evidence) ||
      c.evidence.some((t) => typeof t !== 'string') ||
      !['proposed', 'confirmed', 'rejected'].includes(c.status)
    )
      throw Error('Invalid capability');
  }
  for (const r of s.resumes) {
    if (
      !ids.has(r.jobId) ||
      !Number.isInteger(r.version) ||
      typeof r.content !== 'string' ||
      !Array.isArray(r.capabilityIds) ||
      !Array.isArray(r.adjustments) ||
      !['pending', 'approved', 'changes_requested'].includes(r.reviewStatus)
    )
      throw Error('Invalid resume');
    if (
      r.pdfHash !== undefined &&
      (!/^[a-f0-9]{64}$/.test(r.pdfHash) ||
        !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,110}\.pdf$/.test(r.pdfFilename || '') ||
        !Number.isInteger(r.pdfBytes) ||
        r.pdfBytes < 100 ||
        r.pdfBytes > 2_000_000)
    )
      throw Error('Invalid PDF reference');
  }
  if (s.preparations !== undefined) {
    if (!Array.isArray(s.preparations)) throw Error('Invalid preparations');
    const versions = new Set();
    for (const p of s.preparations) {
      if (
        !ids.has(p.jobId) ||
        !Number.isInteger(p.version) ||
        p.version < 1 ||
        !s.resumes.some((r) => r.jobId === p.jobId && r.version === p.resumeVersion) ||
        !Array.isArray(p.capabilityIds) ||
        !p.capabilityIds.length ||
        !Array.isArray(p.evidence) ||
        p.evidence.length !== p.capabilityIds.length ||
        !text(p.content, 100000).trim()
      )
        throw Error('Invalid preparation');
      if (
        p.evidence.some(
          (c, i) =>
            c.id !== p.capabilityIds[i] || c.status !== 'confirmed' || !Array.isArray(c.evidence),
        )
      )
        throw Error('Invalid preparation evidence');
      for (const key of ['jdHash', 'resumeContentHash', 'capabilityHash'])
        if (!/^[a-f0-9]{64}$/.test(p[key] || '')) throw Error('Invalid preparation binding');
      if (hash(p.evidence) !== p.capabilityHash) throw Error('Invalid preparation evidence hash');
      date(p.createdAt);
      const key = p.jobId + ':' + p.version;
      if (versions.has(key)) throw Error('Duplicate preparation');
      versions.add(key);
    }
  }
  for (const r of s.runs) validateRun(r);
  if (s.schedule !== null) validateSchedule(s.schedule);
  if (s.updatedAt !== null) date(s.updatedAt);
  for (const key of ['capabilities', 'tasks', 'runs'])
    if (new Set(s[key].map((x) => x.id)).size !== s[key].length) throw Error('Duplicate ID');
  if (Buffer.byteLength(JSON.stringify(s)) > 15_000_000) throw Error('Workspace too large');
  return s;
}
function validateRun(r) {
  if (!object(r) || !text(r.id, 100) || !Array.isArray(r.coverage)) throw Error('Invalid run');
  for (const c of r.coverage) {
    if (
      !text(c.source, 100) ||
      !['searched', 'partial', 'blocked', 'not_run', 'empty'].includes(c.status) ||
      !text(c.query, 500) ||
      !text(c.note, 5000)
    )
      throw Error('Invalid coverage');
    for (const k of ['screened', 'fullJd'])
      if (!Number.isInteger(c[k]) || c[k] < 0) throw Error('Invalid coverage count');
    if (c.fullJd > c.screened) throw Error('Invalid coverage depth');
  }
}
function validateAssessment(a) {
  keys(a, ['score', 'reason', 'evidence', 'gaps', 'checkedAt', 'stale', 'binding']);
  if (a.stale !== undefined && typeof a.stale !== 'boolean')
    throw Error('Invalid assessment state');
  if (
    !Number.isInteger(a.score) ||
    a.score < 1 ||
    a.score > 10 ||
    !text(a.reason, 5000).trim() ||
    !Array.isArray(a.evidence) ||
    !a.evidence.length ||
    a.evidence.some((e) => !text(e, 1000).trim()) ||
    !Array.isArray(a.gaps) ||
    a.gaps.some((g) => typeof g !== 'string')
  )
    throw Error('Assessment requires score and evidence');
  date(a.checkedAt);
  if (a.binding !== undefined) {
    keys(a.binding, ['jdHash', 'profileHash', 'capabilityHash']);
    if (
      ['jdHash', 'profileHash', 'capabilityHash'].some(
        (k) => !/^[a-f0-9]{64}$/.test(a.binding[k] || ''),
      )
    )
      throw Error('Invalid assessment binding');
  }
}
export function transition(current, a) {
  const s = structuredClone(current);
  s.submissions ||= [];
  // Preserve explicit legacy Applied decisions before any action can overwrite them.
  // recordedAt is when we retained the record, not an inferred application date.
  for (const [jobId, review] of Object.entries(s.reviews)) {
    if (review.status === 'applied' && !s.submissions.some((x) => x.jobId === jobId))
      s.submissions.push({ jobId, recordedAt: now(), source: 'legacy' });
  }
  const invalidateScores = () => {
    for (const j of s.jobs) if (j.assessment) j.assessment.stale = true;
  };
  if (!object(a)) throw Error('Invalid action');
  const job = () => {
    const j = s.jobs.find((j) => j.id === a.jobId);
    if (!j) throw Error('Unknown job');
    return j;
  };
  if (a.type === 'research') {
    keys(a, ['type', 'run', 'jobs']);
    validateRun(a.run);
    const contentHash = hash(canonical({ run: a.run, jobs: a.jobs }));
    const previousRun = s.runs.find((r) => r.id === a.run.id);
    if (previousRun) {
      if (previousRun.contentHash === contentHash) return current;
      throw Error('Duplicate run ID with different or unrecorded content');
    }
    if (!Array.isArray(a.jobs) || a.jobs.length > 500) throw Error('Invalid jobs');
    const existingIds = new Set(s.jobs.map((j) => j.id));
    for (const raw of a.jobs) {
      const j = normalizeJob(raw),
        old = s.jobs.find((x) => x.id === j.id);
      if (old) {
        if (Date.parse(j.searchedAt) < Date.parse(old.searchedAt)) {
          for (const k of [
            'company',
            'title',
            'description',
            'descriptionKind',
            'descriptionCheckedAt',
            'source',
            'sourceURL',
            'posting',
            'remoteMode',
            'location',
            'salary',
            'expiresAt',
          ])
            j[k] = old[k];
        } else if (
          !j.description ||
          (old.descriptionKind === 'full' && j.descriptionKind !== 'full')
        ) {
          for (const k of [
            'description',
            'descriptionKind',
            'descriptionCheckedAt',
            'source',
            'sourceURL',
          ])
            j[k] = old[k];
        }
        j.availability = preserveFact(old.availability, j.availability);
        const all = new Map(old.checks.map((c) => [c.key, c]));
        for (const c of j.checks)
          all.set(c.key, { key: c.key, label: c.label, ...preserveFact(all.get(c.key), c) });
        j.checks = [...all.values()];
        j.firstSeenAt = old.firstSeenAt;
        if (old.assessment)
          j.assessment = {
            ...old.assessment,
            stale: !!old.assessment.stale || jdHash(j) !== jdHash(old),
          };
        if (Date.parse(j.searchedAt) < Date.parse(old.searchedAt)) j.searchedAt = old.searchedAt;
        s.jobs[s.jobs.indexOf(old)] = j;
      } else s.jobs.push(j);
    }
    s.runs.push({
      ...a.run,
      contentHash,
      finishedAt: a.run.finishedAt || now(),
      observations: [...new Set(a.jobs.map((raw) => normalizeJob(raw).id))].map((id) => {
        const j = s.jobs.find((j) => j.id === id);
        return {
          id: j.id,
          discovered: !existingIds.has(j.id),
          url: j.url,
          company: j.company,
          title: j.title,
          checks: j.checks,
          availability: j.availability,
        };
      }),
    });
  } else if (a.type === 'profile') {
    keys(a, ['type', 'profile']);
    profileCheck(a.profile);
    if (hash(s.profile) !== hash(a.profile)) invalidateScores();
    s.profile = structuredClone(a.profile);
  } else if (a.type === 'review' || a.type === 'archive') {
    keys(a, ['type', 'jobId', a.type === 'review' ? 'status' : 'archived']);
    job();
    const r = s.reviews[a.jobId] || { status: 'review', archived: false };
    if (a.type === 'review') {
      if (!statuses.includes(a.status)) throw Error('Invalid decision');
      r.status = a.status;
      if (a.status === 'applied' && !s.submissions.some((x) => x.jobId === a.jobId))
        s.submissions.push({ jobId: a.jobId, recordedAt: now(), source: 'manual' });
    } else {
      if (typeof a.archived !== 'boolean') throw Error('Invalid archive');
      r.archived = a.archived;
    }
    s.reviews[a.jobId] = { ...r, updatedAt: now() };
  } else if (a.type === 'requestResume') {
    keys(a, ['type', 'jobId']);
    job();
    s.resumeRequests ||= [];
    const existing = s.resumeRequests.find(
      (r) => r.jobId === a.jobId && ['queued', 'blocked'].includes(r.status),
    );
    if (existing?.status === 'queued') return validateState(s);
    if (existing) {
      existing.status = 'queued';
      existing.note = '';
      existing.updatedAt = now();
    } else
      s.resumeRequests.push({
        id: randomUUID(),
        jobId: a.jobId,
        status: 'queued',
        note: '',
        createdAt: now(),
        updatedAt: now(),
        baseVersion: Math.max(
          0,
          ...s.resumes.filter((r) => r.jobId === a.jobId).map((r) => r.version),
        ),
        resumeVersion: null,
      });
  } else if (a.type === 'resumeRequestStatus') {
    keys(a, ['type', 'id', 'status', 'note', 'resumeVersion']);
    const request = s.resumeRequests?.find((r) => r.id === a.id);
    if (
      !request ||
      !['queued', 'blocked'].includes(request.status) ||
      !['blocked', 'completed', 'canceled'].includes(a.status)
    )
      throw Error('Invalid resume request update');
    const note = text(a.note || '', 4000);
    if (a.status === 'blocked' && !note.trim()) throw Error('Blocked request needs a reason');
    if (a.status === 'completed') {
      const r = s.resumes.find((r) => r.jobId === request.jobId && r.version === a.resumeVersion);
      if (
        !r ||
        r.version <= request.baseVersion ||
        resumeStale(s, r) ||
        !r.adjustments?.length ||
        !r.content.trim()
      )
        throw Error('Save a new current resume draft with adjustments first');
      request.resumeVersion = r.version;
    }
    request.status = a.status;
    request.note = note;
    request.updatedAt = now();
  } else if (a.type === 'task') {
    keys(a, ['type', 'id', 'jobId', 'text', 'done']);
    if (a.jobId !== null) job();
    if (typeof a.done !== 'boolean') throw Error('Invalid task');
    const old = s.tasks.find((t) => t.id === a.id);
    if (a.id && !old) throw Error('Unknown task');
    if (old && old.jobId !== a.jobId) throw Error('Task job mismatch');
    const t = {
      ...old,
      status: a.done ? 'done' : 'pending',
      id: old?.id || randomUUID(),
      jobId: a.jobId,
      text: text(a.text || old?.text, 4000),
      done: a.done,
    };
    if (!t.text.trim()) throw Error('Empty task');
    if (old) s.tasks[s.tasks.indexOf(old)] = t;
    else s.tasks.push(t);
  } else if (a.type === 'assessment') {
    keys(a, ['type', 'jobId', 'score', 'reason', 'evidence', 'gaps', 'checkedAt', 'binding']);
    const { type, jobId, ...v } = a;
    validateAssessment(v);
    if (!matchesBinding(s, job(), v.binding))
      throw Error('Stale assessment binding; evaluate current sources again');
    job().assessment = { ...v, stale: false };
  } else if (a.type === 'capability') {
    keys(a, ['type', 'id', 'claim', 'tags', 'evidence', 'status']);
    if (
      !['proposed', 'confirmed', 'rejected'].includes(a.status) ||
      !text(a.claim, 4000).trim() ||
      !Array.isArray(a.tags) ||
      !Array.isArray(a.evidence) ||
      !a.evidence.length
    )
      throw Error('Capability evidence required');
    a.tags.forEach((x) => text(x, 200));
    a.evidence.forEach((x) => text(x, 1000));
    const c = {
      id: a.id || randomUUID(),
      claim: a.claim,
      tags: a.tags,
      evidence: a.evidence,
      status: a.status,
      updatedAt: now(),
    };
    const i = s.capabilities.findIndex((x) => x.id === c.id);
    invalidateScores();
    if (i < 0) s.capabilities.push(c);
    else s.capabilities[i] = c;
  } else if (a.type === 'resume') {
    keys(a, ['type', 'jobId', 'content', 'capabilityIds', 'adjustments', 'jdHash']);
    const j = job();
    if (a.jdHash !== jdHash(j)) throw Error('Stale JD binding');
    if (
      !Array.isArray(a.capabilityIds) ||
      !a.capabilityIds.length ||
      a.capabilityIds.some(
        (id) => !s.capabilities.some((c) => c.id === id && c.status === 'confirmed'),
      )
    )
      throw Error('Confirmed capability required');
    if (!Array.isArray(a.adjustments) || a.adjustments.some((x) => typeof x !== 'string'))
      throw Error('Invalid adjustments');
    s.resumes.push({
      jobId: j.id,
      version: Math.max(0, ...s.resumes.filter((r) => r.jobId === j.id).map((r) => r.version)) + 1,
      content: text(a.content, 100000),
      capabilityIds: a.capabilityIds,
      capabilityHash: capabilityHash(s, a.capabilityIds),
      profileHash: profileHash(s.profile),
      adjustments: a.adjustments,
      jdHash: a.jdHash,
      reviewStatus: 'pending',
      createdAt: now(),
    });
  } else if (a.type === 'resumeReview') {
    keys(a, ['type', 'jobId', 'version', 'status']);
    job();
    const r = s.resumes.find((r) => r.jobId === a.jobId && r.version === a.version);
    if (!r || !['approved', 'changes_requested'].includes(a.status))
      throw Error('Invalid resume review');
    if (resumeStale(s, r)) throw Error('Resume is stale');
    r.reviewStatus = a.status;
  } else if (a.type === 'preparation') {
    keys(a, [
      'type',
      'jobId',
      'jdHash',
      'resumeVersion',
      'resumeContentHash',
      'capabilityIds',
      'content',
    ]);
    const j = job();
    const r = s.resumes.filter((r) => r.jobId === j.id).sort((a, b) => b.version - a.version)[0];
    if (
      !r ||
      r.version !== a.resumeVersion ||
      a.jdHash !== jdHash(j) ||
      a.resumeContentHash !== hash(r.content) ||
      resumeStale(s, r)
    )
      throw Error('Stale preparation binding');
    if (
      !Array.isArray(a.capabilityIds) ||
      !a.capabilityIds.length ||
      new Set(a.capabilityIds).size !== a.capabilityIds.length ||
      a.capabilityIds.some(
        (id) => !s.capabilities.some((c) => c.id === id && c.status === 'confirmed'),
      )
    )
      throw Error('Confirmed capability evidence required');
    const content = text(a.content, 100000);
    if (!content.trim()) throw Error('Preparation content required');
    s.preparations ||= [];
    s.preparations.push({
      jobId: j.id,
      version:
        Math.max(0, ...s.preparations.filter((p) => p.jobId === j.id).map((p) => p.version)) + 1,
      jdHash: a.jdHash,
      resumeVersion: r.version,
      resumeContentHash: a.resumeContentHash,
      capabilityIds: a.capabilityIds,
      capabilityHash: capabilityHash(s, a.capabilityIds),
      evidence: structuredClone(
        a.capabilityIds.map((id) => s.capabilities.find((c) => c.id === id)),
      ),
      content,
      createdAt: now(),
    });
  } else if (a.type === 'schedule') {
    keys(a, ['type', 'schedule']);
    if (a.schedule !== null) validateSchedule(a.schedule);
    s.schedule = a.schedule;
  } else throw Error('Unknown action');
  s.revision++;
  s.updatedAt = now();
  return validateState(s);
}
export function resumeStale(s, r) {
  const j = s.jobs.find((j) => j.id === r.jobId);
  if (r.bindingKind === 'legacy') return !j || r.jdHash !== jdHash(j);
  return (
    !j ||
    r.jdHash !== jdHash(j) ||
    r.profileHash !== profileHash(s.profile) ||
    r.capabilityHash !== capabilityHash(s, r.capabilityIds) ||
    r.capabilityIds.some(
      (id) => !s.capabilities.some((c) => c.id === id && c.status === 'confirmed'),
    )
  );
}
export function preparationStale(s, p) {
  const j = s.jobs.find((j) => j.id === p.jobId);
  const r = s.resumes.filter((r) => r.jobId === p.jobId).sort((a, b) => b.version - a.version)[0];
  if (p.bindingKind === 'legacy')
    return (
      !j ||
      !r ||
      p.jdHash !== jdHash(j) ||
      p.resumeVersion !== r.version ||
      p.resumePdfHash !== r.pdfHash ||
      resumeStale(s, r)
    );
  return (
    !j ||
    !r ||
    p.jdHash !== jdHash(j) ||
    p.resumeVersion !== r.version ||
    p.resumeContentHash !== hash(r.content) ||
    resumeStale(s, r) ||
    p.capabilityHash !== capabilityHash(s, p.capabilityIds)
  );
}
export class LocalStore {
  constructor(dir) {
    this.dir = dir;
  }
  async directory() {
    const dir = await privateWorkspace(this.dir);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    return dir;
  }
  async read() {
    const dir = await this.directory(),
      file = join(dir, 'workspace.json');
    try {
      const stat = await lstat(file);
      if (stat.isSymbolicLink() || !stat.isFile()) throw Error('Invalid state file');
      return validateState(JSON.parse(await readFile(file, 'utf8')));
    } catch (e) {
      if (e.code === 'ENOENT') return emptyState();
      throw e;
    }
  }
  async update(revision, action) {
    return this.mutate(revision, async (s) => {
      const next = transition(s, action),
        bytes = researchArtifact(action);
      if (bytes && next !== s) {
        const id = await this.putArtifact(bytes);
        next.runs.find((r) => r.id === action.run.id).archiveHash = id;
      }
      return next;
    });
  }
  async putArtifact(bytes) {
    const dir = join(await this.directory(), 'artifacts');
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const id = artifactHash(bytes);
    try {
      await writeFile(join(dir, id), bytes, { flag: 'wx', mode: 0o600 });
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      if (artifactHash(await readFile(join(dir, id))) !== id) throw Error('Artifact corruption');
    }
    return id;
  }
  async getArtifact(id) {
    return readFile(join(await this.directory(), 'artifacts', artifactId(id)));
  }
  async savePDF(revision, input, pdf) {
    return this.mutate(revision, async (s) => {
      const next = attachPDF(s, input, pdf);
      await this.putArtifact(pdf);
      return validateState(next);
    });
  }
  async restore(revision, backup) {
    validateState(backup);
    return this.mutate(revision, (s) => ({
      ...structuredClone(backup),
      revision: s.revision + 1,
      updatedAt: now(),
    }));
  }
  async mutate(revision, fn) {
    const dir = await this.directory(),
      lock = join(dir, 'workspace.lock');
    try {
      await writeFile(lock, String(process.pid), { flag: 'wx', mode: 0o600 });
    } catch (e) {
      if (e.code === 'EEXIST')
        throw Error('Workspace conflict: writer active; retry after refresh');
      throw e;
    }
    const temp = join(dir, randomUUID() + '.tmp');
    try {
      const s = await this.read();
      if (revision !== s.revision) throw Error('Revision conflict');
      const next = await fn(s);
      await writeFile(temp, JSON.stringify(next, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      await rename(temp, join(dir, 'workspace.json'));
      return next;
    } finally {
      await unlink(temp).catch(() => {});
      await unlink(lock);
    }
  }
}
