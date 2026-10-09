-- ============================================================================
-- pgTAP Test Suite 5: Resonance Sequence Schema, Patch Isolation & RLS
-- File: supabase/tests/database/05_sequence_schema.test.sql
-- Run:  npx supabase test db
-- ============================================================================

-- Ensure test helpers extension is active for this suite
CREATE EXTENSION IF NOT EXISTS "basejump-supabase_test_helpers";

BEGIN;
SELECT plan(42);

-- ----------------------------------------------------------------------------
-- Part 1: Table Structure, PKs, FKs, and Columns
-- ----------------------------------------------------------------------------
-- Tables exist
SELECT has_table('public', 'resonator_sequences', 'Table resonator_sequences exists');
SELECT has_table('public', 'resonator_sequence_patch_data', 'Table resonator_sequence_patch_data exists');
SELECT has_table('public', 'resonator_sequence_effects', 'Table resonator_sequence_effects exists');

-- Columns exist
SELECT has_column('public', 'resonator_sequences', 'id', 'resonator_sequences.id exists');
SELECT has_column('public', 'resonator_sequences', 'resonator_id', 'resonator_sequences.resonator_id exists');
SELECT has_column('public', 'resonator_sequences', 'node_order', 'resonator_sequences.node_order exists');
SELECT has_column('public', 'resonator_sequences', 'node_code', 'resonator_sequences.node_code exists');

SELECT has_column('public', 'resonator_sequence_patch_data', 'id', 'resonator_sequence_patch_data.id exists');
SELECT has_column('public', 'resonator_sequence_patch_data', 'sequence_id', 'resonator_sequence_patch_data.sequence_id exists');
SELECT has_column('public', 'resonator_sequence_patch_data', 'patch_id', 'resonator_sequence_patch_data.patch_id exists');
SELECT has_column('public', 'resonator_sequence_patch_data', 'name', 'resonator_sequence_patch_data.name exists');
SELECT has_column('public', 'resonator_sequence_patch_data', 'description', 'resonator_sequence_patch_data.description exists');
SELECT has_column('public', 'resonator_sequence_patch_data', 'provenance_id', 'resonator_sequence_patch_data.provenance_id exists');

SELECT has_column('public', 'resonator_sequence_effects', 'id', 'resonator_sequence_effects.id exists');
SELECT has_column('public', 'resonator_sequence_effects', 'sequence_patch_id', 'resonator_sequence_effects.sequence_patch_id exists');
SELECT has_column('public', 'resonator_sequence_effects', 'patch_id', 'resonator_sequence_effects.patch_id exists');
SELECT has_column('public', 'resonator_sequence_effects', 'effect_id', 'resonator_sequence_effects.effect_id exists');
SELECT has_column('public', 'resonator_sequence_effects', 'effect_order', 'resonator_sequence_effects.effect_order exists');

-- Primary keys
SELECT has_pk('public', 'resonator_sequences', 'resonator_sequences has PK');
SELECT has_pk('public', 'resonator_sequence_patch_data', 'resonator_sequence_patch_data has PK');
SELECT has_pk('public', 'resonator_sequence_effects', 'resonator_sequence_effects has PK');

-- Foreign keys
SELECT has_fk('public', 'resonator_sequences', 'resonator_sequences has FK to resonators');
SELECT has_fk('public', 'resonator_sequence_patch_data', 'resonator_sequence_patch_data has FKs');
SELECT has_fk('public', 'resonator_sequence_effects', 'resonator_sequence_effects has FKs');

-- ----------------------------------------------------------------------------
-- Part 2: Seed Fixtures (as superuser / postgres)
-- ----------------------------------------------------------------------------
INSERT INTO public.patches (id, version, release_date) VALUES
  ('aaaaaaaa-3737-3737-3737-aaaaaaaaaaaa', '3.7-seq-test', '2026-09-30'),
  ('bbbbbbbb-3838-3838-3838-bbbbbbbbbbbb', '3.8-seq-test', '2026-11-15')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.provenance_sources (id, source_name, source_type, verification_date, confidence, classification)
VALUES (
  'cccccccc-0000-0000-0000-cccccccccccc',
  'Kuro Official Sequence Test Source',
  'OFFICIAL_PUBLISHED',
  '2026-09-30',
  'HIGH',
  'CORE_MECHANIC'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.resonators (id, name, element, weapon_type, rarity, release_date)
VALUES ('dddddddd-0000-0000-0000-dddddddddddd', 'Sequence Test Resonator', 'Glacio', 'Sword', 5, '2026-09-30')
ON CONFLICT (id) DO NOTHING;

-- GameplayEffect in Patch 3.7
INSERT INTO public.gameplay_effects (id, patch_id, category, target, condition_expression, detail_expression)
VALUES (
  'eeeeeeee-3737-3737-3737-eeeeeeeeeeee',
  'aaaaaaaa-3737-3737-3737-aaaaaaaaaaaa',
  'STAT_BUFF',
  'TEAM',
  '{"trigger":"intro_skill"}'::jsonb,
  '{"atk_percent":0.20}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- GameplayEffect in Patch 3.8
INSERT INTO public.gameplay_effects (id, patch_id, category, target, condition_expression, detail_expression)
VALUES (
  'eeeeeeee-3838-3838-3838-eeeeeeeeeeee',
  'bbbbbbbb-3838-3838-3838-bbbbbbbbbbbb',
  'DMG_AMPLIFY',
  'SELF',
  '{"trigger":"resonance_skill"}'::jsonb,
  '{"glacio_dmg":0.30}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Part 3: Sequence Order Invariant & Constraints
-- ----------------------------------------------------------------------------
-- Valid inserts for S1..S6
SELECT lives_ok(
  $$INSERT INTO public.resonator_sequences (id, resonator_id, node_order, node_code) VALUES
    ('11111111-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-dddddddddddd', 1, 'S1'),
    ('11111111-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-dddddddddddd', 2, 'S2'),
    ('11111111-0000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-dddddddddddd', 3, 'S3'),
    ('11111111-0000-0000-0000-000000000004', 'dddddddd-0000-0000-0000-dddddddddddd', 4, 'S4'),
    ('11111111-0000-0000-0000-000000000005', 'dddddddd-0000-0000-0000-dddddddddddd', 5, 'S5'),
    ('11111111-0000-0000-0000-000000000006', 'dddddddd-0000-0000-0000-dddddddddddd', 6, 'S6')$$,
  'Valid sequence nodes S1..S6 insert successfully'
);

-- Invalid node_order = 0 rejected by CHECK constraint
SELECT throws_ok(
  $$INSERT INTO public.resonator_sequences (resonator_id, node_order, node_code)
    VALUES ('dddddddd-0000-0000-0000-dddddddddddd', 0, 'S0')$$,
  '23514',
  NULL,
  'node_order = 0 is rejected by check constraint'
);

-- Invalid node_order = 7 rejected by CHECK constraint
SELECT throws_ok(
  $$INSERT INTO public.resonator_sequences (resonator_id, node_order, node_code)
    VALUES ('dddddddd-0000-0000-0000-dddddddddddd', 7, 'S7')$$,
  '23514',
  NULL,
  'node_order = 7 is rejected by check constraint'
);

-- Duplicate node_order for same resonator rejected by UNIQUE constraint
SELECT throws_ok(
  $$INSERT INTO public.resonator_sequences (resonator_id, node_order, node_code)
    VALUES ('dddddddd-0000-0000-0000-dddddddddddd', 1, 'S1_DUP')$$,
  '23505',
  NULL,
  'Duplicate node_order for same resonator is rejected by unique constraint'
);

-- Duplicate node_code for same resonator rejected by UNIQUE constraint
SELECT throws_ok(
  $$INSERT INTO public.resonator_sequences (resonator_id, node_order, node_code)
    VALUES ('dddddddd-0000-0000-0000-dddddddddddd', 2, 'S1')$$,
  '23505',
  NULL,
  'Duplicate node_code for same resonator is rejected by unique constraint'
);

-- ----------------------------------------------------------------------------
-- Part 4: Patch Isolation & Composite Foreign Key Enforcements
-- ----------------------------------------------------------------------------
-- Insert valid sequence patch data in Patch 3.7
SELECT lives_ok(
  $$INSERT INTO public.resonator_sequence_patch_data (id, sequence_id, patch_id, name, description, provenance_id)
    VALUES (
      '22222222-3737-3737-3737-222222222221',
      '11111111-0000-0000-0000-000000000001',
      'aaaaaaaa-3737-3737-3737-aaaaaaaaaaaa', -- Patch 3.7
      'Frostbite Convergence',
      'Increases all party members ATK by 20% on Intro Skill.',
      'cccccccc-0000-0000-0000-cccccccccccc'
    )$$,
  'Valid sequence patch data inserts with provenance reference'
);

-- Valid sequence effect linking Patch 3.7 sequence data to Patch 3.7 GameplayEffect
SELECT lives_ok(
  $$INSERT INTO public.resonator_sequence_effects (sequence_patch_id, patch_id, effect_id, effect_order)
    VALUES (
      '22222222-3737-3737-3737-222222222221',
      'aaaaaaaa-3737-3737-3737-aaaaaaaaaaaa', -- Patch 3.7
      'eeeeeeee-3737-3737-3737-eeeeeeeeeeee', -- Patch 3.7 GameplayEffect
      1
    )$$,
  'Sequence effect correctly links sequence patch data and gameplay effect within Patch 3.7'
);

-- Cross-Patch Leakage Prevention: Patch 3.7 sequence effect linking Patch 3.8 effect
SELECT throws_ok(
  $$INSERT INTO public.resonator_sequence_effects (sequence_patch_id, patch_id, effect_id, effect_order)
    VALUES (
      '22222222-3737-3737-3737-222222222221', -- Patch 3.7 sequence data
      'aaaaaaaa-3737-3737-3737-aaaaaaaaaaaa', -- Patch 3.7
      'eeeeeeee-3838-3838-3838-eeeeeeeeeeee', -- Patch 3.8 GameplayEffect!
      2
    )$$,
  '23503',
  NULL,
  'Cross-patch foreign key mismatch between sequence_patch_data and gameplay_effects is rejected'
);

-- Cross-Patch Leakage Prevention: Patch 3.8 patch_id with Patch 3.7 sequence_patch_id
SELECT throws_ok(
  $$INSERT INTO public.resonator_sequence_effects (sequence_patch_id, patch_id, effect_id, effect_order)
    VALUES (
      '22222222-3737-3737-3737-222222222221', -- Patch 3.7 sequence data
      'bbbbbbbb-3838-3838-3838-bbbbbbbbbbbb', -- Patch 3.8
      'eeeeeeee-3838-3838-3838-eeeeeeeeeeee', -- Patch 3.8 GameplayEffect
      99
    )$$,
  '23503',
  NULL,
  'Patch mismatch between sequence_effects and sequence_patch_data is rejected by composite FK'
);

-- Duplicate effect_order rejected
SELECT throws_ok(
  $$INSERT INTO public.resonator_sequence_effects (sequence_patch_id, patch_id, effect_id, effect_order)
    VALUES (
      '22222222-3737-3737-3737-222222222221',
      'aaaaaaaa-3737-3737-3737-aaaaaaaaaaaa',
      'eeeeeeee-3737-3737-3737-eeeeeeeeeeee',
      1 -- Duplicate order 1
    )$$,
  '23505',
  NULL,
  'Duplicate effect_order on same sequence node is rejected by unique constraint'
);

-- Invalid provenance_id rejected
SELECT throws_ok(
  $$INSERT INTO public.resonator_sequence_patch_data (sequence_id, patch_id, name, description, provenance_id)
    VALUES (
      '11111111-0000-0000-0000-000000000002',
      'aaaaaaaa-3737-3737-3737-aaaaaaaaaaaa',
      'Invalid Prov Node',
      'Desc',
      '99999999-9999-9999-9999-999999999999' -- Non-existent provenance ID
    )$$,
  '23503',
  NULL,
  'Invalid provenance_id is rejected by foreign key constraint'
);

-- ----------------------------------------------------------------------------
-- Part 5: RLS & Permissions
-- ----------------------------------------------------------------------------
-- Assertion: anon SELECT succeeds
SELECT tests.clear_authentication();
SELECT lives_ok(
  'SELECT count(*) FROM public.resonator_sequences',
  'anon can select from public.resonator_sequences'
);
SELECT lives_ok(
  'SELECT count(*) FROM public.resonator_sequence_patch_data',
  'anon can select from public.resonator_sequence_patch_data'
);
SELECT lives_ok(
  'SELECT count(*) FROM public.resonator_sequence_effects',
  'anon can select from public.resonator_sequence_effects'
);

-- Assertion: authenticated SELECT succeeds
SELECT tests.create_supabase_user('seq_reader_user', 'seq_reader@example.com');
SELECT tests.authenticate_as('seq_reader_user');
SELECT lives_ok(
  'SELECT count(*) FROM public.resonator_sequences',
  'authenticated can select from public.resonator_sequences'
);

-- Assertion: anon INSERT fails with 42501 (insufficient_privilege)
SELECT tests.clear_authentication();
SELECT throws_ok(
  $$INSERT INTO public.resonator_sequences (resonator_id, node_order, node_code)
    VALUES ('dddddddd-0000-0000-0000-dddddddddddd', 1, 'HACK_S1')$$,
  '42501',
  NULL,
  'anon INSERT on resonator_sequences is rejected with insufficient_privilege (42501)'
);

-- Assertion: authenticated INSERT fails with 42501
SELECT tests.authenticate_as('seq_reader_user');
SELECT throws_ok(
  $$INSERT INTO public.resonator_sequences (resonator_id, node_order, node_code)
    VALUES ('dddddddd-0000-0000-0000-dddddddddddd', 1, 'HACK_S1')$$,
  '42501',
  NULL,
  'authenticated INSERT on resonator_sequences is rejected with insufficient_privilege (42501)'
);

-- Assertion: authenticated UPDATE fails with 42501
SELECT throws_ok(
  $$UPDATE public.resonator_sequences SET node_code = 'HACKED'
    WHERE id = '11111111-0000-0000-0000-000000000001'$$,
  '42501',
  NULL,
  'authenticated UPDATE on resonator_sequences is rejected with insufficient_privilege (42501)'
);

SELECT * FROM finish();
ROLLBACK;

-- Clean up test helpers extension
DROP EXTENSION IF EXISTS "basejump-supabase_test_helpers" CASCADE;
