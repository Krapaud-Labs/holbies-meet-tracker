import pg from 'pg';
import { applyMeetEvent } from './live.js';

const { Pool } = pg;

function createDatabase(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) return null;
  const pool = new Pool({ connectionString, max: 5 });
  return {
    async saveSession(session) {
      await pool.query(
        `INSERT INTO live_sessions (id, meeting_id, mentor_email, scheduled_start, ended_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET ended_at = COALESCE(EXCLUDED.ended_at, live_sessions.ended_at)`,
        [session.id, session.meetingId, session.mentorEmail, session.scheduledStart, session.endedAt || null],
      );
      await this.saveExpectedParticipants(session.id, session.expectedParticipants || []);
    },
    async loadSessions() {
      const sessionsResult = await pool.query('SELECT id, meeting_id, mentor_email, scheduled_start, created_at, ended_at FROM live_sessions ORDER BY scheduled_start');
      const expectedResult = await pool.query('SELECT session_id, email, display_name FROM expected_participants');
      const eventsResult = await pool.query('SELECT session_id, participant_email, display_name, event_type, occurred_at FROM participant_events ORDER BY occurred_at');
      const expectedBySession = new Map();
      for (const row of expectedResult.rows) {
        const list = expectedBySession.get(row.session_id) || [];
        list.push({ email: row.email, displayName: row.display_name });
        expectedBySession.set(row.session_id, list);
      }
      const eventBySession = new Map();
      for (const row of eventsResult.rows) {
        const list = eventBySession.get(row.session_id) || [];
        list.push({
          type: `google.workspace.meet.participant.v2.${row.event_type}`,
          eventTime: new Date(row.occurred_at).toISOString(),
          participantSession: { email: row.participant_email, displayName: row.display_name, startTime: new Date(row.occurred_at).toISOString() },
        });
        eventBySession.set(row.session_id, list);
      }
      return sessionsResult.rows.map((row) => {
        const session = {
          id: row.id,
          meetingId: row.meeting_id,
          mentorEmail: row.mentor_email,
          scheduledStart: new Date(row.scheduled_start).toISOString(),
          createdAt: new Date(row.created_at).toISOString(),
          endedAt: row.ended_at ? new Date(row.ended_at).toISOString() : null,
          expectedParticipants: expectedBySession.get(row.id) || [],
          participants: [],
        };
        for (const event of eventBySession.get(row.id) || []) applyMeetEvent(session, event);
        return session;
      });
    },
    async saveExpectedParticipants(sessionId, participants) {
      for (const participant of participants) {
        await pool.query(
          `INSERT INTO expected_participants (session_id, email, display_name)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [sessionId, participant.email || participant.displayName, participant.displayName || participant.name],
        );
      }
    },
    async saveParticipantEvent(sessionId, participant, type, occurredAt) {
      await pool.query(
        `INSERT INTO participant_events (session_id, participant_email, display_name, event_type, occurred_at)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
        [sessionId, participant.email || null, participant.displayName || participant.name, type, occurredAt],
      );
    },
    async close() {
      await pool.end();
    },
  };
}

export { createDatabase };
