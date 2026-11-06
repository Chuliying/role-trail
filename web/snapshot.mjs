import { canonical } from './status.mjs';
export const sha = async (x, raw = false) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(raw ? x : JSON.stringify(canonical(x))),
      ),
    ),
  )
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
// Derive from one snapshot, then commit data and derived flags together. An older
// read must never replace a newer successful write while hashing is in flight.
export async function deriveSnapshot(b) {
  const stale = new Set();
  if (b.schemaVersion === 1 && Array.isArray(b.resumes) && Array.isArray(b.jobs)) {
    const profileDigest = await sha(b.profile);
    const jobs = new Map(b.jobs.map((j) => [j.id, j]));
    const capabilities = new Map(b.capabilities.map((c) => [c.id, c]));
    await Promise.all(
      b.resumes.map(async (r) => {
        const j = jobs.get(r.jobId);
        if (
          !j ||
          r.jdHash !== (await sha([j.company, j.title, j.description])) ||
          (r.bindingKind !== 'legacy' &&
            (r.profileHash !== profileDigest ||
              r.capabilityHash !== (await sha(r.capabilityIds.map((id) => capabilities.get(id)))) ||
              r.capabilityIds.some((id) => capabilities.get(id)?.status !== 'confirmed')))
        )
          stale.add(r.jobId + ':' + r.version);
      }),
    );
  }
  return { state: b, staleResumes: stale };
}
