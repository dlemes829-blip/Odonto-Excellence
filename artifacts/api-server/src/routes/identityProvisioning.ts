import { sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";

const router: IRouter = Router();
let ready = false;

async function ensureIdentityProvisioning() {
  if (ready) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS odonto_portal_people (
      id text PRIMARY KEY,
      display_name text NOT NULL,
      email text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(
    sql`ALTER TABLE odonto_portal_users ADD COLUMN IF NOT EXISTS person_id text`,
  );
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION odonto_provision_person_for_user()
    RETURNS trigger AS $$
    BEGIN
      IF NEW.person_id IS NULL OR NEW.person_id = '' THEN
        NEW.person_id := NEW.id;
      END IF;
      INSERT INTO odonto_portal_people (id, display_name, email)
      VALUES (NEW.person_id, NEW.display_name, NEW.email)
      ON CONFLICT (id) DO NOTHING;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);
  await db.execute(
    sql`DROP TRIGGER IF EXISTS odonto_provision_person_for_user_trigger ON odonto_portal_users`,
  );
  await db.execute(sql`
    CREATE TRIGGER odonto_provision_person_for_user_trigger
    BEFORE INSERT ON odonto_portal_users
    FOR EACH ROW EXECUTE FUNCTION odonto_provision_person_for_user()
  `);
  ready = true;
}

router.use((_req, _res, next) => {
  void ensureIdentityProvisioning().then(() => next()).catch(next);
});

export default router;
