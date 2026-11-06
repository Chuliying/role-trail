import { mergeWorkspaceDelta } from './sync.mjs';
// Network transport does not mutate view state or retry writes.
export function createTransport({ getState, onUnauthorized, fetcher = fetch }) {
  let validator = null;
  return async function request(path, data, { unconditional = false, signal = undefined } = {}) {
    const base = getState();
    const headers = data
      ? {
          'Content-Type': 'application/json',
          'X-Role-Trail': '1',
          'X-Role-Trail-Response': 'delta',
        }
      : {};
    if (path === 'state' && !unconditional && base && validator?.revision === base.revision)
      headers['If-None-Match'] = validator.etag;
    const response = await fetcher('/api/' + path, {
      signal,
      method: data ? 'POST' : 'GET',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
    if (response.status === 304 && base) return base;
    let value = await response.json();
    if (!response.ok) {
      if (response.status === 401) onUnauthorized();
      throw Object.assign(Error(value.error || 'Request failed'), { status: response.status });
    }
    if (value.kind === 'workspace-delta') {
      try {
        value = mergeWorkspaceDelta(base, value);
      } catch {
        return request('state', undefined, { unconditional: true, signal });
      }
    }
    const etag = response.headers.get('etag');
    if (
      etag &&
      Number.isSafeInteger(value.revision) &&
      (!validator || value.revision >= validator.revision)
    )
      validator = { etag, revision: value.revision };
    return value;
  };
}
