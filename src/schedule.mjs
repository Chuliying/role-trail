import { collect, saveResearch } from './collect.mjs';
import { now } from './workbench.mjs';
import { validateSchedule } from './schedule-config.mjs';
export { validateSchedule };
export function due(s, date = new Date()) {
  if (!s || s.status !== 'active') return null;
  validateSchedule(s);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: s.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  const day = `${parts.year}-${parts.month}-${parts.day}`,
    time = parts.hour + ':' + parts.minute;
  if (time < s.time || s.lastDate === day) return null;
  return day;
}
export async function tick(store, { date = new Date(), collectFn = collect } = {}) {
  let s = await store.read();
  const day = due(s.schedule, date);
  if (!day) return { ran: false };
  // Reserve the date under the same revision lock; another runner cannot reserve it twice.
  s = await store.update(s.revision, {
    type: 'schedule',
    schedule: { ...s.schedule, lastDate: day, lastStartedAt: now(), lastResult: 'running' },
  });
  try {
    const bundle = await collectFn(s.profile);
    await saveResearch(store, bundle);
    const latest = await store.read();
    const result = bundle.run.coverage.some((c) => ['blocked', 'not_run'].includes(c.status))
      ? 'partial'
      : 'completed';
    if (latest.schedule?.lastDate === day)
      await store.update(latest.revision, {
        type: 'schedule',
        schedule: {
          ...latest.schedule,
          lastFinishedAt: now(),
          lastResult: result,
          lastRunId: bundle.run.id,
        },
      });
    return { ran: true, result, runId: bundle.run.id };
  } catch {
    const current = await store.read();
    if (current.schedule?.lastDate === day)
      await store.update(current.revision, {
        type: 'schedule',
        schedule: {
          ...current.schedule,
          lastFinishedAt: now(),
          lastResult: 'failed; inspect configuration, then run collect manually',
        },
      });
    return { ran: true, result: 'failed' };
  }
}
