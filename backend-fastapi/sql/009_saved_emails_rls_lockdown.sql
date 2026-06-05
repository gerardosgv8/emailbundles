-- Lock down saved_emails for direct browser/PostgREST access (anon key).
-- After the app uses GET/PUT/DELETE /api/saved-emails (FastAPI + DATABASE_URL),
-- the frontend no longer needs SELECT/INSERT on this table via the anon role.
--
-- Run in Supabase SQL Editor once. The FastAPI server connects as postgres and bypasses RLS,
-- so subscriber APIs keep working.
--
-- Optional: ensure theme column exists (see 008_saved_emails_theme_css_mode.sql).

-- Remove permissive / dev policies
DROP POLICY IF EXISTS "Allow anonymous access for development" ON saved_emails;
DROP POLICY IF EXISTS "Users can read own emails" ON saved_emails;
DROP POLICY IF EXISTS "Users can insert own emails" ON saved_emails;
DROP POLICY IF EXISTS "Users can update own emails" ON saved_emails;
DROP POLICY IF EXISTS "Users can delete own emails" ON saved_emails;

-- With RLS enabled and no policies for anon/authenticated, PostgREST using the anon key
-- cannot read or write rows. Service / postgres connections used by FastAPI are unaffected.
