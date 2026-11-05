// One-time data conversion. This module never becomes a second application runtime.
import { emptyState, normalizeJob, validateState, hash, jdHash } from './workbench.mjs';
import { artifactHash } from './artifacts.mjs';
const labels = {
  taiwanRemote: ['remote', 'Taiwan remote eligibility'],
  ownership: ['ownership', 'Ownership policy'],
  aiProduct: ['ai', 'AI product work'],
  frontend: ['frontend', 'Frontend responsibility'],
  languagePolicy: ['language', 'Working language'],
};
const markdown = (v, level = 2) =>
  typeof v === 'string'
    ? v
    : Array.isArray(v)
      ? v.map((x) => (typeof x === 'string' ? '- ' + x : markdown(x, level))).join('\n\n')
      : v && typeof v === 'object'
        ? Object.entries(v)
            .map(
              ([k, x]) =>
                '#'.repeat(Math.min(level, 5)) + ' ' + k + '\n\n' + markdown(x, level + 1),
            )
            .join('\n\n')
        : String(v ?? '');
const canonicalURL = (value) => {
  const u = new URL(value);
  for (const k of [...u.searchParams.keys()])
    if (k.startsWith('utm_') || ['ref', 'source', 'from'].includes(k)) u.searchParams.delete(k);
  return u.href.replace(/\/$/, '');
};
export function convertLegacy(snapshot, { profile = null } = {}) {
  if (
    snapshot?.format !== 'job-board-postgres-v1' ||
    snapshot.tables?.job_board_state?.length !== 1
  )
    throw Error('Legacy snapshot required');
  const tables = snapshot.tables,
    base = tables.job_board_state[0],
    s = emptyState(),
    artifacts = [],
    artifactHashes = [],
    idMap = {},
    unmappedReferences = [];
  const put = (value) => {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
    const hash = artifactHash(bytes);
    if (!artifacts.some((a) => a.hash === hash)) artifacts.push({ hash, bytes });
    return hash;
  };
  // Preserve every original row, including fields with no canonical UI equivalent.
  for (const [table, rows] of Object.entries(tables))
    for (const row of rows) artifactHashes.push({ table, hash: put(row) });
  s.profile = profile;
  for (const e of tables.job_board_evidence)
    for (const c of e.document.cards) {
      if (!s.capabilities.some((x) => x.id === c.id))
        s.capabilities.push({
          id: c.id,
          claim: [c.title, c.ownership, c.result].filter(Boolean).join(' — '),
          tags: [],
          evidence: c.sources.map((x) => x.label + ': ' + x.locator),
          status: 'proposed',
          legacyArchive: put(c),
        });
    }
  s.updatedAt = base.board.updatedAt || snapshot.exportedAt;
  const checks = (j) =>
    Object.entries({
      ...j.checks,
      ...(j.languagePolicy ? { languagePolicy: j.languagePolicy } : {}),
    }).map(([key, f]) => ({
      key: labels[key]?.[0] || key.toLowerCase(),
      label: labels[key]?.[1] || key,
      ...f,
    }));
  for (const old of base.board.jobs) {
    const j = normalizeJob({
      company: old.company,
      title: old.title,
      url: old.url,
      source: old.source,
      description: old.description,
      descriptionKind: old.descriptionKind,
      descriptionCheckedAt: old.lastObservedAt,
      posting: old.posting,
      remoteMode: old.remoteMode,
      location: old.location,
      salary: [old.salary?.display, old.salary?.note].filter(Boolean).join(' · '),
      availability: old.availability,
      checks: checks(old),
      searchedAt: old.lastObservedAt,
      firstSeenAt: old.firstObservedAt,
    });
    if (s.jobs.some((x) => x.id === j.id))
      throw Error('Legacy URL identity collision; reconcile before migration');
    idMap[old.id] = j.id;
    if (old.fitScore !== null && old.fitScore !== undefined)
      j.assessment = {
        score: Math.max(1, Math.min(10, Math.round(old.fitScore / 10))),
        reason: old.fitReason || 'Historical assessment; provenance not bound to this profile',
        evidence: ['Imported historical assessment; original record retained in migration archive'],
        gaps: old.gaps || [],
        checkedAt: old.lastObservedAt,
        stale: true,
      };
    s.jobs.push(j);
  }
  const lookup = (old, context) => {
    const id = idMap[old];
    if (!id) unmappedReferences.push({ context, id: old });
    return id;
  };
  const trackerMap = {};
  for (const t of base.tracker.jobs || []) {
    const job = s.jobs.find((j) => canonicalURL(j.url) === canonicalURL(t.url));
    if (job) trackerMap[t.id] = job.id;
    else unmappedReferences.push({ context: 'tracker', id: t.id });
  }
  for (const j of s.jobs) {
    const old = base.board.jobs.find((x) => idMap[x.id] === j.id),
      r = tables.job_board_reviews.find((r) => r.job_id === old.id),
      t = base.tracker.jobs.find((t) => trackerMap[t.id] === j.id);
    const status =
      r?.status ||
      (['applied', 'interview', 'offer', 'rejected'].includes(t?.application_status)
        ? 'applied'
        : t?.application_status === 'withdrawn'
          ? 'passed'
          : t
            ? 'shortlisted'
            : 'review');
    s.reviews[j.id] = {
      status,
      archived: false,
      updatedAt: r?.updated_at || null,
      ...(r ? { legacyVersion: r.version } : { inherited: true }),
    };
  }
  for (const t of base.tracker.prep_tasks || []) {
    const jobIds = (t.job_ids || [])
      .map((id) => {
        if (!trackerMap[id]) unmappedReferences.push({ context: 'task ' + t.id, id });
        return trackerMap[id];
      })
      .filter(Boolean);
    s.tasks.push({
      id: t.id,
      jobId: jobIds[0] || null,
      jobIds,
      text: t.title,
      done: t.status === 'done',
      status: t.status,
      acceptance: t.acceptance,
      dependsOn: t.depends_on || [],
      legacy: structuredClone(t),
    });
  }
  for (const e of tables.job_board_submissions) {
    const jobId = lookup(e.job_id, 'submission');
    if (jobId) s.submissions.push({ jobId, recordedAt: e.recorded_at, source: e.source });
  }
  for (const t of base.tracker.jobs)
    if (
      ['applied', 'interview', 'offer', 'rejected'].includes(t.application_status) &&
      trackerMap[t.id] &&
      !s.submissions.some((x) => x.jobId === trackerMap[t.id])
    )
      s.submissions.push({ jobId: trackerMap[t.id], recordedAt: null, source: 'legacy' });
  for (const r of tables.job_board_resumes) {
    const jobId = lookup(r.job_id, 'resume');
    if (!jobId) continue;
    const j = s.jobs.find((j) => j.id === jobId),
      old = base.board.jobs.find((j) => j.id === r.job_id),
      pdf = Buffer.from(r.pdf.data);
    if (artifactHash(pdf) !== r.pdf_hash) throw Error('Legacy PDF hash mismatch');
    put(pdf);
    s.resumes.push({
      jobId,
      version: r.version,
      content: markdown(r.content),
      capabilityIds: [],
      adjustments: [r.summary, ...r.gaps],
      reviewStatus: r.status,
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at,
      jdHash:
        r.jd_hash === hash(JSON.stringify([old.title, old.company, old.description]))
          ? jdHash(j)
          : r.jd_hash,
      bindingKind: 'legacy',
      sourceHash: r.source_hash,
      sourceArchive: put(r.content),
      pdfHash: r.pdf_hash,
      pdfFilename: r.filename,
      pdfBytes: pdf.length,
      legacyReviewVersion: r.review_version,
    });
  }
  for (const p of tables.job_board_preparation) {
    const jobId = lookup(p.job_id, 'preparation'),
      r = s.resumes.find((r) => r.jobId === jobId && r.version === p.resume_version),
      e = tables.job_board_evidence.find((e) => e.hash === p.evidence_hash);
    if (!r || !e) {
      unmappedReferences.push({ context: 'preparation binding', id: p.job_id });
      continue;
    }
    const j = s.jobs.find((j) => j.id === jobId),
      old = base.board.jobs.find((j) => j.id === p.job_id);
    const evidence = e.document.cards.map((c) => ({
      id: c.id,
      claim: c.title,
      tags: [],
      evidence: c.sources.map((s) => s.label + ': ' + s.locator),
      status: 'confirmed',
      legacy: c,
    }));
    s.preparations.push({
      jobId,
      version: p.version,
      resumeVersion: p.resume_version,
      resumeContentHash: hash(r.content),
      jdHash:
        p.jd_hash === hash(JSON.stringify([old.title, old.company, old.description]))
          ? jdHash(j)
          : p.jd_hash,
      capabilityIds: evidence.map((c) => c.id),
      capabilityHash: hash(evidence),
      evidence,
      content: markdown(p.document) + '\n\n## Source evidence\n\n' + markdown(e.document),
      createdAt: p.created_at,
      bindingKind: 'legacy',
      resumePdfHash: p.resume_pdf_hash,
    });
  }
  const seen = new Set();
  for (const entry of [...tables.job_board_runs].sort((a, b) =>
    String(a.bundle.run.finishedAt).localeCompare(String(b.bundle.run.finishedAt)),
  )) {
    const { bundle } = entry;
    const r = bundle.run;
    const coverage = r.coverage.map((c) => ({
      ...c,
      screened: c.metrics?.screened ?? 0,
      fullJd: c.metrics?.fullJd ?? 0,
      depthKnown: !!c.metrics,
      legacyInspected: c.inspected,
      query: c.query.slice(0, 500) || 'No query recorded in legacy run',
      note: c.note || 'No note recorded in legacy run',
    }));
    s.runs.push({
      ...r,
      coverage,
      archiveHash: put(bundle),
      legacyContentHash: entry.hash,
      observations: bundle.jobs.map((old) => {
        const j = normalizeJob({
          company: old.company,
          title: old.title,
          url: old.url,
          source: old.source,
        });
        const discovered = !seen.has(j.id);
        seen.add(j.id);
        return {
          id: j.id,
          url: j.url,
          company: j.company,
          title: j.title,
          availability: old.availability,
          checks: checks(old),
          discovered,
        };
      }),
    });
  }
  s.schedule = null; // Existing host task is migrated separately, never start a second scheduler.
  s.migration = {
    source: 'job-board-postgres-v1',
    sourceRevision: base.revision,
    exportedAt: snapshot.exportedAt,
    idMap,
    artifacts: artifactHashes,
    schedule: base.schedule,
  };
  if (unmappedReferences.length)
    throw Error('Unmapped legacy references: ' + JSON.stringify(unmappedReferences));
  validateState(s);
  return {
    state: s,
    sourceTables: snapshot.tables,
    artifacts,
    report: {
      sourceRevision: base.revision,
      jobs: s.jobs.length,
      resumes: s.resumes.length,
      preparations: s.preparations.length,
      tasks: s.tasks.length,
      runs: s.runs.length,
      artifacts: artifacts.length,
      unmappedReferences,
    },
  };
}
