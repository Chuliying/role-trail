import test from 'node:test';
import assert from 'node:assert/strict';
let api = {};
try {
  api = await import('../web/verification.mjs');
} catch (e) {
  if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e;
}
const now = Date.parse('2026-11-05T10:00:00Z');
const fact = (key, days = 0) => ({
  key,
  label: 'Custom ' + key,
  status: key === 'availability' ? 'open' : 'confirmed',
  source: 'https://example.org/evidence',
  evidence: 'Explicit evidence',
  checkedAt: new Date(now - days * 86400000).toISOString(),
});
test('shared badges require positive current sourced evidence and exact expiry', () => {
  assert.equal(typeof api.verifiedItems, 'function');
  const items = api.verifiedItems(
    {
      availability: fact('availability', 7),
      checks: [
        fact('frontend', 30),
        fact('aiProduct', 31),
        fact('remote', -1),
        { ...fact('salary'), source: '' },
        { ...fact('ownership'), status: 'excluded' },
      ],
    },
    now,
  );
  assert.deepEqual(
    items.map((x) => x.key),
    ['availability', 'frontend'],
  );
  assert.equal(
    api.verifiedItems(
      {
        availability: fact('availability', 7.01),
        checks: [
          { ...fact('language'), evidence: '   ' },
          { ...fact('timezone'), source: 'javascript:alert(1)' },
        ],
      },
      now,
    ).length,
    0,
  );
});
test('known aliases use the same icon while custom fields retain their actual labels', () => {
  assert.equal(typeof api.iconFor, 'function');
  assert.equal(api.iconFor('taiwanRemote').path, api.iconFor('remote').path);
  assert.equal(api.iconFor('aiProduct').path, api.iconFor('ai-product').path);
  for (const key of ['language', 'timezone', 'salary', 'frontend', 'backend', 'design'])
    assert.equal(api.iconFor(key).custom, false);
  const custom = api.verifiedItems(
    { checks: [{ ...fact('healthcare'), label: 'Healthcare domain' }] },
    now,
  )[0];
  assert.equal(custom.label, 'Healthcare domain');
  assert.equal(custom.custom, true);
});
