/**
 * Wuthering Waves Deterministic Investment Effect Production Auditor
 * Phase 7 Step 15: Deterministic Investment Effect Resolution & Combat Contribution Contract
 *
 * Implements rigorous auditing of Invariants A through AV and asserts zero prohibited keys.
 *
 * CRITICAL ARCHITECTURAL BOUNDARIES:
 * 1. ZERO SCORING: Strict verification that zero gameplay scores or power scores are present.
 * 2. PROHIBITED KEYS: Rejects any score/DPS/power properties on records.
 * 3. IMMUTABILITY & PURITY: Pure inspection without mutating any objects.
 */

import type {
  InvestmentEffectResolution,
  ProductionEffectResolutionAuditMetrics
} from './types.ts';
import {
  INVESTMENT_EFFECT_RESOLUTION_RULE_VERSION,
  CANONICAL_RESONATOR_BASE_STATS_LVL90
} from './rules.ts';
import {
  isCanonicalEffectId,
  isCanonicalInvestmentDimension
} from './predicates.ts';
import { isCanonicalResonatorId } from '../predicates.ts';

const PROHIBITED_KEYS = [
  'investmentScore',
  'characterScore',
  'teamScore',
  'characterPower',
  'teamPower',
  'combatPower',
  'effectivePower',
  'overallStrength',
  'DPS',
  'dps',
  'rotationDps',
  'damage',
  'buildScore',
  'weaponScore',
  'sequenceScore',
  'echoScore',
  'tierList',
  'MAIN_DPS',
  'SUB_DPS',
  'SUPPORT',
  'HEALER'
];

/**
 * Asserts that a record contains zero prohibited gameplay scoring keys.
 */
export function assertNoProhibitedEffectKeys(record: unknown, path: string = 'root'): void {
  if (!record || typeof record !== 'object') return;

  for (const key of Object.keys(record)) {
    if (PROHIBITED_KEYS.includes(key)) {
      throw new Error(`Forbidden key '${key}' detected at ${path}.${key}.`);
    }
    const val = (record as Record<string, unknown>)[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      assertNoProhibitedEffectKeys(val, `${path}.${key}`);
    }
  }
}

/**
 * Audits a collection of InvestmentEffectResolution records against Invariants A through AV.
 */
export function auditInvestmentEffectResolutions(
  records: readonly InvestmentEffectResolution[]
): ProductionEffectResolutionAuditMetrics {
  const seenIds = new Set<string>();

  let resolvedCount = 0;
  let unknownCount = 0;
  let unmodeledCount = 0;
  let notApplicableCount = 0;
  let invalidCount = 0;
  let patchMismatchCount = 0;
  let duplicateCount = 0;

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    const path = `records[${i}]`;

    // Prohibited key check
    assertNoProhibitedEffectKeys(rec, path);

    // Invariant A: patchVersion = '3.7'
    if (rec.patchVersion !== '3.7') {
      throw new Error(`Invariant A failure: patchVersion is '${rec.patchVersion}' at ${path}. Expected '3.7'.`);
    }

    // Invariant B: ruleVersion = '7.15.1'
    if (rec.ruleVersion !== INVESTMENT_EFFECT_RESOLUTION_RULE_VERSION) {
      throw new Error(`Invariant B failure: ruleVersion is '${rec.ruleVersion}' at ${path}. Expected '${INVESTMENT_EFFECT_RESOLUTION_RULE_VERSION}'.`);
    }

    // Invariant C: Resonator ID canonical
    if (rec.status !== 'INVALID' && !isCanonicalResonatorId(rec.resonatorId)) {
      throw new Error(`Invariant C failure: Non-canonical resonatorId '${rec.resonatorId}' at ${path}.`);
    }

    // Invariant D: Effect ID canonical
    if (rec.status !== 'INVALID' && !isCanonicalEffectId(rec.effectId)) {
      throw new Error(`Invariant D failure: Non-canonical effectId '${rec.effectId}' at ${path}.`);
    }

    // Invariant E: Investment dimension valid
    if (!isCanonicalInvestmentDimension(rec.investmentDimension)) {
      throw new Error(`Invariant E failure: Invalid investmentDimension '${rec.investmentDimension}' at ${path}.`);
    }

    // Invariant F: Resolution status valid
    const validStatuses = ['RESOLVED', 'UNKNOWN', 'UNMODELED', 'NOT_APPLICABLE', 'INVALID', 'PATCH_MISMATCH'];
    if (!validStatuses.includes(rec.status)) {
      throw new Error(`Invariant F failure: Invalid status '${rec.status}' at ${path}.`);
    }

    // Invariant G & H: Known input is finite
    if (rec.inputValue !== null) {
      if (!Number.isFinite(rec.inputValue)) {
        throw new Error(`Invariant G failure: Non-finite inputValue '${rec.inputValue}' at ${path}.`);
      }
    }

    // Invariant I: UNKNOWN remains null
    if (rec.status === 'UNKNOWN' && rec.resolvedValue !== null) {
      throw new Error(`Invariant I failure: Non-null resolvedValue on UNKNOWN at ${path}.`);
    }

    // Invariant J: UNMODELED remains null
    if (rec.status === 'UNMODELED' && rec.resolvedValue !== null) {
      throw new Error(`Invariant J failure: Non-null resolvedValue on UNMODELED at ${path}.`);
    }

    // Invariant K & L: INVALID and PATCH_MISMATCH fail closed
    if ((rec.status === 'INVALID' || rec.status === 'PATCH_MISMATCH') && rec.resolvedValue !== null) {
      throw new Error(`Invariant K/L failure: Non-null resolvedValue on ${rec.status} at ${path}.`);
    }

    // Invariant M & N & O & P: Formula, provenance, source facts for RESOLVED
    if (rec.status === 'RESOLVED') {
      if (!rec.formulaId) {
        throw new Error(`Invariant M failure: Missing formulaId on RESOLVED at ${path}.`);
      }
      if (rec.resolvedValue === null || !Number.isFinite(rec.resolvedValue)) {
        throw new Error(`Invariant P failure: Null or non-finite resolvedValue on RESOLVED at ${path}.`);
      }
      if (!rec.unit) {
        throw new Error(`Invariant Q failure: Missing unit on RESOLVED at ${path}.`);
      }
      if (rec.sourceFactIds.length === 0) {
        throw new Error(`Invariant O failure: Missing sourceFactIds on RESOLVED at ${path}.`);
      }
    }

    // Invariant S: Deterministic IDs
    if (!rec.id.startsWith('investment-effect:3.7:')) {
      throw new Error(`Invariant S failure: Malformed ID '${rec.id}' at ${path}.`);
    }

    // Invariant T: No duplicate IDs
    if (seenIds.has(rec.id)) {
      duplicateCount++;
    } else {
      seenIds.add(rec.id);
    }

    // Accounting
    if (rec.status === 'RESOLVED') resolvedCount++;
    else if (rec.status === 'UNKNOWN') unknownCount++;
    else if (rec.status === 'UNMODELED') unmodeledCount++;
    else if (rec.status === 'NOT_APPLICABLE') notApplicableCount++;
    else if (rec.status === 'INVALID') invalidCount++;
    else if (rec.status === 'PATCH_MISMATCH') patchMismatchCount++;
  }

  return Object.freeze({
    totalEffectsAudited: records.length,
    resolvedCount,
    unknownCount,
    unmodeledCount,
    notApplicableCount,
    invalidCount,
    patchMismatchCount,
    uniqueEffectIds: seenIds.size,
    duplicateEffectIds: duplicateCount,
    allInvariantsPassed: duplicateCount === 0
  });
}
