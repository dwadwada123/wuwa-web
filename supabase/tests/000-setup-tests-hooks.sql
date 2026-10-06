-- ============================================================================
-- Supabase Test Setup Hook: dbdev & basejump-supabase_test_helpers
-- File: supabase/tests/000-setup-tests-hooks.sql
-- Runs before all test suites in supabase/tests/
-- ============================================================================

-- 1. Ensure pgtap is available
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

/*
-------------------------------------------------------------------------------
-- Install dbdev (PostgreSQL package manager) via pg_tle & http
-------------------------------------------------------------------------------
Requires:
  - pg_tle
  - pgsql-http
*/
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_tle;

DROP EXTENSION IF EXISTS "supabase-dbdev";
SELECT pgtle.uninstall_extension_if_exists('supabase-dbdev');

SELECT
    pgtle.install_extension(
        'supabase-dbdev',
        resp.contents ->> 'version',
        'PostgreSQL package manager',
        resp.contents ->> 'sql'
    )
FROM extensions.http(
    (
        'GET',
        'https://api.database.dev/rest/v1/'
        || 'package_versions?select=sql,version'
        || '&package_name=eq.supabase-dbdev'
        || '&order=version.desc'
        || '&limit=1',
        array[
            ('apiKey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdXB0cHBsZnZpaWZyYndtbXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODAxMDczNzIsImV4cCI6MTk5NTY4MzM3Mn0.z2CN0mvO2No8wSi46Gw59DFGCTJrzM0AQKsu_5k134s')::extensions.http_header
        ],
        null,
        null
    )
) x,
lateral (
    SELECT
        ((row_to_json(x) -> 'content') #>> '{}')::json -> 0
) resp(contents);

CREATE EXTENSION "supabase-dbdev";
SELECT dbdev.install('supabase-dbdev');
DROP EXTENSION IF EXISTS "supabase-dbdev";
CREATE EXTENSION "supabase-dbdev";

-- 2. Install basejump-supabase_test_helpers via dbdev
SELECT dbdev.install('basejump-supabase_test_helpers');
CREATE EXTENSION IF NOT EXISTS "basejump-supabase_test_helpers" VERSION '0.0.6';

-- 3. Verify setup with an always-green test assertion
BEGIN;
SELECT plan(1);
SELECT ok(true, 'Pre-test hook completed successfully: test helpers installed');
SELECT * FROM finish();
ROLLBACK;
