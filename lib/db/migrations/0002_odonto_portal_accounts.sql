CREATE TABLE IF NOT EXISTS odonto_portal_users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS odonto_portal_users_last_seen_idx ON odonto_portal_users (last_seen_at);

CREATE TABLE IF NOT EXISTS odonto_portal_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES odonto_portal_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS odonto_portal_sessions_user_idx ON odonto_portal_sessions (user_id);
CREATE INDEX IF NOT EXISTS odonto_portal_sessions_expiry_idx ON odonto_portal_sessions (expires_at);

CREATE TABLE IF NOT EXISTS odonto_portal_user_states (
  user_id text PRIMARY KEY REFERENCES odonto_portal_users(id) ON DELETE CASCADE,
  state jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS odonto_portal_notifications (
  id text PRIMARY KEY,
  user_id text REFERENCES odonto_portal_users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  kind text NOT NULL DEFAULT 'info',
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX IF NOT EXISTS odonto_portal_notifications_user_idx ON odonto_portal_notifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS odonto_portal_password_resets (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES odonto_portal_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS odonto_portal_password_resets_user_idx ON odonto_portal_password_resets (user_id);
