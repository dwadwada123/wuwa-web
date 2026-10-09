-- ============================================================================
-- Migration: 20261008020000_resonator_sequences.sql
-- Description: Phase 6A Step 1 - Resonance Sequence Database Schema
--   - public.resonator_sequences (stable identity: order 1..6, code 'S1'..'S6')
--   - public.resonator_sequence_patch_data (patch-versioned metadata & provenance)
--   - public.resonator_sequence_effects (links to public.gameplay_effects with patch isolation)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table 1: resonator_sequences
-- Represents stable identity of sequence node (S1..S6) for a resonator
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.resonator_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resonator_id uuid NOT NULL REFERENCES public.resonators(id) ON DELETE RESTRICT,
  node_order int NOT NULL CHECK (node_order BETWEEN 1 AND 6),
  node_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resonator_sequences_order_unique UNIQUE (resonator_id, node_order),
  CONSTRAINT resonator_sequences_code_unique UNIQUE (resonator_id, node_code)
);

-- ----------------------------------------------------------------------------
-- Table 2: resonator_sequence_patch_data
-- Represents patch-versioned talent data (name, description, provenance)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.resonator_sequence_patch_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES public.resonator_sequences(id) ON DELETE RESTRICT,
  patch_id uuid NOT NULL REFERENCES public.patches(id) ON DELETE RESTRICT,
  name text NOT NULL,
  description text NOT NULL,
  provenance_id uuid REFERENCES public.provenance_sources(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resonator_sequence_patch_data_unique UNIQUE (sequence_id, patch_id),
  CONSTRAINT resonator_sequence_patch_data_patch_key UNIQUE (id, patch_id)
);

-- ----------------------------------------------------------------------------
-- Table 3: resonator_sequence_effects
-- Links sequence nodes to existing gameplay_effects with strict composite patch foreign keys
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.resonator_sequence_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_patch_id uuid NOT NULL,
  patch_id uuid NOT NULL REFERENCES public.patches(id) ON DELETE RESTRICT,
  effect_id uuid NOT NULL,
  effect_order int NOT NULL DEFAULT 1 CHECK (effect_order > 0),
  CONSTRAINT resonator_sequence_effects_order_unique UNIQUE (sequence_patch_id, effect_order),
  CONSTRAINT resonator_sequence_effects_sequence_patch_fkey FOREIGN KEY (sequence_patch_id, patch_id)
    REFERENCES public.resonator_sequence_patch_data(id, patch_id) ON DELETE RESTRICT,
  CONSTRAINT resonator_sequence_effects_gameplay_effect_fkey FOREIGN KEY (effect_id, patch_id)
    REFERENCES public.gameplay_effects(id, patch_id) ON DELETE RESTRICT
);

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_resonator_sequences_resonator_id
  ON public.resonator_sequences (resonator_id);

CREATE INDEX IF NOT EXISTS idx_resonator_sequence_patch_data_patch_id
  ON public.resonator_sequence_patch_data (patch_id);

CREATE INDEX IF NOT EXISTS idx_resonator_sequence_effects_effect_id
  ON public.resonator_sequence_effects (effect_id);

-- ----------------------------------------------------------------------------
-- Permissions & Grants
-- ----------------------------------------------------------------------------
GRANT SELECT ON TABLE
  public.resonator_sequences,
  public.resonator_sequence_patch_data,
  public.resonator_sequence_effects
TO anon, authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE
  public.resonator_sequences,
  public.resonator_sequence_patch_data,
  public.resonator_sequence_effects
FROM anon, authenticated, PUBLIC;

GRANT ALL ON TABLE
  public.resonator_sequences,
  public.resonator_sequence_patch_data,
  public.resonator_sequence_effects
TO service_role;

-- ----------------------------------------------------------------------------
-- Row Level Security (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.resonator_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resonator_sequence_patch_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resonator_sequence_effects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on resonator_sequences"
  ON public.resonator_sequences
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public read on resonator_sequence_patch_data"
  ON public.resonator_sequence_patch_data
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public read on resonator_sequence_effects"
  ON public.resonator_sequence_effects
  FOR SELECT
  TO anon, authenticated
  USING (true);
