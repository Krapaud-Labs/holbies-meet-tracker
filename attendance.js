(function attachAttendance(globalScope) {
  const LATE_TOLERANCE_MS = 2 * 60 * 1000;

  function normalizePersonName(name) {
    return String(name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLocaleLowerCase('fr-FR')
      .replace(/\s+/g, ' ');
  }

  function getAttendanceIdentityKey(row) {
    const name = normalizePersonName(row?.name);
    if (name && !name.includes('@') && name !== 'participant inconnu') return `name:${name}`;

    const email = String(row?.email || '').trim().toLocaleLowerCase('fr-FR');
    const numericId = email.match(/^(\d{4,5})@holbertonstudents\.com$/)?.[1];
    if (numericId) return `student-id:${numericId}`;
    return email ? `email:${email}` : `row:${name}`;
  }

  function mergeAttendanceRows(rows) {
    const merged = new Map();
    const priority = { absent: 0, waiting: 1, 'identity-to-check': 2, late: 3, 'on-time': 4 };

    for (const row of Array.isArray(rows) ? rows : []) {
      const key = getAttendanceIdentityKey(row);
      const current = merged.get(key);
      if (!current || (priority[row.status] || 0) > (priority[current.status] || 0)) {
        merged.set(key, row);
      } else if (!current.email && row.email) {
        merged.set(key, { ...current, email: row.email });
      }
    }

    return [...merged.values()];
  }

  function getParticipantIdentity(participant) {
    // Google Meet returns the union fields at participant.signedinUser,
    // participant.anonymousUser or participant.phoneUser.
    // Keep the nested fallback for older fixtures and cached responses.
    const user = participant?.user || participant || {};
    if (user.signedinUser?.displayName) {
      return { name: user.signedinUser.displayName, identifiable: true };
    }

    if (user.anonymousUser?.displayName) {
      return { name: user.anonymousUser.displayName, identifiable: false };
    }

    if (user.phoneUser?.displayName) {
      return { name: user.phoneUser.displayName, identifiable: false };
    }

    return { name: 'Participant inconnu', identifiable: false };
  }

  function getSessionWindow(sessions) {
    if (!Array.isArray(sessions)) return null;

    const validSessions = sessions
      .map((session) => ({
        start: Date.parse(session.startTime || ''),
        end: session.endTime ? Date.parse(session.endTime) : null,
      }))
      .filter(({ start, end }) => !Number.isNaN(start) && (end === null || !Number.isNaN(end)));

    if (validSessions.length === 0) return null;

    return {
      firstJoin: Math.min(...validSessions.map(({ start }) => start)),
      lastLeave: validSessions.some(({ end }) => end === null)
        ? null
        : Math.max(...validSessions.map(({ end }) => end)),
    };
  }

  function calculateAttendance(participant, sessions, eventStart) {
    const identity = getParticipantIdentity(participant);
    const window = getSessionWindow(sessions);

    if (!identity.identifiable) {
      return { ...identity, status: 'identity-to-check', firstJoin: window?.firstJoin ?? null, lastLeave: window?.lastLeave ?? null };
    }

    if (!window) {
      return { ...identity, status: 'absent', firstJoin: null, lastLeave: null };
    }

    const start = Date.parse(eventStart || '');
    const status = Number.isNaN(start) || window.firstJoin > start + LATE_TOLERANCE_MS
      ? 'late'
      : 'on-time';

    return { ...identity, status, firstJoin: window.firstJoin, lastLeave: window.lastLeave };
  }

  const api = { calculateAttendance, getParticipantIdentity, getSessionWindow, getAttendanceIdentityKey, mergeAttendanceRows, normalizePersonName };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.MeetAttendance = api;
})(typeof globalThis === 'undefined' ? window : globalThis);
