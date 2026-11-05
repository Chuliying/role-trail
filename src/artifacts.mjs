import { createHash } from 'node:crypto';
export const artifactHash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function artifactId(id) {
  if (!/^[a-f0-9]{64}$/.test(id || '')) throw Error('Invalid artifact identity');
  return id;
}
export function attachPDF(s, input, pdf) {
  if (
    !input ||
    Object.keys(input).some((k) => !['jobId', 'version', 'filename'].includes(k)) ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,110}\.pdf$/.test(input.filename || '')
  )
    throw Error('Invalid PDF metadata');
  if (
    !Buffer.isBuffer(pdf) ||
    pdf.length < 100 ||
    pdf.length > 2_000_000 ||
    pdf.subarray(0, 5).toString() !== '%PDF-'
  )
    throw Error('Invalid PDF (maximum 2 MB)');
  const r = s.resumes.find((r) => r.jobId === input.jobId && r.version === input.version);
  if (!r) throw Error('Resume not found');
  const digest = artifactHash(pdf);
  if (r.pdfHash && r.pdfHash !== digest)
    throw Error('PDF version is immutable; create a new resume version');
  if (r.pdfHash === digest) return s;
  const next = structuredClone(s),
    target = next.resumes.find((r) => r.jobId === input.jobId && r.version === input.version);
  Object.assign(target, { pdfHash: digest, pdfFilename: input.filename, pdfBytes: pdf.length });
  next.revision++;
  next.updatedAt = new Date().toISOString();
  return next;
}
export function researchArtifact(action) {
  return action.type === 'research'
    ? Buffer.from(JSON.stringify({ run: action.run, jobs: action.jobs }))
    : null;
}
