-- ========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- for component_library table
-- ========================================

-- Enable RLS on component_library table
ALTER TABLE component_library ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access" ON component_library;
DROP POLICY IF EXISTS "Allow authenticated insert" ON component_library;
DROP POLICY IF EXISTS "Allow authenticated update" ON component_library;
DROP POLICY IF EXISTS "Allow authenticated delete" ON component_library;
DROP POLICY IF EXISTS "Allow service role full access" ON component_library;

-- Policy 1: Allow anyone to read live components
-- This allows the frontend (using anon key) to read components with status='live'
CREATE POLICY "Allow public read access"
ON component_library FOR SELECT
USING (status = 'live');

-- Policy 2: Allow authenticated users to insert components
-- Note: This requires authentication. If you're using Supabase Auth, uncomment this:
-- CREATE POLICY "Allow authenticated insert"
-- ON component_library FOR INSERT
-- TO authenticated
-- WITH CHECK (true);

-- Policy 3: Allow service role to do everything (for admin operations)
-- This allows backend operations using service role key
-- CREATE POLICY "Allow service role full access"
-- ON component_library FOR ALL
-- TO service_role
-- USING (true)
-- WITH CHECK (true);

-- ========================================
-- ALTERNATIVE: For development/testing
-- Temporarily allow inserts from anon key
-- ========================================
-- If you want to allow inserts from frontend (anon key) without authentication:
-- CREATE POLICY "Allow anon insert"
-- ON component_library FOR INSERT
-- TO anon
-- WITH CHECK (true);

-- CREATE POLICY "Allow anon update"
-- ON component_library FOR UPDATE
-- TO anon
-- USING (true)
-- WITH CHECK (true);

-- ========================================
-- RECOMMENDED: Allow authenticated inserts
-- This is more secure but requires Supabase Auth
-- ========================================
-- If you're using Supabase Auth (not just JWT from your backend),
-- uncomment these policies:

-- CREATE POLICY "Allow authenticated users to insert"
-- ON component_library FOR INSERT
-- TO authenticated
-- WITH CHECK (true);

-- CREATE POLICY "Allow authenticated users to update"
-- ON component_library FOR UPDATE
-- TO authenticated
-- USING (true)
-- WITH CHECK (true);

-- CREATE POLICY "Allow authenticated users to delete"
-- ON component_library FOR DELETE
-- TO authenticated
-- USING (true);

-- ========================================
-- SIMPLEST: For now, allow all operations from anon
-- (Only for development - remove for production!)
-- ========================================
-- This allows the frontend to insert/update/delete without authentication
-- WARNING: Only use this in development!

CREATE POLICY "Allow anon insert"
ON component_library FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Allow anon update"
ON component_library FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow anon delete"
ON component_library FOR DELETE
TO anon
USING (true);

-- Verify policies
SELECT tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'component_library';

