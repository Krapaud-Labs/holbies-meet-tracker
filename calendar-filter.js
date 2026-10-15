(function exposeCalendarFilter(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HolbiesCalendar = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const HOUR_MS = 60 * 60 * 1000;

  function getEventEndMs(event) {
    const value = event?.end?.dateTime || event?.end?.date;
    const timestamp = Date.parse(value || '');
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  function getEventStartMs(event) {
    const value = event?.start?.dateTime || event?.start?.date;
    const timestamp = Date.parse(value || '');
    return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
  }

  function calendarDayKey(timestamp) {
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime())) return null;
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }

  function isEventOnDay(event, nowMs = Date.now()) {
    const startMs = getEventStartMs(event);
    return calendarDayKey(startMs) === calendarDayKey(nowMs);
  }

  function getEventStatus(event, nowMs = Date.now()) {
    const startMs = getEventStartMs(event);
    const endMs = getEventEndMs(event);
    if (endMs !== null && nowMs >= endMs) return 'Terminé';
    if (startMs !== Number.MAX_SAFE_INTEGER && nowMs >= startMs) return 'En cours';
    return 'Bientôt';
  }

  function isVisibleAgendaEvent(event, nowMs = Date.now()) {
    return isEventOnDay(event, nowMs);
  }

  function filterVisibleAgendaEvents(events, nowMs = Date.now()) {
    return (Array.isArray(events) ? events : [])
      .filter((event) => isVisibleAgendaEvent(event, nowMs))
      .sort((left, right) => getEventStartMs(left) - getEventStartMs(right));
  }

  return { HOUR_MS, getEventEndMs, getEventStartMs, getEventStatus, isEventOnDay, isVisibleAgendaEvent, filterVisibleAgendaEvents };
}));
