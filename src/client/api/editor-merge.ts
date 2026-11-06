import type { Workspace, Action } from '../types';
export type EditorTarget = { kind: 'profile' } | { kind: 'capability'; id: string };
export type RecordValue = Record<string, unknown> | null;
export interface FieldConflict {
  path: string[];
  base: unknown;
  draft: unknown;
  latest: unknown;
}
export interface EditInput {
  target: EditorTarget;
  base: RecordValue;
  draft: Record<string, unknown>;
}
export interface Reconciliation {
  kind: 'reconcile';
  latest: RecordValue;
  merged: RecordValue;
  conflicts: FieldConflict[];
  raced: boolean;
}
export type EditResult = { kind: 'saved'; state: Workspace } | Reconciliation;
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
export function equal(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((v, i) => equal(v, b[i]));
  if (object(a) && object(b)) {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((k) => Object.hasOwn(b, k) && equal(a[k], b[k]))
    );
  }
  return false;
}
export function recordFor(state: Workspace, target: EditorTarget): RecordValue {
  if (target.kind === 'profile')
    return state.profile
      ? (structuredClone(state.profile) as unknown as Record<string, unknown>)
      : null;
  const c = state.capabilities.find((entry) => entry.id === target.id);
  return c
    ? { id: c.id, claim: c.claim, tags: [...c.tags], evidence: [...c.evidence], status: c.status }
    : null;
}
export function reconcile(input: EditInput, latest: RecordValue, raced = false): Reconciliation {
  const conflicts: FieldConflict[] = [];
  function visit(base: unknown, draft: unknown, remote: unknown, path: string[]): unknown {
    if (equal(draft, base)) return remote;
    if (equal(remote, base) || equal(draft, remote)) return draft;
    if (object(base) && object(draft) && object(remote)) {
      return Object.fromEntries(
        [...new Set([...Object.keys(base), ...Object.keys(draft), ...Object.keys(remote)])]
          .map((key) => [key, visit(base[key], draft[key], remote[key], [...path, key])] as const)
          .filter(([, value]) => value !== undefined),
      );
    }
    conflicts.push({ path, base, draft, latest: remote });
    return draft;
  }
  // Confirming evidence while its content changed must be an explicit review,
  // even when status and content happen to be separate JSON fields.
  const { base, draft, target } = input;
  const evidenceChanged = (a: RecordValue, b: RecordValue) =>
    ['claim', 'tags', 'evidence'].some((key) => !equal(a?.[key], b?.[key]));
  const confirmationRace =
    target.kind === 'capability' &&
    base &&
    latest &&
    ((draft.status === 'confirmed' &&
      base.status !== 'confirmed' &&
      evidenceChanged(base, latest)) ||
      (latest.status === 'confirmed' &&
        base.status !== 'confirmed' &&
        evidenceChanged(base, draft)));
  const merged = confirmationRace
    ? (conflicts.push({ path: [], base, draft, latest }), draft)
    : visit(base, draft, latest, []);
  return { kind: 'reconcile', latest, merged: merged as RecordValue, conflicts, raced };
}
export function resolveField(record: RecordValue, path: string[], value: unknown): RecordValue {
  if (!path.length) return value as RecordValue;
  const result = structuredClone(record)!;
  let parent = result;
  for (const key of path.slice(0, -1)) parent = parent[key] as Record<string, unknown>;
  const key = path[path.length - 1];
  if (value === undefined) delete parent[key];
  else
    Object.defineProperty(parent, key, {
      value: structuredClone(value),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  return result;
}
export function editAction(target: EditorTarget, draft: RecordValue): Action {
  if (!draft || !object(draft)) throw Error('Editor data must be a JSON object.');
  if (target.kind === 'profile') return { type: 'profile', profile: draft };
  if (draft.id !== target.id) throw Error('Capability identity cannot be changed in this editor.');
  return { ...draft, type: 'capability' };
}
