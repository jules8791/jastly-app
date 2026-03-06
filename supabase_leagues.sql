-- ============================================================
-- Jastly — Leagues Module Schema
-- Run in the Supabase SQL Editor after supabase_rls.sql.
-- Safe to re-run: uses IF NOT EXISTS and DROP IF EXISTS.
-- ============================================================

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leagues (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT        NOT NULL,
  sport       TEXT        NOT NULL DEFAULT 'badminton',
  owner_uid   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS league_teams (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id    UUID        NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  player_names JSONB       NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS league_fixtures (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id      UUID        NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  home_team_id   UUID        NOT NULL REFERENCES league_teams(id),
  away_team_id   UUID        NOT NULL REFERENCES league_teams(id),
  round          INTEGER     NOT NULL DEFAULT 1,
  scheduled_at   TIMESTAMPTZ,
  status         TEXT        NOT NULL DEFAULT 'scheduled', -- scheduled | in_progress | completed
  club_id        TEXT,        -- club session used to play this fixture
  result_home    INTEGER,
  result_away    INTEGER,
  winner_team_id UUID        REFERENCES league_teams(id),
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ── Standings View ─────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW league_standings AS
SELECT
  lt.league_id,
  lt.id   AS team_id,
  lt.name AS team_name,
  COUNT(f.id) FILTER (
    WHERE f.status = 'completed'
  ) AS played,
  COUNT(f.id) FILTER (
    WHERE f.status = 'completed' AND f.winner_team_id = lt.id
  ) AS wins,
  COUNT(f.id) FILTER (
    WHERE f.status = 'completed'
      AND f.winner_team_id IS NULL
      AND (f.home_team_id = lt.id OR f.away_team_id = lt.id)
  ) AS draws,
  COUNT(f.id) FILTER (
    WHERE f.status = 'completed'
      AND f.winner_team_id IS NOT NULL
      AND f.winner_team_id != lt.id
      AND (f.home_team_id = lt.id OR f.away_team_id = lt.id)
  ) AS losses,
  COALESCE(SUM(
    CASE WHEN f.home_team_id = lt.id THEN f.result_home ELSE f.result_away END
  ) FILTER (WHERE f.status = 'completed'), 0) AS goals_for,
  COALESCE(SUM(
    CASE WHEN f.home_team_id = lt.id THEN f.result_away ELSE f.result_home END
  ) FILTER (WHERE f.status = 'completed'), 0) AS goals_against,
  (
    COUNT(f.id) FILTER (WHERE f.status = 'completed' AND f.winner_team_id = lt.id) * 3
    + COUNT(f.id) FILTER (
        WHERE f.status = 'completed'
          AND f.winner_team_id IS NULL
          AND (f.home_team_id = lt.id OR f.away_team_id = lt.id)
      )
  ) AS points
FROM league_teams lt
LEFT JOIN league_fixtures f
  ON (f.home_team_id = lt.id OR f.away_team_id = lt.id)
GROUP BY lt.league_id, lt.id, lt.name;

-- ── Row Level Security ─────────────────────────────────────────────────────────

ALTER TABLE leagues        ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_teams   ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_fixtures ENABLE ROW LEVEL SECURITY;

-- leagues
DROP POLICY IF EXISTS "leagues: public read"   ON leagues;
DROP POLICY IF EXISTS "leagues: owner insert"  ON leagues;
DROP POLICY IF EXISTS "leagues: owner update"  ON leagues;
DROP POLICY IF EXISTS "leagues: owner delete"  ON leagues;

CREATE POLICY "leagues: public read"  ON leagues FOR SELECT USING (true);
CREATE POLICY "leagues: owner insert" ON leagues FOR INSERT WITH CHECK (auth.uid() = owner_uid);
CREATE POLICY "leagues: owner update" ON leagues FOR UPDATE USING (auth.uid() = owner_uid);
CREATE POLICY "leagues: owner delete" ON leagues FOR DELETE USING (auth.uid() = owner_uid);

-- league_teams
DROP POLICY IF EXISTS "league_teams: public read"   ON league_teams;
DROP POLICY IF EXISTS "league_teams: owner insert"  ON league_teams;
DROP POLICY IF EXISTS "league_teams: owner update"  ON league_teams;
DROP POLICY IF EXISTS "league_teams: owner delete"  ON league_teams;

CREATE POLICY "league_teams: public read" ON league_teams FOR SELECT USING (true);
CREATE POLICY "league_teams: owner insert" ON league_teams FOR INSERT WITH CHECK (
  auth.uid() = (SELECT owner_uid FROM leagues WHERE id = league_id)
);
CREATE POLICY "league_teams: owner update" ON league_teams FOR UPDATE USING (
  auth.uid() = (SELECT owner_uid FROM leagues WHERE id = league_id)
);
CREATE POLICY "league_teams: owner delete" ON league_teams FOR DELETE USING (
  auth.uid() = (SELECT owner_uid FROM leagues WHERE id = league_id)
);

-- league_fixtures
DROP POLICY IF EXISTS "league_fixtures: public read"   ON league_fixtures;
DROP POLICY IF EXISTS "league_fixtures: owner insert"  ON league_fixtures;
DROP POLICY IF EXISTS "league_fixtures: owner update"  ON league_fixtures;
DROP POLICY IF EXISTS "league_fixtures: owner delete"  ON league_fixtures;

CREATE POLICY "league_fixtures: public read" ON league_fixtures FOR SELECT USING (true);
CREATE POLICY "league_fixtures: owner insert" ON league_fixtures FOR INSERT WITH CHECK (
  auth.uid() = (SELECT owner_uid FROM leagues WHERE id = league_id)
);
CREATE POLICY "league_fixtures: owner update" ON league_fixtures FOR UPDATE USING (
  auth.uid() = (SELECT owner_uid FROM leagues WHERE id = league_id)
);
CREATE POLICY "league_fixtures: owner delete" ON league_fixtures FOR DELETE USING (
  auth.uid() = (SELECT owner_uid FROM leagues WHERE id = league_id)
);

-- ── Schema additions (safe to re-run) ────────────────────────────────────────
ALTER TABLE leagues         ADD COLUMN IF NOT EXISTS format_type    TEXT DEFAULT 'NONE';
ALTER TABLE league_fixtures ADD COLUMN IF NOT EXISTS rubber_results JSONB;

-- ── Indices ────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_leagues_owner_uid          ON leagues(owner_uid);
CREATE INDEX IF NOT EXISTS idx_league_teams_league_id     ON league_teams(league_id);
CREATE INDEX IF NOT EXISTS idx_league_fixtures_league_id  ON league_fixtures(league_id);
CREATE INDEX IF NOT EXISTS idx_league_fixtures_status     ON league_fixtures(status);
