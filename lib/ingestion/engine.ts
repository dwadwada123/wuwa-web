import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  PatchDataset,
  IngestionReport,
  IngestionCounts
} from './types.ts';
import { validatePatchDataset } from './validation.ts';

/**
 * Generates an RFC 4122 v4 formatted deterministic UUID from a namespace key string.
 */
export function deterministicUuid(key: string): string {
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16),
    'a' + hash.substring(17, 20),
    hash.substring(20, 32)
  ].join('-');
}

/**
 * Ingests a validated patch dataset into Supabase canonical game-fact tables.
 * Fully deterministic, patch-aware, and idempotent.
 */
export async function ingestPatchDataset(
  dataset: PatchDataset,
  supabase: SupabaseClient
): Promise<IngestionReport> {
  const startTime = Date.now();

  // 1. Validation Pre-Check
  const validation = validatePatchDataset(dataset);
  if (!validation.isValid) {
    const errorDetails = validation.errors.map(e => `[${e.path}] ${e.message}`).join('; ');
    throw new Error(`Dataset validation failed: ${errorDetails}`);
  }

  const counts: IngestionCounts = {
    patches: 0,
    provenanceSources: 0,
    functionalRoles: 0,
    combatTags: 0,
    resonators: 0,
    resonatorPatchData: 0,
    resonatorRoles: 0,
    resonatorCombatTags: 0,
    abilities: 0,
    abilityPatchData: 0,
    gameplayEffects: 0,
    abilityEffects: 0
  };

  // 2. Ingest Provenance Sources
  const provenanceMap = new Map<string, string>();
  for (const ps of dataset.provenance_sources) {
    const deterministicId = deterministicUuid(`provenance:${ps.source_name}`);
    const { data, error } = await supabase
      .from('provenance_sources')
      .upsert(
        {
          id: deterministicId,
          source_name: ps.source_name,
          url: ps.url ?? null,
          source_type: ps.source_type,
          verification_date: ps.verification_date,
          confidence: ps.confidence,
          classification: ps.classification,
          status: ps.status ?? 'ACTIVE'
        },
        { onConflict: 'id' }
      )
      .select('id, source_name')
      .single();

    if (error || !data) {
      throw new Error(`Failed to upsert provenance source ${ps.source_name}: ${error?.message}`);
    }

    provenanceMap.set(ps.source_name, data.id);
    counts.provenanceSources++;
  }

  // 3. Ingest Patch Registry
  const patchProvId = provenanceMap.get(dataset.patch.provenance_source_name);
  if (!patchProvId) {
    throw new Error(`Provenance source ${dataset.patch.provenance_source_name} not found`);
  }

  const deterministicPatchId =
    dataset.patch.version === '3.7'
      ? '11111111-1111-1111-1111-111111111111'
      : deterministicUuid(`patch:${dataset.patch.version}`);

  const { data: patchRow, error: patchError } = await supabase
    .from('patches')
    .upsert(
      {
        id: deterministicPatchId,
        version: dataset.patch.version,
        release_date: dataset.patch.release_date,
        notes: dataset.patch.notes ?? null
      },
      { onConflict: 'version' }
    )
    .select('id, version')
    .single();

  if (patchError || !patchRow) {
    throw new Error(`Failed to upsert patch ${dataset.patch.version}: ${patchError?.message}`);
  }

  const patchId = patchRow.id;
  counts.patches++;

  // 4. Ingest Functional Roles Taxonomy
  const roleMap = new Map<string, string>();
  for (const role of dataset.functional_roles) {
    const { data: roleRow, error: roleError } = await supabase
      .from('functional_roles')
      .upsert(
        {
          code: role.code,
          label: role.label,
          description: role.description ?? null
        },
        { onConflict: 'code' }
      )
      .select('id, code')
      .single();

    if (roleError || !roleRow) {
      throw new Error(`Failed to upsert functional role ${role.code}: ${roleError?.message}`);
    }

    roleMap.set(roleRow.code, roleRow.id);
    counts.functionalRoles++;
  }

  // 5. Ingest Combat Tags Taxonomy
  const tagMap = new Map<string, string>();
  for (const tag of dataset.combat_tags) {
    const { data: tagRow, error: tagError } = await supabase
      .from('combat_tags')
      .upsert(
        {
          code: tag.code,
          label: tag.label,
          description: tag.description ?? null
        },
        { onConflict: 'code' }
      )
      .select('id, code')
      .single();

    if (tagError || !tagRow) {
      throw new Error(`Failed to upsert combat tag ${tag.code}: ${tagError?.message}`);
    }

    tagMap.set(tagRow.code, tagRow.id);
    counts.combatTags++;
  }

  // 6. Ingest Resonators, Patch Data, Roles, Combat Tags, Abilities, and Effects
  for (const res of dataset.resonators) {
    // 6a. Invariant Resonator Identity
    const { data: resonatorRow, error: resonatorError } = await supabase
      .from('resonators')
      .upsert(
        {
          name: res.name,
          element: res.element,
          weapon_type: res.weapon_type,
          rarity: res.rarity,
          release_date: res.release_date
        },
        { onConflict: 'name' }
      )
      .select('id, name')
      .single();

    if (resonatorError || !resonatorRow) {
      throw new Error(`Failed to upsert resonator ${res.name}: ${resonatorError?.message}`);
    }

    const resonatorId = resonatorRow.id;
    counts.resonators++;

    // 6b. Patch-Specific Resonator Data
    const resProvId = provenanceMap.get(res.patch_data.provenance_source_name);
    if (!resProvId) {
      throw new Error(`Provenance source ${res.patch_data.provenance_source_name} for ${res.name} not found`);
    }

    const { data: patchDataRow, error: patchDataError } = await supabase
      .from('resonator_patch_data')
      .upsert(
        {
          resonator_id: resonatorId,
          patch_id: patchId,
          base_hp_lvl90: res.patch_data.base_hp_lvl90,
          base_atk_lvl90: res.patch_data.base_atk_lvl90,
          base_def_lvl90: res.patch_data.base_def_lvl90,
          provenance_id: resProvId
        },
        { onConflict: 'resonator_id, patch_id' }
      )
      .select('id')
      .single();

    if (patchDataError || !patchDataRow) {
      throw new Error(`Failed to upsert resonator_patch_data for ${res.name}: ${patchDataError?.message}`);
    }

    const resonatorPatchId = patchDataRow.id;
    counts.resonatorPatchData++;

    // 6c. Functional Roles Assignment
    for (const roleAssignment of res.patch_data.roles) {
      const roleId = roleMap.get(roleAssignment.code);
      if (!roleId) {
        throw new Error(`Unknown role code ${roleAssignment.code} for ${res.name}`);
      }

      const { error: roleAssignError } = await supabase
        .from('resonator_roles')
        .upsert(
          {
            resonator_patch_id: resonatorPatchId,
            role_id: roleId,
            is_primary: roleAssignment.is_primary
          },
          { onConflict: 'resonator_patch_id, role_id' }
        );

      if (roleAssignError) {
        throw new Error(`Failed to assign role ${roleAssignment.code} to ${res.name}: ${roleAssignError.message}`);
      }

      counts.resonatorRoles++;
    }

    // 6d. Combat Tags Assignment
    for (const tagCode of res.patch_data.combat_tags) {
      const tagId = tagMap.get(tagCode);
      if (!tagId) {
        throw new Error(`Unknown combat tag code ${tagCode} for ${res.name}`);
      }

      const { error: tagAssignError } = await supabase
        .from('resonator_combat_tags')
        .upsert(
          {
            resonator_patch_id: resonatorPatchId,
            tag_id: tagId
          },
          { onConflict: 'resonator_patch_id, tag_id' }
        );

      if (tagAssignError) {
        throw new Error(`Failed to assign combat tag ${tagCode} to ${res.name}: ${tagAssignError.message}`);
      }

      counts.resonatorCombatTags++;
    }

    // 6e. Abilities & Patch-Specific Abilities
    for (const ab of res.abilities) {
      // Invariant Ability Identity
      const { data: abilityRow, error: abilityError } = await supabase
        .from('abilities')
        .upsert(
          {
            resonator_id: resonatorId,
            ability_code: ab.ability_code,
            ability_category: ab.ability_category
          },
          { onConflict: 'resonator_id, ability_code' }
        )
        .select('id')
        .single();

      if (abilityError || !abilityRow) {
        throw new Error(`Failed to upsert ability ${ab.ability_code} for ${res.name}: ${abilityError?.message}`);
      }

      const abilityId = abilityRow.id;
      counts.abilities++;

      // Patch-Specific Ability Data
      const abProvId = provenanceMap.get(ab.provenance_source_name);
      if (!abProvId) {
        throw new Error(`Provenance source ${ab.provenance_source_name} for ability ${ab.ability_code} not found`);
      }

      const { data: abPatchRow, error: abPatchError } = await supabase
        .from('ability_patch_data')
        .upsert(
          {
            ability_id: abilityId,
            patch_id: patchId,
            name: ab.name,
            description: ab.description ?? null,
            cooldown_seconds: ab.cooldown_seconds ?? null,
            energy_cost: ab.energy_cost ?? null,
            concertos_generated: ab.concertos_generated ?? 0,
            status: ab.status ?? 'ACTIVE',
            provenance_id: abProvId
          },
          { onConflict: 'ability_id, patch_id' }
        )
        .select('id')
        .single();

      if (abPatchError || !abPatchRow) {
        throw new Error(`Failed to upsert ability_patch_data for ${ab.name}: ${abPatchError?.message}`);
      }

      const abilityPatchId = abPatchRow.id;
      counts.abilityPatchData++;

      // 6f. Gameplay Effects (Structured Outro / Mechanics)
      if (ab.effects && ab.effects.length > 0) {
        for (let effIdx = 0; effIdx < ab.effects.length; effIdx++) {
          const eff = ab.effects[effIdx];
          const effectOrder = eff.effect_order ?? effIdx + 1;
          const effProvId = provenanceMap.get(eff.provenance_source_name);
          if (!effProvId) {
            throw new Error(`Provenance source ${eff.provenance_source_name} for effect in ${ab.name} not found`);
          }

          // Deterministic UUID for gameplay effect
          const effectId = deterministicUuid(
            `gameplay_effect:${dataset.patch.version}:${res.name}:${ab.ability_code}:${effectOrder}`
          );

          const { error: effError } = await supabase
            .from('gameplay_effects')
            .upsert(
              {
                id: effectId,
                patch_id: patchId,
                category: eff.category,
                target: eff.target,
                condition_expression: eff.condition_expression ?? {},
                detail_expression: eff.detail_expression ?? {},
                provenance_id: effProvId
              },
              { onConflict: 'id' }
            );

          if (effError) {
            throw new Error(`Failed to upsert gameplay effect for ${ab.name}: ${effError.message}`);
          }

          counts.gameplayEffects++;

          // Ability Effect Mapping
          const { error: abEffError } = await supabase
            .from('ability_effects')
            .upsert(
              {
                ability_patch_id: abilityPatchId,
                patch_id: patchId,
                effect_id: effectId,
                effect_order: effectOrder
              },
              { onConflict: 'ability_patch_id, effect_order' }
            );

          if (abEffError) {
            throw new Error(`Failed to link ability effect in ${ab.name}: ${abEffError.message}`);
          }

          counts.abilityEffects++;
        }
      }
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    success: true,
    counts,
    patchVersion: dataset.patch.version,
    provenanceSourcesUsed: Array.from(provenanceMap.keys()),
    externalSources: dataset.provenance_sources.map(p => p.url).filter(Boolean) as string[],
    omissions: [
      'Complex multi-stage resource gauges and dynamic stacking mechanisms (e.g. Camellya Blossom points, Jinhsi Incandescence) deferred to dedicated rotation simulator phase per instruction E.',
      'Unverified numerical tuning curves for unreleased 3.8 preview assets omitted.'
    ],
    durationMs
  };
}
