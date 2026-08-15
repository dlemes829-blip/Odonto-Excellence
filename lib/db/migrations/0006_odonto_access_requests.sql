ALTER TABLE odonto_portal_users
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active';

UPDATE odonto_portal_users
SET account_status = CASE
  WHEN is_active = false THEN 'suspended'
  ELSE 'active'
END
WHERE account_status IS NULL OR account_status = '';

CREATE INDEX IF NOT EXISTS odonto_portal_users_status_idx
  ON odonto_portal_users (account_status);
