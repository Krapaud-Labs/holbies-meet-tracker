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

  function getAttendanceIdentityKeys(row) {
    const keys = new Set([getAttendanceIdentityKey(row)]);
    const email = String(row?.email || '').trim().toLocaleLowerCase('fr-FR');
    const localPart = email.split('@')[0];
    if (email) keys.add(`email:${email}`);
    if (/^\d{4,5}@holbertonstudents\.com$/.test(email)) keys.add(`student-id:${localPart}`);
    if (localPart && !/^\d{4,5}$/.test(localPart) && email.endsWith('@holbertonstudents.com')) {
      keys.add(`name:${normalizePersonName(localPart.replace(/[._-]+/g, ' '))}`);
      const numberedAlias = localPart.match(/^(.+?)\.\d+$/);
      if (numberedAlias) {
        keys.add(`name:${normalizePersonName(numberedAlias[1].replace(/[._-]+/g, ' '))}`);
      }
    }
    const name = normalizePersonName(row?.name);
    if (name && !name.includes('@') && name !== 'participant inconnu') keys.add(`name:${name}`);
    return [...keys];
  }

  function mergeAttendanceRows(rows) {
    const merged = [];
    const priority = { absent: 0, 'absent': 0, waiting: 1, 'en attente': 1, 'identity-to-check': 2, inconnu: 2, late: 3, 'en retard': 3, 'on-time': 4, "à l'heure": 4, 'à l’heure': 4 };
    for (let row of Array.isArray(rows) ? rows : []) {
      const email = String(row?.email || '').trim().toLocaleLowerCase('fr-FR');
      if (email.endsWith('@resource.calendar.google.com')) continue;
      let candidate = row;
      let index = merged.findIndex((item) => getAttendanceIdentityKeys(item).some((key) => getAttendanceIdentityKeys(candidate).includes(key)));
      while (index >= 0) {
        const current = merged[index];
        candidate = (priority[row.status] || 0) > (priority[current.status] || 0)
          ? { ...current, ...row, email: row.email || current.email, name: row.name || current.name }
          : { ...row, ...current, email: current.email || row.email, name: current.name || row.name };
        merged[index] = candidate;
        const duplicateIndex = merged.findIndex((item, itemIndex) => itemIndex !== index
          && getAttendanceIdentityKeys(item).some((key) => getAttendanceIdentityKeys(candidate).includes(key)));
        if (duplicateIndex < 0) break;
        const duplicate = merged.splice(duplicateIndex, 1)[0];
        row = { ...candidate, ...duplicate, email: candidate.email || duplicate.email, name: candidate.name || duplicate.name };
        index = merged.findIndex((item) => getAttendanceIdentityKeys(item).some((key) => getAttendanceIdentityKeys(row).includes(key)));
      }
      if (index < 0) merged.push(row);
    }

    return merged;
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
    const status = Number.isNaN(start) || window.firstJoin >= start + LATE_TOLERANCE_MS
      ? 'late'
      : 'on-time';

    return { ...identity, status, firstJoin: window.firstJoin, lastLeave: window.lastLeave };
  }

  const api = { calculateAttendance, getParticipantIdentity, getSessionWindow, getAttendanceIdentityKey, getAttendanceIdentityKeys, mergeAttendanceRows, normalizePersonName };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.MeetAttendance = api;
})(typeof globalThis === 'undefined' ? window : globalThis);
