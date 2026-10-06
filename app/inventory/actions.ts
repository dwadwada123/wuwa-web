'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { SupabaseUserInventoryRepository } from '@/lib/data-access/repositories/user-inventory-repository';

/**
 * Server action to toggle ownership of a Resonator for the authenticated user.
 * Authorizes user via Supabase session claims; client cannot spoof userId.
 */
export async function toggleResonatorOwnership(
  resonatorId: string,
  currentlyOwned: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error: authError } = await supabase.auth.getClaims();

    if (authError || !data?.claims?.sub) {
      return { success: false, error: 'Unauthorized: active session required.' };
    }

    const userId = data.claims.sub as string;
    const repo = new SupabaseUserInventoryRepository(supabase);

    if (currentlyOwned) {
      await repo.removeOwnedResonator(userId, resonatorId);
    } else {
      await repo.addOwnedResonator(userId, resonatorId);
    }

    revalidatePath('/inventory');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Operation failed' };
  }
}
