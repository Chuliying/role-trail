import test from 'node:test';
import assert from 'node:assert/strict';
import { collect } from '../src/collect.mjs';
test('collection keeps heading ranks, ordered steps and nested bullets without site chrome', async () => {
  const bundle = await collect(
    {
      name: 'Synthetic',
      location: 'Example City',
      languages: ['English'],
      ownershipPolicy: 'None',
      platforms: ['greenhouse'],
      feeds: [{ type: 'greenhouse', board: 'example' }],
    },
    {
      fetchJSON: async () => ({
        jobs: [
          {
            title: 'Example role',
            absolute_url: 'https://example.test/role',
            content:
              '<nav>Pricing</nav><h2>Responsibilities</h2><p>Build <strong>accessible</strong> products.</p><h3>Process</h3><ol start="3"><li>Read requirements<ul><li>Check evidence</li></ul></li><li>Ship safely</li></ol><footer>Log in</footer><script>alert(1)</script>',
          },
        ],
      }),
    },
  );
  const text = bundle.jobs[0].description;
  assert.match(text, /### Process/);
  assert.match(text, /3\.\s+Read requirements/);
  assert.match(text, /4\.\s+Ship safely/);
  assert.match(text, /\*\*accessible\*\*/);
  assert.doesNotMatch(text, /Pricing|Log in|alert\(1\)/);
});
