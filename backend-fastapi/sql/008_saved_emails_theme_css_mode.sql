-- Add theme_css_mode to saved_emails (required if you want to persist light-only vs adaptive in the DB).
-- Run in Supabase SQL Editor if saves fail with PGRST204 about theme_css_mode, or to re-enable column persistence in savedEmailsSupabase.emailToRow.

ALTER TABLE saved_emails
  ADD COLUMN IF NOT EXISTS theme_css_mode text DEFAULT 'adaptive';

COMMENT ON COLUMN saved_emails.theme_css_mode IS 'adaptive = light+dark CSS in HTML; light-only = light rules only';
