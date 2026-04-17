-- ============================================
-- COMMUNITY, LEADERBOARD E MASSIMALI
-- ============================================

CREATE TABLE IF NOT EXISTS workout_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  day text NOT NULL,
  score_type text NOT NULL CHECK (score_type IN ('time', 'reps', 'load')),
  score_value numeric NOT NULL,
  score_display text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, week_number, day)
);

CREATE TABLE IF NOT EXISTS score_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  score_id uuid NOT NULL REFERENCES workout_scores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (score_id, user_id)
);

CREATE TABLE IF NOT EXISTS score_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  score_id uuid NOT NULL REFERENCES workout_scores(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_maxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lift_name text NOT NULL,
  value numeric NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, lift_name)
);

CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_workout_scores_updated_at ON workout_scores;
CREATE TRIGGER set_workout_scores_updated_at
BEFORE UPDATE ON workout_scores
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

ALTER TABLE workout_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_maxes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workout_scores_select_authenticated" ON workout_scores;
CREATE POLICY "workout_scores_select_authenticated"
ON workout_scores FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "workout_scores_insert_own" ON workout_scores;
CREATE POLICY "workout_scores_insert_own"
ON workout_scores FOR INSERT
TO authenticated
WITH CHECK (client_id = auth.uid());

DROP POLICY IF EXISTS "workout_scores_update_own" ON workout_scores;
CREATE POLICY "workout_scores_update_own"
ON workout_scores FOR UPDATE
TO authenticated
USING (client_id = auth.uid())
WITH CHECK (client_id = auth.uid());

DROP POLICY IF EXISTS "score_reactions_select_authenticated" ON score_reactions;
CREATE POLICY "score_reactions_select_authenticated"
ON score_reactions FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "score_reactions_insert_own" ON score_reactions;
CREATE POLICY "score_reactions_insert_own"
ON score_reactions FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "score_reactions_delete_own" ON score_reactions;
CREATE POLICY "score_reactions_delete_own"
ON score_reactions FOR DELETE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "score_comments_select_authenticated" ON score_comments;
CREATE POLICY "score_comments_select_authenticated"
ON score_comments FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "score_comments_insert_own" ON score_comments;
CREATE POLICY "score_comments_insert_own"
ON score_comments FOR INSERT
TO authenticated
WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "client_maxes_select_owner_or_trainer" ON client_maxes;
CREATE POLICY "client_maxes_select_owner_or_trainer"
ON client_maxes FOR SELECT
TO authenticated
USING (
  client_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'trainer'
  )
);

DROP POLICY IF EXISTS "client_maxes_insert_own" ON client_maxes;
CREATE POLICY "client_maxes_insert_own"
ON client_maxes FOR INSERT
TO authenticated
WITH CHECK (client_id = auth.uid());

DROP POLICY IF EXISTS "client_maxes_update_own" ON client_maxes;
CREATE POLICY "client_maxes_update_own"
ON client_maxes FOR UPDATE
TO authenticated
USING (client_id = auth.uid())
WITH CHECK (client_id = auth.uid());
