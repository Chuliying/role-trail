// Shared positive-evidence policy for the browser and domain layer.
// Negative evidence is retained separately; expiration never unarchives a job.
import { settings } from './configuration.mjs';
export const freshness = settings.verification.freshness;
export function positiveFresh(fact, days = freshness.checkDays, at = Date.now()) {
  const checked = Date.parse(fact?.checkedAt);
  const age = at - checked;
  return (
    ['confirmed', 'open'].includes(fact?.status) &&
    Number.isFinite(checked) &&
    age >= 0 &&
    age <= days * 86400000
  );
}
export const currentScore = (job) =>
  job.assessment && !job.assessment.stale ? job.assessment.score : 0;

// JSONB and serializers may reorder object keys. Bind content, not insertion order.
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}
