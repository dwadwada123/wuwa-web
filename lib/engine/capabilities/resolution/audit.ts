/**
 * Wuthering Waves Production Capability Resolution Audit
 * Phase 7 Step 2: Capability Resolution & Applicability Engine
 *
 * Runs full multi-dimensional resolution reconciliation across all 292
 * Patch 3.7 production capabilities under zero context.
 */

import { auditProductionCapabilities } from '../builder.ts';
import { resolveGameplayCapabilities } from './resolver.ts';
import type { CapabilityContextRequirementDimension } from '../types.ts';
import type {
  CapabilityResolutionStatus,
  ProductionResolutionAuditMetrics
} from './types.ts';

/**
 * Executes a comprehensive resolution audit of the Patch 3.7 production dataset.
 * Pure and deterministic.
 */
export function runProductionCapabilityResolutionAudit(): ProductionResolutionAuditMetrics {
  const capAudit = auditProductionCapabilities();
  const capabilities = capAudit.capabilities;

  // Zero-context resolution
  const zeroContextResolutions = resolveGameplayCapabilities(capabilities);

  let applicableWithoutContext = 0;
  let requiresContext = 0;
  let unmodeled = 0;
  let unknown = 0;
  let notApplicable = 0;

  const byResolutionStatus: Record<CapabilityResolutionStatus, number> = {
    APPLICABLE: 0,
    MISSING_CONTEXT: 0,
    CONTEXT_MISMATCH: 0,
    UNMODELED: 0,
    UNKNOWN: 0,
    NOT_APPLICABLE: 0
  };

  for (const res of zeroContextResolutions) {
    byResolutionStatus[res.status]++;

    if (res.status === 'APPLICABLE') {
      applicableWithoutContext++;
    } else if (res.status === 'MISSING_CONTEXT' || res.status === 'CONTEXT_MISMATCH') {
      requiresContext++;
    } else if (res.status === 'UNMODELED') {
      unmodeled++;
    } else if (res.status === 'UNKNOWN') {
      unknown++;
    } else if (res.status === 'NOT_APPLICABLE') {
      notApplicable++;
    }
  }

  const byRequirementDimension: Record<CapabilityContextRequirementDimension, number> = {
    ELEMENT: capAudit.totalRequiringElement,
    ACTION: capAudit.totalRequiringAction,
    TRIGGER: capAudit.totalRequiringTrigger,
    ZONE_STATE: capAudit.totalRequiringZone,
    BUFF_STATE: capAudit.totalRequiringBuff,
    STACK_COUNT: capAudit.totalRequiringStack,
    REFINEMENT_RANK: capAudit.totalRequiringRefinement,
    UNMODELED: capAudit.unmodeledRequirementCount
  };

  const noneCount = capAudit.byElement['NONE'] !== undefined ? capAudit.byElement['NONE'] : 0;
  const allCount = capAudit.byElement['All'] !== undefined ? capAudit.byElement['All'] : 0;
  const specificCount = capabilities.length - noneCount - allCount;

  return Object.freeze({
    totalCapabilities: capabilities.length,
    applicableWithoutContext,
    requiresContext,
    unmodeled,
    unknown,
    notApplicable,
    byResolutionStatus: Object.freeze(byResolutionStatus),
    byRequirementDimension: Object.freeze(byRequirementDimension),
    elementBreakdown: Object.freeze({
      noneCount,
      allCount,
      specificCount,
      requiringElementCount: capAudit.totalRequiringElement
    }),
    actionBreakdown: Object.freeze({
      requiringActionCount: capAudit.totalRequiringAction
    }),
    triggerBreakdown: Object.freeze({
      requiringTriggerCount: capAudit.totalRequiringTrigger
    }),
    stackBreakdown: Object.freeze({
      requiringStackCount: capAudit.totalRequiringStack
    }),
    refinementBreakdown: Object.freeze({
      requiringRefinementCount: capAudit.totalRequiringRefinement
    }),
    zeroContextResolutions
  });
}
