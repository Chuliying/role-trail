import { jdHash, hash, resumeStale } from './workbench.mjs';
export const escapeHTML = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export function draftAction(state, jobId) {
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job || !state.profile) throw Error('Profile and job required');
  const latest = state.resumes
    .filter((r) => r.jobId === jobId)
    .sort((a, b) => b.version - a.version)[0];
  if (
    latest &&
    ['pending', 'approved'].includes(latest.reviewStatus) &&
    !resumeStale(state, latest)
  )
    return null;
  const confirmed = state.capabilities.filter((c) => c.status === 'confirmed');
  if (!confirmed.length) throw Error('Confirm evidence-backed capabilities first');
  const words = new Set(job.description.toLowerCase().match(/[\p{L}\p{N}+#.]+/gu) || []);
  const ranked = confirmed
    .map((c, index) => ({
      c,
      index,
      hits: c.tags.filter((t) => words.has(t.toLowerCase())).length,
    }))
    .sort((a, b) => b.hits - a.hits || a.index - b.index)
    .slice(0, 10);
  const p = state.profile,
    claims = ranked.map((x) => x.c);
  const content = [
    '# ' + p.name,
    p.location + ' · ' + p.languages.join(' / '),
    p.portfolio || '',
    '## ' + job.title,
    '## Selected experience',
    ...claims.map((c) => '- ' + c.claim),
  ]
    .filter(Boolean)
    .join('\n\n');
  return {
    type: 'resume',
    jobId,
    content,
    capabilityIds: claims.map((c) => c.id),
    jdHash: jdHash(job),
    adjustments: [
      `Target heading: ${job.title} at ${job.company}.`,
      'Confirmed claims were ordered by exact overlap between their skill tags and JD words. This is a transparent draft heuristic, not a proficiency score.',
      `Selected ${claims.length} of ${confirmed.length} confirmed claims. Proposed or rejected claims were omitted.`,
      'No dates, employment history, qualifications or metrics were inferred. Review and edit this draft before use.',
    ],
  };
}
export function resumeHTML(resume) {
  const blocks = resume.content
    .split(/\r?\n/)
    .filter((x) => x.trim())
    .map((line) => {
      if (line.startsWith('# ')) return '<h1>' + escapeHTML(line.slice(2)) + '</h1>';
      if (line.startsWith('## ')) return '<h2>' + escapeHTML(line.slice(3)) + '</h2>';
      if (/^[-*] /.test(line))
        return '<div class="bullet">• ' + escapeHTML(line.slice(2)) + '</div>';
      return '<p>' + escapeHTML(line) + '</p>';
    })
    .join('\n');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Resume</title><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font:11pt/1.55 Arial,sans-serif;color:#18202b;max-width:174mm;margin:24px auto;padding:16px}h1{font-size:24pt;margin:0 0 6pt}h2{font-size:12pt;margin:18pt 0 7pt;border-bottom:1px solid #bbb;padding-bottom:5pt}p{margin:5pt 0}.bullet{margin:8pt 0;break-inside:avoid}h1,h2{break-after:avoid}@media print{body{margin:0;padding:0}}</style><body>${blocks}</body></html>`;
}
export const capabilityDigest = (state, ids) =>
  hash(ids.map((id) => state.capabilities.find((c) => c.id === id)));
