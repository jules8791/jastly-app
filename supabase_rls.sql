-- ============================================================
-- Queue Master (Jastly) — Schema Migrations
-- Run BEFORE the RLS policies below if not already applied.
-- ============================================================

-- Add sport column (safe to re-run)
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS sport TEXT DEFAULT 'badminton';

-- Add tournament column (safe to re-run)
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS tournament JSONB;

-- Add score cap and players-per-game override columns (safe to re-run)
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS score_cap INTEGER;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS players_per_game INTEGER;

-- Add ELO rating toggle and custom court names (safe to re-run)
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS elo_enabled BOOLEAN DEFAULT false;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS court_names JSONB;

-- Add generated boolean so guests can check if a power-guest PIN is set
-- without ever reading the actual hash
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS has_power_guest_pin BOOLEAN
  GENERATED ALWAYS AS (power_guest_pin IS NOT NULL) STORED;

-- ────────────────────────────────────────────────────────────
-- SECURITY: Drop clubs_public view (SECURITY DEFINER bypasses RLS)
-- The app queries the clubs table directly; this view is unused.
DROP VIEW IF EXISTS public.clubs_public;

-- ────────────────────────────────────────────────────────────
-- SECURITY: Revoke sensitive columns from unauthenticated users
-- join_password and power_guest_pin are hashed but should not
-- be readable by unauthenticated (anon role) API calls.
-- Password validation is done server-side via the RPC below.
-- ────────────────────────────────────────────────────────────
-- Revoke sensitive columns from unauthenticated users
REVOKE SELECT (join_password, power_guest_pin) ON public.clubs FROM anon;
-- Also revoke from authenticated (including anonymous sessions) — guests must not be able to
-- read the power_guest_pin hash to avoid crafting a valid hash without knowing the PIN.
-- The host device reads it via the in-memory club state after loading as host (host_uid = auth.uid()).
REVOKE SELECT (power_guest_pin) ON public.clubs FROM authenticated;

-- Server-side password validation RPC (called by join.tsx)
-- Accepts plaintext password and compares server-side so the stored hash
-- is never exposed to the client. Handles both formats:
--   Legacy:  SHA256("jastly::<password>::club")
--   Salted:  "<salt>:SHA256(<salt>::<password>)"
-- Empty p_password = probe call (returns requires_password without validating)
-- Returns: { valid: bool, requires_password: bool }
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop old signature first (parameter was renamed from p_password_hash → p_password)
DROP FUNCTION IF EXISTS public.validate_join_password(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.validate_join_password(p_club_id TEXT, p_password TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_stored   TEXT;
  v_colon    INT;
  v_salt     TEXT;
  v_stored_h TEXT;
  v_computed TEXT;
BEGIN
  SELECT join_password INTO v_stored FROM clubs WHERE id = p_club_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Club not found');
  END IF;
  IF v_stored IS NULL THEN
    RETURN jsonb_build_object('valid', true, 'requires_password', false);
  END IF;
  -- Empty password = just probing whether a password is required
  IF p_password = '' THEN
    RETURN jsonb_build_object('valid', false, 'requires_password', true);
  END IF;

  v_colon := position(':' IN v_stored);
  IF v_colon > 0 THEN
    -- Salted format: "salt:SHA256(salt + '::' + password)"
    v_salt     := left(v_stored, v_colon - 1);
    v_stored_h := substring(v_stored FROM v_colon + 1);
    v_computed := encode(digest(v_salt || '::' || p_password, 'sha256'), 'hex');
  ELSE
    -- Legacy format: SHA256("jastly::password::club")
    v_computed := encode(digest('jastly::' || p_password || '::club', 'sha256'), 'hex');
    v_stored_h := v_stored;
  END IF;

  RETURN jsonb_build_object('valid', v_computed = v_stored_h, 'requires_password', true);
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

-- Any authenticated user (including anonymous sessions) can create a club.
-- Anonymous hosts sign in via signInAnonymously() before creating a club.
-- The UPDATE/DELETE policies restrict further actions to the original host_uid.
CREATE POLICY "clubs: authenticated insert"
  ON clubs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

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

-- Only the authenticated uploader can insert a logo (owner is set automatically)
DROP POLICY IF EXISTS "club-logos: auth upload"   ON storage.objects;
CREATE POLICY "club-logos: auth upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'club-logos' AND auth.uid() IS NOT NULL);

-- Only the original uploader can replace their own logo (owner = auth.uid())
DROP POLICY IF EXISTS "club-logos: auth update"   ON storage.objects;
CREATE POLICY "club-logos: auth update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'club-logos' AND owner = auth.uid());

-- Only the original uploader can delete their own logo
DROP POLICY IF EXISTS "club-logos: auth delete"   ON storage.objects;
CREATE POLICY "club-logos: auth delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'club-logos' AND owner = auth.uid());


-- ────────────────────────────────────────────────────────────
-- PERFORMANCE INDICES
-- ────────────────────────────────────────────────────────────
-- Speeds up host authentication checks and request polling
CREATE INDEX IF NOT EXISTS idx_clubs_host_uid     ON clubs(host_uid);
CREATE INDEX IF NOT EXISTS idx_requests_club_id   ON requests(club_id);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at DESC);

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
--
-- ── Supabase security advisor warnings (expected / false positives) ──────────
--
-- "auth_allow_anonymous_sign_ins" on clubs/requests:
--   This app intentionally allows anonymous auth for hosts (signInAnonymously).
--   The UPDATE/DELETE policies on clubs check auth.uid() = host_uid, so an
--   anonymous session without the right UID has no access. These are false
--   positives; the actual data protection is enforced by the UID check.
--
-- "auth_allow_anonymous_sign_ins" on storage.objects:
--   The upload policy requires auth.uid() IS NOT NULL (any authenticated user).
--   UPDATE and DELETE are now restricted to owner = auth.uid() (fixed above).
--   Public read is intentional — logos are served via public CDN URLs.
--
-- "auth_leaked_password_protection":
--   Enable this in the Supabase Dashboard only — there is no SQL for it.
--   Dashboard → Authentication → Providers → Email → "Check for leaked passwords"
