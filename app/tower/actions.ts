'use server';

import { createClient } from '@/lib/supabase/server';
import { RecommendationApplicationService } from '@/lib/services/recommendation';
import type { RunOptimizationInput, RunOptimizationResponse } from './types';

/**
 * Server action to run Tower of Adversity deterministic recommendation.
 * Executes purely server-side with zero engine logic exposed to client.
 */
export async function runTowerOptimizationAction(
  input: RunOptimizationInput
): Promise<RunOptimizationResponse> {
  try {
    // 1. Authenticate user strictly from server-side session
    const supabase = await createClient();
    const { data: userData, error: authError } = await supabase.auth.getUser();

    if (authError || !userData?.user?.id) {
      return {
        success: false,
        code: 'UNAUTHENTICATED',
        error: 'Authentication required. Please sign in to run personal ToA optimization.',
      };
    }

    // 2. Execute deterministic Step 25 Application Service
    const recService = new RecommendationApplicationService({ supabase });
    const serviceResponse = await recService.executeRecommendation({
      scope: input.scope,
      selectedTowerId: input.selectedTowerId,
      selectedStageIds: input.selectedStageIds,
      targetK: input.targetK,
      allowPartial: input.allowPartial,
    });

    if (!serviceResponse.success) {
      return {
        success: false,
        code: serviceResponse.code,
        error: serviceResponse.error,
      };
    }

    return {
      success: true,
      data: serviceResponse.data,
    };
  } catch (_err: unknown) {
    return {
      success: false,
      code: 'INTERNAL_ERROR',
      error: 'An unexpected internal error occurred while processing the recommendation.',
    };
  }
}
