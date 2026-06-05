/**
 * Supabase Client Configuration
 * Based on supabase-course-main reference implementation
 * 
 * Environment variables needed in .env (root level):
 * - VITE_SUPABASE_URL: Your Supabase project URL
 * - VITE_SUPABASE_ANON_KEY: Your Supabase anon/public key
 */

import { createClient } from "@supabase/supabase-js";

// Get Supabase URL and key from environment variables
// Vite requires VITE_ prefix for client-side env variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Password login uses FastAPI only; Supabase is for OAuth and some data features.
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    'Supabase env vars missing (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). ' +
      'Google sign-in and Supabase-backed features are disabled until they are set.'
  );
}

// Placeholder avoids crashing the app when Supabase is not configured.
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder'
);

