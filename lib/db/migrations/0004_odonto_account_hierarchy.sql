ALTER TABLE odonto_portal_users
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS manager_id text,
  ADD COLUMN IF NOT EXISTS workspace_owner_id text;

UPDATE odonto_portal_users
SET account_type = CASE WHEN role = 'admin' THEN 'creator' ELSE 'individual' END
WHERE account_type IS NULL OR account_type = 'individual';

UPDATE odonto_portal_users
SET workspace_owner_id = id
WHERE workspace_owner_id IS NULL;

CREATE INDEX IF NOT EXISTS odonto_portal_users_manager_idx
  ON odonto_portal_users (manager_id);

CREATE INDEX IF NOT EXISTS odonto_portal_users_workspace_idx
  ON odonto_portal_users (workspace_owner_id);
