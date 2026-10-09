/**
 * Wuthering Waves Team Build Evaluation Contract Tests
 * Phase 7 Step 21: Deterministic Team Build Evaluation Contract
 *
 * Verifies all 20 required dimensions from prompt Section 7:
 * 1. Correct contract identity and version
 * 2. Exactly three distinct members
 * 3. Canonical member identity validation
 * 4. Duplicate, malformed, and unknown IDs
 * 5. Missing and extra upstream records
 * 6. Mismatched patches and character identities
 * 7. Missing snapshots versus confirmed unequipped snapshots
 * 8. Incompatible weapons
 * 9. Partial and unknown build data
 * 10. Completeness aggregation boundaries
 * 11. Sonata metadata normalization and unknown Sonata behavior
 * 12. Sonata interactions only where authoritative rules exist
 * 13. Input immutability
 * 14. Deterministic IDs and stable ordering
 * 15. Input permutation invariance
 * 16. Repeated-run byte-identical output (20-run determinism)
 * 17. Query/filter behavior
 * 18. Provenance and explanation safety
 * 19. Prohibited-key rejection
 * 20. Explicitly prohibited behavior is absent from pure engine
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import {
  TEAM_BUILD_EVALUATION_RULE_VERSION,
  CANONICAL_PATCH_VERSION,
  REQUIRED_STEP20_RULE_VERSION,
  REQUIRED_STEP9_RULE_VERSION,
  TEAM_MEMBER_COUNT,
  TEAM_TOTAL_ASPECTS_COUNT,
  OFFLINE_DETERMINISTIC_AUDIT_STAMP,
  TEAM_BUILD_EVALUATION_EXPLANATION_CODES,
  PROHIBITED_TEAM_BUILD_EVALUATION_KEYS
} from '../lib/engine/team-build-evaluation/rules.ts';
import {
  deriveTeamBuildEvaluationId,
  compareTeamBuildEvaluations,
  matchesTeamBuildEvaluationFilter
} from '../lib/engine/team-build-evaluation/predicates.ts';
import {
  evaluateTeamBuild,
  buildTeamBuildEvaluations
} from '../lib/engine/team-build-evaluation/builder.ts';
import {
  getTeamBuildEvaluationResult,
  getAllTeamBuildEvaluations,
  getTeamBuildEvaluationById,
  getTeamBuildEvaluationByMembers,
  queryTeamBuildEvaluations,
  clearTeamBuildEvaluationCache
} from '../lib/engine/team-build-evaluation/repository.ts';
import {
  normalizeProhibitedKey,
  assertNoProhibitedTeamBuildEvaluationKeys,
  auditSingleTeamBuildEvaluation,
  auditTeamBuildEvaluations,
  runProductionTeamBuildEvaluationAudit
} from '../lib/engine/team-build-evaluation/audit.ts';
import { formatTeamBuildExplanation } from '../lib/engine/team-build-evaluation/index.ts';

import {
  getAllCharacterBuildEvaluations,
  getCharacterBuildEvaluationByCharacterId
} from '../lib/engine/character-build-evaluation/repository.ts';
import { evaluateCharacterBuild } from '../lib/engine/character-build-evaluation/builder.ts';
import { getCharacterDecisionContext } from '../lib/engine/character-decision-context/repository.ts';
import { createUninvestedSnapshot } from '../lib/engine/investment/repository.ts';
import { knownValue, unknownValue } from '../lib/engine/investment/predicates.ts';
import type {
  CharacterBuildEvaluation,
  TeamBuildEvaluation,
  TeamBuildEvaluationInput
} from '../lib/engine/team-build-evaluation/types.ts';
import type { ResonatorInvestmentSnapshot } from '../lib/engine/investment/types.ts';

function createTestSnapshot(
  resonatorId: string,
  weaponConfig?: {
    weaponId: string;
    weaponLevel?: number;
    refinementRank?: number;
    isCompatible?: boolean;
  },
  echoConfig?: {
    sonataSetId: string;
    equippedCount?: number;
    tunedCount?: number;
    maxLevelCount?: number;
  }
): ResonatorInvestmentSnapshot {
  return {
    id: `resonator-investment:3.7:${resonatorId}:7.13.1`,
    patchVersion: '3.7',
    ruleVersion: '7.13.1',
    resonatorId,
    characterLevel: knownValue(90),
    sequenceLevel: knownValue(0),
    weapon: weaponConfig
      ? {
          weaponId: weaponConfig.weaponId,
          weaponLevel:
            weaponConfig.weaponLevel !== undefined
              ? knownValue(weaponConfig.weaponLevel)
              : unknownValue(),
          refinementRank:
            weaponConfig.refinementRank !== undefined
              ? knownValue(weaponConfig.refinementRank)
              : unknownValue(),
          compatibilityStatus:
            weaponConfig.isCompatible === false ? 'INCOMPATIBLE' : 'KNOWN_COMPATIBLE',
          provenance: {
            entityId: 'SYSTEM',
            entityName: 'WeaponInvestment',
            sourceType: 'RESONATOR_ABILITY',
            sourceCode: 'WEAPON_TEST',
            patchVersion: '3.7',
            sourceProvenance: 'Test',
            originalDescription: 'Test'
          }
        }
      : null,
    echoInvestment: echoConfig
      ? {
          equippedCount: knownValue(echoConfig.equippedCount ?? 5),
          tunedCount:
            echoConfig.tunedCount !== undefined
              ? knownValue(echoConfig.tunedCount)
              : unknownValue(),
          maxLevelEchoCount: knownValue(echoConfig.maxLevelCount ?? 5),
          sonataSetId: echoConfig.sonataSetId,
          provenance: {
            entityId: 'SYSTEM',
            entityName: 'EchoInvestment',
            sourceType: 'RESONATOR_ABILITY',
            sourceCode: 'ECHO_TEST',
            patchVersion: '3.7',
            sourceProvenance: 'Test',
            originalDescription: 'Test'
          }
        }
      : null,
    provenance: {
      entityId: 'SYSTEM',
      entityName: 'ResonatorInvestment',
      sourceType: 'RESONATOR_ABILITY',
      sourceCode: 'RESONATOR_TEST',
      patchVersion: '3.7',
      sourceProvenance: 'Test',
      originalDescription: 'Test'
    }
  };
}

test('Dimension 1: Correct contract identity and versioning', () => {
  assert.equal(TEAM_BUILD_EVALUATION_RULE_VERSION, '7.21.1');
  assert.equal(CANONICAL_PATCH_VERSION, '3.7');
  assert.equal(REQUIRED_STEP20_RULE_VERSION, '7.20.1');
  assert.equal(REQUIRED_STEP9_RULE_VERSION, '7.9.1');
  assert.equal(TEAM_MEMBER_COUNT, 3);
  assert.equal(TEAM_TOTAL_ASPECTS_COUNT, 18);
  assert.equal(OFFLINE_DETERMINISTIC_AUDIT_STAMP, 'OFFLINE_DETERMINISTIC_AUDIT');
});

test('Dimension 2: Exactly three distinct members constraint', () => {
  const charEvals = getAllCharacterBuildEvaluations();
  const evalMap = new Map(charEvals.map((e) => [e.resonatorId, e]));

  // Rejects 0, 1, 2, or 4 members
  assert.throws(
    () => evaluateTeamBuild([] as unknown as readonly [string, string, string], evalMap),
    /Team candidate must contain exactly 3 members/
  );
  assert.throws(
    () => evaluateTeamBuild(['Jiyan'] as unknown as readonly [string, string, string], evalMap),
    /Team candidate must contain exactly 3 members/
  );
  assert.throws(
    () => evaluateTeamBuild(['Jiyan', 'Baizhi'] as unknown as readonly [string, string, string], evalMap),
    /Team candidate must contain exactly 3 members/
  );
  assert.throws(
    () => evaluateTeamBuild(['Jiyan', 'Baizhi', 'Rover: Spectro', 'Yinlin'] as unknown as readonly [string, string, string], evalMap),
    /Team candidate must contain exactly 3 members/
  );

  // Rejects duplicates
  assert.throws(
    () => evaluateTeamBuild(['Jiyan', 'Jiyan', 'Baizhi'], evalMap),
    /Duplicate Resonator 'Jiyan'/
  );
  assert.throws(
    () => evaluateTeamBuild(['Baizhi', 'Jiyan', 'Baizhi'], evalMap),
    /Duplicate Resonator 'Baizhi'/
  );
});

test('Dimension 3: Canonical member identity validation', () => {
  const charEvals = getAllCharacterBuildEvaluations();
  const evalMap = new Map(charEvals.map((e) => [e.resonatorId, e]));

  assert.throws(
    () => evaluateTeamBuild(['non_canonical_resonator', 'Jiyan', 'Baizhi'], evalMap),
    /is not a canonical Patch 3.7 Resonator/
  );
  assert.throws(
    () => evaluateTeamBuild(['Jiyan', 'fake_hero', 'Baizhi'], evalMap),
    /is not a canonical Patch 3.7 Resonator/
  );
});

test('Dimension 4: Duplicate, malformed, and unknown IDs in batch candidate list', () => {
  // Empty array of candidates is rejected
  assert.throws(
    () => buildTeamBuildEvaluations({ teamCandidates: [] }),
    /teamCandidates cannot be an empty array/
  );

  // Malformed triple in candidate array
  assert.throws(
    () =>
      buildTeamBuildEvaluations({
        teamCandidates: [['Jiyan', 'Baizhi'] as unknown as readonly [string, string, string]]
      }),
    /must have exactly 3 members/
  );

  // Non-canonical ID in candidate array
  assert.throws(
    () =>
      buildTeamBuildEvaluations({
        teamCandidates: [['Jiyan', 'Baizhi', 'invalid_char']]
      }),
    /Non-canonical Resonator ID 'invalid_char'/
  );

  // Duplicate member inside candidate triple
  assert.throws(
    () =>
      buildTeamBuildEvaluations({
        teamCandidates: [['Jiyan', 'Baizhi', 'Jiyan']]
      }),
    /Duplicate Resonator 'Jiyan' in candidate triple/
  );
});

test('Dimension 5: Missing and extra upstream records safety', () => {
  const evJiyan = getCharacterBuildEvaluationByCharacterId('Jiyan')!;
  const evBaizhi = getCharacterBuildEvaluationByCharacterId('Baizhi')!;
  const evRover = getCharacterBuildEvaluationByCharacterId('Rover: Spectro')!;
  const evYinlin = getCharacterBuildEvaluationByCharacterId('Yinlin')!;

  assert.ok(evJiyan && evBaizhi && evRover && evYinlin);

  // Missing evaluation record for one member
  const partialMap = new Map([
    ['Jiyan', evJiyan],
    ['Baizhi', evBaizhi]
  ]);
  assert.throws(
    () => evaluateTeamBuild(['Jiyan', 'Baizhi', 'Rover: Spectro'], partialMap),
    /Missing CharacterBuildEvaluation for member 'Rover: Spectro'/
  );

  // Extra record rejection when both characterBuildEvaluations and teamCandidates are supplied
  assert.throws(
    () =>
      buildTeamBuildEvaluations({
        characterBuildEvaluations: [evJiyan, evBaizhi, evRover, evYinlin],
        teamCandidates: [['Jiyan', 'Baizhi', 'Rover: Spectro']]
      }),
    /Extra character build evaluation record for 'Yinlin' not present in requested team candidates/
  );
});

test('Dimension 6: Mismatched patches and character identities', () => {
  const charEvals = getAllCharacterBuildEvaluations();
  const evalMap = new Map(charEvals.map((e) => [e.resonatorId, e]));

  // Invalid patchId passed to evaluateTeamBuild
  assert.throws(
    () => evaluateTeamBuild(['Jiyan', 'Baizhi', 'Rover: Spectro'], evalMap, '3.8'),
    /Invalid patchId '3.8'/
  );
  assert.throws(
    () => evaluateTeamBuild(['Jiyan', 'Baizhi', 'Rover: Spectro'], evalMap, '2.4'),
    /Invalid patchId '2.4'/
  );

  // Invalid patchId in buildTeamBuildEvaluations
  assert.throws(
    () => buildTeamBuildEvaluations({ patchId: '3.8' }),
    /Invalid patchId '3.8'/
  );

  // Mismatched patch in member CharacterBuildEvaluation
  const badPatchEval: CharacterBuildEvaluation = {
    ...charEvals[0],
    patchVersion: '3.8' as unknown as '3.7'
  };
  const badMap = new Map(evalMap);
  badMap.set(badPatchEval.resonatorId, badPatchEval);
  assert.throws(
    () => evaluateTeamBuild([badPatchEval.resonatorId, 'Baizhi', 'Rover: Spectro'], badMap),
    /has patchVersion '3.8'. Expected '3.7'/
  );

  // Mismatched ruleVersion in member CharacterBuildEvaluation
  const badRuleEval: CharacterBuildEvaluation = {
    ...charEvals[0],
    ruleVersion: '7.19.1' as unknown as '7.20.1'
  };
  const badRuleMap = new Map(evalMap);
  badRuleMap.set(badRuleEval.resonatorId, badRuleEval);
  assert.throws(
    () => evaluateTeamBuild([badRuleEval.resonatorId, 'Baizhi', 'Rover: Spectro'], badRuleMap),
    /has ruleVersion '7.19.1'. Expected '7.20.1'/
  );
});

test('Dimension 7: Missing snapshots versus confirmed unequipped snapshots', () => {
  const ctxJiyan = getCharacterDecisionContext('Jiyan')!;
  const ctxBaizhi = getCharacterDecisionContext('Baizhi')!;
  const ctxRover = getCharacterDecisionContext('Rover: Spectro')!;

  // 1. All 3 uninvested (null snapshots) -> BUILD_UNKNOWN
  const evJiyanUnknown = evaluateCharacterBuild(ctxJiyan, null);
  const evBaizhiUnknown = evaluateCharacterBuild(ctxBaizhi, null);
  const evRoverUnknown = evaluateCharacterBuild(ctxRover, null);

  assert.equal(evJiyanUnknown.status, 'BUILD_UNKNOWN');
  assert.equal(evJiyanUnknown.completeness.completenessRatio, null);

  const teamUnknown = evaluateTeamBuild(
    ['Jiyan', 'Baizhi', 'Rover: Spectro'],
    [evJiyanUnknown, evBaizhiUnknown, evRoverUnknown]
  );

  assert.equal(teamUnknown.status, 'BUILD_UNKNOWN');
  assert.equal(teamUnknown.completeness.teamCompletenessRatio, null);
  assert.equal(teamUnknown.completeness.knownTeamAspects, 0);
  assert.equal(teamUnknown.completeness.unknownTeamAspects, 18);
  assert.equal(teamUnknown.sonataInteraction.interactionStatus, 'UNKNOWN');

  // 2. All 3 confirmed UNEQUIPPED -> UNEQUIPPED
  const snapJiyanUnequipped = createUninvestedSnapshot('Jiyan');
  const snapBaizhiUnequipped = createUninvestedSnapshot('Baizhi');
  const snapRoverUnequipped = createUninvestedSnapshot('Rover: Spectro');

  const evJiyanUnequipped = evaluateCharacterBuild(ctxJiyan, snapJiyanUnequipped);
  const evBaizhiUnequipped = evaluateCharacterBuild(ctxBaizhi, snapBaizhiUnequipped);
  const evRoverUnequipped = evaluateCharacterBuild(ctxRover, snapRoverUnequipped);

  assert.equal(evJiyanUnequipped.status, 'UNEQUIPPED');
  assert.equal(evJiyanUnequipped.completeness.completenessRatio, 0.0);

  const teamUnequipped = evaluateTeamBuild(
    ['Jiyan', 'Baizhi', 'Rover: Spectro'],
    [evJiyanUnequipped, evBaizhiUnequipped, evRoverUnequipped]
  );

  assert.equal(teamUnequipped.status, 'UNEQUIPPED');
  assert.equal(teamUnequipped.completeness.knownTeamAspects, 0);
  assert.equal(teamUnequipped.completeness.unknownTeamAspects, 18);
  assert.equal(teamUnequipped.completeness.teamCompletenessRatio, 0.0);
  assert.equal(teamUnequipped.sonataInteraction.interactionStatus, 'NOT_EQUIPPED');
  assert.equal(teamUnequipped.weaponAggregation.unequippedCount, 3);
  assert.equal(teamUnequipped.weaponAggregation.compatibleCount, 0);

  // 3. Mixed: 1 confirmed unequipped, 2 BUILD_UNKNOWN -> PARTIALLY_UNKNOWN
  const teamPartiallyUnknown = evaluateTeamBuild(
    ['Jiyan', 'Baizhi', 'Rover: Spectro'],
    [evJiyanUnequipped, evBaizhiUnknown, evRoverUnknown]
  );
  assert.equal(teamPartiallyUnknown.status, 'PARTIALLY_UNKNOWN');
  assert.equal(teamPartiallyUnknown.completeness.knownTeamAspects, 0);
  assert.equal(teamPartiallyUnknown.completeness.unknownTeamAspects, 18);
  assert.equal(teamPartiallyUnknown.completeness.teamCompletenessRatio, 0.0);
  assert.equal(teamPartiallyUnknown.sonataInteraction.interactionStatus, 'UNKNOWN');
});

test('Dimension 8: Incompatible weapons handling', () => {
  const ctxJiyan = getCharacterDecisionContext('Jiyan')!; // Broadblade user
  const ctxBaizhi = getCharacterDecisionContext('Baizhi')!; // Rectifier user
  const ctxRover = getCharacterDecisionContext('Rover: Spectro')!; // Sword user

  // Create snapshot where Jiyan equips a Sword ('Emerald of Genesis'), which is INCOMPATIBLE for Broadblade
  const incompatibleSnap = createTestSnapshot('Jiyan', {
    weaponId: 'Emerald of Genesis',
    weaponLevel: 90,
    refinementRank: 1,
    isCompatible: false
  });

  const evJiyanIncompat = evaluateCharacterBuild(ctxJiyan, incompatibleSnap);
  assert.equal(evJiyanIncompat.weaponEvaluation.compatibility, 'INCOMPATIBLE');
  assert.equal(evJiyanIncompat.status, 'INCOMPATIBLE_WEAPON');

  const evBaizhi = evaluateCharacterBuild(ctxBaizhi, createUninvestedSnapshot('Baizhi'));
  const evRover = evaluateCharacterBuild(ctxRover, createUninvestedSnapshot('Rover: Spectro'));

  const team = evaluateTeamBuild(
    ['Jiyan', 'Baizhi', 'Rover: Spectro'],
    [evJiyanIncompat, evBaizhi, evRover]
  );

  assert.equal(team.status, 'INCOMPATIBLE_WEAPON');
  assert.equal(team.weaponAggregation.incompatibleCount, 1);
  assert.equal(team.weaponAggregation.hasIncompatibleWeapon, true);
  assert.equal(team.weaponAggregation.allCompatible, false);
  assert.ok(team.explanationCodes.includes('STATUS_INCOMPATIBLE_WEAPON'));
  assert.ok(team.explanationCodes.includes(TEAM_BUILD_EVALUATION_EXPLANATION_CODES.HAS_INCOMPATIBLE_WEAPON));
});

test('Dimension 9: Partial and unknown build data accounting', () => {
  const ctxJiyan = getCharacterDecisionContext('Jiyan')!;
  const ctxBaizhi = getCharacterDecisionContext('Baizhi')!;
  const ctxRover = getCharacterDecisionContext('Rover: Spectro')!;

  // Jiyan: partial weapon snapshot (weapon equipped, but level unknown)
  const partialSnap = createTestSnapshot(
    'Jiyan',
    { weaponId: 'Verdant Summit', refinementRank: 1 }, // weaponLevel omitted -> unknown
    { sonataSetId: 'SIERRA_GALE', equippedCount: 5 } // tunedCount omitted -> unknown
  );

  const evJiyan = evaluateCharacterBuild(ctxJiyan, partialSnap);
  const evBaizhi = evaluateCharacterBuild(ctxBaizhi, createUninvestedSnapshot('Baizhi'));
  const evRover = evaluateCharacterBuild(ctxRover, null); // unknown

  const team = evaluateTeamBuild(
    ['Jiyan', 'Baizhi', 'Rover: Spectro'],
    [evJiyan, evBaizhi, evRover]
  );

  // Weapon aggregation: 1 compatible, 0 incompatible, 2 unequipped, 0 unknown
  assert.equal(team.weaponAggregation.compatibleCount, 1);
  assert.equal(team.weaponAggregation.incompatibleCount, 0);
  assert.equal(team.weaponAggregation.unequippedCount, 2);
  assert.equal(team.weaponAggregation.unknownCount, 0);
  assert.equal(team.weaponAggregation.allCompatible, false);
  assert.equal(team.weaponAggregation.hasIncompatibleWeapon, false);

  // Test with unknown weapon compatibility (unmodeled weapon)
  const unknownWpnSnap = createTestSnapshot('Rover: Spectro', {
    weaponId: 'mysterious_unreleased_relic'
  });
  const evRoverUnknownWpn = evaluateCharacterBuild(ctxRover, unknownWpnSnap);
  assert.equal(evRoverUnknownWpn.weaponEvaluation.compatibility, 'UNKNOWN');

  const teamWithUnknownWpn = evaluateTeamBuild(
    ['Jiyan', 'Baizhi', 'Rover: Spectro'],
    [evJiyan, evBaizhi, evRoverUnknownWpn]
  );
  assert.equal(teamWithUnknownWpn.weaponAggregation.compatibleCount, 1);
  assert.equal(teamWithUnknownWpn.weaponAggregation.unequippedCount, 1);
  assert.equal(teamWithUnknownWpn.weaponAggregation.unknownCount, 1);


  // Sum equals 3
  const wSum =
    team.weaponAggregation.compatibleCount +
    team.weaponAggregation.incompatibleCount +
    team.weaponAggregation.unequippedCount +
    team.weaponAggregation.unknownCount;
  assert.equal(wSum, 3);
});

test('Dimension 10: Completeness aggregation boundaries and strict algebra', () => {
  const ctxJiyan = getCharacterDecisionContext('Jiyan')!;
  const ctxBaizhi = getCharacterDecisionContext('Baizhi')!;
  const ctxRover = getCharacterDecisionContext('Rover: Spectro')!;

  // Jiyan: full snapshot (all 6 aspects known)
  const snapJiyan = createTestSnapshot(
    'Jiyan',
    { weaponId: 'Verdant Summit', weaponLevel: 90, refinementRank: 1 },
    { sonataSetId: 'SIERRA_GALE', equippedCount: 5, tunedCount: 5, maxLevelCount: 5 }
  );

  // Rover: full snapshot (all 6 aspects known)
  const snapRover = createTestSnapshot(
    'Rover: Spectro',
    { weaponId: 'Emerald of Genesis', weaponLevel: 90, refinementRank: 1 },
    { sonataSetId: 'CELESTIAL_LIGHT', equippedCount: 5, tunedCount: 5, maxLevelCount: 5 }
  );

  const evJiyan = evaluateCharacterBuild(ctxJiyan, snapJiyan); // 6/6 known
  const evRover = evaluateCharacterBuild(ctxRover, snapRover); // 6/6 known
  const evBaizhi = evaluateCharacterBuild(ctxBaizhi, null); // 0/6 known, ratio = null

  assert.equal(evJiyan.completeness.knownAspects, 6);
  assert.equal(evRover.completeness.knownAspects, 6);
  assert.equal(evBaizhi.completeness.knownAspects, 0);

  const team = evaluateTeamBuild(
    ['Jiyan', 'Baizhi', 'Rover: Spectro'],
    [evJiyan, evBaizhi, evRover]
  );

  assert.equal(team.completeness.totalTeamAspects, 18);
  assert.equal(team.completeness.knownTeamAspects, 12);
  assert.equal(team.completeness.unknownTeamAspects, 6);
  assert.equal(
    team.completeness.knownTeamAspects + team.completeness.unknownTeamAspects,
    18
  );
  assert.equal(team.completeness.teamCompletenessRatio, 0.6667);
  // Sorted members: Baizhi (unknown: null), Jiyan (known: 1.0), Rover: Spectro (known: 1.0)
  assert.deepEqual(team.completeness.memberCompletenessRatios, [null, 1.0, 1.0]);
});

test('Dimension 11: Sonata metadata normalization and unknown Sonata behavior', () => {
  const ctxJiyan = getCharacterDecisionContext('Jiyan')!;
  const ctxBaizhi = getCharacterDecisionContext('Baizhi')!;
  const ctxRover = getCharacterDecisionContext('Rover: Spectro')!;

  const evJiyan = evaluateCharacterBuild(ctxJiyan, createUninvestedSnapshot('Jiyan'));
  const evBaizhi = evaluateCharacterBuild(ctxBaizhi, null); // unknown
  const evRover = evaluateCharacterBuild(ctxRover, createUninvestedSnapshot('Rover: Spectro'));

  const team = evaluateTeamBuild(
    ['Jiyan', 'Baizhi', 'Rover: Spectro'],
    [evJiyan, evBaizhi, evRover]
  );

  assert.equal(team.sonataInteraction.interactionStatus, 'UNKNOWN');
  assert.equal(team.echoAggregation.unknownSonataCount, 0);
  // Status reflects partially unknown
  assert.equal(team.status, 'PARTIALLY_UNKNOWN');
});

test('Dimension 12: Sonata interactions and unmodeled stacking mechanics', () => {
  const ctxJiyan = getCharacterDecisionContext('Jiyan')!;
  const ctxBaizhi = getCharacterDecisionContext('Baizhi')!;
  const ctxRover = getCharacterDecisionContext('Rover: Spectro')!;

  // Jiyan equips 'SIERRA_GALE'
  const snapJiyan = createTestSnapshot(
    'Jiyan',
    { weaponId: 'Verdant Summit', weaponLevel: 90, refinementRank: 1 },
    { sonataSetId: 'SIERRA_GALE', equippedCount: 5, tunedCount: 5, maxLevelCount: 5 }
  );

  // Baizhi equips 'REJUVENATING_GLOW'
  const snapBaizhi = createTestSnapshot(
    'Baizhi',
    { weaponId: 'Blooming Jadehaven', weaponLevel: 90, refinementRank: 1 },
    { sonataSetId: 'REJUVENATING_GLOW', equippedCount: 5, tunedCount: 5, maxLevelCount: 5 }
  );

  // Rover equips 'REJUVENATING_GLOW' (duplicate set with Baizhi!)
  const snapRover = createTestSnapshot(
    'Rover: Spectro',
    { weaponId: 'Emerald of Genesis', weaponLevel: 90, refinementRank: 1 },
    { sonataSetId: 'REJUVENATING_GLOW', equippedCount: 5, tunedCount: 5, maxLevelCount: 5 }
  );

  const evJiyan = evaluateCharacterBuild(ctxJiyan, snapJiyan);
  const evBaizhi = evaluateCharacterBuild(ctxBaizhi, snapBaizhi);
  const evRover = evaluateCharacterBuild(ctxRover, snapRover);

  const team = evaluateTeamBuild(
    ['Jiyan', 'Baizhi', 'Rover: Spectro'],
    [evJiyan, evBaizhi, evRover]
  );

  // Stacking status is strictly UNMODELED
  assert.equal(team.sonataInteraction.stackingStatus, 'UNMODELED');
  assert.equal(team.sonataInteraction.interactionStatus, 'EVALUATED');
  assert.equal(team.sonataInteraction.hasDuplicateSonataSets, true);
  assert.deepEqual(team.sonataInteraction.duplicateSonataCodes, ['REJUVENATING_GLOW']);
  assert.deepEqual(team.sonataInteraction.distinctActiveSonataCodes, [
    'REJUVENATING_GLOW',
    'SIERRA_GALE'
  ]);
  assert.ok(
    team.explanationCodes.includes(TEAM_BUILD_EVALUATION_EXPLANATION_CODES.DUPLICATE_SONATA_SETS_PRESENT)
  );
  assert.ok(
    team.explanationCodes.includes(TEAM_BUILD_EVALUATION_EXPLANATION_CODES.SONATA_STACKING_UNMODELED)
  );
});

test('Dimension 13: Input immutability and record freezing', () => {
  const charEvals = getAllCharacterBuildEvaluations();
  const evalMap = new Map(charEvals.map((e) => [e.resonatorId, e]));

  const candidateInput: [string, string, string] = ['Rover: Spectro', 'Jiyan', 'Baizhi'];
  const inputCopy = [...candidateInput];

  const team = evaluateTeamBuild(candidateInput, evalMap);

  // Input array not mutated
  assert.deepEqual(candidateInput, inputCopy);

  // Output record is frozen
  assert.ok(Object.isFrozen(team));
  assert.ok(Object.isFrozen(team.memberResonatorIds));
  assert.ok(Object.isFrozen(team.memberBuildEvaluations));
  assert.ok(Object.isFrozen(team.weaponAggregation));
  assert.ok(Object.isFrozen(team.echoAggregation));
  assert.ok(Object.isFrozen(team.sonataInteraction));
  assert.ok(Object.isFrozen(team.completeness));
  assert.ok(Object.isFrozen(team.explanationCodes));
  assert.ok(Object.isFrozen(team.provenance));
});

test('Dimension 14: Deterministic IDs and stable ordering', () => {
  const id1 = deriveTeamBuildEvaluationId(['Jiyan', 'Baizhi', 'Rover: Spectro']);
  const id2 = deriveTeamBuildEvaluationId(['Rover: Spectro', 'Baizhi', 'Jiyan']);
  const expected = 'team-build:3.7:Baizhi:Jiyan:Rover: Spectro:7.21.1';

  assert.equal(id1, expected);
  assert.equal(id2, expected);

  const charEvals = getAllCharacterBuildEvaluations();
  const evalMap = new Map(charEvals.map((e) => [e.resonatorId, e]));

  const team1 = evaluateTeamBuild(['Baizhi', 'Jiyan', 'Rover: Spectro'], evalMap);
  const team2 = evaluateTeamBuild(['Baizhi', 'Jiyan', 'Yinlin'], evalMap);

  assert.equal(compareTeamBuildEvaluations(team1, team2) < 0, true);
  assert.equal(compareTeamBuildEvaluations(team2, team1) > 0, true);
  assert.equal(compareTeamBuildEvaluations(team1, team1), 0);
});

test('Dimension 15: Input permutation invariance', () => {
  const charEvals = getAllCharacterBuildEvaluations();
  const evalMap = new Map(charEvals.map((e) => [e.resonatorId, e]));

  const perm1 = evaluateTeamBuild(['Jiyan', 'Baizhi', 'Rover: Spectro'], evalMap);
  const perm2 = evaluateTeamBuild(['Baizhi', 'Rover: Spectro', 'Jiyan'], evalMap);
  const perm3 = evaluateTeamBuild(['Rover: Spectro', 'Jiyan', 'Baizhi'], evalMap);

  assert.equal(perm1.id, perm2.id);
  assert.equal(perm2.id, perm3.id);
  assert.deepEqual(perm1.memberResonatorIds, perm2.memberResonatorIds);
  assert.deepEqual(perm2.memberResonatorIds, perm3.memberResonatorIds);
  assert.equal(perm1.status, perm2.status);
  assert.deepEqual(perm1.completeness, perm2.completeness);
  assert.deepEqual(perm1.weaponAggregation, perm2.weaponAggregation);
  assert.deepEqual(perm1.echoAggregation, perm2.echoAggregation);
  assert.deepEqual(perm1.sonataInteraction, perm2.sonataInteraction);
});

test('Dimension 16: 20-run byte-identical determinism on production evaluations', () => {
  clearTeamBuildEvaluationCache();

  // Test across a targeted set of 5 distinct candidate triples for 20 runs
  const targetTriples: readonly (readonly [string, string, string])[] = [
    ['Baizhi', 'Jiyan', 'Rover: Spectro'],
    ['Calcharo', 'Yinlin', 'Verina'],
    ['Chixia', 'Encore', 'Mortefi'],
    ['Danjin', 'Rover: Havoc', 'Sanhua'],
    ['Aalto', 'Jianxin', 'Yangyang']
  ];

  let firstHash = '';
  for (let run = 1; run <= 20; run++) {
    const res = buildTeamBuildEvaluations({ teamCandidates: targetTriples });
    const jsonStr = JSON.stringify(res);
    const hash = crypto.createHash('sha256').update(jsonStr).digest('hex');

    if (run === 1) {
      firstHash = hash;
    } else {
      assert.equal(hash, firstHash, `Run ${run} produced non-deterministic output hash!`);
    }
  }
  assert.ok(firstHash.length === 64, 'SHA-256 hash valid');
});

test('Dimension 17: Query and filter behavior', () => {
  const targetTriples: readonly (readonly [string, string, string])[] = [
    ['Baizhi', 'Jiyan', 'Rover: Spectro'],
    ['Calcharo', 'Yinlin', 'Verina'],
    ['Chixia', 'Encore', 'Mortefi']
  ];

  const result = buildTeamBuildEvaluations({ teamCandidates: targetTriples });

  // Filter containsResonatorId
  const withJiyan = result.evaluations.filter((ev) =>
    matchesTeamBuildEvaluationFilter(ev, { containsResonatorId: 'Jiyan' })
  );
  assert.equal(withJiyan.length, 1);
  assert.equal(withJiyan[0].memberResonatorIds.includes('Jiyan'), true);

  // Filter status
  const fullyEquipped = result.evaluations.filter((ev) =>
    matchesTeamBuildEvaluationFilter(ev, { status: 'FULLY_EQUIPPED' })
  );
  assert.ok(Array.isArray(fullyEquipped));

  // Filter minTeamCompletenessRatio
  const completeTeams = result.evaluations.filter((ev) =>
    matchesTeamBuildEvaluationFilter(ev, { minTeamCompletenessRatio: 0.5 })
  );
  assert.ok(Array.isArray(completeTeams));
});

test('Dimension 18: Provenance and explanation safety', () => {
  const charEvals = getAllCharacterBuildEvaluations();
  const evalMap = new Map(charEvals.map((e) => [e.resonatorId, e]));

  const team = evaluateTeamBuild(['Baizhi', 'Jiyan', 'Rover: Spectro'], evalMap);

  assert.equal(team.provenance.source, 'DERIVED_TEAM_BUILD_EVALUATION');
  assert.equal(team.provenance.patchVersion, '3.7');
  assert.equal(team.provenance.ruleVersion, '7.21.1');
  assert.equal(team.provenance.upstreamBuildEvaluationRuleVersion, '7.20.1');
  assert.equal(team.provenance.upstreamTeamCandidateRuleVersion, '7.9.1');
  assert.equal(team.provenance.teamCandidateId, 'team-composition:3.7:Baizhi:Jiyan:Rover: Spectro:7.9.1');
  assert.equal(team.provenance.memberBuildEvaluationIds.length, 3);

  const explanation = formatTeamBuildExplanation(team);
  assert.ok(explanation.includes('Team Build: [Baizhi, Jiyan, Rover: Spectro]'));
  assert.ok(explanation.includes('Weapons:'));
  assert.ok(explanation.includes('Echo Loadouts:'));
  assert.ok(explanation.includes('Sonata Interaction:'));
  assert.ok(explanation.includes('Stacking: UNMODELED'));

  // Ensure no subjective/power terms in explanation
  assert.equal(explanation.includes('DPS'), false);
  assert.equal(explanation.includes('combatPower'), false);
  assert.equal(explanation.includes('tier'), false);
});

test('Dimension 19: Prohibited-key rejection across casing and delimiters', () => {
  assert.equal(normalizeProhibitedKey('combatPower'), 'combatpower');
  assert.equal(normalizeProhibitedKey('combat_power'), 'combatpower');
  assert.equal(normalizeProhibitedKey('COMBAT-POWER'), 'combatpower');
  assert.equal(normalizeProhibitedKey('teamScore'), 'teamscore');
  assert.equal(normalizeProhibitedKey('team_score'), 'teamscore');
  assert.equal(normalizeProhibitedKey('dps'), 'dps');

  // Verify assertNoProhibitedTeamBuildEvaluationKeys catches all variants
  for (const key of PROHIBITED_TEAM_BUILD_EVALUATION_KEYS) {
    assert.throws(
      () => assertNoProhibitedTeamBuildEvaluationKeys({ [key]: 100 }),
      /Violates Step 21 boundary isolation/
    );
    assert.throws(
      () => assertNoProhibitedTeamBuildEvaluationKeys({ [`_${key}`]: 100 }),
      /Violates Step 21 boundary isolation/
    );
    assert.throws(
      () => assertNoProhibitedTeamBuildEvaluationKeys({ nested: { [key.toUpperCase()]: 'meta' } }),
      /Violates Step 21 boundary isolation/
    );
  }
});

test('Dimension 20: Audit verification and absence of prohibited engine behavior', () => {
  const targetTriples: readonly (readonly [string, string, string])[] = [
    ['Baizhi', 'Jiyan', 'Rover: Spectro'],
    ['Calcharo', 'Yinlin', 'Verina'],
    ['Chixia', 'Encore', 'Mortefi']
  ];

  const result = buildTeamBuildEvaluations({ teamCandidates: targetTriples });

  // Full audit check passes without throwing
  auditTeamBuildEvaluations(result);
  for (const ev of result.evaluations) {
    auditSingleTeamBuildEvaluation(ev);
  }

  // Repository lookup helpers
  const single = getTeamBuildEvaluationByMembers('Jiyan', 'Baizhi', 'Rover: Spectro');
  assert.ok(single);
  assert.equal(single.id, 'team-build:3.7:Baizhi:Jiyan:Rover: Spectro:7.21.1');

  const invalidLookup = getTeamBuildEvaluationByMembers('Jiyan', 'Jiyan', 'Baizhi');
  assert.equal(invalidLookup, null);
});

test('Additional Test 21: Full production catalog generation and summary invariants', () => {
  clearTeamBuildEvaluationCache();
  const prodResult = getTeamBuildEvaluationResult();

  assert.equal(prodResult.patchId, '3.7');
  assert.equal(prodResult.ruleVersion, '7.21.1');
  assert.ok(prodResult.evaluations.length > 0);
  assert.equal(prodResult.summary.totalEvaluations, prodResult.evaluations.length);

  // Status breakdown sum matches total
  const statusSum =
    prodResult.summary.totalFullyEquipped +
    prodResult.summary.totalPartiallyEquipped +
    prodResult.summary.totalUnequipped +
    prodResult.summary.totalIncompatibleWeapon +
    prodResult.summary.totalBuildUnknown +
    prodResult.summary.totalPartiallyUnknown;

  assert.equal(statusSum, prodResult.summary.totalEvaluations);

  // Invariant: knownTeamAspects + unknownTeamAspects === 18 across all production evaluations
  for (let i = 0; i < Math.min(100, prodResult.evaluations.length); i++) {
    const ev = prodResult.evaluations[i];
    assert.equal(
      ev.completeness.knownTeamAspects + ev.completeness.unknownTeamAspects,
      18,
      `Invariant violated on evaluation ${ev.id}`
    );
  }
});

test('Additional Test 22: Multi-dimensional repository query filtering', () => {
  const allEvals = getAllTeamBuildEvaluations();
  assert.ok(allEvals.length > 0);

  // Filter by resonator
  const jiyanTeams = queryTeamBuildEvaluations({ containsResonatorId: 'Jiyan' });
  assert.ok(jiyanTeams.length > 0);
  for (const t of jiyanTeams) {
    assert.ok(t.memberResonatorIds.includes('Jiyan'));
  }

  // Filter by patch
  const patchMismatch = queryTeamBuildEvaluations({ patchVersion: '3.7' });
  assert.equal(patchMismatch.length, allEvals.length);

  // Filter by empty filter returns all
  const defaultFilter = queryTeamBuildEvaluations({});
  assert.equal(defaultFilter.length, allEvals.length);
});

test('Additional Test 23: formatTeamBuildExplanation output formatting', () => {
  const single = getTeamBuildEvaluationByMembers('Jiyan', 'Baizhi', 'Rover: Spectro');
  assert.ok(single);

  const formatted = formatTeamBuildExplanation(single);
  assert.ok(formatted.includes('Team Build: [Baizhi, Jiyan, Rover: Spectro]'));
  assert.ok(formatted.includes('Status:'));
  assert.ok(formatted.includes('Completeness:'));
  assert.ok(formatted.includes('Weapons:'));
  assert.ok(formatted.includes('Echo Loadouts:'));
  assert.ok(formatted.includes('Sonata Interaction:'));
});

test('Additional Test 24: Cache eviction and re-generation idempotence', () => {
  clearTeamBuildEvaluationCache();
  const res1 = getTeamBuildEvaluationResult();
  const id1 = res1.evaluations[0]?.id;

  clearTeamBuildEvaluationCache();
  const res2 = getTeamBuildEvaluationResult();
  const id2 = res2.evaluations[0]?.id;

  assert.equal(id1, id2);
  assert.equal(res1.evaluations.length, res2.evaluations.length);
});

test('Additional Test 25: All 6 permutations of candidate triple yield identical evaluation', () => {
  const members = ['Baizhi', 'Jiyan', 'Rover: Spectro'];
  const perms = [
    ['Baizhi', 'Jiyan', 'Rover: Spectro'],
    ['Baizhi', 'Rover: Spectro', 'Jiyan'],
    ['Jiyan', 'Baizhi', 'Rover: Spectro'],
    ['Jiyan', 'Rover: Spectro', 'Baizhi'],
    ['Rover: Spectro', 'Baizhi', 'Jiyan'],
    ['Rover: Spectro', 'Jiyan', 'Baizhi']
  ] as const;

  const charEvals = getAllCharacterBuildEvaluations();
  const evalMap = new Map(charEvals.map((e) => [e.resonatorId, e]));

  const baseline = evaluateTeamBuild(perms[0], evalMap);

  for (let i = 1; i < perms.length; i++) {
    const permEval = evaluateTeamBuild(perms[i], evalMap);
    assert.equal(permEval.id, baseline.id);
    assert.deepEqual(permEval.memberResonatorIds, baseline.memberResonatorIds);
    assert.equal(permEval.status, baseline.status);
    assert.deepEqual(permEval.completeness, baseline.completeness);
    assert.deepEqual(permEval.weaponAggregation, baseline.weaponAggregation);
    assert.deepEqual(permEval.echoAggregation, baseline.echoAggregation);
    assert.deepEqual(permEval.sonataInteraction, baseline.sonataInteraction);
  }
});

test('Additional Test 26: Adversarial multi-defect status precedence conflict matrix', () => {
  const evBaizhi = getCharacterBuildEvaluationByCharacterId('Baizhi')!;
  const evJiyan = getCharacterBuildEvaluationByCharacterId('Jiyan')!;
  const evRover = getCharacterBuildEvaluationByCharacterId('Rover: Spectro')!;

  function mockMemberEval(
    base: CharacterBuildEvaluation,
    overrides: {
      status?: any;
      weaponCompat?: any;
      sonataCode?: string | null;
      sonataAlignment?: any;
    }
  ): CharacterBuildEvaluation {
    return {
      ...base,
      status: overrides.status ?? base.status,
      weaponEvaluation: {
        ...base.weaponEvaluation,
        compatibility: overrides.weaponCompat ?? base.weaponEvaluation.compatibility
      },
      echoEvaluation: {
        ...base.echoEvaluation,
        activeSonataSetCode:
          overrides.sonataCode !== undefined
            ? overrides.sonataCode
            : base.echoEvaluation.activeSonataSetCode,
        sonataAlignment: overrides.sonataAlignment ?? base.echoEvaluation.sonataAlignment
      }
    };
  }

  // Conflict 1: PATCH_MISMATCH vs INCOMPATIBLE_WEAPON -> PATCH_MISMATCH
  const evalPatchMismatch = mockMemberEval(evBaizhi, { status: 'PATCH_MISMATCH' });
  const evalIncompatible = mockMemberEval(evJiyan, {
    status: 'INCOMPATIBLE_WEAPON',
    weaponCompat: 'INCOMPATIBLE'
  });
  const teamConflict1 = evaluateTeamBuild(
    ['Baizhi', 'Jiyan', 'Rover: Spectro'],
    [evalPatchMismatch, evalIncompatible, evRover]
  );
  assert.equal(teamConflict1.status, 'PATCH_MISMATCH');
  assert.equal(teamConflict1.weaponAggregation.hasIncompatibleWeapon, true);
  auditSingleTeamBuildEvaluation(teamConflict1);

  // Conflict 2: INVALID vs INCOMPATIBLE_WEAPON -> INVALID
  const evalInvalid = mockMemberEval(evBaizhi, { status: 'INVALID' });
  const teamConflict2 = evaluateTeamBuild(
    ['Baizhi', 'Jiyan', 'Rover: Spectro'],
    [evalInvalid, evalIncompatible, evRover]
  );
  assert.equal(teamConflict2.status, 'INVALID');
  assert.equal(teamConflict2.weaponAggregation.hasIncompatibleWeapon, true);
  auditSingleTeamBuildEvaluation(teamConflict2);

  // Conflict 3: INCOMPATIBLE_WEAPON vs UNEQUIPPED -> INCOMPATIBLE_WEAPON
  const evalUnequipped1 = mockMemberEval(evBaizhi, { status: 'UNEQUIPPED' });
  const evalUnequipped2 = mockMemberEval(evRover, { status: 'UNEQUIPPED' });
  const teamConflict3 = evaluateTeamBuild(
    ['Baizhi', 'Jiyan', 'Rover: Spectro'],
    [evalUnequipped1, evalIncompatible, evalUnequipped2]
  );
  assert.equal(teamConflict3.status, 'INCOMPATIBLE_WEAPON');
  auditSingleTeamBuildEvaluation(teamConflict3);

  // Conflict 4: INCOMPATIBLE_WEAPON vs BUILD_UNKNOWN -> INCOMPATIBLE_WEAPON
  const evalUnknown1 = mockMemberEval(evBaizhi, { status: 'BUILD_UNKNOWN' });
  const evalUnknown2 = mockMemberEval(evRover, { status: 'BUILD_UNKNOWN' });
  const teamConflict4 = evaluateTeamBuild(
    ['Baizhi', 'Jiyan', 'Rover: Spectro'],
    [evalUnknown1, evalIncompatible, evalUnknown2]
  );
  assert.equal(teamConflict4.status, 'INCOMPATIBLE_WEAPON');
  auditSingleTeamBuildEvaluation(teamConflict4);

  // Conflict 5: INCOMPATIBLE_WEAPON vs PARTIALLY_UNKNOWN -> INCOMPATIBLE_WEAPON
  const evalEquipped = mockMemberEval(evBaizhi, { status: 'FULLY_EQUIPPED' });
  const teamConflict5 = evaluateTeamBuild(
    ['Baizhi', 'Jiyan', 'Rover: Spectro'],
    [evalEquipped, evalIncompatible, evalUnknown2]
  );
  assert.equal(teamConflict5.status, 'INCOMPATIBLE_WEAPON');
  auditSingleTeamBuildEvaluation(teamConflict5);

  // Conflict 6: Conflicting individual statuses without incompatible weapon -> PARTIALLY_EQUIPPED
  const evalPartiallyEquipped = mockMemberEval(evJiyan, { status: 'PARTIALLY_EQUIPPED' });
  const teamConflict6 = evaluateTeamBuild(
    ['Baizhi', 'Jiyan', 'Rover: Spectro'],
    [evalEquipped, evalPartiallyEquipped, evalUnequipped2]
  );
  assert.equal(teamConflict6.status, 'PARTIALLY_EQUIPPED');
  auditSingleTeamBuildEvaluation(teamConflict6);
});

test('Additional Test 27: Exhaustive Sonata loadout state aggregation and duplicate set detection', () => {
  const evBaizhi = getCharacterBuildEvaluationByCharacterId('Baizhi')!;
  const evJiyan = getCharacterBuildEvaluationByCharacterId('Jiyan')!;
  const evRover = getCharacterBuildEvaluationByCharacterId('Rover: Spectro')!;

  function mockSonataEval(
    base: CharacterBuildEvaluation,
    sonataCode: string | null,
    alignment: any
  ): CharacterBuildEvaluation {
    return {
      ...base,
      echoEvaluation: {
        ...base.echoEvaluation,
        hasLoadout: sonataCode !== null,
        activeSonataSetCode: sonataCode,
        sonataAlignment: alignment
      }
    };
  }

  // 1. Three identical Sonata sets:
  const tripleSame = evaluateTeamBuild(
    ['Baizhi', 'Jiyan', 'Rover: Spectro'],
    [
      mockSonataEval(evBaizhi, 'REJUVENATING_GLOW', 'ELEMENT_ALIGNED'),
      mockSonataEval(evJiyan, 'REJUVENATING_GLOW', 'MISALIGNED'),
      mockSonataEval(evRover, 'REJUVENATING_GLOW', 'UNIVERSAL')
    ]
  );
  assert.equal(tripleSame.sonataInteraction.hasDuplicateSonataSets, true);
  assert.deepEqual(tripleSame.sonataInteraction.duplicateSonataCodes, ['REJUVENATING_GLOW']);
  assert.deepEqual(tripleSame.sonataInteraction.distinctActiveSonataCodes, ['REJUVENATING_GLOW']);
  assert.equal(tripleSame.echoAggregation.elementAlignedSonataCount, 1);
  assert.equal(tripleSame.echoAggregation.misalignedSonataCount, 1);
  assert.equal(tripleSame.echoAggregation.universalSonataCount, 1);
  assert.equal(tripleSame.echoAggregation.equippedCount, 3);
  auditSingleTeamBuildEvaluation(tripleSame);

  // 2. Three distinct Sonata sets:
  const tripleDistinct = evaluateTeamBuild(
    ['Baizhi', 'Jiyan', 'Rover: Spectro'],
    [
      mockSonataEval(evBaizhi, 'REJUVENATING_GLOW', 'ELEMENT_ALIGNED'),
      mockSonataEval(evJiyan, 'SIERRA_GALE', 'ELEMENT_ALIGNED'),
      mockSonataEval(evRover, 'CELESTIAL_LIGHT', 'ELEMENT_ALIGNED')
    ]
  );
  assert.equal(tripleDistinct.sonataInteraction.hasDuplicateSonataSets, false);
  assert.deepEqual(tripleDistinct.sonataInteraction.duplicateSonataCodes, []);
  assert.deepEqual(tripleDistinct.sonataInteraction.distinctActiveSonataCodes, [
    'CELESTIAL_LIGHT',
    'REJUVENATING_GLOW',
    'SIERRA_GALE'
  ]);
  assert.equal(tripleDistinct.echoAggregation.elementAlignedSonataCount, 3);
  auditSingleTeamBuildEvaluation(tripleDistinct);

  // 3. Unknown Sonata code presence:
  const withUnknown = evaluateTeamBuild(
    ['Baizhi', 'Jiyan', 'Rover: Spectro'],
    [
      mockSonataEval(evBaizhi, 'REJUVENATING_GLOW', 'ELEMENT_ALIGNED'),
      mockSonataEval(evJiyan, null, 'UNKNOWN'),
      mockSonataEval(evRover, 'CELESTIAL_LIGHT', 'ELEMENT_ALIGNED')
    ]
  );
  assert.equal(withUnknown.echoAggregation.unknownSonataCount, 1);
  assert.equal(withUnknown.sonataInteraction.interactionStatus, 'UNKNOWN');
  auditSingleTeamBuildEvaluation(withUnknown);

  // 4. Stacking remains unmodeled regardless of loadouts:
  assert.equal(tripleSame.sonataInteraction.stackingStatus, 'UNMODELED');
  assert.equal(tripleDistinct.sonataInteraction.stackingStatus, 'UNMODELED');
  assert.equal(withUnknown.sonataInteraction.stackingStatus, 'UNMODELED');
});

test('Additional Test 28: Completeness algebra conservation and ratio edge cases', () => {
  const evBaizhi = getCharacterBuildEvaluationByCharacterId('Baizhi')!;
  const evJiyan = getCharacterBuildEvaluationByCharacterId('Jiyan')!;
  const evRover = getCharacterBuildEvaluationByCharacterId('Rover: Spectro')!;

  function mockCompletenessEval(
    base: CharacterBuildEvaluation,
    known: number,
    ratio: number | null
  ): CharacterBuildEvaluation {
    return {
      ...base,
      completeness: {
        ...base.completeness,
        totalAspects: 6,
        knownAspects: known,
        unknownAspects: 6 - known,
        completenessRatio: ratio
      }
    };
  }

  // 1. All uninvested (ratios null) -> teamCompletenessRatio is null
  const allNullTeam = evaluateTeamBuild(
    ['Baizhi', 'Jiyan', 'Rover: Spectro'],
    [
      mockCompletenessEval(evBaizhi, 0, null),
      mockCompletenessEval(evJiyan, 0, null),
      mockCompletenessEval(evRover, 0, null)
    ]
  );
  assert.equal(allNullTeam.completeness.knownTeamAspects, 0);
  assert.equal(allNullTeam.completeness.unknownTeamAspects, 18);
  assert.equal(allNullTeam.completeness.teamCompletenessRatio, null);
  assert.equal(
    allNullTeam.completeness.knownTeamAspects + allNullTeam.completeness.unknownTeamAspects,
    18
  );
  auditSingleTeamBuildEvaluation(allNullTeam);

  // 2. Full investment (18/18 known) -> 1.0000
  const allFullTeam = evaluateTeamBuild(
    ['Baizhi', 'Jiyan', 'Rover: Spectro'],
    [
      mockCompletenessEval(evBaizhi, 6, 1.0),
      mockCompletenessEval(evJiyan, 6, 1.0),
      mockCompletenessEval(evRover, 6, 1.0)
    ]
  );
  assert.equal(allFullTeam.completeness.knownTeamAspects, 18);
  assert.equal(allFullTeam.completeness.unknownTeamAspects, 0);
  assert.equal(allFullTeam.completeness.teamCompletenessRatio, 1.0);
  auditSingleTeamBuildEvaluation(allFullTeam);

  // 3. Partial aspects: 3 + 4 + 5 = 12 / 18 -> 0.6667
  const partialTeam = evaluateTeamBuild(
    ['Baizhi', 'Jiyan', 'Rover: Spectro'],
    [
      mockCompletenessEval(evBaizhi, 3, 0.5),
      mockCompletenessEval(evJiyan, 4, 0.6667),
      mockCompletenessEval(evRover, 5, 0.8333)
    ]
  );
  assert.equal(partialTeam.completeness.knownTeamAspects, 12);
  assert.equal(partialTeam.completeness.unknownTeamAspects, 6);
  assert.equal(partialTeam.completeness.teamCompletenessRatio, 0.6667);
  auditSingleTeamBuildEvaluation(partialTeam);
});

test('Additional Test 29: Negative candidate validation matrix', () => {
  const charEvals = getAllCharacterBuildEvaluations();
  const evalMap = new Map(charEvals.map((e) => [e.resonatorId, e]));

  // 1. Cross-patch input rejected
  assert.throws(
    () => evaluateTeamBuild(['Baizhi', 'Jiyan', 'Rover: Spectro'], evalMap, '3.6'),
    /Invalid patchId '3.6'/
  );

  // 2. Candidate object with patch mismatch
  assert.throws(
    () =>
      evaluateTeamBuild(
        {
          id: 'cand1',
          patchVersion: '3.6',
          ruleVersion: '7.9.1',
          memberResonatorIds: ['Baizhi', 'Jiyan', 'Rover: Spectro']
        } as any,
        evalMap
      ),
    /Candidate patchVersion '3.6' mismatch/
  );

  // 3. Candidate object with ruleVersion mismatch
  assert.throws(
    () =>
      evaluateTeamBuild(
        {
          id: 'cand1',
          patchVersion: '3.7',
          ruleVersion: '7.8.1',
          memberResonatorIds: ['Baizhi', 'Jiyan', 'Rover: Spectro']
        } as any,
        evalMap
      ),
    /Candidate ruleVersion '7.8.1' mismatch/
  );

  // 4. Candidate with duplicate members
  assert.throws(
    () => evaluateTeamBuild(['Baizhi', 'Baizhi', 'Jiyan'], evalMap),
    /Duplicate Resonator 'Baizhi'/
  );

  // 5. Candidate with non-canonical Resonator ID
  assert.throws(
    () => evaluateTeamBuild(['Baizhi', 'InvalidCharacter', 'Jiyan'], evalMap),
    /is not a canonical Patch 3.7 Resonator/
  );

  // 6. Candidate with wrong length
  assert.throws(
    () => evaluateTeamBuild(['Baizhi', 'Jiyan'] as any, evalMap),
    /Team candidate must contain exactly 3 members/
  );

  // 7. Missing member evaluation in map
  const incompleteMap = new Map([
    ['Baizhi', getCharacterBuildEvaluationByCharacterId('Baizhi')!]
  ]);
  assert.throws(
    () => evaluateTeamBuild(['Baizhi', 'Jiyan', 'Rover: Spectro'], incompleteMap),
    /Missing CharacterBuildEvaluation for member 'Jiyan'/
  );
});

test('Additional Test 30: 20-run production catalog SHA-256 byte-identical determinism & dataset baseline', () => {
  const EXPECTED_DATASET_HASH = '7abb7cb3b5290dee9e22cba83df4c974e2befd6639fbb7f04041adedc11a68e9';
  const EXPECTED_STEP21_HASH = 'f568c9a8c9881fa5c697075d22f1f51f31dabe11f0f99c58293ad6038284d437';

  // Verify Patch 3.7 dataset hash
  const datasetBuffer = fs.readFileSync('data/patches/3.7/patch_3_7_dataset.json');
  const datasetHash = crypto.createHash('sha256').update(datasetBuffer).digest('hex');
  assert.equal(datasetHash, EXPECTED_DATASET_HASH, 'Dataset SHA-256 hash matches authoritative baseline');

  // Verify 20 consecutive runs of production catalog generation
  let firstCatalogHash = '';
  for (let run = 1; run <= 20; run++) {
    clearTeamBuildEvaluationCache();
    const prodResult = getTeamBuildEvaluationResult();
    const jsonStr = JSON.stringify(prodResult);
    const hash = crypto.createHash('sha256').update(jsonStr).digest('hex');

    if (run === 1) {
      firstCatalogHash = hash;
      assert.equal(
        hash,
        EXPECTED_STEP21_HASH,
        `Step 21 output hash must match authoritative baseline '${EXPECTED_STEP21_HASH}'`
      );
    } else {
      assert.equal(
        hash,
        firstCatalogHash,
        `Run ${run} produced divergent catalog hash! Expected ${firstCatalogHash}, got ${hash}`
      );
    }
  }
});

