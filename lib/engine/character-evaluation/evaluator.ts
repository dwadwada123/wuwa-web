/**
 * Wuthering Waves Deterministic Investment-Aware Character Evaluator
 * Phase 7 Step 16: Deterministic Investment-Aware Character Evaluation Contract
 *
 * Implements deterministic evaluation of character-level evidence availability
 * under a supplied investment snapshot.
 *
 * CRITICAL ARCHITECTURAL BOUNDARIES:
 * 1. EVIDENCE EVALUATION ONLY, NEVER CHARACTER POWER:
 *    Measures strictly the completeness and strength of approved modeled evidence.
 *    ZERO character power, ZERO DPS, ZERO damage, ZERO combat strength, ZERO tier, ZERO meta.
 * 2. DIRECTIONAL SYNERGY INTEGRITY: Consumes Step 8 pairwise synergy preserving A -> B directionality.
 * 3. NO RECALCULATION: Consumes approved Step 8 and Step 15 evaluations verbatim.
 * 4. PURE & DETERMINISTIC: Zero network, zero LLMs, zero random IDs, zero timestamps.
 * 5. UNKNOWN ≠ ZERO: Unknown investment values strictly prevent resolution.
 * 6. UNMODELED ≠ ZERO: Unmodeled mechanics strictly prevent resolution.
 * 7. NOT_APPLICABLE IS NOT UNKNOWN: Excluded from applicable effects denominator.
 */

import {
  CHARACTER_EVALUATION_RULE_VERSION,
  COMPONENT_MAX_VALUES,
  EVALUATION_RULE_CODES,
  EVALUATION_EXPLANATION_CODES,
  createDefaultStep16Provenance
} from './rules.ts';
import {
  deriveCharacterEvaluationId,
  canonicalSortStrings
} from './predicates.ts';
import type {
  CharacterEvaluation,
  CharacterEvaluationComponent,
  CharacterEvaluationStatus,
  CharacterEvaluationOptions
} from './types.ts';
import type {
  InvestmentDimensionKey,
  ResonatorInvestmentSnapshot
} from '../investment/types.ts';
import { ALL_INVESTMENT_DIMENSIONS } from '../investment/rules.ts';
import { computeInvestmentCompleteness } from '../investment/normalization.ts';
import { isCanonicalResonatorId } from '../investment/predicates.ts';
import {
  getInvestmentSnapshot,
  createUninvestedSnapshot
} from '../investment/repository.ts';
import { getAllInvestmentEffects } from '../investment/effects/repository.ts';
import { queryCharacterPairSynergyProfiles } from '../relationships/character-pairs/synergy/repository.ts';
import type { CharacterPairSynergyProfile } from '../relationships/character-pairs/synergy/types.ts';
import type { InvestmentEffectResolution } from '../investment/effects/types.ts';

/**
 * Deterministically evaluates a Resonator under an investment snapshot.
 */
export function evaluateCharacter(
  resonatorId: string,
  investmentInput?: ResonatorInvestmentSnapshot,
  options?: CharacterEvaluationOptions
): CharacterEvaluation {
  const ruleVersion = options?.ruleVersion ?? CHARACTER_EVALUATION_RULE_VERSION;
  const id = deriveCharacterEvaluationId(resonatorId, ruleVersion);
  const provenance = createDefaultStep16Provenance(resonatorId);

  // 1. Strict Patch Isolation
  if (investmentInput && investmentInput.patchVersion !== '3.7') {
    return Object.freeze({
      id,
      patchVersion: '3.7',
      ruleVersion,
      resonatorId,
      status: 'PATCH_MISMATCH',
      evaluationScore: null,
      components: Object.freeze([]),
      synergyProfileIds: Object.freeze([]),
      investmentEffectIds: Object.freeze([]),
      resolvedInvestmentEffectIds: Object.freeze([]),
      sourceFactIds: Object.freeze([]),
      evidenceIds: Object.freeze([]),
      relationshipIds: Object.freeze([]),
      investmentDimensionsKnown: Object.freeze([]),
      investmentDimensionsUnknown: ALL_INVESTMENT_DIMENSIONS,
      resolvedEffectCategories: Object.freeze([]),
      contextRequirements: Object.freeze([]),
      explanationCodes: Object.freeze([EVALUATION_EXPLANATION_CODES.STATUS_PATCH_MISMATCH]),
      provenance
    });
  }

  // 2. Canonical Resonator Identity Check
  if (!isCanonicalResonatorId(resonatorId)) {
    return Object.freeze({
      id,
      patchVersion: '3.7',
      ruleVersion,
      resonatorId,
      status: 'INVALID',
      evaluationScore: null,
      components: Object.freeze([]),
      synergyProfileIds: Object.freeze([]),
      investmentEffectIds: Object.freeze([]),
      resolvedInvestmentEffectIds: Object.freeze([]),
      sourceFactIds: Object.freeze([]),
      evidenceIds: Object.freeze([]),
      relationshipIds: Object.freeze([]),
      investmentDimensionsKnown: Object.freeze([]),
      investmentDimensionsUnknown: ALL_INVESTMENT_DIMENSIONS,
      resolvedEffectCategories: Object.freeze([]),
      contextRequirements: Object.freeze([]),
      explanationCodes: Object.freeze([EVALUATION_EXPLANATION_CODES.STATUS_INVALID, 'NON_CANONICAL_RESONATOR_ID']),
      provenance
    });
  }

  if (investmentInput && investmentInput.resonatorId !== resonatorId) {
    return Object.freeze({
      id,
      patchVersion: '3.7',
      ruleVersion,
      resonatorId,
      status: 'INVALID',
      evaluationScore: null,
      components: Object.freeze([]),
      synergyProfileIds: Object.freeze([]),
      investmentEffectIds: Object.freeze([]),
      resolvedInvestmentEffectIds: Object.freeze([]),
      sourceFactIds: Object.freeze([]),
      evidenceIds: Object.freeze([]),
      relationshipIds: Object.freeze([]),
      investmentDimensionsKnown: Object.freeze([]),
      investmentDimensionsUnknown: ALL_INVESTMENT_DIMENSIONS,
      resolvedEffectCategories: Object.freeze([]),
      contextRequirements: Object.freeze([]),
      explanationCodes: Object.freeze([EVALUATION_EXPLANATION_CODES.STATUS_INVALID, 'RESONATOR_ID_MISMATCH']),
      provenance
    });
  }

  // 3. Resolve Investment Snapshot
  const investment = investmentInput ?? getInvestmentSnapshot(resonatorId) ?? createUninvestedSnapshot(resonatorId);

  // 4. Compute Step 13 Completeness Summary
  const completeness = computeInvestmentCompleteness(investment);
  const knownDims: readonly InvestmentDimensionKey[] = Object.freeze(
    ALL_INVESTMENT_DIMENSIONS.filter((d) => completeness.dimensionDetails[d] === 'KNOWN')
  );
  const unknownDims: readonly InvestmentDimensionKey[] = Object.freeze(
    ALL_INVESTMENT_DIMENSIONS.filter((d) => completeness.dimensionDetails[d] !== 'KNOWN')
  );
  const completenessRatio = completeness.completenessRatio !== null && Number.isFinite(completeness.completenessRatio)
    ? completeness.completenessRatio
    : 0;

  // 5. Query Step 15 Investment Effects
  const allEffects = getAllInvestmentEffects(resonatorId, investment);
  const applicableEffects = allEffects.filter((e) => e.status !== 'NOT_APPLICABLE');
  const resolvedEffects = applicableEffects.filter((e) => e.status === 'RESOLVED');
  const unknownEffects = applicableEffects.filter((e) => e.status === 'UNKNOWN');
  const unmodeledEffects = applicableEffects.filter((e) => e.status === 'UNMODELED');
  const resolvedInvestmentEffectIds = canonicalSortStrings(resolvedEffects.map((e) => e.id));
  const investmentEffectIds = canonicalSortStrings(applicableEffects.map((e) => e.id));
  const resolvedEffectCategories = canonicalSortStrings(resolvedEffects.map((e) => e.category));

  // 6. Query Step 8 Synergy Profiles (Preserving Directionality)
  const rawSynergyProfiles = queryCharacterPairSynergyProfiles(
    { resonatorId },
    { includeEmptyPairs: options?.includeEmptyPairs }
  );
  // Sort synergy profiles canonically by ID
  const synergyProfiles = Object.freeze(
    [...rawSynergyProfiles].sort((a, b) => a.id.localeCompare(b.id))
  );
  const synergyProfileIds = canonicalSortStrings(synergyProfiles.map((p) => p.id));

  // Filter valid directional synergy scores
  const validSynergyScores = synergyProfiles
    .map((p) => p.synergyScore)
    .filter((s): s is number => s !== null && Number.isFinite(s));

  // 7. Extract Provenance & Anti-Double-Counting Lineage
  const evidenceIdSet = new Set<string>();
  const relationshipIdSet = new Set<string>();
  const sourceFactIdSet = new Set<string>();
  const contextReqSet = new Set<string>();

  // Add synergy lineage
  for (const prof of synergyProfiles) {
    for (const eid of prof.evidenceIds) evidenceIdSet.add(eid);
    for (const rid of prof.relationshipIds) relationshipIdSet.add(rid);
    for (const fid of prof.sourceFactIds) sourceFactIdSet.add(fid);
    for (const cid of prof.contextRequirements) contextReqSet.add(cid);
  }

  // Add resolved investment effects lineage
  for (const eff of resolvedEffects) {
    for (const rid of eff.relationshipIds) relationshipIdSet.add(rid);
    for (const fid of eff.sourceFactIds) sourceFactIdSet.add(fid);
    for (const req of eff.requiredContext) contextReqSet.add(req);
  }

  if (investment.provenance && investment.provenance.sourceCode) {
    sourceFactIdSet.add(investment.provenance.sourceCode);
  }

  const evidenceIds = canonicalSortStrings(Array.from(evidenceIdSet));
  const relationshipIds = canonicalSortStrings(Array.from(relationshipIdSet));
  const sourceFactIds = canonicalSortStrings(Array.from(sourceFactIdSet));
  const contextRequirements = canonicalSortStrings(Array.from(contextReqSet));

  // 8. Calculate Score Components
  // Component 1: SYNERGY_EVIDENCE (max 30)
  let synergyValue = 0;
  const synergyReasonCodes: string[] = [];
  if (validSynergyScores.length > 0) {
    const avgScore = validSynergyScores.reduce((sum, s) => sum + s, 0) / validSynergyScores.length;
    const clampedAvg = Math.min(100, Math.max(0, avgScore));
    synergyValue = Math.round((clampedAvg / 100 * COMPONENT_MAX_VALUES.SYNERGY_EVIDENCE) * 100) / 100;
    synergyReasonCodes.push(EVALUATION_EXPLANATION_CODES.SYNERGY_EVIDENCE_EVALUATED);
    synergyReasonCodes.push(`VALID_PROFILES_${validSynergyScores.length}`);
  } else {
    synergyReasonCodes.push(EVALUATION_EXPLANATION_CODES.SYNERGY_EVIDENCE_ABSENT);
  }
  const synergyProfileIdsForComp = canonicalSortStrings(
    synergyProfiles.filter((p) => p.synergyScore !== null).map((p) => p.id)
  );

  const compSynergy: CharacterEvaluationComponent = Object.freeze({
    dimension: 'SYNERGY_EVIDENCE',
    ruleCode: EVALUATION_RULE_CODES.SYNERGY_EVIDENCE,
    value: Math.min(COMPONENT_MAX_VALUES.SYNERGY_EVIDENCE, Math.max(0, synergyValue)),
    maxValue: COMPONENT_MAX_VALUES.SYNERGY_EVIDENCE,
    synergyProfileIds: synergyProfileIdsForComp,
    investmentEffectIds: Object.freeze([]),
    evidenceIds,
    relationshipIds: canonicalSortStrings(
      Array.from(new Set(synergyProfiles.flatMap((p) => p.relationshipIds)))
    ),
    sourceFactIds: canonicalSortStrings(
      Array.from(new Set(synergyProfiles.flatMap((p) => p.sourceFactIds)))
    ),
    reasonCodes: Object.freeze(synergyReasonCodes)
  });

  // Component 2: INVESTMENT_EFFECT_RESOLUTION (max 30)
  let effectResolutionValue = 0;
  const resolutionReasonCodes: string[] = [];
  if (applicableEffects.length > 0) {
    const resolutionRatio = resolvedEffects.length / applicableEffects.length;
    effectResolutionValue = Math.round((resolutionRatio * COMPONENT_MAX_VALUES.INVESTMENT_EFFECT_RESOLUTION) * 100) / 100;
    resolutionReasonCodes.push(`APPLICABLE_${applicableEffects.length}`);
    resolutionReasonCodes.push(`RESOLVED_${resolvedEffects.length}`);
    if (resolvedEffects.length === applicableEffects.length) {
      resolutionReasonCodes.push(EVALUATION_EXPLANATION_CODES.INVESTMENT_EFFECTS_RESOLVED);
    } else if (resolvedEffects.length > 0) {
      resolutionReasonCodes.push(EVALUATION_EXPLANATION_CODES.INVESTMENT_EFFECTS_PARTIAL);
    } else if (unknownEffects.length > 0) {
      resolutionReasonCodes.push(EVALUATION_EXPLANATION_CODES.INVESTMENT_EFFECTS_UNKNOWN);
    } else if (unmodeledEffects.length > 0) {
      resolutionReasonCodes.push(EVALUATION_EXPLANATION_CODES.INVESTMENT_EFFECTS_UNMODELED);
    }
  } else {
    resolutionReasonCodes.push(EVALUATION_EXPLANATION_CODES.INVESTMENT_EFFECTS_NOT_APPLICABLE_EXCLUDED);
  }

  const compEffectResolution: CharacterEvaluationComponent = Object.freeze({
    dimension: 'INVESTMENT_EFFECT_RESOLUTION',
    ruleCode: EVALUATION_RULE_CODES.INVESTMENT_EFFECT_RESOLUTION,
    value: Math.min(COMPONENT_MAX_VALUES.INVESTMENT_EFFECT_RESOLUTION, Math.max(0, effectResolutionValue)),
    maxValue: COMPONENT_MAX_VALUES.INVESTMENT_EFFECT_RESOLUTION,
    synergyProfileIds: Object.freeze([]),
    investmentEffectIds,
    evidenceIds: Object.freeze([]),
    relationshipIds: canonicalSortStrings(
      Array.from(new Set(resolvedEffects.flatMap((e) => e.relationshipIds)))
    ),
    sourceFactIds: canonicalSortStrings(
      Array.from(new Set(resolvedEffects.flatMap((e) => e.sourceFactIds)))
    ),
    reasonCodes: Object.freeze(resolutionReasonCodes)
  });

  // Component 3: INVESTMENT_COMPLETENESS (max 20)
  const completenessClamped = Math.min(1, Math.max(0, completenessRatio));
  const completenessValue = Math.round((completenessClamped * COMPONENT_MAX_VALUES.INVESTMENT_COMPLETENESS) * 100) / 100;
  const completenessReasonCodes: string[] = [
    `KNOWN_${knownDims.length}`,
    `UNKNOWN_${unknownDims.length}`
  ];
  if (knownDims.length === ALL_INVESTMENT_DIMENSIONS.length) {
    completenessReasonCodes.push(EVALUATION_EXPLANATION_CODES.INVESTMENT_COMPLETENESS_COMPLETE);
  } else if (knownDims.length > 0) {
    completenessReasonCodes.push(EVALUATION_EXPLANATION_CODES.INVESTMENT_COMPLETENESS_PARTIAL);
  } else {
    completenessReasonCodes.push(EVALUATION_EXPLANATION_CODES.INVESTMENT_COMPLETENESS_EMPTY);
  }

  const compCompleteness: CharacterEvaluationComponent = Object.freeze({
    dimension: 'INVESTMENT_COMPLETENESS',
    ruleCode: EVALUATION_RULE_CODES.INVESTMENT_COMPLETENESS,
    value: Math.min(COMPONENT_MAX_VALUES.INVESTMENT_COMPLETENESS, Math.max(0, completenessValue)),
    maxValue: COMPONENT_MAX_VALUES.INVESTMENT_COMPLETENESS,
    synergyProfileIds: Object.freeze([]),
    investmentEffectIds: Object.freeze([]),
    evidenceIds: Object.freeze([]),
    relationshipIds: Object.freeze([]),
    sourceFactIds: Object.freeze([investment.provenance?.sourceCode || 'FACT_INVESTMENT_SNAPSHOT']),
    reasonCodes: Object.freeze(completenessReasonCodes)
  });

  // Component 4: EVIDENCE_COVERAGE (max 10)
  // Domains: 1. Synergy, 2. Char level base stats, 3. Weapon, 4. Sonata, 5. Sequence
  const hasSynergyDomain = validSynergyScores.length > 0;
  const hasCharStatsDomain = resolvedEffects.some((e) => e.category === 'CHARACTER_LEVEL_EFFECT');
  const hasWeaponDomain = resolvedEffects.some((e) => e.category === 'WEAPON_LEVEL_EFFECT' || e.category === 'WEAPON_REFINEMENT_EFFECT');
  const hasSonataDomain = resolvedEffects.some((e) => e.category === 'SONATA_EFFECT');
  const hasSequenceDomain = resolvedEffects.some((e) => e.category === 'SEQUENCE_EFFECT');

  const activeDomainsCount = [
    hasSynergyDomain,
    hasCharStatsDomain,
    hasWeaponDomain,
    hasSonataDomain,
    hasSequenceDomain
  ].filter(Boolean).length;

  let coverageValue = 0;
  if (activeDomainsCount === 0) {
    coverageValue = 0;
  } else if (activeDomainsCount === 1) {
    coverageValue = 4;
  } else if (activeDomainsCount === 2) {
    coverageValue = 7;
  } else {
    coverageValue = 10;
  }

  const coverageReasonCodes: string[] = [`ACTIVE_DOMAINS_${activeDomainsCount}`];
  if (activeDomainsCount >= 3) {
    coverageReasonCodes.push(EVALUATION_EXPLANATION_CODES.EVIDENCE_COVERAGE_HIGH);
  } else if (activeDomainsCount === 2) {
    coverageReasonCodes.push(EVALUATION_EXPLANATION_CODES.EVIDENCE_COVERAGE_MEDIUM);
  } else if (activeDomainsCount === 1) {
    coverageReasonCodes.push(EVALUATION_EXPLANATION_CODES.EVIDENCE_COVERAGE_LOW);
  } else {
    coverageReasonCodes.push(EVALUATION_EXPLANATION_CODES.EVIDENCE_COVERAGE_NONE);
  }

  const compCoverage: CharacterEvaluationComponent = Object.freeze({
    dimension: 'EVIDENCE_COVERAGE',
    ruleCode: EVALUATION_RULE_CODES.EVIDENCE_COVERAGE,
    value: Math.min(COMPONENT_MAX_VALUES.EVIDENCE_COVERAGE, Math.max(0, coverageValue)),
    maxValue: COMPONENT_MAX_VALUES.EVIDENCE_COVERAGE,
    synergyProfileIds: synergyProfileIdsForComp,
    investmentEffectIds: resolvedInvestmentEffectIds,
    evidenceIds,
    relationshipIds,
    sourceFactIds,
    reasonCodes: Object.freeze(coverageReasonCodes)
  });

  // 9. Status Determination & Context Certainty
  // Precedence: NO_EVIDENCE > INVESTMENT_UNKNOWN > UNMODELED > CONTEXT_DEPENDENT > PARTIALLY_EVALUATED > EVALUATED
  let status: CharacterEvaluationStatus;
  let certaintyValue = 0;
  const certaintyReasonCodes: string[] = [];

  const hasAnySynergyEvidence = synergyProfiles.length > 0 && !synergyProfiles.every((p) => p.synergyStatus === 'NO_EVIDENCE');
  const hasAnyInvestmentEvidence = applicableEffects.length > 0;

  if (!hasAnySynergyEvidence && !hasAnyInvestmentEvidence && knownDims.length === 0) {
    status = 'NO_EVIDENCE';
    certaintyValue = 0;
    certaintyReasonCodes.push(EVALUATION_EXPLANATION_CODES.CONTEXT_BLOCKED);
  } else if (knownDims.length === 0) {
    // Investment is completely unprovided / unknown
    status = 'INVESTMENT_UNKNOWN';
    certaintyValue = 0;
    certaintyReasonCodes.push(EVALUATION_EXPLANATION_CODES.CONTEXT_BLOCKED);
  } else if (applicableEffects.length > 0 && applicableEffects.every((e) => e.status === 'UNMODELED') && validSynergyScores.length === 0) {
    status = 'UNMODELED';
    certaintyValue = 0;
    certaintyReasonCodes.push(EVALUATION_EXPLANATION_CODES.CONTEXT_BLOCKED);
  } else if (
    applicableEffects.length > 0 &&
    applicableEffects.every((e) => e.status === 'UNKNOWN') &&
    validSynergyScores.length === 0
  ) {
    status = 'INVESTMENT_UNKNOWN';
    certaintyValue = 0;
    certaintyReasonCodes.push(EVALUATION_EXPLANATION_CODES.CONTEXT_BLOCKED);
  } else if (
    applicableEffects.length > 0 &&
    applicableEffects.every((e) => e.status === 'NOT_APPLICABLE') &&
    validSynergyScores.length === 0
  ) {
    status = 'NOT_APPLICABLE';
    certaintyValue = 0;
    certaintyReasonCodes.push(EVALUATION_EXPLANATION_CODES.CONTEXT_BLOCKED);
  } else if (
    synergyProfiles.length > 0 &&
    synergyProfiles.every((p) => p.synergyStatus === 'CONTEXT_DEPENDENT') &&
    resolvedEffects.length === 0
  ) {
    status = 'CONTEXT_DEPENDENT';
    certaintyValue = 0;
    certaintyReasonCodes.push(EVALUATION_EXPLANATION_CODES.CONTEXT_BLOCKED);
  } else {
    // Deterministic evidence is present and evaluatable
    const hasUnresolvedApplicable = applicableEffects.some(
      (e) => e.status === 'UNKNOWN' || e.status === 'UNMODELED' || e.status === 'INVALID' || e.status === 'PATCH_MISMATCH'
    );
    const hasContextSynergy = synergyProfiles.some((p) => p.synergyStatus === 'CONTEXT_DEPENDENT');
    const isFullyCompleteInvestment = knownDims.length === ALL_INVESTMENT_DIMENSIONS.length;

    if (!hasUnresolvedApplicable && !hasContextSynergy && isFullyCompleteInvestment && resolvedEffects.length === applicableEffects.length) {
      status = 'EVALUATED';
    } else {
      status = 'PARTIALLY_EVALUATED';
    }

    // Context Certainty calculation for active evidence
    if (hasContextSynergy || contextRequirements.length > 0) {
      certaintyValue = 5;
      certaintyReasonCodes.push(EVALUATION_EXPLANATION_CODES.CONTEXT_PARTIAL);
    } else if (resolvedEffects.some((e) => e.requiredContext.length > 0)) {
      certaintyValue = 8;
      certaintyReasonCodes.push(EVALUATION_EXPLANATION_CODES.CONTEXT_KNOWN);
    } else {
      certaintyValue = 10;
      certaintyReasonCodes.push(EVALUATION_EXPLANATION_CODES.CONTEXT_FREE);
    }
  }

  // Component 5: CONTEXT_CERTAINTY (max 10)
  const compCertainty: CharacterEvaluationComponent = Object.freeze({
    dimension: 'CONTEXT_CERTAINTY',
    ruleCode: EVALUATION_RULE_CODES.CONTEXT_CERTAINTY,
    value: Math.min(COMPONENT_MAX_VALUES.CONTEXT_CERTAINTY, Math.max(0, certaintyValue)),
    maxValue: COMPONENT_MAX_VALUES.CONTEXT_CERTAINTY,
    synergyProfileIds: Object.freeze([]),
    investmentEffectIds: Object.freeze([]),
    evidenceIds: Object.freeze([]),
    relationshipIds: Object.freeze([]),
    sourceFactIds: Object.freeze([]),
    reasonCodes: Object.freeze(certaintyReasonCodes)
  });

  const components: readonly CharacterEvaluationComponent[] = Object.freeze([
    compSynergy,
    compEffectResolution,
    compCompleteness,
    compCoverage,
    compCertainty
  ]);

  // 10. Final Score Calculation
  let evaluationScore: number | null = null;
  if (status === 'EVALUATED' || status === 'PARTIALLY_EVALUATED') {
    const rawSum = compSynergy.value + compEffectResolution.value + compCompleteness.value + compCoverage.value + compCertainty.value;
    const clampedSum = Math.min(100, Math.max(0, rawSum));
    evaluationScore = Math.round(clampedSum * 100) / 100;
  }

  // Explanation Codes
  const explanationCodes: string[] = [`STATUS_${status}`];
  if (status === 'EVALUATED') {
    explanationCodes.push('ALL_EVIDENCE_EVALUATED');
  } else if (status === 'PARTIALLY_EVALUATED') {
    explanationCodes.push('PARTIALLY_EVALUATED_EVIDENCE');
  } else if (status === 'INVESTMENT_UNKNOWN') {
    explanationCodes.push('REQUIRED_INVESTMENT_UNKNOWN');
  } else if (status === 'UNMODELED') {
    explanationCodes.push('ALL_EFFECTS_UNMODELED');
  } else if (status === 'CONTEXT_DEPENDENT') {
    explanationCodes.push('CONTEXT_DEPENDENT_BLOCKERS');
  } else if (status === 'NO_EVIDENCE') {
    explanationCodes.push('NO_MODELED_EVIDENCE');
  }

  explanationCodes.push(EVALUATION_EXPLANATION_CODES.DIRECTIONAL_SYNERGY_PRESERVED);
  explanationCodes.push(`RESOLVED_EFFECTS_${resolvedEffects.length}`);
  explanationCodes.push(`KNOWN_DIMENSIONS_${knownDims.length}`);

  return Object.freeze({
    id,
    patchVersion: '3.7',
    ruleVersion,
    resonatorId,
    status,
    evaluationScore,
    components,
    synergyProfileIds,
    investmentEffectIds,
    resolvedInvestmentEffectIds,
    sourceFactIds,
    evidenceIds,
    relationshipIds,
    investmentDimensionsKnown: knownDims,
    investmentDimensionsUnknown: unknownDims,
    resolvedEffectCategories,
    contextRequirements,
    explanationCodes: Object.freeze(canonicalSortStrings(explanationCodes)),
    provenance
  });
}
