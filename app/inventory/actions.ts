'use server';

import type {
  UpdateResonatorInvestmentInput,
  UpdateResonatorInvestmentResponse,
} from './types';

async function getSupabaseClient(options?: { supabase?: any }) {
  if (options?.supabase) return options.supabase;
  const { createClient } = await import('../../lib/supabase/server.ts');
  return createClient();
}

async function triggerRevalidate() {
  try {
    const { revalidatePath } = await import('next/cache.js');
    revalidatePath('/inventory');
    revalidatePath('/tower');
  } catch {
    // Gracefully ignore in non-Next.js test environments
  }
}

export interface DefaultBuildInput {
  level?: number;
  waveband?: number;
  weaponId?: string;
  weaponLevel?: number;
  weaponRefinement?: number;
  sonataId?: string;
}

/**
 * Server action to toggle ownership of a Resonator for the authenticated user.
 * Authorizes user via Supabase session claims; client cannot spoof userId.
 * When adding, automatically configures intelligent default builds (Level 90, signature weapon Lv 90, sonata).
 */
export async function toggleResonatorOwnership(
  resonatorId: string,
  currentlyOwned: boolean,
  defaultBuild?: DefaultBuildInput,
  options?: { supabase?: any }
): Promise<{ success: boolean; error?: string; userResonatorId?: string }> {
  try {
    const supabase = await getSupabaseClient(options);
    const { data, error: authError } = await supabase.auth.getClaims();

    if (authError || !data?.claims?.sub) {
      return { success: false, error: 'Unauthorized: active session required.' };
    }

    const userId = data.claims.sub as string;
    const { SupabaseUserInventoryRepository } = await import(
      '../../lib/data-access/repositories/user-inventory-repository.ts'
    );
    const repo = new SupabaseUserInventoryRepository(supabase);

    if (currentlyOwned) {
      await repo.removeOwnedResonator(userId, resonatorId);
      await triggerRevalidate();
      return { success: true };
    } else {
      // Default to Max level 90 when added
      const charLevel = defaultBuild?.level ?? 90;
      const charWaveband = defaultBuild?.waveband ?? 0;

      const userRes = await repo.addOwnedResonator(userId, resonatorId, {
        level: charLevel,
        waveband: charWaveband,
      });

      // Auto-equip signature or fallback weapon at level 90 if provided
      let weaponInstanceId: string | null = null;
      if (defaultBuild?.weaponId) {
        const wep = await repo.addOwnedWeapon(userId, defaultBuild.weaponId, {
          level: defaultBuild.weaponLevel ?? 90,
          refinement: defaultBuild.weaponRefinement ?? 1,
        });
        weaponInstanceId = wep.id;
      }

      // Auto-equip optimal sonata if provided
      if (weaponInstanceId || defaultBuild?.sonataId) {
        await repo.saveResonatorLoadout(userId, {
          userResonatorId: userRes.id,
          weaponInstanceId,
          sonataId: defaultBuild?.sonataId ?? null,
        });
      }

      await triggerRevalidate();
      return { success: true, userResonatorId: userRes.id };
    }
  } catch (err: any) {
    console.error('[toggleResonatorOwnership] Error:', err);
    return {
      success: false,
      error: 'Failed to update resonator ownership. Please try again.',
    };
  }
}

/**
 * Server action to batch remove resonators from user inventory.
 * Guarantees atomic deletion and immediately cascades loadout cleanup.
 */
export async function batchRemoveResonatorsAction(
  resonatorIds: string[],
  options?: { supabase?: any }
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const supabase = await getSupabaseClient(options);
    const { data, error: authError } = await supabase.auth.getClaims();

    if (authError || !data?.claims?.sub) {
      return { success: false, error: 'Unauthorized: active session required.' };
    }

    const userId = data.claims.sub as string;
    if (!Array.isArray(resonatorIds) || resonatorIds.length === 0) {
      return { success: false, error: 'No resonators selected for removal.' };
    }

    const { error: deleteError } = await supabase
      .from('user_resonators')
      .delete()
      .eq('user_id', userId)
      .in('resonator_id', resonatorIds);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    await triggerRevalidate();
    return { success: true, count: resonatorIds.length };
  } catch (err: any) {
    console.error('[batchRemoveResonatorsAction] Error:', err);
    return {
      success: false,
      error: err.message || 'Failed to batch remove resonators.',
    };
  }
}

/**
 * Server action to batch add multiple resonators with intelligent default builds.
 */
export async function batchAddResonatorsAction(
  items: Array<{
    resonatorId: string;
    level?: number;
    waveband?: number;
    weaponId?: string;
    weaponLevel?: number;
    weaponRefinement?: number;
    sonataId?: string;
  }>,
  options?: { supabase?: any }
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const supabase = await getSupabaseClient(options);
    const { data, error: authError } = await supabase.auth.getClaims();

    if (authError || !data?.claims?.sub) {
      return { success: false, error: 'Unauthorized: active session required.' };
    }

    const userId = data.claims.sub as string;
    if (!Array.isArray(items) || items.length === 0) {
      return { success: false, error: 'No resonators provided for batch addition.' };
    }

    const { SupabaseUserInventoryRepository } = await import(
      '../../lib/data-access/repositories/user-inventory-repository.ts'
    );
    const repo = new SupabaseUserInventoryRepository(supabase);

    for (const item of items) {
      const userRes = await repo.addOwnedResonator(userId, item.resonatorId, {
        level: item.level ?? 90,
        waveband: item.waveband ?? 0,
      });

      let weaponInstanceId: string | null = null;
      if (item.weaponId) {
        const wep = await repo.addOwnedWeapon(userId, item.weaponId, {
          level: item.weaponLevel ?? 90,
          refinement: item.weaponRefinement ?? 1,
        });
        weaponInstanceId = wep.id;
      }

      if (weaponInstanceId || item.sonataId) {
        await repo.saveResonatorLoadout(userId, {
          userResonatorId: userRes.id,
          weaponInstanceId,
          sonataId: item.sonataId ?? null,
        });
      }
    }

    await triggerRevalidate();
    return { success: true, count: items.length };
  } catch (err: any) {
    console.error('[batchAddResonatorsAction] Error:', err);
    return {
      success: false,
      error: err.message || 'Failed to batch add resonators.',
    };
  }
}

/**
 * Server action to update investment and equipment (level, waveband, weapon, sonata)
 * for an owned Resonator.
 *
 * Strict Server-Side Verification:
 * 1. Derives effective identity strictly from authenticated session claims (zero client spoofing).
 * 2. Validates character level (1–90) and Sequence/waveband (0–6).
 * 3. Enforces weapon-type compatibility against canonical Patch 3.7 definitions.
 * 4. Reuses weapon instance to prevent duplicate equipment rows on repeated submissions.
 * 5. Revalidates paths so Tower recommendations consume updated data immediately.
 */
export async function updateResonatorInvestmentAction(
  input: UpdateResonatorInvestmentInput,
  options?: { supabase?: any }
): Promise<UpdateResonatorInvestmentResponse> {
  try {
    // 1. Authenticate user from server session
    const supabase = await getSupabaseClient(options);
    const { data: claimsData, error: authError } = await supabase.auth.getClaims();

    if (authError || !claimsData?.claims?.sub) {
      return { success: false, error: 'Unauthorized: active session required.' };
    }

    const userId = claimsData.claims.sub as string;

    // 2. Validate input schema & boundaries
    if (!input.resonatorId || typeof input.resonatorId !== 'string') {
      return { success: false, error: 'Invalid resonator ID.' };
    }

    if (
      typeof input.characterLevel !== 'number' ||
      !Number.isInteger(input.characterLevel) ||
      input.characterLevel < 1 ||
      input.characterLevel > 90
    ) {
      return {
        success: false,
        error: 'Character level must be an integer between 1 and 90.',
      };
    }

    if (
      typeof input.sequenceLevel !== 'number' ||
      !Number.isInteger(input.sequenceLevel) ||
      input.sequenceLevel < 0 ||
      input.sequenceLevel > 6
    ) {
      return {
        success: false,
        error: 'Sequence/waveband must be an integer between 0 and 6.',
      };
    }

    if (input.weapon !== null && input.weapon !== undefined) {
      if (!input.weapon.weaponId || typeof input.weapon.weaponId !== 'string') {
        return { success: false, error: 'Invalid weapon ID.' };
      }
      if (
        typeof input.weapon.level !== 'number' ||
        !Number.isInteger(input.weapon.level) ||
        input.weapon.level < 1 ||
        input.weapon.level > 90
      ) {
        return {
          success: false,
          error: 'Weapon level must be an integer between 1 and 90.',
        };
      }
      if (
        typeof input.weapon.refinement !== 'number' ||
        !Number.isInteger(input.weapon.refinement) ||
        input.weapon.refinement < 1 ||
        input.weapon.refinement > 5
      ) {
        return {
          success: false,
          error: 'Weapon refinement must be an integer between 1 and 5.',
        };
      }
    }

    // 3. Verify user ownership of target Resonator
    const { data: userResonator, error: userResError } = await supabase
      .from('user_resonators')
      .select('id, resonator_id, level, waveband')
      .eq('user_id', userId)
      .eq('resonator_id', input.resonatorId)
      .maybeSingle();

    if (userResError) {
      return {
        success: false,
        error: `Database error querying user resonator: ${userResError.message}`,
      };
    }

    if (!userResonator) {
      return {
        success: false,
        error: 'Resonator is not in your owned roster. Mark it as owned before editing build.',
      };
    }

    // 4. Verify canonical Resonator and weapon compatibility
    const { data: canonicalResonator, error: canResError } = await supabase
      .from('resonators')
      .select('id, name, weapon_type')
      .eq('id', input.resonatorId)
      .maybeSingle();

    if (canResError || !canonicalResonator) {
      return { success: false, error: 'Canonical resonator not found.' };
    }

    if (input.weapon) {
      const { data: canonicalWeapon, error: canWepError } = await supabase
        .from('weapons')
        .select('id, name, weapon_type')
        .eq('id', input.weapon.weaponId)
        .maybeSingle();

      if (canWepError || !canonicalWeapon) {
        return { success: false, error: 'Canonical weapon not found.' };
      }

      if (canonicalWeapon.weapon_type !== canonicalResonator.weapon_type) {
        return {
          success: false,
          error: `Weapon type mismatch: "${canonicalWeapon.name}" (${canonicalWeapon.weapon_type}) cannot be equipped by "${canonicalResonator.name}" (${canonicalResonator.weapon_type}).`,
        };
      }
    }

    if (input.sonataId) {
      const { data: canonicalSonata, error: canSonError } = await supabase
        .from('sonatas')
        .select('id, name')
        .eq('id', input.sonataId)
        .maybeSingle();

      if (canSonError || !canonicalSonata) {
        return { success: false, error: 'Canonical sonata set not found.' };
      }
    }

    // 5. Update user_resonators record
    const { error: updateResError } = await supabase
      .from('user_resonators')
      .update({
        level: input.characterLevel,
        waveband: input.sequenceLevel,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userResonator.id)
      .eq('user_id', userId);

    if (updateResError) {
      return {
        success: false,
        error: `Failed to update character level/sequence: ${updateResError.message}`,
      };
    }

    // 6. Manage weapon instance & loadout association
    const { data: existingLoadout, error: loadoutFetchError } = await supabase
      .from('user_resonator_loadouts')
      .select('id, weapon_instance_id, sonata_id')
      .eq('user_id', userId)
      .eq('user_resonator_id', userResonator.id)
      .maybeSingle();

    if (loadoutFetchError) {
      return {
        success: false,
        error: `Failed to check existing loadout: ${loadoutFetchError.message}`,
      };
    }

    let weaponInstanceId: string | null = null;

    if (input.weapon) {
      if (existingLoadout?.weapon_instance_id) {
        // Update existing weapon instance owned by user in place (preserves single weapon instance per resonator)
        const { error: wepUpdateError } = await supabase
          .from('user_weapons')
          .update({
            weapon_id: input.weapon.weaponId,
            level: input.weapon.level,
            refinement: input.weapon.refinement,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingLoadout.weapon_instance_id)
          .eq('user_id', userId);

        if (wepUpdateError) {
          return {
            success: false,
            error: `Failed to update weapon instance: ${wepUpdateError.message}`,
          };
        }
        weaponInstanceId = existingLoadout.weapon_instance_id;
      } else {
        // Insert new weapon instance
        const { data: newWep, error: wepInsertError } = await supabase
          .from('user_weapons')
          .insert({
            user_id: userId,
            weapon_id: input.weapon.weaponId,
            level: input.weapon.level,
            refinement: input.weapon.refinement,
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (wepInsertError || !newWep) {
          return {
            success: false,
            error: `Failed to create weapon instance: ${wepInsertError?.message || 'Unknown error'}`,
          };
        }
        weaponInstanceId = newWep.id;
      }
    } else {
      // Unequipped: weapon instance becomes null
      weaponInstanceId = null;
    }

    // 7. Upsert loadout record
    const { error: loadoutUpsertError } = await supabase
      .from('user_resonator_loadouts')
      .upsert(
        {
          user_id: userId,
          user_resonator_id: userResonator.id,
          weapon_instance_id: weaponInstanceId,
          sonata_id: input.sonataId ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,user_resonator_id' }
      );

    if (loadoutUpsertError) {
      return {
        success: false,
        error: `Failed to save resonator loadout: ${loadoutUpsertError.message}`,
      };
    }

    // 8. Revalidate routes so cached views and Tower recommendations receive updated state
    await triggerRevalidate();

    return {
      success: true,
      data: {
        userResonatorId: userResonator.id,
        level: input.characterLevel,
        waveband: input.sequenceLevel,
        weaponInstanceId,
        weaponId: input.weapon?.weaponId ?? null,
        weaponLevel: input.weapon?.level ?? null,
        weaponRefinement: input.weapon?.refinement ?? null,
        sonataId: input.sonataId ?? null,
      },
    };
  } catch (err: any) {
    console.error('[updateResonatorInvestmentAction] Error:', err);
    return {
      success: false,
      error: 'An unexpected internal error occurred while updating character build.',
    };
  }
}
