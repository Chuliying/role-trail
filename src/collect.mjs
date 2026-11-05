import { parseCompanies, parseJobs } from './providers/job-frog.mjs';
import { collectProviders, parseGoogleJobs } from './providers/taiwan.mjs';
import { randomUUID } from 'node:crypto';
import { normalizeJob, now } from './workbench.mjs';
const hosts = new Set([
  'www.job-frog.com',
  'himalayas.app',
  'boards-api.greenhouse.io',
  'api.lever.co',
  'serpapi.com',
]);
export async function fetchText(url) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !hosts.has(u.hostname) || u.username || u.password)
    throw Error('Unsupported provider');
  const r = await fetch(u, {
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
    headers: { Accept: 'application/json' },
  });
  if (!r.ok) throw Error('Provider HTTP ' + r.status);
  const reader = r.body.getReader();
  let size = 0,
    parts = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 8_000_000) {
      await reader.cancel();
      throw Error('Provider response too large');
    }
    parts.push(Buffer.from(value));
  }
  return Buffer.concat(parts).toString();
}
export async function fetchJSON(url) {
  return JSON.parse(await fetchText(url));
}
const plain = (s) =>
  String(s || '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<h[1-6][^>]*>/gi, '\n\n## ')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(?:p|div|h[1-6]|li)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(
      /&(?:amp|lt|gt|quot|#39|nbsp);/g,
      (x) =>
        ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' })[x],
    )
    .trim();
const slug = (s) => {
  if (typeof s !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(s)) throw Error('Invalid board slug');
  return s;
};
function unknownChecks(p) {
  const checks = [
    {
      key: 'location',
      label: 'Location eligibility',
      status: 'unknown',
      source: null,
      evidence: 'Verify long-term work from ' + p.location,
      checkedAt: null,
    },
    {
      key: 'language',
      label: 'Working language',
      status: 'unknown',
      source: null,
      evidence: 'Verify ' + p.languages.join(', '),
      checkedAt: null,
    },
    ...(p.ownershipPolicy.toLowerCase() === 'none'
      ? []
      : [
          {
            key: 'ownership',
            label: 'Ownership policy',
            status: 'unknown',
            source: null,
            evidence: p.ownershipPolicy,
            checkedAt: null,
          },
        ]),
  ];
  for (const c of p.requiredChecks || [])
    if (!checks.some((x) => x.key === c.key))
      checks.push({
        ...c,
        status: 'unknown',
        source: null,
        evidence: 'Verify against the user’s stated requirements.',
        checkedAt: null,
      });
  return checks;
}
export async function collect(
  profile,
  {
    fetchJSON: get = fetchJSON,
    fetchText: getText = fetchText,
    env = process.env,
    clock = Date.now,
    taiwan = collectProviders,
  } = {},
) {
  if (!profile) throw Error('Set up your profile first');
  const stamp = now(),
    jobs = [],
    coverage = [],
    feeds = profile.feeds || [];
  if (!Array.isArray(feeds) || feeds.length > 12) throw Error('At most 12 configured feeds');
  const deadline = clock() + 180000;
  for (const f of feeds) {
    let screened = 0,
      fullJd = 0,
      pages = 0;
    const source = String(f.type),
      query = ['greenhouse', 'lever'].includes(source)
        ? 'Employer board ' + String(f.board || f.company) + ' (unfiltered)'
        : String(f.query || profile.targetRoles.join(' OR ')).slice(0, 500);
    if (clock() >= deadline) {
      coverage.push({
        source,
        status: 'not_run',
        query,
        screened: 0,
        fullJd: 0,
        note: 'Run time budget reached before this feed. No request was made.',
        checkedAt: now(),
      });
      continue;
    }
    const add = (raw) => {
      screened++;
      try {
        const j = normalizeJob({
          ...raw,
          source,
          checks: unknownChecks(profile),
          searchedAt: stamp,
        });
        jobs.push(j);
        if (j.descriptionKind === 'full') fullJd++;
      } catch {
        /* malformed upstream row is not promoted to a job */
      }
    };
    try {
      if (source === 'job-frog') {
        const groups = parseCompanies(
          await getText('https://www.job-frog.com/?searched=1&q=' + encodeURIComponent(query)),
        );
        pages++;
        for (const group of groups.slice(0, 4))
          for (let page = 1; page <= 2; page++) {
            if (clock() >= deadline) break;
            const url =
              'https://www.job-frog.com/api/search?' +
              new URLSearchParams({
                q: query,
                companyExact: group.company,
                page: String(page),
                pageSize: '20',
              });
            const result = parseJobs(JSON.stringify(await get(url)), {
              company: group.company,
              query,
            });
            pages++;
            for (const j of result.jobs)
              add({
                company: j.company,
                title: j.title,
                url: j.url,
                sourceURL: url,
                description: j.summary,
                descriptionKind: 'summary',
                location: j.location,
                posting: { date: null, kind: 'unknown', raw: j.platformDate || '' },
              });
            if (!result.hasMore) break;
          }
      } else if (['indeed', '104'].includes(source)) {
        if (f.country !== 'TW' || !f.location)
          throw Error('Taiwan provider requires explicit TW country and location');
        const result = await taiwan({ query, location: f.location, sources: [source], env });
        pages++;
        if (
          !result.attempts.length ||
          result.attempts.some((a) =>
            ['failed', 'needs_configuration', 'disabled'].includes(a.status),
          )
        )
          throw Error('Provider not available');
        for (const j of result.candidates)
          add({
            company: j.company,
            title: j.title,
            url: j.url,
            sourceURL: j.sourceURL || j.url,
            description: j.descriptionText,
            descriptionKind: j.fetchStatus === 'summary_only' ? 'summary' : 'excerpt',
            location: j.location || f.location,
            posting: { date: null, kind: 'unknown', raw: j.platformDate || '' },
          });
      } else if (source === 'greenhouse') {
        const url =
            'https://boards-api.greenhouse.io/v1/boards/' + slug(f.board) + '/jobs?content=true',
          data = await get(url);
        pages++;
        if (!Array.isArray(data.jobs)) throw Error('Unexpected provider shape');
        for (const j of data.jobs.slice(0, 100))
          add({
            company: f.company || f.board,
            title: j.title,
            url: j.absolute_url,
            sourceURL: url,
            description: plain(j.content),
            descriptionKind: j.content ? 'full' : 'summary',
            location: j.location?.name,
            posting: {
              date: j.updated_at?.slice(0, 10) || null,
              kind: 'updated',
              raw: j.updated_at || '',
            },
            availability: {
              status: 'open',
              source: j.absolute_url,
              evidence: 'Listed by employer Greenhouse job-board API.',
              checkedAt: stamp,
            },
          });
      } else if (source === 'lever') {
        const url = 'https://api.lever.co/v0/postings/' + slug(f.company) + '?mode=json',
          data = await get(url);
        pages++;
        if (!Array.isArray(data)) throw Error('Unexpected provider shape');
        for (const j of data.slice(0, 100))
          add({
            company: f.name || f.company,
            title: j.text,
            url: j.hostedUrl,
            sourceURL: url,
            description: plain(
              [
                j.description,
                ...(j.lists || []).map((x) => '<h2>' + x.text + '</h2>' + x.content),
                j.additional,
              ].join('\n'),
            ),
            descriptionKind: 'full',
            location: j.categories?.location,
            availability: {
              status: 'open',
              source: j.hostedUrl,
              evidence: 'Listed by employer Lever postings API.',
              checkedAt: stamp,
            },
          });
      } else if (source === 'himalayas') {
        for (let page = 1; page <= 2; page++) {
          if (clock() >= deadline) break;
          const u = new URL('https://himalayas.app/jobs/api/search');
          u.searchParams.set('q', query);
          u.searchParams.set('page', page);
          u.searchParams.set('sort', 'recent');
          if (f.country) u.searchParams.set('country', String(f.country));
          if (f.timezone) u.searchParams.set('timezone', String(f.timezone));
          const data = await get(u.href);
          pages++;
          if (!Array.isArray(data.jobs)) throw Error('Unexpected provider shape');
          for (const j of data.jobs.slice(0, 20))
            add({
              company: j.companyName,
              title: j.title,
              url: j.applicationLink,
              sourceURL: j.guid || 'https://himalayas.app',
              description: plain(j.description || j.excerpt),
              descriptionKind: j.description ? 'full' : 'excerpt',
              location: [...(j.locationRestrictions || []), ...(j.timezoneRestrictions || [])].join(
                ', ',
              ),
              remoteMode: 'remote',
              expiresAt: j.expiryDate
                ? typeof j.expiryDate === 'number'
                  ? new Date(j.expiryDate * 1000).toISOString()
                  : new Date(j.expiryDate).toISOString()
                : null,
              posting: {
                date: j.pubDate
                  ? new Date(typeof j.pubDate === 'number' ? j.pubDate * 1000 : j.pubDate)
                      .toISOString()
                      .slice(0, 10)
                  : null,
                kind: 'unknown',
                raw: 'Aggregator publication, not verified employer first posting',
              },
            });
          if (data.jobs.length < 20) break;
        }
      } else if (source === 'google-jobs') {
        if (!env.SERPAPI_API_KEY) throw Error('Missing provider credential');
        const u = new URL('https://serpapi.com/search.json');
        u.searchParams.set('engine', 'google_jobs');
        u.searchParams.set('q', query);
        u.searchParams.set('api_key', env.SERPAPI_API_KEY);
        u.searchParams.set('location', f.location || profile.location);
        if (f.country) u.searchParams.set('gl', f.country);
        const data = await get(u.href);
        pages++;
        for (const j of parseGoogleJobs(data).slice(0, 20))
          add({
            company: j.company,
            title: j.title,
            url: j.url,
            sourceURL: j.sourceURL || j.url,
            description: j.descriptionText,
            descriptionKind: j.fetchStatus === 'summary_only' ? 'summary' : 'excerpt',
            location: j.location || '',
            posting: { date: null, kind: 'unknown', raw: j.platformDate || '' },
          });
      } else throw Error('Unsupported provider');
      coverage.push({
        source,
        status: screened ? 'partial' : 'empty',
        query,
        screened,
        fullJd,
        note: `Read ${pages} response page(s), bounded to ${source === 'himalayas' ? 40 : source === 'google-jobs' ? 20 : 100} rows. ${screened - fullJd} rows were summaries, excerpts or invalid. Eligibility remains unverified. ATS boards are unfiltered; query preferences are not an employer API filter. Not an exhaustive search.`,
        checkedAt: stamp,
      });
    } catch {
      coverage.push({
        source,
        status: screened ? 'partial' : 'blocked',
        query,
        screened,
        fullJd,
        note: `Provider failed after ${pages} response page(s). Check feed configuration, credentials, limits and provider availability. No secret or raw error is logged.`,
        checkedAt: stamp,
      });
    }
  }
  for (const p of profile.platforms || [])
    if (!coverage.some((c) => c.source === p))
      coverage.push({
        source: p,
        status: 'not_run',
        query: profile.targetRoles.join(' OR ').slice(0, 500),
        screened: 0,
        fullJd: 0,
        note: 'No automatic feed configured. Ask your agent to search this source and import evidence; this run does not count it as searched.',
        checkedAt: stamp,
      });
  const unique = [...new Map(jobs.map((j) => [j.id, j])).values()].slice(0, 500);
  return {
    run: {
      id: 'search-' + randomUUID(),
      kind: 'daily',
      startedAt: stamp,
      finishedAt: now(),
      coverage,
      note: 'Automatic collection only. No ability assessment, personal decision or factual eligibility inferred.',
    },
    jobs: unique,
  };
}

// Research merges only observed fields; it cannot change user decisions or progress.
export async function saveResearch(store, bundle) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await store.read();
    try {
      return await store.update(current.revision, { type: 'research', ...bundle });
    } catch (e) {
      if (!/conflict/i.test(e.message) || attempt === 2) throw e;
    }
  }
}
