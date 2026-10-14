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

  function isVisibleAgendaEvent(event, nowMs = Date.now()) {
    const endMs = getEventEndMs(event);
    return endMs === null || endMs >= nowMs - HOUR_MS;
  }

  function filterVisibleAgendaEvents(events, nowMs = Date.now()) {
    return (Array.isArray(events) ? events : []).filter((event) => isVisibleAgendaEvent(event, nowMs));
  }

  return { HOUR_MS, getEventEndMs, isVisibleAgendaEvent, filterVisibleAgendaEvents };
}));
