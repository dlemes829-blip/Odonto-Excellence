ALTER TABLE odonto_portal_users
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS team_member_limit integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

UPDATE odonto_portal_users
SET must_change_password = false
WHERE account_type = 'creator';
