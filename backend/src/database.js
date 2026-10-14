import pg from 'pg';

const { Pool } = pg;

function createDatabase(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) return null;
  const pool = new Pool({ connectionString, max: 5 });
  return {
    async saveSession(session) {
      await pool.query(
        `INSERT INTO live_sessions (id, meeting_id, mentor_email, scheduled_start)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET ended_at = EXCLUDED.ended_at`,
        [session.id, session.meetingId, session.mentorEmail, session.scheduledStart],
      );
      await this.saveExpectedParticipants(session.id, session.expectedParticipants || []);
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
