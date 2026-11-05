# Configure sources, not credentials

Edit Profile in the dashboard. `platforms` is the list you expect covered. `feeds` selects automatic routes. A selected platform without a feed appears as **not_run**; your agent can search it with host tools and import actual observations. No platform is silently counted as complete.

```json
{
  "platforms": ["himalayas", "greenhouse", "lever", "google-jobs", "your-other-platform"],
  "feeds": [
    {"type":"himalayas","query":"data engineer","country":"GB","timezone":"UTC+0"},
    {"type":"greenhouse","board":"EMPLOYER_BOARD_SLUG","company":"Employer name"},
    {"type":"lever","company":"EMPLOYER_SLUG","name":"Employer name"},
    {"type":"google-jobs","query":"data engineer remote","location":"London, England, United Kingdom","country":"uk"}
  ]
}
```

These are profile fragments, not a complete initialization profile. Replace employer placeholders with an employer's actual ATS board identifier. Select only sources you want. None of these choices imposes the maintainer's geography or profession.

| Route | Credentials | Actual bounds and semantics |
| --- | --- | --- |
| [Himalayas search API](https://himalayas.app/api) | No key | At most 2 pages × 20 rows. Query, country and timezone are sent to the provider. Preserve original application links and source attribution. Aggregator publication is not proof of employer first publication; expiry archives the row. |
| [Greenhouse Job Board API](https://developers.greenhouse.io/job-board.html) | No key for public boards | First 100 returned jobs, with content. This is an unfiltered employer board, not a title-filtered search. `updated_at` is an update date. |
| [Lever Postings API](https://github.com/lever/postings-api) | No key for public boards | First 100 returned postings. Uses description, lists and additional content. Employer board identifiers must be valid. |
| [SerpApi Google Jobs](https://serpapi.com/google-jobs-api) | Your `SERPAPI_API_KEY` in server environment | One request, at most 20 rows, no automatic paid retry. Preserve excerpts and relative posting text; not direct official-JD verification. Check your own quota and current plan. |
| Other platforms | Host tools / user accounts as needed | Agent-assisted research and JSON import. Access to 104, Indeed, LinkedIn, Wellfound or other sites is not guaranteed by this package. Login barriers are not bypassed. |

Provider requests have a 20-second timeout and 8 MB response cap, fixed HTTPS hosts and redirects disabled. At most 12 feeds may be configured. A 180-second run budget prevents starting further feeds; remaining sources are recorded as not_run. Multiple feeds mean multiple requests; keep optional provider usage within your own account limits. No automatic subscription changes or card binding.

After configuration run `collect --workspace DIR`, or Search now. Inspect Research for actual source, query, page limit, screened rows, full JDs and failure status. The command saves a run even when all sources fail. No automatic collection establishes hiring eligibility, company ownership, working language or ability fit.

## Failure response

- **Wrong employer slug / 404:** open the employer's actual careers link and correct the feed. A board 404 is not evidence that every saved role closed.
- **Missing optional key:** configure it in the server environment, or remove that optional feed. Unkeyed feeds still run.
- **Blocked / timeout:** inspect current provider availability and try a bounded manual query or the employer's official page. Do not relabel search-engine snippets as a full platform search.
- **Malformed rows:** coverage counts screened rows but only accepted descriptions count as full JDs. Review skipped data before changing the parser.
- **No matches:** rotate terms and inspect an independent official source; do not infer the market has no suitable jobs.

Optional provider-account setup is user-specific. Fixture coverage proves parser behavior, not live account access. No credentials or real private job records are included in this repo.
