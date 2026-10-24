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

  function normalizeEmail(email) {
    if (typeof email !== 'string') return null;
    const normalized = email.trim().normalize('NFC');
    if (!/^[^@\s]+@[^@\s]+$/u.test(normalized)) return null;
    const separator = normalized.lastIndexOf('@');
    if (separator <= 0 || separator === normalized.length - 1) return null;
    const local = normalized.slice(0, separator);
    const domain = normalized.slice(separator + 1).toLowerCase();
    return `${local}@${domain}`;
  }

  function getAttendanceIdentityKey(row) {
    const email = normalizeEmail(row?.email);
    return email ? `email:${email}` : null;
  }

  function getAttendanceIdentityKeys(row) {
    const key = getAttendanceIdentityKey(row);
    return key ? [key] : [];
  }

  function stableSerialize(value) {
    if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  function mergeAttendanceRows(rows) {
    const merged = [];
    const priority = { absent: 0, 'absent': 0, waiting: 1, 'en attente': 1, 'identity-to-check': 2, inconnu: 2, late: 3, 'en retard': 3, 'on-time': 4, "à l'heure": 4, 'à l’heure': 4 };
    const orderedRows = (Array.isArray(rows) ? rows : []).slice().sort((left, right) => {
      const leftKey = stableSerialize(left);
      const rightKey = stableSerialize(right);
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });
    for (const row of orderedRows) {
      const email = normalizeEmail(row?.email);
      if (email?.endsWith('@resource.calendar.google.com')) continue;
      const key = getAttendanceIdentityKey(row);
      if (!key) {
        merged.push({ ...row, email: null, status: 'identity-to-check' });
        continue;
      }
      const index = merged.findIndex((item) => getAttendanceIdentityKey(item) === key);
      if (index < 0) {
        merged.push({ ...row, email });
        continue;
      }
      const current = merged[index];
      merged[index] = (priority[row.status] ?? -1) > (priority[current.status] ?? -1)
        ? { ...current, ...row, email, name: row.name || current.name }
        : { ...row, ...current, email, name: current.name || row.name };
    }

    return merged;
  }

  function getParticipantIdentity(participant) {
    // Google Meet returns the union fields at participant.signedinUser,
    // participant.anonymousUser or participant.phoneUser.
    // Keep the nested fallback for older fixtures and cached responses.
    const signedInUser = participant?.signedinUser || participant?.user?.signedinUser;
    const anonymousUser = participant?.anonymousUser || participant?.user?.anonymousUser;
    const phoneUser = participant?.phoneUser || participant?.user?.phoneUser;
    const signedInEmail = normalizeEmail(signedInUser?.email);
    if (signedInEmail) {
      return { name: signedInUser?.displayName || signedInEmail, email: signedInEmail, identifiable: true };
    }

    if (signedInUser?.displayName) return { name: signedInUser.displayName, email: null, identifiable: false };

    if (anonymousUser?.displayName) {
      return { name: anonymousUser.displayName, email: null, identifiable: false };
    }

    if (phoneUser?.displayName) {
      return { name: phoneUser.displayName, email: null, identifiable: false };
    }

    return { name: 'Participant inconnu', email: null, identifiable: false };
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
      return { ...identity, status: 'identity-to-check', firstJoin: null, lastLeave: null };
    }

    const start = Date.parse(eventStart || '');
    const status = Number.isNaN(start) || window.firstJoin >= start + LATE_TOLERANCE_MS
      ? 'late'
      : 'on-time';

    return { ...identity, status, firstJoin: window.firstJoin, lastLeave: window.lastLeave };
  }

  const api = { calculateAttendance, getParticipantIdentity, getSessionWindow, getAttendanceIdentityKey, getAttendanceIdentityKeys, mergeAttendanceRows, normalizePersonName, normalizeEmail };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.MeetAttendance = api;
})(typeof globalThis === 'undefined' ? window : globalThis);
