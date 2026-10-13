CREATE TABLE IF NOT EXISTS live_sessions (
  id UUID PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  mentor_email TEXT NOT NULL CHECK (mentor_email LIKE '%@holbertonschool.com'),
  scheduled_start TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS expected_participants (
  session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  PRIMARY KEY (session_id, email)
);

CREATE TABLE IF NOT EXISTS participant_events (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  participant_email TEXT,
  display_name TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('joined', 'left')),
  occurred_at TIMESTAMPTZ NOT NULL,
  UNIQUE (session_id, participant_email, event_type, occurred_at)
);

CREATE INDEX IF NOT EXISTS participant_events_session_idx ON participant_events(session_id, occurred_at);
