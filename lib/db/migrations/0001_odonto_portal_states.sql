CREATE TABLE IF NOT EXISTS odonto_portal_states (
  portal_key text PRIMARY KEY,
  state jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
