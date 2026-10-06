-- ============================================================================
-- Migration: 20261006170000_expand_provenance_source_types.sql
-- Description: Expand provenance_sources.source_type taxonomy to include:
--   - OFFICIAL_PUBLISHED
--   - OFFICIAL_DATAMINE
--   - COMMUNITY_DATAMINE
--   - LIVE_OBSERVATION
--   - COMMUNITY_VERIFIED
-- And remap existing Patch 3.7 provenance rows to correct semantics.
-- ============================================================================

-- Step 1: Drop legacy source_type CHECK constraint
ALTER TABLE public.provenance_sources
  DROP CONSTRAINT IF EXISTS provenance_sources_source_type_check;

-- Step 2: Remap existing Patch 3.7 provenance records to exact semantic source_type
UPDATE public.provenance_sources
SET source_type = 'OFFICIAL_PUBLISHED'
WHERE source_name = 'Kuro Games Official 3.7 Release Announcement'
   OR source_name ILIKE '%Kuro Games%';

UPDATE public.provenance_sources
SET source_type = 'COMMUNITY_DATAMINE'
WHERE source_name = 'api-v2.encore.moe Client Datamine (Patch 3.7)'
   OR source_name = 'Arikatsu/WutheringWaves_Data (Branch 3.7)'
   OR source_name ILIKE '%encore.moe%'
   OR source_name ILIKE '%WutheringWaves_Data%';

UPDATE public.provenance_sources
SET source_type = 'COMMUNITY_VERIFIED'
WHERE source_name = 'Prydwen Institute Community Theorycrafting (Patch 3.7)'
   OR source_name ILIKE '%Prydwen%';

-- Step 3: Add expanded source_type CHECK constraint
ALTER TABLE public.provenance_sources
  ADD CONSTRAINT provenance_sources_source_type_check
  CHECK (source_type IN (
    'OFFICIAL_PUBLISHED',
    'OFFICIAL_DATAMINE',
    'COMMUNITY_DATAMINE',
    'LIVE_OBSERVATION',
    'COMMUNITY_VERIFIED'
  ));
