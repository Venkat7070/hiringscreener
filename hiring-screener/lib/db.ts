import { createPool, type VercelPool } from "@vercel/postgres";

let poolInstance: VercelPool | null = null;

function getPool(): VercelPool {
  if (!poolInstance) {
    poolInstance = createPool({ connectionString: process.env.DATABASE_URL });
  }
  return poolInstance;
}

const sql: VercelPool["sql"] = (strings, ...values) => getPool().sql(strings, ...values);
const pool = {
  query: (text: string, params?: unknown[]) => getPool().query(text, params as unknown[]),
};

let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = sql`
      CREATE TABLE IF NOT EXISTS applications (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        name TEXT NOT NULL,
        linkedin TEXT,
        location_choice TEXT,
        answers JSONB NOT NULL,
        free_text TEXT,
        cv_url TEXT,
        cv_filename TEXT,
        mechanical_score INTEGER NOT NULL,
        ai_score INTEGER,
        ai_rationale TEXT,
        ai_recommended_stage TEXT,
        stage TEXT NOT NULL DEFAULT 'Applied',
        submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `
      .then(() => sql`ALTER TABLE applications ALTER COLUMN role DROP NOT NULL`)
      .then(() => sql`ALTER TABLE applications ALTER COLUMN mechanical_score DROP NOT NULL`)
      .then(
        () => sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'form'`
      )
      .then(() => sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS external_id TEXT UNIQUE`)
      .then(
        () => sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'`
      )
      .then(
        () => sql`
          CREATE TABLE IF NOT EXISTS linkedin_messages (
            id TEXT PRIMARY KEY,
            chat_id TEXT NOT NULL,
            message_id TEXT NOT NULL UNIQUE,
            sender_name TEXT NOT NULL,
            sender_profile_url TEXT,
            is_sender BOOLEAN NOT NULL DEFAULT false,
            text TEXT,
            has_cv_attachment BOOLEAN NOT NULL DEFAULT false,
            message_timestamp TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `
      )
      .then(
        () => sql`
          CREATE INDEX IF NOT EXISTS idx_linkedin_messages_chat_id
          ON linkedin_messages (chat_id, message_timestamp)
        `
      )
      .then(
        () => sql`
          CREATE TABLE IF NOT EXISTS screening_sessions (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `
      )
      .then(
        () => sql`
          CREATE TABLE IF NOT EXISTS screening_roles (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES screening_sessions(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            jd_text TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `
      )
      .then(
        () => sql`
          CREATE INDEX IF NOT EXISTS idx_screening_roles_session_id
          ON screening_roles(session_id)
        `
      )
      .then(
        () => sql`
          CREATE TABLE IF NOT EXISTS screening_candidates (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES screening_sessions(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            name_confirmed BOOLEAN NOT NULL DEFAULT false,
            cv_url TEXT NOT NULL,
            cv_filename TEXT NOT NULL,
            cv_text TEXT,
            cv_text_error TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `
      )
      .then(
        () => sql`
          CREATE INDEX IF NOT EXISTS idx_screening_candidates_session_id
          ON screening_candidates(session_id)
        `
      )
      .then(
        () => sql`
          CREATE TABLE IF NOT EXISTS screening_results (
            id TEXT PRIMARY KEY,
            candidate_id TEXT NOT NULL REFERENCES screening_candidates(id) ON DELETE CASCADE,
            role_id TEXT NOT NULL REFERENCES screening_roles(id) ON DELETE CASCADE,
            ai_score INTEGER,
            ai_rationale TEXT,
            ai_recommended_stage TEXT,
            stage TEXT NOT NULL DEFAULT 'Screened',
            tags TEXT[] NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE(candidate_id, role_id)
          )
        `
      )
      .then(
        () => sql`
          CREATE INDEX IF NOT EXISTS idx_screening_results_role_id
          ON screening_results(role_id)
        `
      )
      .then(
        () => sql`
          CREATE INDEX IF NOT EXISTS idx_screening_results_candidate_id
          ON screening_results(candidate_id)
        `
      )
      .then(() => undefined);
  }
  return schemaReady;
}

export { sql, pool };
