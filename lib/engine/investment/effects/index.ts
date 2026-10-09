/**
 * Wuthering Waves Deterministic Investment Effect Resolution & Combat Contribution Contract
 * Phase 7 Step 15: Deterministic Investment Effect Resolution & Combat Contribution Contract
 *
 * Grounded strictly in Patch 3.7 canonical data.
 */

export * from './types.ts';
export * from './rules.ts';
export * from './predicates.ts';
export * from './resolver.ts';
export * from './repository.ts';
export * from './audit.ts';

import type { InvestmentEffectResolution } from './types.ts';

/**
 * Generates an objective, factual explanation string for an InvestmentEffectResolution record.
 * Never includes subjective opinions or scores!
 */
export function explainInvestmentEffectResolution(record: InvestmentEffectResolution): string {
  switch (record.status) {
    case 'RESOLVED':
      return `Effect '${record.effectId}' for ${record.resonatorId} is RESOLVED: ${record.resolvedValue} ${record.unit ?? ''} (Formula: ${record.formulaId}).`;
    case 'UNKNOWN':
      return `Effect '${record.effectId}' for ${record.resonatorId} is UNKNOWN: required user investment input (${record.investmentDimension}) was not provided.`;
    case 'UNMODELED':
      return `Effect '${record.effectId}' for ${record.resonatorId} is UNMODELED: required formula/scaling curve is absent from canonical Patch 3.7 structured data.`;
    case 'NOT_APPLICABLE':
      return `Effect '${record.effectId}' for ${record.resonatorId} is NOT_APPLICABLE: activation threshold or condition was not met.`;
    case 'INVALID':
      return `Effect '${record.effectId}' for ${record.resonatorId} is INVALID: input data violated canonical validation constraints.`;
    case 'PATCH_MISMATCH':
      return `Effect '${record.effectId}' for ${record.resonatorId} encountered PATCH_MISMATCH: patchVersion is not strictly '3.7'.`;
    default:
      return `Effect '${record.effectId}' for ${record.resonatorId} status: ${record.status}.`;
  }
}
