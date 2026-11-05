export function parseCompanies(html) {
  const visit = (x) => {
    if (!x || typeof x !== 'object') return null;
    if (
      Array.isArray(x.companies) &&
      Number.isInteger(x.total) &&
      x.companies.every((c) => typeof c.company === 'string' && Number.isInteger(c.job_count))
    )
      return x.companies;
    for (const v of Object.values(x)) {
      const hit = visit(v);
      if (hit) return hit;
    }
    return null;
  };
  let stream = '';
  for (const match of html.matchAll(/self\.__next_f\.push\((\[[^<]*?\])\)\s*<\/script>/g)) {
    try {
      const [, s] = JSON.parse(match[1]);
      if (typeof s === 'string') stream += s;
    } catch {}
  }
  for (const line of stream.split('\n')) {
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    try {
      const found = visit(JSON.parse(line.slice(colon + 1)));
      if (found) return found;
    } catch {}
  }
  throw Error('Job-Frog company schema changed or search results missing');
}
export function parseJobs(body, expected) {
  const x = JSON.parse(body);
  if (
    !Array.isArray(x.data) ||
    typeof x.meta?.hasMore !== 'boolean' ||
    !x.data.every(
      (j) =>
        typeof j.title === 'string' &&
        typeof j.company === 'string' &&
        typeof j.website_link === 'string' &&
        /^https:\/\//.test(j.website_link),
    )
  )
    throw Error('Job-Frog job schema changed');
  if (
    expected &&
    (x.meta.appliedFilters?.companyExact !== expected.company ||
      x.meta.appliedFilters?.q?.toLowerCase() !== expected.query.toLowerCase())
  )
    throw Error('Job-Frog response filter mismatch');
  return {
    jobs: x.data.map((j) => ({
      title: j.title,
      company: j.company,
      url: j.website_link,
      summary: j.summary_zh_hq ?? '',
      platformDate: j.posted_date ?? null,
      location: j.location ?? '',
      discoverySource: 'job-frog',
    })),
    hasMore: x.meta.hasMore,
  };
}
