export function validateSchedule(s) {
  const fields = [
    'status',
    'time',
    'timezone',
    'lastDate',
    'lastStartedAt',
    'lastFinishedAt',
    'lastResult',
    'lastRunId',
  ];
  if (
    !s ||
    Object.keys(s).some((k) => !fields.includes(k)) ||
    !['active', 'paused'].includes(s.status) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time) ||
    typeof s.timezone !== 'string'
  )
    throw Error('Schedule requires HH:mm, IANA timezone and active/paused');
  new Intl.DateTimeFormat('en', { timeZone: s.timezone }).format();
  if (s.lastDate && !/^\d{4}-\d\d-\d\d$/.test(s.lastDate)) throw Error('Invalid schedule date');
  return s;
}
