-- ============================================================
-- Queue Master (Jastly) — Schema Migrations
-- Run BEFORE the RLS policies below if not already applied.
-- ============================================================

-- Add sport column (safe to re-run)
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS sport TEXT DEFAULT 'badminton';

-- Add generated boolean so guests can check if a power-guest PIN is set
-- without ever reading the actual hash
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS has_power_guest_pin BOOLEAN
  GENERATED ALWAYS AS (power_guest_pin IS NOT NULL) STORED;

-- ────────────────────────────────────────────────────────────
-- SECURITY: Revoke sensitive columns from unauthenticated users
-- join_password and power_guest_pin are hashed but should not
-- be readable by unauthenticated (anon role) API calls.
-- Password validation is done server-side via the RPC below.
-- ────────────────────────────────────────────────────────────
REVOKE SELECT (join_password, power_guest_pin) ON public.clubs FROM anon;

-- Server-side password validation RPC (called by join.tsx)
-- Returns: { valid: bool, requires_password: bool }
CREATE OR REPLACE FUNCTION public.validate_join_password(p_club_id TEXT, p_password_hash TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_club RECORD;
BEGIN
  SELECT join_password INTO v_club FROM clubs WHERE id = p_club_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Club not found');
  END IF;
  IF v_club.join_password IS NULL THEN
    RETURN jsonb_build_object('valid', true, 'requires_password', false);
  END IF;
  RETURN jsonb_build_object('valid', v_club.join_password = p_password_hash, 'requires_password', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.validate_join_password(TEXT, TEXT) TO anon, authenticated;

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
-- STORAGE BUCKET: club-logos
-- ────────────────────────────────────────────────────────────
-- STEP 1 (Dashboard UI — NOT SQL):
--   Supabase Dashboard → Storage → New Bucket
--   Name: club-logos   Public: ON (toggle on)   → Save
--
-- STEP 2: Run the policies below in SQL Editor after creating the bucket.
-- ────────────────────────────────────────────────────────────

-- Anyone can view logos (needed for public URLs to work)
DROP POLICY IF EXISTS "club-logos: public read"   ON storage.objects;
CREATE POLICY "club-logos: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'club-logos');

-- Any authenticated user (including anonymous host) can upload
DROP POLICY IF EXISTS "club-logos: auth upload"   ON storage.objects;
CREATE POLICY "club-logos: auth upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'club-logos' AND auth.uid() IS NOT NULL);

-- Any authenticated user can replace (upsert) their logo
DROP POLICY IF EXISTS "club-logos: auth update"   ON storage.objects;
CREATE POLICY "club-logos: auth update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'club-logos' AND auth.uid() IS NOT NULL);

-- Any authenticated user can delete their logo
DROP POLICY IF EXISTS "club-logos: auth delete"   ON storage.objects;
CREATE POLICY "club-logos: auth delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'club-logos' AND auth.uid() IS NOT NULL);


-- ────────────────────────────────────────────────────────────
-- NOTES
-- ────────────────────────────────────────────────────────────
-- After running this, verify policies are active in:
-- Supabase Dashboard → Storage → Policies
-- Supabase Dashboard → Authentication → Policies
--
-- To test: open an incognito browser, use the Supabase REST API
-- directly with the anon key and confirm you cannot UPDATE clubs
-- or READ requests without being the host.
