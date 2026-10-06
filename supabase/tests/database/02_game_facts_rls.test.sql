-- ============================================================================
-- pgTAP Test Suite 2: Canonical Game Facts RLS & Read-Only Permissions
-- File: supabase/tests/database/02_game_facts_rls.test.sql
-- Run:  supabase test db
-- ============================================================================

BEGIN;
SELECT plan(8);

-- Seed a resonator fixture for testing read/write rules
INSERT INTO public.resonators (id, name, element, weapon_type, rarity, release_date)
VALUES ('11111111-2222-3333-4444-555555555555', 'Verina Fact Test', 'Spectro', 'Rectifier', 5, '2024-05-23')
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Test 1 & 2: Public SELECT Access
-- ----------------------------------------------------------------------------
-- Assertion 1: anon SELECT succeeds
SELECT tests.clear_authentication();
SELECT lives_ok(
  'SELECT count(*) FROM public.resonators',
  'anon can select from public game facts (resonators)'
);

-- Assertion 2: authenticated SELECT succeeds
SELECT tests.create_supabase_user('game_facts_reader', 'facts_reader@example.com');
SELECT tests.authenticate_as('game_facts_reader');
SELECT lives_ok(
  'SELECT count(*) FROM public.resonators',
  'authenticated can select from public game facts (resonators)'
);

-- ----------------------------------------------------------------------------
-- Test 3 & 4: INSERT Lockdown
-- ----------------------------------------------------------------------------
-- Assertion 3: anon INSERT fails with 42501
SELECT tests.clear_authentication();
SELECT throws_ok(
  'INSERT INTO public.resonators (name, element, weapon_type, rarity, release_date) VALUES (''Hacked Char'', ''Glacio'', ''Sword'', 5, ''2026-01-01'')',
  '42501',
  NULL,
  'anon INSERT on game facts is rejected with insufficient_privilege (42501)'
);

-- Assertion 4: authenticated INSERT fails with 42501
SELECT tests.authenticate_as('game_facts_reader');
SELECT throws_ok(
  'INSERT INTO public.resonators (name, element, weapon_type, rarity, release_date) VALUES (''Hacked Char'', ''Glacio'', ''Sword'', 5, ''2026-01-01'')',
  '42501',
  NULL,
  'authenticated INSERT on game facts is rejected with insufficient_privilege (42501)'
);

-- ----------------------------------------------------------------------------
-- Test 5 & 6: UPDATE Lockdown
-- ----------------------------------------------------------------------------
-- Assertion 5: anon UPDATE fails with 42501
SELECT tests.clear_authentication();
SELECT throws_ok(
  'UPDATE public.resonators SET name = ''Modified'' WHERE id = ''11111111-2222-3333-4444-555555555555''',
  '42501',
  NULL,
  'anon UPDATE on game facts is rejected with insufficient_privilege (42501)'
);

-- Assertion 6: authenticated UPDATE fails with 42501
SELECT tests.authenticate_as('game_facts_reader');
SELECT throws_ok(
  'UPDATE public.resonators SET name = ''Modified'' WHERE id = ''11111111-2222-3333-4444-555555555555''',
  '42501',
  NULL,
  'authenticated UPDATE on game facts is rejected with insufficient_privilege (42501)'
);

-- ----------------------------------------------------------------------------
-- Test 7 & 8: DELETE Lockdown
-- ----------------------------------------------------------------------------
-- Assertion 7: anon DELETE fails with 42501
SELECT tests.clear_authentication();
SELECT throws_ok(
  'DELETE FROM public.resonators WHERE id = ''11111111-2222-3333-4444-555555555555''',
  '42501',
  NULL,
  'anon DELETE on game facts is rejected with insufficient_privilege (42501)'
);

-- Assertion 8: authenticated DELETE fails with 42501
SELECT tests.authenticate_as('game_facts_reader');
SELECT throws_ok(
  'DELETE FROM public.resonators WHERE id = ''11111111-2222-3333-4444-555555555555''',
  '42501',
  NULL,
  'authenticated DELETE on game facts is rejected with insufficient_privilege (42501)'
);

SELECT * FROM finish();
ROLLBACK;
