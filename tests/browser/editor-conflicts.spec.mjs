import { test, expect } from '@playwright/test';
import { demoActions } from '../../src/demo.mjs';
import { transition, emptyState } from '../../src/workbench.mjs';
async function setup(page) {
  let state = demoActions().reduce(transition, emptyState());
  let writes = 0;
  let race = false;
  let failRead = false;
  await page.route('**/api/state', (route) =>
    failRead
      ? route.fulfill({ status: 503, json: { error: 'Synthetic read failure' } })
      : route.fulfill({ json: state }),
  );
  await page.route('**/api/action', async (route) => {
    writes++;
    const body = route.request().postDataJSON();
    if (race) {
      race = false;
      state = {
        ...state,
        revision: state.revision + 1,
        profile: { ...state.profile, location: 'Racing location' },
      };
    }
    if (body.revision !== state.revision)
      return route.fulfill({
        status: 409,
        json: { error: 'Revision conflict; refresh and retry' },
      });
    state = transition(state, body.action);
    await route.fulfill({ json: state });
  });
  await page.goto('/?view=profile');
  return {
    get state() {
      return state;
    },
    get writes() {
      return writes;
    },
    update(patch) {
      state = { ...state, ...patch, revision: state.revision + 1 };
    },
    race() {
      race = true;
    },
    failRead() {
      failRead = true;
    },
  };
}
async function edit(page, patch) {
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  const input = page.locator('#editor textarea');
  const draft = { ...JSON.parse(await input.inputValue()), ...patch };
  await input.fill(JSON.stringify(draft));
  return { input, draft };
}
const save = (page) => page.locator('#editor [type=submit]').click();

test('profile save merges disjoint external edits with the user draft', async ({ page }) => {
  const env = await setup(page);
  await edit(page, { name: 'My edited name' });
  env.update({ profile: { ...env.state.profile, location: 'External location' } });
  await save(page);
  await expect(page.locator('#editor')).not.toBeVisible();
  expect(env.state.profile.name).toBe('My edited name');
  expect(env.state.profile.location).toBe('External location');
  expect(env.writes).toBe(1);
});

test('same-field conflict preserves draft and requires an explicit choice', async ({ page }) => {
  const env = await setup(page);
  const { input, draft } = await edit(page, { name: 'My edited name' });
  env.update({
    profile: { ...env.state.profile, name: 'External name', location: 'New location' },
  });
  await save(page);
  await expect(page.locator('[data-editor-conflict]')).toBeVisible();
  await expect(input).toHaveValue(JSON.stringify(draft));
  expect(env.writes).toBe(0);
  await expect(page.locator('#editor [type=submit]')).toBeDisabled();
  await page.getByRole('button', { name: 'Use my draft', exact: true }).click();
  await save(page);
  await expect(page.locator('#editor')).not.toBeVisible();
  expect(env.state.profile.name).toBe('My edited name');
  expect(env.state.profile.location).toBe('New location');
});

test('a racing revision conflict retains edits and needs another explicit save', async ({
  page,
}) => {
  const env = await setup(page);
  await edit(page, { name: 'My edited name' });
  env.race();
  await save(page);
  await expect(page.locator('#editor-notice')).toContainText('Workspace changed again');
  await expect(page.locator('#editor')).toBeVisible();
  expect(env.writes).toBe(1);
  await save(page);
  await expect(page.locator('#editor')).not.toBeVisible();
  expect(env.state.profile.name).toBe('My edited name');
  expect(env.state.profile.location).toBe('Racing location');
});

test('failed latest read retains the draft and sends no write', async ({ page }) => {
  const env = await setup(page);
  const { input, draft } = await edit(page, { name: 'My edited name' });
  env.failRead();
  await save(page);
  await expect(page.locator('#editor-notice')).toContainText('Synthetic read failure');
  await expect(input).toHaveValue(JSON.stringify(draft));
  expect(env.writes).toBe(0);
});

async function editCapability(page, patch) {
  await page
    .locator('.capability-section article')
    .first()
    .getByRole('button', { name: 'Review / edit' })
    .click();
  const input = page.locator('#editor textarea');
  const draft = { ...JSON.parse(await input.inputValue()), ...patch };
  await input.fill(JSON.stringify(draft));
  return { input, draft };
}
test('capability edits merge by stable identity and preserve other records', async ({ page }) => {
  const env = await setup(page);
  const { draft } = await editCapability(page, { claim: 'My specific contribution' });
  const before = env.state.capabilities;
  env.update({
    capabilities: before.map((c) => (c.id === draft.id ? { ...c, tags: ['external-tag'] } : c)),
  });
  await save(page);
  await expect(page.locator('#editor')).not.toBeVisible();
  expect(env.state.capabilities.find((c) => c.id === draft.id)).toMatchObject({
    claim: draft.claim,
    tags: ['external-tag'],
  });
  expect(env.state.capabilities.filter((c) => c.id !== draft.id)).toEqual(
    before.filter((c) => c.id !== draft.id),
  );
});
test('changed evidence cannot be silently confirmed', async ({ page }) => {
  const env = await setup(page);
  env.update({ capabilities: env.state.capabilities.map((c) => ({ ...c, status: 'proposed' })) });
  await page.reload();
  const { input, draft } = await editCapability(page, { status: 'confirmed' });
  env.update({
    capabilities: env.state.capabilities.map((c) =>
      c.id === draft.id ? { ...c, evidence: ['External replacement evidence'] } : c,
    ),
  });
  await save(page);
  await expect(page.locator('[data-editor-conflict]')).toContainText(
    'External replacement evidence',
  );
  expect(env.writes).toBe(0);
  await expect(input).toHaveValue(JSON.stringify(draft));
  await page.getByRole('button', { name: 'Use latest', exact: true }).click();
  await save(page);
  await expect(page.locator('#editor')).not.toBeVisible();
  expect(env.state.capabilities.find((c) => c.id === draft.id).status).toBe('proposed');
});
test('deleted capability is not silently recreated and choosing latest accepts deletion', async ({
  page,
}) => {
  const env = await setup(page);
  const { draft } = await editCapability(page, { claim: 'Unsaved claim' });
  env.update({ capabilities: env.state.capabilities.filter((c) => c.id !== draft.id) });
  await save(page);
  await expect(page.locator('[data-editor-conflict]')).toContainText('Not present');
  expect(env.writes).toBe(0);
  await page.getByRole('button', { name: 'Use latest', exact: true }).click();
  await expect(page.locator('#editor')).not.toBeVisible();
  expect(env.writes).toBe(0);
  expect(env.state.capabilities.some((c) => c.id === draft.id)).toBe(false);
});
test('changing a capability ID is blocked before writing', async ({ page }) => {
  const env = await setup(page);
  await editCapability(page, { id: 'another-record' });
  await save(page);
  await expect(page.locator('#editor-notice')).toContainText(
    'Capability identity cannot be changed',
  );
  expect(env.writes).toBe(0);
});
test('a second external edit after conflict selection requires a fresh comparison', async ({
  page,
}) => {
  const env = await setup(page);
  await edit(page, { name: 'My edited name' });
  env.update({ profile: { ...env.state.profile, name: 'First external name' } });
  await save(page);
  await page.getByRole('button', { name: 'Use my draft', exact: true }).click();
  env.update({ profile: { ...env.state.profile, name: 'Second external name' } });
  await save(page);
  await expect(page.locator('[data-editor-conflict]')).toContainText('Second external name');
  expect(env.writes).toBe(0);
  await page.getByRole('button', { name: 'Use latest', exact: true }).click();
  await save(page);
  await expect(page.locator('#editor')).not.toBeVisible();
  expect(env.state.profile.name).toBe('Second external name');
});
test('nested profile edits preserve independent changes and treat arrays as a whole field', async ({
  page,
}) => {
  const env = await setup(page);
  env.update({
    profile: {
      ...env.state.profile,
      contacts: { email: 'old@example.test', link: 'old' },
      optional: 'old',
    },
  });
  await page.reload();
  const { input, draft } = await edit(page, {});
  draft.contacts.email = 'new@example.test';
  delete draft.optional;
  draft.languages = ['My language'];
  await input.fill(JSON.stringify(draft));
  env.update({
    profile: {
      ...env.state.profile,
      contacts: { ...env.state.profile.contacts, link: 'new' },
      languages: ['External language'],
    },
  });
  await save(page);
  await expect(page.locator('[data-editor-conflict]')).toContainText('languages');
  await page.getByRole('button', { name: 'Use latest', exact: true }).click();
  const merged = JSON.parse(await input.inputValue());
  expect(merged.contacts).toEqual({ email: 'new@example.test', link: 'new' });
  expect(merged).not.toHaveProperty('optional');
  expect(merged.languages).toEqual(['External language']);
});
test('mobile Chinese conflict comparison stays inside the editor', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('role-trail.language', 'zh-TW'));
  const env = await setup(page);
  await page.getByRole('button', { name: '編輯偏好', exact: true }).click();
  const input = page.locator('#editor textarea');
  const draft = { ...JSON.parse(await input.inputValue()), name: '我的修改' };
  await input.fill(JSON.stringify(draft));
  env.update({ profile: { ...env.state.profile, name: '另一個修改'.repeat(60) } });
  await save(page);
  await expect(page.locator('[data-editor-conflict]')).toBeVisible();
  await expect(page.getByRole('button', { name: '保留我的草稿', exact: true })).toBeVisible();
  expect(await page.locator('#editor').evaluate((n) => n.scrollWidth <= n.clientWidth + 1)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/editor-conflict-mobile.png' });
});
