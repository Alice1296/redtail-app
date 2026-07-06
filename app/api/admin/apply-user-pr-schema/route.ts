import { Client } from 'pg'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const userPrSchemaSql = `
CREATE TABLE IF NOT EXISTS user_pr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exercise_name text NOT NULL,
  weight numeric NOT NULL CHECK (weight > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, exercise_name)
);

CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_user_pr_updated_at ON user_pr;
CREATE TRIGGER set_user_pr_updated_at
BEFORE UPDATE ON user_pr
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

ALTER TABLE user_pr ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_pr_select_owner_or_trainer" ON user_pr;
CREATE POLICY "user_pr_select_owner_or_trainer"
ON user_pr FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'trainer'
  )
);

DROP POLICY IF EXISTS "user_pr_insert_own" ON user_pr;
CREATE POLICY "user_pr_insert_own"
ON user_pr FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_pr_update_own" ON user_pr;
CREATE POLICY "user_pr_update_own"
ON user_pr FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_pr_delete_own" ON user_pr;
CREATE POLICY "user_pr_delete_own"
ON user_pr FOR DELETE
TO authenticated
USING (user_id = auth.uid());
`

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')

  if (!process.env.SCHEMA_ADMIN_TOKEN || token !== process.env.SCHEMA_ADMIN_TOKEN) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  if (!process.env.SUPABASE_DIRECT_DB_URL) {
    return NextResponse.json(
      { error: 'SUPABASE_DIRECT_DB_URL mancante' },
      { status: 500 }
    )
  }

  const client = new Client({
    connectionString: process.env.SUPABASE_DIRECT_DB_URL,
  })

  try {
    await client.connect()
    await client.query(userPrSchemaSql)

    const result = await client.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_name = 'user_pr' order by ordinal_position"
    )

    return NextResponse.json({
      ok: true,
      columns: result.rows.map((row) => row.column_name),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Errore applicazione schema',
      },
      { status: 500 }
    )
  } finally {
    await client.end().catch(() => {})
  }
}
