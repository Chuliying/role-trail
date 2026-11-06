# Source routes for the agent

Use only the sources selected in the user's profile. These are operating instructions for the host LLM, not a claim that the built-in collector implements every site. Choose terms from the user's field and language. For engineering searches, distinguish software frontend from semiconductor frontend.

Start with public APIs/HTTP and configured feeds. Use host web search and original employer pages to fill gaps. A logged-in browser is optional; don't bypass an access restriction. Record direct and fallback scopes separately. A web result that mentions a platform does not count as a full search of that platform.

The source routes, labels and built-in feed mappings live in [`config/sources.json`](../config/sources.json). Read the selected entries there, or use `sourceDefinitions` in the generated agent work packet. That packet preserves custom user source IDs and labels unregistered sources as manual routes. The catalog contains twelve discovery sources; it does not claim twelve automated collectors.

Use [sources.md](sources.md) for the built-in feed configuration and request limits. Optional accounts belong to the user. A provider setup is only verified after a real bounded response is checked; don't reuse another person's keys or claim uptime from fixture tests.

For language exclusions, apply the user's stated rule. If they accept only English work, a Japanese-only JD without explicit English working permission is excluded on language evidence, not marked closed and not given a lower ability score. Do not impose this preference on users who do work in Japanese.

The final research bundle needs one coverage entry for every selected source, even if it was blocked or not run. Include the actual query/scope, screened listings, full JDs and limitation. The completion check detects missing source entries; the agent must still verify that the stated counts and sources are real.
