// Versioned, opt-in wire protocol. Stored workspace JSON is unchanged.
const arrays = new Set([
  'jobs',
  'capabilities',
  'tasks',
  'runs',
  'submissions',
  'resumes',
  'preparations',
  'resumeRequests',
]);
const fields = new Set([
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
const keyOf = (field, row) =>
  ['resumes', 'preparations'].includes(field)
    ? JSON.stringify([row.jobId, row.version])
    : field === 'submissions'
      ? row.jobId
      : row.id;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const own = (obj, key) => Object.hasOwn(obj, key);
export function workspaceDelta(before, after) {
  const changes = {};
  for (const field of fields) {
    if (same(before[field], after[field])) continue;
    if (!own(after, field)) {
      changes[field] = { kind: 'delete' };
      continue;
    }
    if (arrays.has(field) && Array.isArray(after[field])) {
      const old = new Map((before[field] || []).map((row) => [keyOf(field, row), row]));
      const order = after[field].map((row) => keyOf(field, row));
      changes[field] = {
        kind: 'entities',
        order,
        upsert: after[field].filter((row) => !same(old.get(keyOf(field, row)), row)),
      };
    } else if (field === 'reviews') {
      const old = before.reviews || {},
        next = after.reviews;
      changes[field] = {
        kind: 'records',
        remove: Object.keys(old).filter((id) => !own(next, id)),
        upsert: Object.fromEntries(Object.entries(next).filter(([id, row]) => !same(old[id], row))),
      };
    } else changes[field] = { kind: 'replace', value: after[field] };
  }
  return {
    kind: 'workspace-delta',
    version: 1,
    baseRevision: before.revision,
    revision: after.revision,
    changes,
  };
}
export function mergeWorkspaceDelta(base, delta) {
  if (
    !base ||
    delta.kind !== 'workspace-delta' ||
    delta.version !== 1 ||
    delta.baseRevision !== base.revision ||
    !Number.isSafeInteger(delta.revision) ||
    delta.revision < base.revision
  )
    throw Error('Workspace delta base mismatch');
  const next = { ...base };
  for (const [field, change] of Object.entries(delta.changes || {})) {
    if (!fields.has(field)) throw Error('Invalid workspace delta field');
    if (change.kind === 'delete') {
      delete next[field];
      continue;
    }
    if (change.kind === 'replace') {
      next[field] = change.value;
      continue;
    }
    if (change.kind === 'entities' && arrays.has(field)) {
      const rows = new Map((base[field] || []).map((row) => [keyOf(field, row), row]));
      for (const row of change.upsert) rows.set(keyOf(field, row), row);
      if (
        new Set(change.order).size !== change.order.length ||
        change.order.some((id) => !rows.has(id))
      )
        throw Error('Incomplete workspace delta');
      next[field] = change.order.map((id) => rows.get(id));
    } else if (change.kind === 'records' && field === 'reviews') {
      next.reviews = { ...(base.reviews || {}) };
      for (const id of change.remove) delete next.reviews[id];
      for (const [id, value] of Object.entries(change.upsert))
        Object.defineProperty(next.reviews, id, {
          value,
          enumerable: true,
          writable: true,
          configurable: true,
        });
    } else throw Error('Invalid workspace delta');
  }
  if (next.revision !== delta.revision) throw Error('Invalid workspace delta revision');
  return next;
}
