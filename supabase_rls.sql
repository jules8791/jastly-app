-- ============================================================
-- Queue Master (Jastly) — Schema Migrations
-- Run BEFORE the RLS policies below if not already applied.
-- ============================================================

-- Add sport column (safe to re-run)
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS sport TEXT DEFAULT 'badminton';

-- ============================================================
-- Queue Master (Jastly) — Row Level Security Policies
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- Safe to re-run: drops existing policies before recreating.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- CLUBS TABLE
-- ────────────────────────────────────────────────────────────
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clubs: public read"          ON clubs;
DROP POLICY IF EXISTS "clubs: host can update"      ON clubs;
DROP POLICY IF EXISTS "clubs: authenticated insert" ON clubs;
DROP POLICY IF EXISTS "clubs: host can delete"      ON clubs;

-- Anyone (including anonymous users) can read a club by its ID.
-- Guests need this to see the queue and courts.
CREATE POLICY "clubs: public read"
  ON clubs FOR SELECT
  USING (true);

-- Only the authenticated user who created the club (host_uid) can update it.
CREATE POLICY "clubs: host can update"
  ON clubs FOR UPDATE
  USING (auth.uid() = host_uid);

-- Only authenticated (non-anonymous) users can create a club.
CREATE POLICY "clubs: authenticated insert"
  ON clubs FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.jwt() ->> 'is_anonymous' IS DISTINCT FROM 'true'
  );

-- Only the host can delete their own club.
CREATE POLICY "clubs: host can delete"
  ON clubs FOR DELETE
  USING (auth.uid() = host_uid);


-- ────────────────────────────────────────────────────────────
-- REQUESTS TABLE
-- ────────────────────────────────────────────────────────────
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "requests: anyone can insert" ON requests;
DROP POLICY IF EXISTS "requests: host can read"     ON requests;
DROP POLICY IF EXISTS "requests: host can delete"   ON requests;

-- Any authenticated user (including anonymous) can insert a request
-- for a club they know the ID of. This lets guests send actions.
CREATE POLICY "requests: anyone can insert"
  ON requests FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Only the host of a club can read its requests.
-- This prevents guests from reading other guests' requests.
CREATE POLICY "requests: host can read"
  ON requests FOR SELECT
  USING (
    club_id IN (
      SELECT id FROM clubs WHERE host_uid = auth.uid()
    )
  );

-- Only the host can delete requests (after processing them).
CREATE POLICY "requests: host can delete"
  ON requests FOR DELETE
  USING (
    club_id IN (
      SELECT id FROM clubs WHERE host_uid = auth.uid()
    )
  );


-- ────────────────────────────────────────────────────────────
-- NOTES
-- ────────────────────────────────────────────────────────────
-- After running this, verify policies are active in:
-- Supabase Dashboard → Authentication → Policies
--
-- To test: open an incognito browser, use the Supabase REST API
-- directly with the anon key and confirm you cannot UPDATE clubs
-- or READ requests without being the host.
--
-- If you have a storage bucket for club logos, enable RLS there too:
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
-- (then add appropriate policies for the bucket)
