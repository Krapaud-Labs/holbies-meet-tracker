(function attachAttendance(globalScope) {
  const LATE_TOLERANCE_MS = 2 * 60 * 1000;

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

  const api = { calculateAttendance, getParticipantIdentity, getSessionWindow };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.MeetAttendance = api;
})(typeof globalThis === 'undefined' ? window : globalThis);
