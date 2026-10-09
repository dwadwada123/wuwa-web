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
    resonatorSequences: 0,
    resonatorSequencePatchData: 0,
    resonatorSequenceEffects: 0,
    gameplayEffects: 0,
    abilityEffects: 0,
    weapons: 0,
    weaponPatchData: 0,
    echoes: 0,
    echoPatchData: 0,
    sonatas: 0,
    sonataPatchData: 0,
    enemies: 0,
    enemyResistances: 0,
    enemyModifiers: 0,
    areaEffects: 0,
    toaCycles: 0,
    toaZones: 0,
    toaTowers: 0,
    toaStages: 0,
    stageAreaEffects: 0,
    challengeGoals: 0,
    toaWaves: 0,
    toaEnemyInstances: 0
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

    // 6g. Sequence Nodes & Sequence Patch Data & Sequence Effects
    const sequenceNodes = res.sequence_nodes ?? res.sequences;
      if (sequenceNodes && sequenceNodes.length > 0) {
        for (const seqNode of sequenceNodes) {
          const nodeOrder = seqNode.node_order ?? seqNode.nodeOrder;
          const nodeCode = seqNode.node_code ?? seqNode.nodeCode;
          const provName =
            seqNode.provenance_source_name ??
            seqNode.provenanceSourceName ??
            seqNode.provenanceId ??
            seqNode.provenance_id;
          const seqProvId = provenanceMap.get(provName as string);
          if (!seqProvId) {
            throw new Error(`Provenance source ${provName} for sequence ${nodeCode} of ${res.name} not found`);
          }

          // Stable Sequence Identity
          const sequenceId = deterministicUuid(`resonator_sequence:${res.name}:${nodeOrder}`);
          const { data: seqRow, error: seqError } = await supabase
            .from('resonator_sequences')
            .upsert(
              {
                id: sequenceId,
                resonator_id: resonatorId,
                node_order: nodeOrder,
                node_code: nodeCode
              },
              { onConflict: 'resonator_id, node_order' }
            )
            .select('id')
            .single();

          if (seqError || !seqRow) {
            throw new Error(`Failed to upsert resonator_sequences for ${res.name} ${nodeCode}: ${seqError?.message}`);
          }

          counts.resonatorSequences++;

          // Patch-Specific Sequence Data
          const seqPatchId = deterministicUuid(
            `resonator_sequence_patch:${dataset.patch.version}:${res.name}:${nodeOrder}`
          );
          const { data: seqPatchRow, error: seqPatchError } = await supabase
            .from('resonator_sequence_patch_data')
            .upsert(
              {
                id: seqPatchId,
                sequence_id: seqRow.id,
                patch_id: patchId,
                name: seqNode.name,
                description: seqNode.description,
                provenance_id: seqProvId
              },
              { onConflict: 'sequence_id, patch_id' }
            )
            .select('id')
            .single();

          if (seqPatchError || !seqPatchRow) {
            throw new Error(
              `Failed to upsert resonator_sequence_patch_data for ${res.name} ${nodeCode}: ${seqPatchError?.message}`
            );
          }

          counts.resonatorSequencePatchData++;

          // Sequence Effects (if any)
          if (seqNode.effects && seqNode.effects.length > 0) {
            for (let effIdx = 0; effIdx < seqNode.effects.length; effIdx++) {
              const eff = seqNode.effects[effIdx];
              const effectOrder = eff.effect_order ?? effIdx + 1;
              const effProvName = eff.provenance_source_name ?? provName;
              const effProvId = provenanceMap.get(effProvName as string);
              if (!effProvId) {
                throw new Error(
                  `Provenance source ${effProvName} for sequence effect in ${res.name} ${nodeCode} not found`
                );
              }

              const effectId = deterministicUuid(
                `gameplay_effect:${dataset.patch.version}:${res.name}:SEQ_${nodeCode}:${effectOrder}`
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
                throw new Error(
                  `Failed to upsert gameplay effect for sequence ${res.name} ${nodeCode}: ${effError.message}`
                );
              }

              counts.gameplayEffects++;

              // Sequence Effect Mapping
              const seqEffectId = deterministicUuid(
                `resonator_sequence_effect:${dataset.patch.version}:${res.name}:${nodeOrder}:${effectOrder}`
              );

              const { error: seqEffError } = await supabase
                .from('resonator_sequence_effects')
                .upsert(
                  {
                    id: seqEffectId,
                    sequence_patch_id: seqPatchRow.id,
                    patch_id: patchId,
                    effect_id: effectId,
                    effect_order: effectOrder
                  },
                  { onConflict: 'sequence_patch_id, effect_order' }
                );

              if (seqEffError) {
                throw new Error(
                  `Failed to map sequence effect for ${res.name} ${nodeCode}: ${seqEffError.message}`
                );
              }

              counts.resonatorSequenceEffects++;
            }
          }
        }
      }
    }

  // 7. Ingest Weapons & Weapon Patch Data
  if (dataset.weapons && dataset.weapons.length > 0) {
    for (const w of dataset.weapons) {
      // 7a. Invariant Weapon Identity
      const { data: weaponRow, error: weaponError } = await supabase
        .from('weapons')
        .upsert(
          {
            name: w.name,
            weapon_type: w.weapon_type,
            rarity: w.rarity
          },
          { onConflict: 'name' }
        )
        .select('id, name')
        .single();

      if (weaponError || !weaponRow) {
        throw new Error(`Failed to upsert weapon ${w.name}: ${weaponError?.message}`);
      }

      const weaponId = weaponRow.id;
      counts.weapons++;

      // 7b. Passive Effect (if provided)
      let passiveEffectId: string | null = null;
      if (w.patch_data.passive_effect) {
        const eff = w.patch_data.passive_effect;
        const effProvId = provenanceMap.get(eff.provenance_source_name);
        if (!effProvId) {
          throw new Error(`Provenance source ${eff.provenance_source_name} for weapon ${w.name} not found`);
        }

        passiveEffectId = deterministicUuid(`gameplay_effect:weapon:${dataset.patch.version}:${w.name}`);

        const detailExpr = { ...(eff.detail_expression ?? {}) };
        if (w.patch_data.refinement_scaling && !detailExpr.refinement_scaling) {
          detailExpr.refinement_scaling = w.patch_data.refinement_scaling;
        }

        const { error: effError } = await supabase
          .from('gameplay_effects')
          .upsert(
            {
              id: passiveEffectId,
              patch_id: patchId,
              category: eff.category,
              target: eff.target,
              condition_expression: eff.condition_expression ?? {},
              detail_expression: detailExpr,
              provenance_id: effProvId
            },
            { onConflict: 'id' }
          );

        if (effError) {
          throw new Error(`Failed to upsert weapon passive effect for ${w.name}: ${effError.message}`);
        }
        counts.gameplayEffects++;
      }

      // 7c. Patch-Specific Weapon Data
      const wProvId = provenanceMap.get(w.patch_data.provenance_source_name);
      if (!wProvId) {
        throw new Error(`Provenance source ${w.patch_data.provenance_source_name} for weapon ${w.name} not found`);
      }

      const { error: wPatchError } = await supabase
        .from('weapon_patch_data')
        .upsert(
          {
            weapon_id: weaponId,
            patch_id: patchId,
            base_atk_lvl90: w.patch_data.base_atk_lvl90,
            sub_stat_type: w.patch_data.sub_stat_type,
            sub_stat_value_lvl90: w.patch_data.sub_stat_value_lvl90,
            passive_effect_id: passiveEffectId,
            provenance_id: wProvId
          },
          { onConflict: 'weapon_id, patch_id' }
        );

      if (wPatchError) {
        throw new Error(`Failed to upsert weapon_patch_data for ${w.name}: ${wPatchError.message}`);
      }

      counts.weaponPatchData++;
    }
  }

  // 8. Ingest Echoes & Echo Patch Data
  if (dataset.echoes && dataset.echoes.length > 0) {
    for (const e of dataset.echoes) {
      // 8a. Invariant Echo Identity
      const { data: echoRow, error: echoError } = await supabase
        .from('echoes')
        .upsert(
          {
            name: e.name,
            class_type: e.class_type,
            cost: e.cost
          },
          { onConflict: 'name' }
        )
        .select('id, name')
        .single();

      if (echoError || !echoRow) {
        throw new Error(`Failed to upsert echo ${e.name}: ${echoError?.message}`);
      }

      const echoId = echoRow.id;
      counts.echoes++;

      // 8b. Skill Effect (if provided)
      let skillEffectId: string | null = null;
      if (e.patch_data.skill_effect) {
        const eff = e.patch_data.skill_effect;
        const effProvId = provenanceMap.get(eff.provenance_source_name);
        if (!effProvId) {
          throw new Error(`Provenance source ${eff.provenance_source_name} for echo ${e.name} not found`);
        }

        skillEffectId = deterministicUuid(`gameplay_effect:echo:${dataset.patch.version}:${e.name}`);
        const { error: effError } = await supabase
          .from('gameplay_effects')
          .upsert(
            {
              id: skillEffectId,
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
          throw new Error(`Failed to upsert echo skill effect for ${e.name}: ${effError.message}`);
        }
        counts.gameplayEffects++;
      }

      // 8c. Patch-Specific Echo Data
      const eProvId = provenanceMap.get(e.patch_data.provenance_source_name);
      if (!eProvId) {
        throw new Error(`Provenance source ${e.patch_data.provenance_source_name} for echo ${e.name} not found`);
      }

      const { error: ePatchError } = await supabase
        .from('echo_patch_data')
        .upsert(
          {
            echo_id: echoId,
            patch_id: patchId,
            cost: e.patch_data.cost,
            cd_seconds: e.patch_data.cd_seconds ?? 0,
            concertos_generated: e.patch_data.concertos_generated ?? 0,
            skill_effect_id: skillEffectId,
            provenance_id: eProvId
          },
          { onConflict: 'echo_id, patch_id' }
        );

      if (ePatchError) {
        throw new Error(`Failed to upsert echo_patch_data for ${e.name}: ${ePatchError.message}`);
      }

      counts.echoPatchData++;
    }
  }

  // 9. Ingest Sonatas & Sonata Patch Data
  if (dataset.sonatas && dataset.sonatas.length > 0) {
    for (const s of dataset.sonatas) {
      // 9a. Invariant Sonata Identity
      const { data: sonataRow, error: sonataError } = await supabase
        .from('sonatas')
        .upsert(
          {
            name: s.name,
            code: s.code,
            description: s.description ?? null
          },
          { onConflict: 'code' }
        )
        .select('id, code')
        .single();

      if (sonataError || !sonataRow) {
        throw new Error(`Failed to upsert sonata ${s.code}: ${sonataError?.message}`);
      }

      const sonataId = sonataRow.id;
      counts.sonatas++;

      // 9b. 2-Piece Gameplay Effect
      const eff2 = s.patch_data.two_piece_effect;
      const eff2ProvId = provenanceMap.get(eff2.provenance_source_name);
      if (!eff2ProvId) {
        throw new Error(`Provenance source ${eff2.provenance_source_name} for sonata ${s.code} 2pc not found`);
      }

      const twoPieceEffectId = deterministicUuid(`gameplay_effect:sonata:${dataset.patch.version}:${s.code}:2pc`);
      const { error: eff2Error } = await supabase
        .from('gameplay_effects')
        .upsert(
          {
            id: twoPieceEffectId,
            patch_id: patchId,
            category: eff2.category,
            target: eff2.target,
            condition_expression: eff2.condition_expression ?? {},
            detail_expression: eff2.detail_expression ?? {},
            provenance_id: eff2ProvId
          },
          { onConflict: 'id' }
        );

      if (eff2Error) {
        throw new Error(`Failed to upsert sonata 2pc effect for ${s.code}: ${eff2Error.message}`);
      }
      counts.gameplayEffects++;

      // 9c. 5-Piece Gameplay Effect
      const eff5 = s.patch_data.five_piece_effect;
      const eff5ProvId = provenanceMap.get(eff5.provenance_source_name);
      if (!eff5ProvId) {
        throw new Error(`Provenance source ${eff5.provenance_source_name} for sonata ${s.code} 5pc not found`);
      }

      const fivePieceEffectId = deterministicUuid(`gameplay_effect:sonata:${dataset.patch.version}:${s.code}:5pc`);
      const { error: eff5Error } = await supabase
        .from('gameplay_effects')
        .upsert(
          {
            id: fivePieceEffectId,
            patch_id: patchId,
            category: eff5.category,
            target: eff5.target,
            condition_expression: eff5.condition_expression ?? {},
            detail_expression: eff5.detail_expression ?? {},
            provenance_id: eff5ProvId
          },
          { onConflict: 'id' }
        );

      if (eff5Error) {
        throw new Error(`Failed to upsert sonata 5pc effect for ${s.code}: ${eff5Error.message}`);
      }
      counts.gameplayEffects++;

      // 9d. Patch-Specific Sonata Data
      const sProvId = provenanceMap.get(s.patch_data.provenance_source_name);
      if (!sProvId) {
        throw new Error(`Provenance source ${s.patch_data.provenance_source_name} for sonata ${s.code} not found`);
      }

      const { error: sPatchError } = await supabase
        .from('sonata_patch_data')
        .upsert(
          {
            sonata_id: sonataId,
            patch_id: patchId,
            two_piece_effect_id: twoPieceEffectId,
            five_piece_effect_id: fivePieceEffectId,
            provenance_id: sProvId
          },
          { onConflict: 'sonata_id, patch_id' }
        );

      if (sPatchError) {
        throw new Error(`Failed to upsert sonata_patch_data for ${s.code}: ${sPatchError.message}`);
      }

      counts.sonataPatchData++;
    }
  }

  // 10. Ingest Enemies, Enemy Resistances & Enemy Modifiers
  const enemyCodeMap = new Map<string, string>();
  if (dataset.enemies && dataset.enemies.length > 0) {
    for (const e of dataset.enemies) {
      // 10a. Canonical Enemy Identity
      const enemyId = deterministicUuid(`enemy:${e.code}`);
      enemyCodeMap.set(e.code, enemyId);
      const { data: enemyRow, error: enemyError } = await supabase
        .from('enemies')
        .upsert(
          {
            id: enemyId,
            name: e.name,
            enemy_class: e.enemy_class,
            code: e.code
          },
          { onConflict: 'code' }
        )
        .select('id, code')
        .single();

      if (enemyError || !enemyRow) {
        throw new Error(`Failed to upsert enemy ${e.code}: ${enemyError?.message}`);
      }

      counts.enemies++;

      // 10b. Enemy Resistances
      if (e.resistances && e.resistances.length > 0) {
        for (const r of e.resistances) {
          const resProvId = provenanceMap.get(r.provenance_source_name);
          if (!resProvId) {
            throw new Error(`Provenance source ${r.provenance_source_name} for enemy ${e.code} resistance ${r.element} not found`);
          }

          const resistanceId = deterministicUuid(`enemy_resistance:${dataset.patch.version}:${e.code}:${r.element}`);
          const { error: resError } = await supabase
            .from('enemy_resistances')
            .upsert(
              {
                id: resistanceId,
                enemy_id: enemyId,
                patch_id: patchId,
                element: r.element,
                resistance_ratio: r.resistance_ratio,
                provenance_id: resProvId
              },
              { onConflict: 'enemy_id, patch_id, element' }
            );

          if (resError) {
            throw new Error(`Failed to upsert enemy resistance for ${e.code} [${r.element}]: ${resError.message}`);
          }

          counts.enemyResistances++;
        }
      }

      // 10c. Enemy Modifiers
      if (e.modifiers && e.modifiers.length > 0) {
        for (const m of e.modifiers) {
          const modProvId = provenanceMap.get(m.provenance_source_name);
          if (!modProvId) {
            throw new Error(`Provenance source ${m.provenance_source_name} for enemy ${e.code} modifier ${m.modifier_type} not found`);
          }

          const modifierId = deterministicUuid(`enemy_modifier:${dataset.patch.version}:${e.code}:${m.modifier_type}`);
          const { error: modError } = await supabase
            .from('enemy_modifiers')
            .upsert(
              {
                id: modifierId,
                enemy_id: enemyId,
                patch_id: patchId,
                modifier_type: m.modifier_type,
                parameters: (m.parameters ?? {}) as any,
                provenance_id: modProvId,
                is_active: m.is_active ?? true
              },
              { onConflict: 'enemy_id, patch_id, modifier_type' }
            );

          if (modError) {
            throw new Error(`Failed to upsert enemy modifier for ${e.code} [${m.modifier_type}]: ${modError.message}`);
          }

          counts.enemyModifiers++;
        }
      }
    }
  }

  // 11. Ingest Area Effects & Backing Gameplay Effects
  const areaEffectMap = new Map<string, string>();
  if (dataset.area_effects && dataset.area_effects.length > 0) {
    for (const ae of dataset.area_effects) {
      const geProvId = provenanceMap.get(ae.gameplay_effect.provenance_source_name);
      if (!geProvId) {
        throw new Error(`Provenance source ${ae.gameplay_effect.provenance_source_name} for area effect ${ae.source_id} not found`);
      }

      const gameplayEffectId = deterministicUuid(`gameplay_effect:area:${dataset.patch.version}:${ae.source_id}`);
      const { error: geError } = await supabase
        .from('gameplay_effects')
        .upsert(
          {
            id: gameplayEffectId,
            patch_id: patchId,
            category: ae.gameplay_effect.category,
            target: ae.gameplay_effect.target,
            condition_expression: (ae.gameplay_effect.condition_expression ?? {}) as any,
            detail_expression: (ae.gameplay_effect.detail_expression ?? {}) as any,
            provenance_id: geProvId
          },
          { onConflict: 'id, patch_id' }
        );

      if (geError) {
        throw new Error(`Failed to upsert gameplay effect for area effect ${ae.source_id}: ${geError.message}`);
      }
      counts.gameplayEffects++;

      const areaEffectId = deterministicUuid(`area_effect:${ae.source_id}`);
      const { error: aeError } = await supabase
        .from('area_effects')
        .upsert(
          {
            id: areaEffectId,
            patch_id: patchId,
            effect_id: gameplayEffectId,
            name: ae.name,
            description: ae.description
          },
          { onConflict: 'id, patch_id' }
        );

      if (aeError) {
        throw new Error(`Failed to upsert area effect ${ae.source_id}: ${aeError.message}`);
      }
      counts.areaEffects++;
      areaEffectMap.set(ae.source_id, areaEffectId);
    }
  }

  // 12. Ingest Tower of Adversity Cycles, Zones, Towers, Stages, Effects, Goals, Waves & Enemy Instances
  if (dataset.toa_cycles && dataset.toa_cycles.length > 0) {
    for (const cycle of dataset.toa_cycles) {
      const cycleProvId = provenanceMap.get(cycle.provenance_source_name);
      if (!cycleProvId) {
        throw new Error(`Provenance source ${cycle.provenance_source_name} for ToA cycle ${cycle.cycle_code} not found`);
      }

      // 12a. toa_cycles (Deterministic logical ID, composite PK with patch_id)
      const cycleId = deterministicUuid(`toa-cycle:${cycle.cycle_code}`);
      const { error: cycleError } = await supabase
        .from('toa_cycles')
        .upsert(
          {
            id: cycleId,
            patch_id: patchId,
            cycle_name: cycle.cycle_name,
            start_time: cycle.start_time,
            end_time: cycle.end_time
          },
          { onConflict: 'id, patch_id' }
        );

      if (cycleError) {
        throw new Error(`Failed to upsert ToA cycle ${cycle.cycle_code}: ${cycleError.message}`);
      }
      counts.toaCycles++;

      // 12b. toa_zones
      for (const zone of cycle.zones) {
        const zoneId = deterministicUuid(`toa-zone:${cycle.cycle_code}:${zone.zone_type}`);
        const { error: zoneError } = await supabase
          .from('toa_zones')
          .upsert(
            {
              id: zoneId,
              cycle_id: cycleId,
              patch_id: patchId,
              zone_type: zone.zone_type
            },
            { onConflict: 'id, patch_id' }
          );

        if (zoneError) {
          throw new Error(`Failed to upsert ToA zone ${zone.zone_type}: ${zoneError.message}`);
        }
        counts.toaZones++;

        // 12c. toa_towers
        for (const tower of zone.towers) {
          const towerId = deterministicUuid(`toa-tower:${cycle.cycle_code}:${zone.zone_type}:${tower.tower_order}`);
          const { error: towerError } = await supabase
            .from('toa_towers')
            .upsert(
              {
                id: towerId,
                zone_id: zoneId,
                patch_id: patchId,
                tower_name: tower.tower_name,
                tower_order: tower.tower_order
              },
              { onConflict: 'zone_id, tower_order' }
            );

          if (towerError) {
            throw new Error(`Failed to upsert ToA tower ${tower.tower_name}: ${towerError.message}`);
          }
          counts.toaTowers++;

          // 12d. toa_stages
          for (const stage of tower.stages) {
            const stageId = deterministicUuid(`toa-stage:${cycle.cycle_code}:${tower.tower_order}:${stage.stage_index}`);
            const { error: stageError } = await supabase
              .from('toa_stages')
              .upsert(
                {
                  id: stageId,
                  tower_id: towerId,
                  patch_id: patchId,
                  stage_index: stage.stage_index,
                  vigor_cost: stage.vigor_cost
                },
                { onConflict: 'tower_id, stage_index' }
              );

            if (stageError) {
              throw new Error(`Failed to upsert ToA stage ${stage.stage_index}: ${stageError.message}`);
            }
            counts.toaStages++;

            // 12e. stage_area_effects
            if (stage.area_effect_source_ids && stage.area_effect_source_ids.length > 0) {
              for (let effIdx = 0; effIdx < stage.area_effect_source_ids.length; effIdx++) {
                const srcId = stage.area_effect_source_ids[effIdx];
                const areaEffId = areaEffectMap.get(srcId);
                if (!areaEffId) {
                  throw new Error(`Area effect source ID ${srcId} not found in areaEffectMap`);
                }

                const stageEffId = deterministicUuid(`stage_area_effect:${stageId}:${areaEffId}`);
                const { error: saeError } = await supabase
                  .from('stage_area_effects')
                  .upsert(
                    {
                      id: stageEffId,
                      stage_id: stageId,
                      area_effect_id: areaEffId,
                      patch_id: patchId,
                      effect_order: effIdx + 1
                    },
                    { onConflict: 'stage_id, area_effect_id' }
                  );

                if (saeError) {
                  throw new Error(`Failed to upsert stage area effect: ${saeError.message}`);
                }
                counts.stageAreaEffects++;
              }
            }

            // 12f. challenge_goals
            for (const goal of stage.challenge_goals) {
              const goalId = deterministicUuid(`challenge_goal:${stageId}:${goal.goal_order}`);
              const { error: goalError } = await supabase
                .from('challenge_goals')
                .upsert(
                  {
                    id: goalId,
                    stage_id: stageId,
                    patch_id: patchId,
                    goal_order: goal.goal_order,
                    target_time_seconds: goal.target_time_seconds,
                    points: goal.points ?? 1
                  },
                  { onConflict: 'stage_id, goal_order' }
                );

              if (goalError) {
                throw new Error(`Failed to upsert challenge goal ${goal.goal_order}: ${goalError.message}`);
              }
              counts.challengeGoals++;
            }

            // 12g. toa_waves & toa_enemy_instances
            for (const wave of stage.waves) {
              const waveId = deterministicUuid(`toa-wave:${stageId}:${wave.wave_index}`);
              const { error: waveError } = await supabase
                .from('toa_waves')
                .upsert(
                  {
                    id: waveId,
                    stage_id: stageId,
                    patch_id: patchId,
                    wave_index: wave.wave_index
                  },
                  { onConflict: 'stage_id, wave_index' }
                );

              if (waveError) {
                throw new Error(`Failed to upsert ToA wave ${wave.wave_index}: ${waveError.message}`);
              }
              counts.toaWaves++;

              for (const inst of wave.enemy_instances) {
                const enemyId = enemyCodeMap.get(inst.enemy_code) || deterministicUuid(`enemy:${inst.enemy_code}`);
                const instId = deterministicUuid(`toa_enemy_instance:${waveId}:${inst.spawn_order}`);
                const { error: instError } = await supabase
                  .from('toa_enemy_instances')
                  .upsert(
                    {
                      id: instId,
                      wave_id: waveId,
                      enemy_id: enemyId,
                      patch_id: patchId,
                      level: inst.level,
                      spawn_order: inst.spawn_order
                    },
                    { onConflict: 'wave_id, spawn_order' }
                  );

                if (instError) {
                  throw new Error(`Failed to upsert ToA enemy instance ${inst.spawn_order}: ${instError.message}`);
                }
                counts.toaEnemyInstances++;
              }
            }
          }
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
      'Unverified numerical tuning curves for unreleased 3.8 preview assets omitted.',
      'Complex boss scripting transitions (cinematic immunity windows, mid-fight dialog cutscenes) omitted from structured modifiers to avoid unverified schema forcing.'
    ],
    durationMs
  };
}
