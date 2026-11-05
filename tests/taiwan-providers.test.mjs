import test from 'node:test';
import assert from 'node:assert/strict';
let api = {};
try {
  api = await import('../src/providers/taiwan.mjs');
} catch (e) {
  if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e;
}
const description =
  'Build and maintain React product interfaces. Work with designers and engineers. '.repeat(3);
const indeed = {
  site: 'indeed',
  title: 'Frontend Engineer',
  company: 'Example',
  job_url: 'https://tw.indeed.com/viewjob?jk=abc',
  description,
  location: 'Taipei',
  date_posted: '2026-11-01',
  is_remote: true,
};
test('Indeed validates source identity, preserves JD and separates remote/date from eligibility', () => {
  assert.equal(typeof api.parseIndeed, 'function', 'Indeed adapter required');
  const [job] = api.parseIndeed({ status: 'ok', rows: [indeed], errors: 0 });
  assert.equal(job.descriptionText, description);
  assert.equal(job.discoverySource, 'indeed');
  assert.equal(job.platformRemote, true);
  assert.equal(job.postingKind, 'unknown');
  assert.equal(job.checks, undefined);
  assert.throws(() => api.parseIndeed({ status: 'error', rows: [], errors: 1 }), /provider/);
  assert.throws(
    () =>
      api.parseIndeed({
        status: 'ok',
        rows: [{ ...indeed, job_url: 'https://evil.test/job' }],
        errors: 0,
      }),
    /identity/,
  );
  assert.throws(
    () => api.parseIndeed({ status: 'ok', rows: [{ ...indeed, description: null }], errors: 0 }),
    /description/,
  );
});
test('Google Jobs accepts only jobs_results; preserves apply links and provider attribution', () => {
  assert.equal(typeof api.parseGoogleJobs, 'function', 'Google Jobs adapter required');
  const row = {
    title: 'Product Engineer',
    company_name: 'Example',
    job_id: '123',
    description,
    share_link: 'https://www.google.com/search?ibp=htl;jobs',
    apply_options: [{ title: 'Company', link: 'https://example.test/jobs/1' }],
    detected_extensions: { posted_at: '2 days ago', work_from_home: true },
  };
  const [j] = api.parseGoogleJobs({ search_metadata: { status: 'Success' }, jobs_results: [row] });
  assert.equal(j.discoverySource, 'google-jobs');
  assert.equal(j.provider, 'serpapi');
  assert.equal(j.url, 'https://example.test/jobs/1');
  assert.equal(j.postingKind, 'unknown');
  assert.throws(() => api.parseGoogleJobs({ organic_results: [row] }), /schema/);
  assert.throws(() => api.parseGoogleJobs({ error: 'Invalid key', jobs_results: [] }), /provider/);
  assert.deepEqual(
    api.parseGoogleJobs({ search_metadata: { status: 'Success' }, jobs_results: [] }),
    [],
  );
  assert.throws(
    () =>
      api.parseGoogleJobs({
        jobs_results: [
          { ...row, apply_options: [{ link: 'javascript:alert(1)' }], share_link: null },
        ],
      }),
    /URL/,
  );
});
test('104 cloud records require 104 identity and real description; never infer open/remote', () => {
  assert.equal(typeof api.parse104Cloud, 'function', '104 adapter required');
  const row = {
    id: 'abc',
    url: 'https://www.104.com.tw/job/abc',
    title: '前端工程師',
    company: 'Example',
    descriptionText: description,
    searchKeyword: 'React',
    isRemote: true,
  };
  const [j] = api.parse104Cloud([row]);
  assert.equal(j.provider, 'apify');
  assert.equal(j.availability, undefined);
  assert.equal(j.checks, undefined);
  assert.throws(() => api.parse104Cloud([{ error: 'blocked' }]), /identity/);
  assert.throws(
    () => api.parse104Cloud([{ ...row, descriptionText: 'Access denied' }]),
    /description/,
  );
  assert.throws(
    () => api.parse104Cloud([{ ...row, url: 'https://www.104.com.tw.evil.test/job/abc' }]),
    /identity/,
  );
});
test('missing keys never send requests; paid provider requires separate opt-in', async () => {
  assert.equal(typeof api.collectProviders, 'function', 'Collector required');
  let calls = 0;
  const result = await api.collectProviders({
    query: 'React',
    env: {},
    sources: ['104', 'google-jobs'],
    request: async () => {
      calls++;
      throw Error('must not run');
    },
  });
  assert.equal(calls, 0);
  assert.equal(result.candidates.length, 0);
  assert.deepEqual(
    result.attempts.map((a) => a.status),
    ['needs_configuration', 'needs_configuration'],
  );
  const disabled = await api.collectProviders({
    query: 'React',
    env: { APIFY_TOKEN: 'test' },
    sources: ['104'],
    request: async () => {
      calls++;
    },
  });
  assert.equal(calls, 0);
  assert.equal(disabled.attempts[0].status, 'disabled');
});
test('SerpApi requests are bounded and packet/log metadata never exposes keys', async () => {
  assert.equal(typeof api.collectProviders, 'function');
  const seen = [];
  const result = await api.collectProviders({
    query: 'React',
    sources: ['google-jobs'],
    env: { SERPAPI_API_KEY: 'example-test-key' },
    request: async (url, options) => {
      seen.push({ url, options });
      return { search_metadata: { status: 'Success' }, jobs_results: [] };
    },
  });
  assert.equal(seen.length, 1);
  assert.equal(new URL(seen[0].url).searchParams.get('engine'), 'google_jobs');
  assert.equal(new URL(seen[0].url).searchParams.get('gl'), 'tw');
  assert.equal(JSON.stringify(result).includes('example-test-key'), false);
  assert.equal(result.attempts[0].status, 'empty');
});
test('provider errors are sanitized, not converted into successful empty searches', async () => {
  assert.equal(typeof api.collectProviders, 'function');
  const result = await api.collectProviders({
    query: 'React',
    sources: ['google-jobs'],
    env: { SERPAPI_API_KEY: 'example-test-key' },
    request: async () => {
      throw Error('https://serpapi.com/?api_key=example-test-key');
    },
  });
  assert.equal(result.attempts[0].status, 'failed');
  assert.equal(JSON.stringify(result).includes('example-test-key'), false);
});
test('104 trial uses explicit cost/time/result caps and never retries or leaks bearer token', async () => {
  const calls = [];
  const r = await api.collectProviders({
    query: 'React',
    sources: ['104'],
    env: { APIFY_TOKEN: 'private-test-token', ROLE_TRAIL_104_CLOUD: 'enabled' },
    request: async (url, options) => {
      calls.push({ url, options });
      throw Error('timeout private-test-token');
    },
  });
  assert.equal(calls.length, 1);
  const url = new URL(calls[0].url);
  assert.equal(url.searchParams.get('maxTotalChargeUsd'), '0.05');
  assert.equal(url.searchParams.get('timeout'), '30');
  assert.equal(url.searchParams.get('restartOnError'), 'false');
  assert.equal(JSON.parse(calls[0].options.body).maxResults, 10);
  assert.equal(url.href.includes('private-test-token'), false);
  assert.equal(JSON.stringify(r).includes('private-test-token'), false);
  assert.equal(r.attempts[0].status, 'failed');
});
test('Indeed partial data is retained as partial, and no-source errors do not discard other sources', async () => {
  const r = await api.collectProviders({
    query: 'React',
    env: {},
    indeed: async () => ({ status: 'partial', rows: [indeed], errors: 1, version: '1.3.0' }),
  });
  assert.equal(r.candidates.length, 1);
  assert.equal(r.attempts[0].status, 'partial');
  assert.equal(r.attempts[0].descriptionsFetched, 1);
  assert.equal(r.attempts[0].reviewed, 0);
  assert.equal(r.attempts.length, 3);
});
test('one malformed record does not discard valid JDs; rejected records remain visible', async () => {
  const r = await api.collectProviders({
    query: 'React',
    sources: ['indeed'],
    env: {},
    indeed: async () => ({
      status: 'ok',
      rows: [indeed, { ...indeed, description: null }],
      errors: 0,
    }),
  });
  assert.equal(r.candidates.length, 1);
  assert.equal(r.attempts[0].status, 'partial');
  assert.equal(r.attempts[0].rejected, 1);
});
test('104 listing payloads remain leads, never full descriptions even when text is long', async () => {
  const r = await api.collectProviders({
    query: 'React',
    sources: ['104'],
    env: { APIFY_TOKEN: 'fixture', ROLE_TRAIL_104_CLOUD: 'enabled' },
    request: async () => [
      {
        url: 'https://www.104.com.tw/job/abc',
        title: 'Frontend',
        company: 'Example',
        descriptionText: description.repeat(10),
      },
    ],
  });
  assert.equal(r.candidates.length, 1);
  assert.equal(r.candidates[0].fetchStatus, 'summary_only');
  assert.equal(r.candidates[0].descriptionCompleteness, 'unverified_listing');
  assert.equal(r.attempts[0].fetched, 1);
  assert.equal(r.attempts[0].descriptionsFetched, 0);
  assert.equal(r.attempts[0].status, 'partial');
});
test('SerpApi successful no-results response is empty; authentication error remains failed', async () => {
  const empty = {
    search_metadata: { status: 'Success' },
    error: "Google hasn't returned any results for this query.",
  };
  const r = await api.collectProviders({
    query: 'React',
    sources: ['google-jobs'],
    env: { SERPAPI_API_KEY: 'fixture' },
    request: async () => empty,
  });
  assert.equal(r.attempts[0].status, 'empty');
  assert.equal(r.attempts[0].fetched, 0);
  assert.throws(
    () => api.parseGoogleJobs({ ...empty, search_metadata: { status: 'Error' } }),
    /provider/,
  );
});
test('Google query override does not alter Indeed and preserves actual query provenance', async () => {
  let seenGoogle, seenIndeed;
  const r = await api.collectProviders({
    query: 'React',
    googleQuery: '前端工程師',
    sources: ['indeed', 'google-jobs'],
    env: { SERPAPI_API_KEY: 'fixture' },
    indeed: async (q) => {
      seenIndeed = q;
      return { status: 'ok', rows: [], errors: 0 };
    },
    request: async (u) => {
      seenGoogle = new URL(u).searchParams.get('q');
      return { jobs_results: [] };
    },
  });
  assert.equal(seenIndeed, 'React');
  assert.equal(seenGoogle, '前端工程師 jobs');
  assert.equal(r.attempts[1].query, '前端工程師');
  await assert.rejects(
    api.collectProviders({ query: 'React', googleQuery: ' ', sources: [] }),
    /query/i,
  );
});
test('Google Jobs SEO result blurbs are retained as leads rather than descriptions', async () => {
  const row = {
    title: 'Frontend',
    company_name: 'Example',
    description:
      '台北市工作職缺 | 前端工程師 | Example | 月薪 40,000 至 45,000元 | 2026-11-04｜找工作、求職、兼職、短期打工、實習，就上1111人力銀行求職網。',
    apply_options: [{ link: 'https://www.1111.com.tw/job/123' }],
  };
  const r = await api.collectProviders({
    query: '前端工程師',
    sources: ['google-jobs'],
    env: { SERPAPI_API_KEY: 'fixture' },
    request: async () => ({ jobs_results: [row] }),
  });
  assert.equal(r.attempts[0].descriptionsFetched, 0);
  assert.equal(r.attempts[0].status, 'partial');
  assert.equal(r.candidates[0].fetchStatus, 'summary_only');
});
