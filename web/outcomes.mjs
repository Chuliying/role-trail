// Shared, data-only rules. Callers provide canonical identities, factual statuses and artifacts.
const day = (value, timeZone) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
const key = (j) => {
  try {
    const u = new URL(j.url);
    for (const p of [...u.searchParams.keys()]) if (p.startsWith('utm_')) u.searchParams.delete(p);
    return u.href;
  } catch {
    return j.id;
  }
};
const negative = (f) => ['excluded', 'closed'].includes(f?.status);
const supported = (f) =>
  ['confirmed', 'open', 'excluded', 'closed'].includes(f?.status) &&
  /^https?:\/\//.test(f.source || '') &&
  !!f.evidence?.trim() &&
  Number.isFinite(Date.parse(f.checkedAt));
function preserve(old, next) {
  if (!old) return next;
  if (old.checkedAt && (!next.checkedAt || Date.parse(next.checkedAt) < Date.parse(old.checkedAt)))
    return old;
  if (negative(old) && (!supported(next) || Date.parse(next.checkedAt) < Date.parse(old.checkedAt)))
    return old;
  return next;
}
export function researchOutcomes({
  jobs,
  history,
  timeZone = 'UTC',
  now = new Date().toISOString(),
  historyComplete = true,
}) {
  const endDate = day(now, timeZone),
    startDate = new Date(Date.parse(endDate + 'T12:00:00Z') - 6 * 86400000)
      .toISOString()
      .slice(0, 10);
  const inside = (t) =>
    Number.isFinite(Date.parse(t)) &&
    Date.parse(t) <= Date.parse(now) &&
    day(t, timeZone) >= startDate &&
    day(t, timeZone) <= endDate;
  const result = {
    startDate,
    endDate,
    timeZone,
    historyAvailable: Array.isArray(history),
    historyComplete,
    newJobs: [],
    newHighFit: [],
    qualifying: [],
    kept: [],
    resolvedPositive: [],
    resolvedNegative: [],
    runs: 0,
  };
  if (!Array.isArray(history)) return result;
  const current = new Map(jobs.map((j) => [key(j), j])),
    first = new Map(),
    prior = new Map(),
    resolved = new Map();
  const events = [...history]
    .filter(
      (r) =>
        Number.isFinite(Date.parse(r.finishedAt)) && Date.parse(r.finishedAt) <= Date.parse(now),
    )
    .sort((a, b) => Date.parse(a.finishedAt) - Date.parse(b.finishedAt));
  const runIds = new Set();
  for (const run of events) {
    if (runIds.has(run.id)) continue;
    runIds.add(run.id);
    if (run.kind !== 'import' && inside(run.finishedAt)) result.runs++;
    for (const j of run.jobs || []) {
      const identity = key(j);
      if (!first.has(identity)) first.set(identity, { ...run, discovered: j.discovered });
      const facts = [
        ...(j.checks || []),
        ...(j.availability ? [{ key: 'availability', ...j.availability }] : []),
      ];
      for (const f of facts) {
        const id = identity + '\n' + f.key,
          old = prior.get(id),
          next = preserve(old, f);
        const days = f.key === 'availability' ? 7 : 30;
        const stale =
          old &&
          !negative(old) &&
          (!supported(old) ||
            Date.parse(run.finishedAt) - Date.parse(old.checkedAt) > days * 86400000);
        if (
          run.kind !== 'import' &&
          inside(run.finishedAt) &&
          old &&
          stale &&
          supported(next) &&
          inside(next.checkedAt) &&
          next !== old &&
          Date.parse(next.checkedAt) <= Date.parse(run.finishedAt)
        ) {
          const role = current.get(identity) || j;
          resolved.set(id, {
            id: role.id,
            company: role.company,
            title: role.title,
            key: f.key,
            label: f.label || f.key,
            from: old.status === 'unknown' ? 'unknown' : 'stale',
            to: next.status,
            source: next.source,
            checkedAt: next.checkedAt,
          });
        }
        // If a resolved field subsequently changes polarity, report the final supported result once.
        if (
          run.kind !== 'import' &&
          resolved.has(id) &&
          supported(next) &&
          next !== old &&
          inside(next.checkedAt) &&
          Date.parse(next.checkedAt) <= Date.parse(run.finishedAt)
        )
          resolved.set(id, {
            ...resolved.get(id),
            to: next.status,
            source: next.source,
            checkedAt: next.checkedAt,
          });
        prior.set(id, next);
      }
    }
  }
  for (const [identity, j] of current) {
    const origin = first.get(identity);
    if (
      origin &&
      origin.kind !== 'import' &&
      (historyComplete || origin.discovered === true) &&
      origin.discovered !== false &&
      inside(origin.finishedAt) &&
      inside(j.firstSeenAt)
    )
      result.newJobs.push(j);
  }
  result.newHighFit = result.newJobs.filter((j) => j.score >= 7 && !j.excluded);
  result.qualifying = result.newHighFit.filter((j) => j.verified);
  result.kept = result.newHighFit.filter((j) => ['shortlisted', 'applied'].includes(j.decision));
  for (const item of resolved.values())
    (negative({ status: item.to }) ? result.resolvedNegative : result.resolvedPositive).push(item);
  return result;
}
export function applicationReadiness({
  resume,
  preparation,
  tasks = [],
  qualification = 'unknown',
  submitted = false,
}) {
  const missing = [];
  if (!resume?.exists) missing.push('resume');
  else {
    if (resume.stale) missing.push('resume_stale');
    if (!resume.pdf) missing.push('pdf');
    if (!resume.adjustments) missing.push('adjustments');
    if (resume.reviewStatus === 'changes_requested') missing.push('resume_changes');
  }
  if (!preparation?.exists) missing.push('preparation');
  else if (preparation.stale) missing.push('preparation_stale');
  const remaining = tasks.filter((t) => !t.done).length;
  if (remaining) missing.push('tasks');
  const materialsReady = missing.length === 0;
  if (resume?.reviewStatus !== 'approved') missing.push('review');
  if (qualification !== 'verified') missing.push('qualification');
  const readyToApply = missing.length === 0 && !submitted;
  return {
    materialsReady,
    readyToApply,
    submitted,
    missing,
    remainingTasks: remaining,
    totalTasks: tasks.length,
    stage: submitted
      ? 'applied'
      : qualification === 'excluded'
        ? 'blocked'
        : !materialsReady
          ? 'preparing'
          : resume?.reviewStatus !== 'approved'
            ? 'review'
            : qualification !== 'verified'
              ? 'verify'
              : 'ready',
  };
}
