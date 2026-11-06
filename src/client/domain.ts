import { settings } from '../../web/configuration.mjs';
import { positiveFresh, freshness } from '../../web/status.mjs';
import type { Job, Workspace, Task } from './types';
export { settings, positiveFresh, freshness };
import { locale as detectedLocale } from '../../web/i18n.mjs';
export const locale = detectedLocale as 'en' | 'zh-TW';
export { t, setLocale } from '../../web/i18n.mjs';
export { sha } from '../../web/snapshot.mjs';
export const sourceLabel = (id: string) => settings.sources.find((s) => s.id === id)?.label || id;
export const taskFor = (task: Task, id: string) => task.jobId === id || task.jobIds?.includes(id);
export const archived = (state: Workspace, j: Job) =>
  !!(
    state.reviews[j.id]?.archived ||
    j.availability.status === 'closed' ||
    (j.expiresAt && Date.parse(j.expiresAt) < Date.now()) ||
    j.checks.some((c) => c.status === 'excluded')
  );
export const latestResume = (state: Workspace, id: string) =>
  state.resumes.filter((r) => r.jobId === id).sort((a, b) => b.version - a.version)[0];
export function qualification(state: Workspace, j: Job) {
  if (
    j.availability.status === 'closed' ||
    (j.expiresAt && Date.parse(j.expiresAt) < Date.now()) ||
    j.checks.some((c) => c.status === 'excluded')
  )
    return 'excluded';
  return j.checks.length &&
    (state.profile?.requiredChecks || []).every((k) => j.checks.some((c) => c.key === k.key)) &&
    j.checks.every((c) => positiveFresh(c) && c.source && c.evidence) &&
    positiveFresh(j.availability, freshness.availabilityDays) &&
    j.availability.source &&
    j.availability.evidence
    ? 'verified'
    : 'unknown';
}
export const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
