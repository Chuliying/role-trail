import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { demoActions } from '../src/demo.mjs';
import { emptyState, transition } from '../src/workbench.mjs';
import { workPacket } from '../src/agent-workflow.mjs';
import { validateFeeds } from '../src/onboarding.mjs';

test('catalog declares twelve discovery sources and preserves custom source coverage', async () => {
  const { configuration, sourceDefinition } = await import('../src/configuration.mjs');
  assert.equal(configuration.sources.sources.length, 12);
  assert.equal(new Set(configuration.sources.sources.map((s) => s.id)).size, 12);
  assert.deepEqual(sourceDefinition('official').feedTypes, ['greenhouse', 'lever']);
  const s = demoActions().reduce(transition, emptyState());
  s.profile.platforms = ['104', 'wellfound', 'official', 'custom-board'];
  const p = workPacket(s);
  assert.deepEqual(p.sources, s.profile.platforms);
  assert.equal(p.sourceDefinitions[0].label, '104');
  assert.equal(p.sourceDefinitions[1].feedTypes.length, 0);
  assert.equal(p.sourceDefinitions[3].id, 'custom-board');
  assert.equal(p.sourceDefinitions[3].registered, false);
});

test('catalog validation fails on duplicate IDs, unsupported adapters and embedded secrets', async () => {
  const { configuration, validateConfiguration } = await import('../src/configuration.mjs');
  for (const mutate of [
    (c) => c.sources.sources.push(c.sources.sources[0]),
    (c) => (c.sources.feeds[0].id = 'execute-arbitrary-code'),
    (c) => (c.sources.feeds[0].token = 'test-token-not-a-credential'),
    (c) => (c.sources.sources[0].homepage = 'javascript:alert(1)'),
    (c) => (c.ui.defaults.pageSize = -1),
    (c) => (c.ui.decisions[0].id = 'invented-status'),
    (c) => (c.verification.freshness.availabilityDays = 0),
    (c) => (c.verification.aliases.unknown = 'missing-icon'),
  ]) {
    const c = structuredClone(configuration);
    mutate(c);
    assert.throws(() => validateConfiguration(c), /configuration/i);
  }
});

test('feed validation consumes catalog options without accepting URLs or credentials', async () => {
  const { configuration } = await import('../src/configuration.mjs');
  const wwr = configuration.sources.feeds.find((f) => f.id === 'we-work-remotely');
  for (const category of wwr.options.category)
    assert.equal(validateFeeds([{ type: wwr.id, category }])[0].category, category);
  assert.throws(() => validateFeeds([{ type: wwr.id, category: 'unknown' }]));
  assert.throws(() => validateFeeds([{ type: 'wellfound' }]));
  assert.throws(() => validateFeeds([{ type: 'himalayas', url: 'https://localhost/' }]));
  assert.throws(() => validateFeeds([{ type: 'himalayas', token: 'test-token-not-a-credential' }]));
});

test('browser catalogs and deployment allowlist match validated source JSON', async () => {
  const { configuration, browserConfiguration } = await import('../src/configuration.mjs');
  const { settings } = await import('../web/configuration.mjs');
  const { staticFiles } = await import('../src/deployment.mjs');
  assert.deepEqual(settings, browserConfiguration(configuration));
  assert.ok(staticFiles.includes('configuration.mjs'));
  const ui = JSON.parse(await readFile(new URL('../config/ui.json', import.meta.url)));
  assert.equal(settings.ui.defaults.pageSize, ui.defaults.pageSize);
  assert.equal(settings.ui.defaults.sort, 'recent');
});

test('language packs cover matching UI keys and interpolation parameters', async () => {
  const { configuration, validateConfiguration } = await import('../src/configuration.mjs');
  const { en, 'zh-TW': zh } = configuration.messages;
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
  const params = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of Object.keys(en)) assert.deepEqual(params(en[key]), params(zh[key]), key);
  const missing = structuredClone(configuration);
  delete missing.messages['zh-TW'].Opportunities;
  assert.throws(() => validateConfiguration(missing), /configuration/i);
  const { staticFiles } = await import('../src/deployment.mjs');
  const manifest = JSON.parse(await readFile(new URL('../web/modules.json', import.meta.url)));
  for (const name of manifest) assert.ok(staticFiles.includes(name), name);
});
