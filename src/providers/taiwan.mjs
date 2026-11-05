import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const exec = promisify(execFile);
const nonempty = (x) => typeof x === 'string' && Boolean(x.trim());
function httpsURL(value) {
  try {
    const u = new URL(value);
    if (u.protocol === 'https:' && !u.username && !u.password && !u.port) return u;
  } catch {}
  return null;
}
function description(value, minimum = 80) {
  if (
    !nonempty(value) ||
    value.trim().length < minimum ||
    /^(access denied|forbidden|verify you are human|just a moment)/i.test(value.trim())
  )
    throw Error('description missing or unusable');
  return value;
}
function candidate(source, provider, row) {
  if (!nonempty(row.title) || !nonempty(row.company) || !httpsURL(row.url))
    throw Error('job identity missing');
  return {
    ...row,
    discoverySource: source,
    provider,
    postingKind: 'unknown',
    reviewStatus: 'unreviewed',
    fetchStatus: 'description_fetched',
  };
}
export function parseIndeed(payload) {
  if (
    !['ok', 'partial'].includes(payload?.status) ||
    !Array.isArray(payload.rows) ||
    (payload.status === 'ok' && payload.errors)
  )
    throw Error('Indeed provider failure');
  return payload.rows.map((r) => {
    const url = httpsURL(r.job_url);
    if (
      r.site !== 'indeed' ||
      url?.hostname !== 'tw.indeed.com' ||
      url.pathname !== '/viewjob' ||
      !url.searchParams.get('jk')
    )
      throw Error('Indeed identity mismatch');
    return candidate('indeed', 'jobspy', {
      title: r.title,
      company: r.company,
      url: url.href,
      sourceURL: url.href,
      descriptionText: description(r.description),
      descriptionSource: url.href,
      location: r.location ?? null,
      platformDate: r.date_posted ?? null,
      platformRemote: typeof r.is_remote === 'boolean' ? r.is_remote : null,
      employerLink: httpsURL(r.job_url_direct)?.href ?? null,
    });
  });
}
function googleEmpty(payload) {
  return (
    payload?.search_metadata?.status === 'Success' &&
    payload.error === "Google hasn't returned any results for this query." &&
    (payload.jobs_results === undefined ||
      (Array.isArray(payload.jobs_results) && payload.jobs_results.length === 0))
  );
}
export function parseGoogleJobs(payload) {
  if (googleEmpty(payload)) return [];
  if (payload?.error || payload?.search_metadata?.status === 'Error')
    throw Error('Google Jobs provider failure');
  if (!Array.isArray(payload?.jobs_results)) throw Error('Google Jobs schema missing jobs_results');
  return payload.jobs_results.map((r) => {
    const applyOptions = (r.apply_options ?? [])
      .filter((o) => httpsURL(o.link))
      .map((o) => ({ title: o.title ?? '', url: o.link }));
    const share = httpsURL(r.share_link);
    const sourceURL = share?.hostname === 'www.google.com' ? share.href : null;
    const url = applyOptions[0]?.url || sourceURL;
    if (!url) throw Error('Google Jobs source URL missing');
    const job = candidate('google-jobs', 'serpapi', {
      title: r.title,
      company: r.company_name,
      url,
      sourceURL,
      providerJobId: r.job_id ?? null,
      applyOptions,
      descriptionText: description(r.description, 1),
      descriptionSource: sourceURL || 'https://serpapi.com/google-jobs-api',
      location: r.location ?? null,
      platformDate: r.detected_extensions?.posted_at ?? null,
      platformRemote: r.detected_extensions?.work_from_home ?? null,
    });
    const seoBlurb =
      /工作職缺\s*\|/.test(job.descriptionText) &&
      /就上1111人力銀行求職網/.test(job.descriptionText);
    return {
      ...job,
      fetchStatus: seoBlurb ? 'summary_only' : job.fetchStatus,
      descriptionCompleteness: seoBlurb ? 'seo_blurb' : 'unverified_provider',
    };
  });
}
export function parse104Cloud(payload) {
  if (!Array.isArray(payload)) throw Error('104 cloud schema must be records');
  return payload.map((r) => {
    const url = httpsURL(r.url);
    if (url?.hostname !== 'www.104.com.tw' || !/^\/job\/[a-z0-9]+$/.test(url.pathname))
      throw Error('104 identity mismatch');
    return {
      ...candidate('104', 'apify', {
        title: r.title,
        company: r.company,
        url: url.href,
        sourceURL: url.href,
        descriptionText: description(r.descriptionText),
        descriptionSource: url.href,
        location: r.location ?? null,
        platformDate: r.appearDate ?? r.publishDate ?? null,
        platformRemote: typeof r.isRemote === 'boolean' ? r.isRemote : null,
        providerFetchedAt: r.scrapedAt ?? null,
        searchKeyword: r.searchKeyword ?? null,
      }),
      // Live run 2026-11-05: actor only visited the listing API and silently
      // returned truncated snippets. Text length cannot establish completeness.
      fetchStatus: 'summary_only',
      descriptionCompleteness: 'unverified_listing',
    };
  });
}

// Keys stay in memory, never shell arguments, logs, raw HTTP snapshots or packets.
// Fixed provider hosts only; do not follow redirects with a credential.
export async function providerRequest(url, options = {}) {
  const u = httpsURL(url);
  if (!u || !['serpapi.com', 'api.apify.com'].includes(u.hostname))
    throw Error('provider host not allowed');
  const response = await fetch(u, {
    ...options,
    redirect: 'error',
    signal: AbortSignal.timeout(40000),
  });
  if (!response.ok) throw Error('provider HTTP failure');
  const reader = response.body.getReader();
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 5_000_000) throw Error('provider response too large');
      chunks.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel();
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function indeedBridge(query, env, location) {
  const python = env.JOB_HUNTER_PYTHON || join(homedir(), '.venv/job-hunter/bin/python3');
  const { stdout } = await exec(
    python,
    [fileURLToPath(new URL('./indeed-fetch.py', import.meta.url)), query, location],
    {
      timeout: 60000,
      maxBuffer: 5 * 1024 * 1024,
      env: { PATH: env.PATH || process.env.PATH, HOME: homedir(), PYTHONIOENCODING: 'utf-8' },
    },
  );
  return JSON.parse(stdout);
}
function usableRecords(rows, parse, attempt) {
  if (!Array.isArray(rows)) throw Error('provider schema missing records');
  parse([]); // Validate envelope/errors even when the response has no rows.
  const jobs = [];
  attempt.rejected = 0;
  for (const row of rows.slice(0, 10)) {
    try {
      jobs.push(...parse([row]));
    } catch {
      attempt.rejected++;
    }
  }
  if (attempt.rejected && !jobs.length) throw Error('no usable provider records');
  return jobs;
}
export async function collectProviders({
  query,
  googleQuery = query,
  location = 'Taipei, Taiwan',
  env = process.env,
  sources = ['indeed', 'google-jobs', '104'],
  request = providerRequest,
  indeed = indeedBridge,
} = {}) {
  if (!nonempty(query) || query.length > 160 || !nonempty(googleQuery) || googleQuery.length > 160)
    throw Error('Invalid query');
  const candidates = [],
    attempts = [],
    nextActions = [];
  for (const source of sources) {
    const actualQuery = source === 'google-jobs' ? googleQuery : query;
    const startedAt = new Date().toISOString();
    const attempt = {
      source,
      query: actualQuery,
      attemptedAt: startedAt,
      limit: 10,
      reviewed: 0,
      eligible: 0,
    };
    if (source === '104' && env.APIFY_TOKEN && env.ROLE_TRAIL_104_CLOUD !== 'enabled') {
      const reason =
        '104 credential configured; cloud trial disabled. Live actor returns listing summaries only; no daily full-JD acquisition claim';
      attempts.push({ ...attempt, status: 'disabled', reason });
      nextActions.push({ source, status: 'pending-agent-review', reason });
      continue;
    }
    const missing =
      source === 'google-jobs' && !env.SERPAPI_API_KEY
        ? 'Set SERPAPI_API_KEY in the scheduled process environment; optional provider integration; verify your own account and quota'
        : source === '104' && (!env.APIFY_TOKEN || env.ROLE_TRAIL_104_CLOUD !== 'enabled')
          ? '104 local API/headless/relay trials failed. Cloud trial requires APIFY_TOKEN and explicit ROLE_TRAIL_104_CLOUD=enabled; use only after authorizing your own provider quota'
          : null;
    if (missing) {
      attempts.push({ ...attempt, status: 'needs_configuration', reason: missing });
      nextActions.push({ source, status: 'pending-setup', reason: missing });
      continue;
    }
    try {
      let jobs, payload;
      if (source === 'indeed') {
        payload = await indeed(query, env, location);
        jobs = usableRecords(payload.rows, (rows) => parseIndeed({ ...payload, rows }), attempt);
        attempt.provider = 'jobspy';
        attempt.version = payload.version;
      } else if (source === 'google-jobs') {
        const url = new URL('https://serpapi.com/search.json');
        url.search = new URLSearchParams({
          engine: 'google_jobs',
          q: googleQuery + ' jobs',
          location,
          gl: 'tw',
          hl: 'en',
          api_key: env.SERPAPI_API_KEY,
        });
        payload = await request(url.href);
        jobs = usableRecords(
          googleEmpty(payload) ? [] : payload.jobs_results,
          (rows) => parseGoogleJobs({ ...payload, jobs_results: rows }),
          attempt,
        );
        attempt.provider = 'serpapi';
        attempt.hasMore = Boolean(payload.serpapi_pagination?.next_page_token);
      } else if (source === '104') {
        // Trial only; never auto-retry a possibly billed request. Server-side cost and time caps.
        payload = await request(
          'https://api.apify.com/v2/acts/unfenced-group~taiwan104-scraper/run-sync-get-dataset-items?timeout=30&maxTotalChargeUsd=0.05&maxItems=10&restartOnError=false&format=json',
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + env.APIFY_TOKEN,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ searchQuery: [query], area: '6001001000', maxResults: 10 }),
          },
        );
        jobs = usableRecords(payload, parse104Cloud, attempt);
        attempt.provider = 'apify';
        attempt.maxTotalChargeUsd = 0.05;
      } else throw Error('Unsupported source');
      jobs = jobs.slice(0, 10);
      const fetchedAt = new Date().toISOString();
      candidates.push(
        ...jobs.map((j) => ({
          ...j,
          fetchedAt,
          discoveredFrom:
            source === 'indeed'
              ? 'https://tw.indeed.com/jobs?' + new URLSearchParams({ q: query, l: location })
              : source === '104'
                ? 'https://www.104.com.tw/jobs/search/?' + new URLSearchParams({ keyword: query })
                : 'https://www.google.com/search?' +
                  new URLSearchParams({ q: googleQuery + ' jobs', udm: '8' }),
        })),
      );
      const descriptionsFetched = jobs.filter(
        (j) => j.fetchStatus === 'description_fetched',
      ).length;
      const status =
        payload.status === 'partial' || attempt.rejected || descriptionsFetched < jobs.length
          ? 'partial'
          : jobs.length
            ? 'fetched'
            : 'empty';
      attempts.push({
        ...attempt,
        status,
        finishedAt: fetchedAt,
        fetched: jobs.length,
        descriptionsFetched,
        scope: 'bounded query, not full source coverage',
      });
      if (status === 'partial' || status === 'empty')
        nextActions.push({
          source,
          status: 'pending-agent-review',
          reason:
            status === 'empty'
              ? 'Provider returned no usable records for this query; test another role query, not a market conclusion'
              : 'Provider returned partial results; remaining scope unverified',
        });
    } catch {
      // Upstream errors can contain key-bearing request URLs; persist only this fixed message.
      attempts.push({
        ...attempt,
        status: 'failed',
        reason:
          'Provider request, dependency or response validation failed; no empty-success claim',
      });
      nextActions.push({
        source,
        status: 'pending-agent-review',
        reason:
          'Check runtime dependency/key and provider account status; do not retry billed requests automatically',
      });
    }
  }
  return { candidates, attempts, nextActions };
}
