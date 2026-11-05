# Source routes for the agent

Use only the sources selected in the user's profile. These are operating instructions for the host LLM, not a claim that the built-in collector implements every site. Choose terms from the user's field and language. For engineering searches, distinguish software frontend from semiconductor frontend.

Start with public APIs/HTTP and configured feeds. Use host web search and original employer pages to fill gaps. A logged-in browser is optional; don't bypass an access restriction. Record direct and fallback scopes separately. A web result that mentions a platform does not count as a full search of that platform.

| Source | Route and checks |
| --- | --- |
| 104 | Read software/product results and individual JDs with available host tools. If direct access fails, use a bounded search-engine query and employer pages. A user-approved Apify route may provide listing summaries; inspect actual completeness and account limits before using it. Don't call snippets full JDs or silently schedule a billed trial. |
| Job-Frog | Search product/software terms; expand company groups to individual roles. Company counts and aggregate cards are not full JD counts. Rotate terms if semiconductor results dominate. |
| Wellfound | Inspect role results, then individual postings and the employer's current careers page. Verify hiring countries and first-posted versus reposted dates. |
| LinkedIn | Use accessible job search/guest results or the user's authorized session. Track pagination and distinguish result cards from complete descriptions. Confirm the role on the employer's site. |
| Indeed | Use available public/host routes or an explicitly configured JobSpy environment. Check the provider country/location and actual description output. Keep dependency/runtime failures distinct from zero matches. Search-engine snippets are fallback leads, not an Indeed JD fetch. |
| Google Jobs | Prefer the configured SerpApi route when the user has authorized it. Preserve pagination limits, excerpts and relative-date wording. A normal Google web query is separate coverage, not Google Jobs coverage. No keys or key-bearing URLs in logs. |
| Japan Dev | Use Remote Work Worldwide when relevant. Overseas applications or Japan-only remote work do not establish permission to remain in another country. Inspect the employer's JD. |
| TokyoDev | Check whether applying from abroad requires moving to Japan. Verify working language, employment form and actual long-term work location. |
| Wantedly | Use the user's languages and appropriate terms; for English-speaking overseas applicants, terms such as 海外在住可 and 海外から勤務 may help. Verify that the selected team/role permits the user's working language. An English website alone is insufficient. Distinguish employment from contracting. |
| Himalayas | Use the public API/feed with the chosen country and timezone; encode `+` in timezone query values. Record pages and country restrictions, then verify the original employer JD. |
| Official careers | Follow selected and newly discovered employers. Use public Greenhouse/Lever feeds where applicable; otherwise inspect their careers pages or ATS. Preserve original application links. An unavailable board or missing search result does not prove a role closed. |

Use [sources.md](sources.md) for the built-in feed configuration and request limits. Optional accounts belong to the user. A provider setup is only verified after a real bounded response is checked; don't reuse another person's keys or claim uptime from fixture tests.

For language exclusions, apply the user's stated rule. If they accept only English work, a Japanese-only JD without explicit English working permission is excluded on language evidence, not marked closed and not given a lower ability score. Do not impose this preference on users who do work in Japanese.

The final research bundle needs one coverage entry for every selected source, even if it was blocked or not run. Include the actual query/scope, screened listings, full JDs and limitation. The completion check detects missing source entries; the agent must still verify that the stated counts and sources are real.
