/**
 * Wuthering Waves Character Build Evaluation Builder
 * Phase 7 Step 20: Deterministic Character Build Evaluation Contract
 *
 * Implements deterministic evaluation, compatibility inspection, summary calculation,
 * and ordering for CharacterBuildEvaluation records.
 *
 * CENTRAL INVARIANTS:
 * 1. FACTUAL BUILD EVALUATION ONLY: Evaluates equipment configuration; NEVER DPS, tier, power.
 * 2. ZERO SCORING / ZERO RECOMMENDATIONS: Does not score builds or suggest weapons.
 * 3. ZERO TEAM DECISION: Does not generate or rank teams.
 * 4. PURE DETERMINISM: Offline, zero network, zero LLMs, zero random IDs, zero timestamps.
 * 5. STRICT PATCH ISOLATION: Bound strictly to Patch 3.7.
 * 6. INPUT IMMUTABILITY: Upstream decision contexts and investment snapshots remain untouched.
 */

import {
  CHARACTER_BUILD_EVALUATION_RULE_VERSION,
  CANONICAL_PATCH_VERSION,
  REQUIRED_STEP19_RULE_VERSION,
  REQUIRED_STEP13_RULE_VERSION,
  CANONICAL_RESONATOR_METADATA,
  CANONICAL_WEAPON_METADATA,
  CANONICAL_SONATA_METADATA,
  getCanonicalSonataMetadata,
  BUILD_EVALUATION_EXPLANATION_CODES,
  OFFLINE_DETERMINISTIC_AUDIT_STAMP,
  EMPTY_BUILD_EVALUATION_PROVENANCE
} from './rules.ts';
import {
  deriveCharacterBuildEvaluationId,
  compareCharacterBuildEvaluations
} from './predicates.ts';
import {
  isCanonicalResonatorId,
  isCanonicalWeaponId,
  isCanonicalSonataId
} from '../investment/predicates.ts';
import { getCharacterDecisionContextResult } from '../character-decision-context/repository.ts';
import type {
  CharacterBuildEvaluation,
  CharacterBuildEvaluationStatus,
  BuildWeaponCompatibilityStatus,
  BuildSonataAlignmentStatus,
  BuildAspectKey,
  WeaponBuildEvaluation,
  EchoLoadoutBuildEvaluation,
  BuildCompletenessMetrics,
  CharacterBuildEvaluationProvenance,
  CharacterBuildEvaluationInput,
  CharacterBuildEvaluationResult,
  CharacterBuildEvaluationResultSummary,
  CharacterBuildEvaluationAuditMetrics,
  CharacterDecisionContext,
  ResonatorInvestmentSnapshot
} from './types.ts';

/**
 * Deterministically evaluates the build for a single Resonator given their
 * approved Step 19 decision context and optional Step 13 investment snapshot.
 */
export function evaluateCharacterBuild(
  decisionContext: CharacterDecisionContext,
  investmentSnapshot?: ResonatorInvestmentSnapshot | null,
  patchId: string = CANONICAL_PATCH_VERSION
): CharacterBuildEvaluation {
  if (!decisionContext) {
    throw new Error('decisionContext is required to evaluate CharacterBuild.');
  }

  // 1. Strict Patch Isolation
  if (patchId !== CANONICAL_PATCH_VERSION) {
    throw new Error(
      `Invalid patchId '${patchId}'. Step 20 requires strictly '${CANONICAL_PATCH_VERSION}'.`
    );
  }
  if (decisionContext.patchVersion !== CANONICAL_PATCH_VERSION) {
    throw new Error(
      `DecisionContext patchVersion '${decisionContext.patchVersion}' mismatch. Expected '${CANONICAL_PATCH_VERSION}'.`
    );
  }

  // 2. Upstream Rule Version Validation
  if (decisionContext.ruleVersion !== REQUIRED_STEP19_RULE_VERSION) {
    throw new Error(
      `Incompatible decisionContext ruleVersion '${decisionContext.ruleVersion}'. Expected '${REQUIRED_STEP19_RULE_VERSION}'.`
    );
  }

  // 3. Canonical Resonator Identity Check
  const charId = decisionContext.characterId;
  if (!isCanonicalResonatorId(charId)) {
    throw new Error(`Invalid canonical Resonator ID '${charId}'.`);
  }

  const resMeta = CANONICAL_RESONATOR_METADATA[charId];
  if (!resMeta) {
    throw new Error(`Canonical metadata missing for Resonator '${charId}'.`);
  }

  const id = deriveCharacterBuildEvaluationId(
    charId,
    CANONICAL_PATCH_VERSION,
    CHARACTER_BUILD_EVALUATION_RULE_VERSION
  );

  // 4. Investment Snapshot Validation
  let hasPatchMismatch = false;
  let hasMismatchedResonator = false;

  if (investmentSnapshot) {
    if (investmentSnapshot.patchVersion !== CANONICAL_PATCH_VERSION) {
      hasPatchMismatch = true;
    }
    if (investmentSnapshot.ruleVersion !== REQUIRED_STEP13_RULE_VERSION) {
      throw new Error(
        `Incompatible investmentSnapshot ruleVersion '${investmentSnapshot.ruleVersion}'. Expected '${REQUIRED_STEP13_RULE_VERSION}'.`
      );
    }
    if (investmentSnapshot.resonatorId !== charId) {
      hasMismatchedResonator = true;
    }
  }

  // Handle patch mismatch failure state
  if (hasPatchMismatch) {
    const invalidWeapon: WeaponBuildEvaluation = Object.freeze({
      isEquipped: false,
      weaponId: null,
      weaponName: null,
      weaponType: null,
      resonatorWeaponType: resMeta.weaponType,
      compatibility: 'UNKNOWN',
      weaponLevel: null,
      isLevelMaxed: null,
      refinementRank: null,
      isRefinementMaxed: null,
      baseAtkLvl90: null,
      subStatType: null,
      subStatValueLvl90: null,
      passiveEffectCategory: null,
      hasPassiveRefinementScaling: false,
      provenance: EMPTY_BUILD_EVALUATION_PROVENANCE
    });

    const invalidEcho: EchoLoadoutBuildEvaluation = Object.freeze({
      hasLoadout: false,
      equippedCount: null,
      isEquippedCountMaxed: null,
      tunedCount: null,
      isTunedCountMaxed: null,
      maxLevelCount: null,
      isMaxLevelCountMaxed: null,
      activeSonataSetCode: null,
      activeSonataSetName: null,
      sonataAlignment: 'UNKNOWN',
      twoPieceEffectDescription: null,
      fivePieceEffectDescription: null,
      provenance: EMPTY_BUILD_EVALUATION_PROVENANCE
    });

    const invalidCompleteness: BuildCompletenessMetrics = Object.freeze({
      totalAspects: 6,
      knownAspects: 0,
      unknownAspects: 6,
      completenessRatio: null,
      aspectDetails: Object.freeze({
        WEAPON_EQUIPPED: 'UNKNOWN',
        WEAPON_LEVEL_KNOWN: 'UNKNOWN',
        WEAPON_REFINEMENT_KNOWN: 'UNKNOWN',
        ECHO_EQUIPPED_KNOWN: 'UNKNOWN',
        ECHO_TUNING_KNOWN: 'UNKNOWN',
        SONATA_SET_KNOWN: 'UNKNOWN'
      })
    });

    const provenance: CharacterBuildEvaluationProvenance = Object.freeze({
      source: 'DERIVED_BUILD_EVALUATION',
      patchVersion: CANONICAL_PATCH_VERSION,
      ruleVersion: CHARACTER_BUILD_EVALUATION_RULE_VERSION,
      decisionContextId: decisionContext.id,
      investmentSnapshotId: investmentSnapshot?.id ?? null,
      upstreamDecisionContextRuleVersion: decisionContext.ruleVersion,
      upstreamInvestmentRuleVersion: REQUIRED_STEP13_RULE_VERSION
    });

    return Object.freeze({
      id,
      patchVersion: CANONICAL_PATCH_VERSION,
      ruleVersion: CHARACTER_BUILD_EVALUATION_RULE_VERSION,
      resonatorId: charId,
      element: resMeta.element,
      weaponType: resMeta.weaponType,
      rarity: resMeta.rarity,
      status: 'PATCH_MISMATCH',
      weaponEvaluation: invalidWeapon,
      echoEvaluation: invalidEcho,
      completeness: invalidCompleteness,
      decisionContextSummary: decisionContext.summary,
      explanationCodes: Object.freeze([BUILD_EVALUATION_EXPLANATION_CODES.STATUS_PATCH_MISMATCH]),
      provenance
    });
  }

  // Handle mismatched resonator ID failure state
  if (hasMismatchedResonator) {
    const invalidWeapon: WeaponBuildEvaluation = Object.freeze({
      isEquipped: false,
      weaponId: null,
      weaponName: null,
      weaponType: null,
      resonatorWeaponType: resMeta.weaponType,
      compatibility: 'UNKNOWN',
      weaponLevel: null,
      isLevelMaxed: null,
      refinementRank: null,
      isRefinementMaxed: null,
      baseAtkLvl90: null,
      subStatType: null,
      subStatValueLvl90: null,
      passiveEffectCategory: null,
      hasPassiveRefinementScaling: false,
      provenance: EMPTY_BUILD_EVALUATION_PROVENANCE
    });

    const invalidEcho: EchoLoadoutBuildEvaluation = Object.freeze({
      hasLoadout: false,
      equippedCount: null,
      isEquippedCountMaxed: null,
      tunedCount: null,
      isTunedCountMaxed: null,
      maxLevelCount: null,
      isMaxLevelCountMaxed: null,
      activeSonataSetCode: null,
      activeSonataSetName: null,
      sonataAlignment: 'UNKNOWN',
      twoPieceEffectDescription: null,
      fivePieceEffectDescription: null,
      provenance: EMPTY_BUILD_EVALUATION_PROVENANCE
    });

    const invalidCompleteness: BuildCompletenessMetrics = Object.freeze({
      totalAspects: 6,
      knownAspects: 0,
      unknownAspects: 6,
      completenessRatio: null,
      aspectDetails: Object.freeze({
        WEAPON_EQUIPPED: 'UNKNOWN',
        WEAPON_LEVEL_KNOWN: 'UNKNOWN',
        WEAPON_REFINEMENT_KNOWN: 'UNKNOWN',
        ECHO_EQUIPPED_KNOWN: 'UNKNOWN',
        ECHO_TUNING_KNOWN: 'UNKNOWN',
        SONATA_SET_KNOWN: 'UNKNOWN'
      })
    });

    const provenance: CharacterBuildEvaluationProvenance = Object.freeze({
      source: 'DERIVED_BUILD_EVALUATION',
      patchVersion: CANONICAL_PATCH_VERSION,
      ruleVersion: CHARACTER_BUILD_EVALUATION_RULE_VERSION,
      decisionContextId: decisionContext.id,
      investmentSnapshotId: investmentSnapshot?.id ?? null,
      upstreamDecisionContextRuleVersion: decisionContext.ruleVersion,
      upstreamInvestmentRuleVersion: REQUIRED_STEP13_RULE_VERSION
    });

    return Object.freeze({
      id,
      patchVersion: CANONICAL_PATCH_VERSION,
      ruleVersion: CHARACTER_BUILD_EVALUATION_RULE_VERSION,
      resonatorId: charId,
      element: resMeta.element,
      weaponType: resMeta.weaponType,
      rarity: resMeta.rarity,
      status: 'INVALID',
      weaponEvaluation: invalidWeapon,
      echoEvaluation: invalidEcho,
      completeness: invalidCompleteness,
      decisionContextSummary: decisionContext.summary,
      explanationCodes: Object.freeze([BUILD_EVALUATION_EXPLANATION_CODES.STATUS_INVALID]),
      provenance
    });
  }

  // 5. Evaluate Weapon Configuration
  let weaponEvaluation: WeaponBuildEvaluation;
  const aspectWeaponEquipped: 'KNOWN' | 'UNKNOWN' | 'NOT_APPLICABLE' = investmentSnapshot
    ? (investmentSnapshot.weapon ? 'KNOWN' : 'NOT_APPLICABLE')
    : 'UNKNOWN';
  let aspectWeaponLevel: 'KNOWN' | 'UNKNOWN' | 'NOT_APPLICABLE' = 'UNKNOWN';
  let aspectWeaponRefinement: 'KNOWN' | 'UNKNOWN' | 'NOT_APPLICABLE' = 'UNKNOWN';

  if (!investmentSnapshot || !investmentSnapshot.weapon) {
    weaponEvaluation = Object.freeze({
      isEquipped: false,
      weaponId: null,
      weaponName: null,
      weaponType: null,
      resonatorWeaponType: resMeta.weaponType,
      compatibility: 'NOT_EQUIPPED',
      weaponLevel: null,
      isLevelMaxed: null,
      refinementRank: null,
      isRefinementMaxed: null,
      baseAtkLvl90: null,
      subStatType: null,
      subStatValueLvl90: null,
      passiveEffectCategory: null,
      hasPassiveRefinementScaling: false,
      provenance: EMPTY_BUILD_EVALUATION_PROVENANCE
    });
    aspectWeaponLevel = investmentSnapshot ? 'NOT_APPLICABLE' : 'UNKNOWN';
    aspectWeaponRefinement = investmentSnapshot ? 'NOT_APPLICABLE' : 'UNKNOWN';
  } else {
    const wpn = investmentSnapshot.weapon;
    const isCanonical = isCanonicalWeaponId(wpn.weaponId);
    const wpnMeta = isCanonical ? CANONICAL_WEAPON_METADATA[wpn.weaponId] : null;

    let compatibility: BuildWeaponCompatibilityStatus = 'UNKNOWN';
    if (wpnMeta) {
      compatibility = wpnMeta.weaponType === resMeta.weaponType ? 'COMPATIBLE' : 'INCOMPATIBLE';
    }

    const lvlKnown = wpn.weaponLevel.status === 'KNOWN';
    const lvlVal = lvlKnown ? wpn.weaponLevel.value : null;
    aspectWeaponLevel = lvlKnown ? 'KNOWN' : 'UNKNOWN';

    const refKnown = wpn.refinementRank.status === 'KNOWN';
    const refVal = refKnown ? wpn.refinementRank.value : null;
    aspectWeaponRefinement = refKnown ? 'KNOWN' : 'UNKNOWN';

    weaponEvaluation = Object.freeze({
      isEquipped: true,
      weaponId: wpn.weaponId,
      weaponName: isCanonical ? wpn.weaponId : null,
      weaponType: wpnMeta ? wpnMeta.weaponType : null,
      resonatorWeaponType: resMeta.weaponType,
      compatibility,
      weaponLevel: lvlVal,
      isLevelMaxed: lvlVal !== null ? lvlVal === 90 : null,
      refinementRank: refVal,
      isRefinementMaxed: refVal !== null ? refVal === 5 : null,
      baseAtkLvl90: wpnMeta ? wpnMeta.baseAtkLvl90 : null,
      subStatType: wpnMeta ? wpnMeta.subStatType : null,
      subStatValueLvl90: wpnMeta ? wpnMeta.subStatValueLvl90 : null,
      passiveEffectCategory: wpnMeta ? wpnMeta.passiveCategory : null,
      hasPassiveRefinementScaling: wpnMeta ? wpnMeta.hasRefinementScaling : false,
      provenance: wpn.provenance ?? EMPTY_BUILD_EVALUATION_PROVENANCE
    });
  }

  // 6. Evaluate Echo Loadout Configuration
  let echoEvaluation: EchoLoadoutBuildEvaluation;
  let aspectEchoEquipped: 'KNOWN' | 'UNKNOWN' | 'NOT_APPLICABLE' = 'UNKNOWN';
  let aspectEchoTuning: 'KNOWN' | 'UNKNOWN' | 'NOT_APPLICABLE' = 'UNKNOWN';
  let aspectSonataSet: 'KNOWN' | 'UNKNOWN' | 'NOT_APPLICABLE' = 'UNKNOWN';

  if (!investmentSnapshot || !investmentSnapshot.echoInvestment) {
    echoEvaluation = Object.freeze({
      hasLoadout: false,
      equippedCount: null,
      isEquippedCountMaxed: null,
      tunedCount: null,
      isTunedCountMaxed: null,
      maxLevelCount: null,
      isMaxLevelCountMaxed: null,
      activeSonataSetCode: null,
      activeSonataSetName: null,
      sonataAlignment: 'NOT_EQUIPPED',
      twoPieceEffectDescription: null,
      fivePieceEffectDescription: null,
      provenance: EMPTY_BUILD_EVALUATION_PROVENANCE
    });
    aspectEchoEquipped = investmentSnapshot ? 'NOT_APPLICABLE' : 'UNKNOWN';
    aspectEchoTuning = investmentSnapshot ? 'NOT_APPLICABLE' : 'UNKNOWN';
    aspectSonataSet = investmentSnapshot ? 'NOT_APPLICABLE' : 'UNKNOWN';
  } else {
    const echo = investmentSnapshot.echoInvestment;
    const eqKnown = echo.equippedCount.status === 'KNOWN';
    const eqVal = eqKnown ? echo.equippedCount.value : null;
    aspectEchoEquipped = eqKnown ? 'KNOWN' : 'UNKNOWN';

    const tuKnown = echo.tunedCount.status === 'KNOWN';
    const tuVal = tuKnown ? echo.tunedCount.value : null;
    aspectEchoTuning = tuKnown ? 'KNOWN' : 'UNKNOWN';

    const maxKnown = echo.maxLevelEchoCount.status === 'KNOWN';
    const maxVal = maxKnown ? echo.maxLevelEchoCount.value : null;

    const hasLoadout = (eqVal !== null && eqVal > 0) || echo.sonataSetId !== null;

    let sonataAlignment: BuildSonataAlignmentStatus = 'NOT_EQUIPPED';
    let sonataName: string | null = null;
    let twoPcDesc: string | null = null;
    let fivePcDesc: string | null = null;

    let sonataCode: string | null = null;
    if (echo.sonataSetId) {
      const isSonataCanonical = isCanonicalSonataId(echo.sonataSetId);
      const sonataMeta = isSonataCanonical ? getCanonicalSonataMetadata(echo.sonataSetId) : null;

      if (sonataMeta) {
        aspectSonataSet = 'KNOWN';
        sonataCode = sonataMeta.code;
        sonataName = sonataMeta.name;
        if (sonataMeta.alignmentType === 'UNIVERSAL') {
          sonataAlignment = 'UNIVERSAL';
        } else if (sonataMeta.element === resMeta.element) {
          sonataAlignment = 'ELEMENT_ALIGNED';
        } else {
          sonataAlignment = 'MISALIGNED';
        }
        twoPcDesc = sonataMeta.description.split('. 5-Pc:')[0] ?? null;
        fivePcDesc = sonataMeta.description.includes('5-Pc:')
          ? '5-Pc:' + sonataMeta.description.split('5-Pc:')[1]
          : null;
      } else {
        aspectSonataSet = 'UNKNOWN';
        sonataCode = echo.sonataSetId;
        sonataAlignment = 'UNKNOWN';
      }
    } else {
      aspectSonataSet = hasLoadout ? 'UNKNOWN' : (investmentSnapshot ? 'NOT_APPLICABLE' : 'UNKNOWN');
      sonataAlignment = hasLoadout ? 'UNKNOWN' : 'NOT_EQUIPPED';
    }

    echoEvaluation = Object.freeze({
      hasLoadout,
      equippedCount: eqVal,
      isEquippedCountMaxed: eqVal !== null ? eqVal === 5 : null,
      tunedCount: tuVal,
      isTunedCountMaxed: tuVal !== null ? tuVal === 5 : null,
      maxLevelCount: maxVal,
      isMaxLevelCountMaxed: maxVal !== null ? maxVal === 5 : null,
      activeSonataSetCode: sonataCode,
      activeSonataSetName: sonataName,
      sonataAlignment,
      twoPieceEffectDescription: twoPcDesc,
      fivePieceEffectDescription: fivePcDesc,
      provenance: echo.provenance ?? EMPTY_BUILD_EVALUATION_PROVENANCE
    });
  }

  // 7. Calculate Build Completeness Metrics
  const aspectDetails: Readonly<Record<BuildAspectKey, 'KNOWN' | 'UNKNOWN' | 'NOT_APPLICABLE'>> = Object.freeze({
    WEAPON_EQUIPPED: aspectWeaponEquipped,
    WEAPON_LEVEL_KNOWN: aspectWeaponLevel,
    WEAPON_REFINEMENT_KNOWN: aspectWeaponRefinement,
    ECHO_EQUIPPED_KNOWN: aspectEchoEquipped,
    ECHO_TUNING_KNOWN: aspectEchoTuning,
    SONATA_SET_KNOWN: aspectSonataSet
  });

  let knownAspects = 0;
  let unknownAspects = 0;
  for (const key of Object.keys(aspectDetails) as BuildAspectKey[]) {
    if (aspectDetails[key] === 'KNOWN') {
      knownAspects++;
    } else {
      unknownAspects++;
    }
  }

  const completenessRatio = investmentSnapshot
    ? Math.round((knownAspects / 6) * 10000) / 10000
    : null;

  const completeness: BuildCompletenessMetrics = Object.freeze({
    totalAspects: 6,
    knownAspects,
    unknownAspects,
    completenessRatio,
    aspectDetails
  });

  // 8. Determine Overall Status
  let status: CharacterBuildEvaluationStatus;
  const explanationCodes: string[] = [];

  if (weaponEvaluation.compatibility === 'INCOMPATIBLE') {
    status = 'INCOMPATIBLE_WEAPON';
    explanationCodes.push(BUILD_EVALUATION_EXPLANATION_CODES.STATUS_INCOMPATIBLE_WEAPON);
    explanationCodes.push(BUILD_EVALUATION_EXPLANATION_CODES.WEAPON_INCOMPATIBLE);
  } else if (!investmentSnapshot) {
    status = 'BUILD_UNKNOWN';
    explanationCodes.push(BUILD_EVALUATION_EXPLANATION_CODES.STATUS_BUILD_UNKNOWN);
  } else if (!weaponEvaluation.isEquipped && !echoEvaluation.hasLoadout) {
    status = 'UNEQUIPPED';
    explanationCodes.push(BUILD_EVALUATION_EXPLANATION_CODES.STATUS_UNEQUIPPED);
    explanationCodes.push(BUILD_EVALUATION_EXPLANATION_CODES.WEAPON_NOT_EQUIPPED);
    explanationCodes.push(BUILD_EVALUATION_EXPLANATION_CODES.SONATA_NOT_EQUIPPED);
  } else if (
    weaponEvaluation.isEquipped &&
    weaponEvaluation.compatibility === 'COMPATIBLE' &&
    weaponEvaluation.weaponLevel !== null &&
    weaponEvaluation.refinementRank !== null &&
    echoEvaluation.hasLoadout &&
    echoEvaluation.equippedCount === 5 &&
    (echoEvaluation.sonataAlignment === 'ELEMENT_ALIGNED' || echoEvaluation.sonataAlignment === 'UNIVERSAL')
  ) {
    status = 'FULLY_EQUIPPED';
    explanationCodes.push(BUILD_EVALUATION_EXPLANATION_CODES.STATUS_FULLY_EQUIPPED);
    explanationCodes.push(BUILD_EVALUATION_EXPLANATION_CODES.WEAPON_COMPATIBLE);
    if (weaponEvaluation.isLevelMaxed) {
      explanationCodes.push(BUILD_EVALUATION_EXPLANATION_CODES.WEAPON_LEVEL_MAXED);
    }
    if (weaponEvaluation.isRefinementMaxed) {
      explanationCodes.push(BUILD_EVALUATION_EXPLANATION_CODES.WEAPON_REFINEMENT_MAXED);
    }
    explanationCodes.push(BUILD_EVALUATION_EXPLANATION_CODES.ECHOES_FULLY_EQUIPPED);
    if (echoEvaluation.isTunedCountMaxed) {
      explanationCodes.push(BUILD_EVALUATION_EXPLANATION_CODES.ECHOES_FULLY_TUNED);
    }
    if (echoEvaluation.isMaxLevelCountMaxed) {
      explanationCodes.push(BUILD_EVALUATION_EXPLANATION_CODES.ECHOES_FULLY_MAXED);
    }
    if (echoEvaluation.sonataAlignment === 'ELEMENT_ALIGNED') {
      explanationCodes.push(BUILD_EVALUATION_EXPLANATION_CODES.SONATA_ELEMENT_ALIGNED);
    } else {
      explanationCodes.push(BUILD_EVALUATION_EXPLANATION_CODES.SONATA_UNIVERSAL);
    }
  } else {
    status = 'PARTIALLY_EQUIPPED';
    explanationCodes.push(BUILD_EVALUATION_EXPLANATION_CODES.STATUS_PARTIALLY_EQUIPPED);
    if (weaponEvaluation.compatibility === 'COMPATIBLE') {
      explanationCodes.push(BUILD_EVALUATION_EXPLANATION_CODES.WEAPON_COMPATIBLE);
    }
    if (weaponEvaluation.isLevelMaxed) {
      explanationCodes.push(BUILD_EVALUATION_EXPLANATION_CODES.WEAPON_LEVEL_MAXED);
    }
    if (weaponEvaluation.isRefinementMaxed) {
      explanationCodes.push(BUILD_EVALUATION_EXPLANATION_CODES.WEAPON_REFINEMENT_MAXED);
    }
    if (echoEvaluation.isEquippedCountMaxed) {
      explanationCodes.push(BUILD_EVALUATION_EXPLANATION_CODES.ECHOES_FULLY_EQUIPPED);
    }
    if (echoEvaluation.isTunedCountMaxed) {
      explanationCodes.push(BUILD_EVALUATION_EXPLANATION_CODES.ECHOES_FULLY_TUNED);
    }
    if (echoEvaluation.isMaxLevelCountMaxed) {
      explanationCodes.push(BUILD_EVALUATION_EXPLANATION_CODES.ECHOES_FULLY_MAXED);
    }
    if (echoEvaluation.sonataAlignment === 'ELEMENT_ALIGNED') {
      explanationCodes.push(BUILD_EVALUATION_EXPLANATION_CODES.SONATA_ELEMENT_ALIGNED);
    } else if (echoEvaluation.sonataAlignment === 'UNIVERSAL') {
      explanationCodes.push(BUILD_EVALUATION_EXPLANATION_CODES.SONATA_UNIVERSAL);
    } else if (echoEvaluation.sonataAlignment === 'MISALIGNED') {
      explanationCodes.push(BUILD_EVALUATION_EXPLANATION_CODES.SONATA_MISALIGNED);
    }
  }

  const provenance: CharacterBuildEvaluationProvenance = Object.freeze({
    source: 'DERIVED_BUILD_EVALUATION',
    patchVersion: CANONICAL_PATCH_VERSION,
    ruleVersion: CHARACTER_BUILD_EVALUATION_RULE_VERSION,
    decisionContextId: decisionContext.id,
    investmentSnapshotId: investmentSnapshot?.id ?? null,
    upstreamDecisionContextRuleVersion: decisionContext.ruleVersion,
    upstreamInvestmentRuleVersion: REQUIRED_STEP13_RULE_VERSION
  });

  return Object.freeze({
    id,
    patchVersion: CANONICAL_PATCH_VERSION,
    ruleVersion: CHARACTER_BUILD_EVALUATION_RULE_VERSION,
    resonatorId: charId,
    element: resMeta.element,
    weaponType: resMeta.weaponType,
    rarity: resMeta.rarity,
    status,
    weaponEvaluation,
    echoEvaluation,
    completeness,
    decisionContextSummary: decisionContext.summary,
    explanationCodes: Object.freeze(explanationCodes),
    provenance
  });
}

/**
 * Builds a deterministic collection of CharacterBuildEvaluation records
 * across requested or all canonical Resonators.
 */
export function buildCharacterBuildEvaluations(
  input?: CharacterBuildEvaluationInput
): CharacterBuildEvaluationResult {
  const patchId = input?.patchId ?? CANONICAL_PATCH_VERSION;
  if (patchId !== CANONICAL_PATCH_VERSION) {
    throw new Error(
      `Invalid patchId '${patchId}'. Step 20 requires strictly '${CANONICAL_PATCH_VERSION}'.`
    );
  }

  const decisionContexts =
    input?.decisionContexts ?? getCharacterDecisionContextResult().contexts;

  // Validate decision contexts
  const contextMap = new Map<string, CharacterDecisionContext>();
  for (let i = 0; i < decisionContexts.length; i++) {
    const ctx = decisionContexts[i];
    if (!ctx) {
      throw new Error(`Null decisionContext record at index ${i}.`);
    }
    if (!ctx.characterId || !isCanonicalResonatorId(ctx.characterId)) {
      throw new Error(
        `Character ID '${ctx?.characterId}' in decision context at index ${i} is not a canonical Patch 3.7 Resonator.`
      );
    }
    if (ctx.patchVersion !== CANONICAL_PATCH_VERSION) {
      throw new Error(
        `DecisionContext record for '${ctx.characterId}' has invalid patchVersion '${ctx.patchVersion}'. Expected '${CANONICAL_PATCH_VERSION}'.`
      );
    }
    if (ctx.ruleVersion !== REQUIRED_STEP19_RULE_VERSION) {
      throw new Error(
        `DecisionContext record for '${ctx.characterId}' has invalid ruleVersion '${ctx.ruleVersion}'. Expected '${REQUIRED_STEP19_RULE_VERSION}'.`
      );
    }
    if (contextMap.has(ctx.characterId)) {
      throw new Error(`Duplicate decisionContext record for character '${ctx.characterId}'.`);
    }
    contextMap.set(ctx.characterId, ctx);
  }

  // Validate optional investment snapshots
  const investmentMap = new Map<string, ResonatorInvestmentSnapshot>();
  if (input?.investmentSnapshots) {
    for (let i = 0; i < input.investmentSnapshots.length; i++) {
      const inv = input.investmentSnapshots[i];
      if (!inv) {
        throw new Error(`Null investmentSnapshot record at index ${i}.`);
      }
      if (!inv.resonatorId || !isCanonicalResonatorId(inv.resonatorId)) {
        throw new Error(
          `Character ID '${inv?.resonatorId}' in investment snapshot at index ${i} is not a canonical Patch 3.7 Resonator.`
        );
      }
      if (inv.patchVersion !== CANONICAL_PATCH_VERSION) {
        throw new Error(
          `Investment snapshot record for '${inv.resonatorId}' has invalid patchVersion '${inv.patchVersion}'. Expected '${CANONICAL_PATCH_VERSION}'.`
        );
      }
      if (inv.ruleVersion !== REQUIRED_STEP13_RULE_VERSION) {
        throw new Error(
          `Investment snapshot record for '${inv.resonatorId}' has invalid ruleVersion '${inv.ruleVersion}'. Expected '${REQUIRED_STEP13_RULE_VERSION}'.`
        );
      }
      if (investmentMap.has(inv.resonatorId)) {
        throw new Error(`Duplicate investmentSnapshot record for character '${inv.resonatorId}'.`);
      }
      investmentMap.set(inv.resonatorId, inv);
    }
  }

  // Determine target character IDs
  let targetIds: readonly string[];
  if (input?.characterIds !== undefined) {
    if (input.characterIds.length === 0) {
      throw new Error('characterIds cannot be an empty array.');
    }
    const seen = new Set<string>();
    const validated: string[] = [];
    for (const cid of input.characterIds) {
      if (!cid || typeof cid !== 'string' || !isCanonicalResonatorId(cid)) {
        throw new Error(`Invalid canonical Resonator ID '${cid}' in characterIds list.`);
      }
      if (seen.has(cid)) {
        throw new Error(`Duplicate character ID '${cid}' in characterIds list.`);
      }
      seen.add(cid);
      validated.push(cid);
    }
    targetIds = Object.freeze(validated.sort((a, b) => a.localeCompare(b)));
  } else {
    targetIds = Object.freeze(Array.from(contextMap.keys()).sort((a, b) => a.localeCompare(b)));
  }

  const targetSet = new Set<string>(targetIds);

  // Validate that no extra records exist when catalog inputs are explicitly supplied
  if (input?.characterIds && input?.decisionContexts) {
    for (const ctx of decisionContexts) {
      if (!targetSet.has(ctx.characterId)) {
        throw new Error(
          `Extra decision context record for character '${ctx.characterId}' not present in requested target characters.`
        );
      }
    }
  }

  if (input?.characterIds && input?.investmentSnapshots) {
    for (const inv of input.investmentSnapshots) {
      if (!targetSet.has(inv.resonatorId)) {
        throw new Error(
          `Extra investment snapshot record for character '${inv.resonatorId}' not present in requested target characters.`
        );
      }
    }
  }

  // Build evaluations
  const evaluations: CharacterBuildEvaluation[] = [];
  let totalFullyEquipped = 0;
  let totalPartiallyEquipped = 0;
  let totalUnequipped = 0;
  let totalIncompatibleWeapon = 0;
  let totalBuildUnknown = 0;
  let totalElementAligned = 0;
  let totalUniversalSonata = 0;
  let totalMisalignedSonata = 0;
  let totalCompletenessRatiosSum = 0;
  let completenessCount = 0;

  let decisionContextsMatched = 0;
  let investmentSnapshotsMatched = 0;

  for (const cid of targetIds) {
    const ctx = contextMap.get(cid);
    if (!ctx) {
      throw new Error(`Missing required decisionContext record for canonical Resonator '${cid}'.`);
    }
    decisionContextsMatched++;

    const inv = investmentMap.get(cid) ?? null;
    if (inv) investmentSnapshotsMatched++;

    const evalRec = evaluateCharacterBuild(ctx, inv, CANONICAL_PATCH_VERSION);
    evaluations.push(evalRec);

    if (evalRec.status === 'FULLY_EQUIPPED') totalFullyEquipped++;
    else if (evalRec.status === 'PARTIALLY_EQUIPPED') totalPartiallyEquipped++;
    else if (evalRec.status === 'UNEQUIPPED') totalUnequipped++;
    else if (evalRec.status === 'INCOMPATIBLE_WEAPON') totalIncompatibleWeapon++;
    else if (evalRec.status === 'BUILD_UNKNOWN') totalBuildUnknown++;

    if (evalRec.echoEvaluation.sonataAlignment === 'ELEMENT_ALIGNED') totalElementAligned++;
    else if (evalRec.echoEvaluation.sonataAlignment === 'UNIVERSAL') totalUniversalSonata++;
    else if (evalRec.echoEvaluation.sonataAlignment === 'MISALIGNED') totalMisalignedSonata++;

    if (evalRec.completeness.completenessRatio !== null) {
      totalCompletenessRatiosSum += evalRec.completeness.completenessRatio;
      completenessCount++;
    }
  }

  // Stable canonical ordering
  evaluations.sort(compareCharacterBuildEvaluations);

  const averageCompletenessRatio = completenessCount > 0
    ? Math.round((totalCompletenessRatiosSum / completenessCount) * 10000) / 10000
    : null;

  const summary: CharacterBuildEvaluationResultSummary = Object.freeze({
    totalEvaluations: evaluations.length,
    totalFullyEquipped,
    totalPartiallyEquipped,
    totalUnequipped,
    totalIncompatibleWeapon,
    totalBuildUnknown,
    totalElementAligned,
    totalUniversalSonata,
    totalMisalignedSonata,
    averageCompletenessRatio
  });

  const audit: CharacterBuildEvaluationAuditMetrics = Object.freeze({
    patchVersion: CANONICAL_PATCH_VERSION,
    ruleVersion: CHARACTER_BUILD_EVALUATION_RULE_VERSION,
    totalEvaluations: evaluations.length,
    uniqueCharacterIds: targetIds.length,
    canonicalResonatorCoverage: evaluations.length / 60,
    decisionContextsMatched,
    investmentSnapshotsMatched,
    verifiedAt: OFFLINE_DETERMINISTIC_AUDIT_STAMP
  });

  return Object.freeze({
    patchId: CANONICAL_PATCH_VERSION,
    ruleVersion: CHARACTER_BUILD_EVALUATION_RULE_VERSION,
    evaluations: Object.freeze(evaluations),
    summary,
    audit
  });
}
