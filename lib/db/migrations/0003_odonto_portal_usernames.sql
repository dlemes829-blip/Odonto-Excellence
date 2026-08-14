ALTER TABLE odonto_portal_users
  ADD COLUMN IF NOT EXISTS username text;

UPDATE odonto_portal_users
  SET username = CONCAT('user-', LEFT(id, 8))
  WHERE username IS NULL OR username = '';

ALTER TABLE odonto_portal_users
  ALTER COLUMN username SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS odonto_portal_users_username_idx
  ON odonto_portal_users (username);
