/**
 * Wuthering Waves Deterministic Gameplay Relationships Test Suite
 * Phase 7 Step 3: Gameplay Relationship & Interaction Contract
 *
 * Verifies that the Gameplay Relationship & Interaction Engine:
 * - Represents explicit mechanical evidence without computing synergy scores
 * - Derives deterministic, deduplicated, and canonically sorted relationships
 * - Preserves target, action, element, trigger, and context requirement semantics
 * - Correctly delegates applicability evaluation to Phase 7 Step 2 resolution
 * - Passes all 75 required test specifications
 */

import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { NormalizedEngineFact } from '../lib/engine/facts/types.ts';
import {
  buildGameplayCapability,
  auditProductionCapabilities
} from '../lib/engine/capabilities/builder.ts';
import type {
  GameplayCapability,
  RuntimeEvaluationContext
} from '../lib/engine/capabilities/types.ts';
import {
  buildGameplayRelationships,
  buildGameplayRelationshipsForCapability,
  deriveRelationshipId
} from '../lib/engine/relationships/builder.ts';
import {
  isGameplayRelationshipApplicable,
  isOffensiveRelationship,
  isDefensiveRelationship,
  isResourceRelationship,
  isTargetingRelationship,
  isActionRelationship,
  isElementalRelationship,
  isTriggerRelationship,
  isMechanicalRelationship
} from '../lib/engine/relationships/predicates.ts';
import {
  queryGameplayRelationships,
  findRelationshipsByEntity,
  findRelationshipsByType,
  findRelationshipsByTargetKind,
  findRelationshipsByElement,
  findRelationshipsByAction
} from '../lib/engine/relationships/repository.ts';
import { auditProductionRelationships } from '../lib/engine/relationships/audit.ts';

function createMockFact(overrides?: Partial<NormalizedEngineFact>): NormalizedEngineFact {
  const isUnmodeledOrUnknown =
    overrides?.consumptionState === 'UNMODELED' ||
    overrides?.consumptionState === 'UNKNOWN' ||
    overrides?.consumptionState === 'NOT_APPLICABLE' ||
    overrides?.value?.type === 'UNRESOLVED';

  const baseNumeric =
    overrides && 'staticNumericValue' in overrides
      ? overrides.staticNumericValue
      : overrides && 'value' in overrides && overrides.value?.type === 'EXACT'
        ? overrides.value.value
        : isUnmodeledOrUnknown
          ? null
          : 15;

  const baseValue =
    overrides?.value ??
    (isUnmodeledOrUnknown
      ? { type: 'UNRESOLVED' as const, reason: 'Unmodeled/unknown in test fixture' }
      : {
          type: 'EXACT' as const,
          value: baseNumeric !== null && baseNumeric !== undefined ? baseNumeric : 15,
          unit: 'PERCENT' as const
        });

  return {
    factId: 'mock_entity|skill|STAT_BUFF|SELF|ATK_PERCENT|NONE|EXACT:15:PERCENT|NO_COND|NO_DUR|NO_STACK',
    entityId: 'mock_entity',
    sourceCode: 'skill',
    patchVersion: '3.7',
    category: 'STAT_BUFF',
    parameter: 'ATK_PERCENT',
    value: baseValue,
    staticNumericValue:
      overrides && 'staticNumericValue' in overrides
        ? overrides.staticNumericValue!
        : baseValue.type === 'EXACT'
          ? baseValue.value
          : null,
    unit: 'PERCENT',
    target: 'SELF',
    element: 'NONE',
    semanticStatus: 'SAFE_EXPLICIT',
    parameterSafety: 'DIRECT_ENGINE_FACT',
    consumptionState: 'CONSUMABLE_STATIC',
    provenance: {
      entityId: 'mock_entity',
      entityName: 'Mock Entity',
      sourceType: 'RESONATOR_ABILITY',
      sourceCode: 'skill',
      patchVersion: '3.7',
      sourceProvenance: 'Official Test Provenance',
      originalDescription: 'ATK increases by 15%.'
    },
    extraction: {
      parserVersion: '1.1.0',
      method: 'DETERMINISTIC_RULE_PARSER',
      extractionDate: '2026-10-08'
    },
    ...overrides
  };
}

// ============================================================================
// SUITE 1: CORE RELATIONSHIP INVARIANTS (Tests 1-5)
// ============================================================================

test('1. Core: relationship builder is deterministic', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      element: 'Fusion',
      parameter: 'FUSION_DAMAGE_PERCENT',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
    })
  );

  const run1 = buildGameplayRelationshipsForCapability(cap);
  const run2 = buildGameplayRelationshipsForCapability(cap);

  assert.deepStrictEqual(run1, run2);
});

test('2. Core: empty capability list produces empty relationships', () => {
  const rels = buildGameplayRelationships([]);
  assert.strictEqual(rels.length, 0);
  assert.deepStrictEqual(rels, []);
});

test('3. Core: relationship IDs are deterministic', () => {
  const cap = buildGameplayCapability(createMockFact({ parameter: 'ATK_PERCENT' }));
  const rels = buildGameplayRelationshipsForCapability(cap);

  assert.ok(rels.length > 0);
  for (const rel of rels) {
    assert.strictEqual(rel.relationshipId.startsWith('rel:3.7:'), true);
    assert.strictEqual(rel.patchVersion, '3.7');
  }
});

test('4. Core: relationship objects are immutable', () => {
  const cap = buildGameplayCapability(createMockFact());
  const rels = buildGameplayRelationships([cap]);

  assert.strictEqual(Object.isFrozen(rels), true);
  assert.strictEqual(Object.isFrozen(rels[0]), true);
  assert.strictEqual(Object.isFrozen(rels[0].target), true);
  assert.strictEqual(Object.isFrozen(rels[0].evidence), true);
});

test('5. Core: provenance is preserved', () => {
  const cap = buildGameplayCapability(createMockFact({ entityId: 'changli', sourceCode: 'skill' }));
  const rels = buildGameplayRelationshipsForCapability(cap);

  assert.ok(rels.length > 0);
  for (const rel of rels) {
    assert.strictEqual(rel.sourceEntityId, 'changli');
    assert.strictEqual(rel.sourceCode, 'skill');
    assert.strictEqual(rel.provenance.entityId, 'mock_entity');
    assert.ok(rel.sourceFactIds.length > 0);
  }
});

// ============================================================================
// SUITE 2: AMPLIFICATION RELATIONSHIPS (Tests 6-14)
// ============================================================================

test('6. Amplification: ATK amplification relationship', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'ATK_PERCENT',
      category: 'STAT_BUFF',
      value: { type: 'EXACT', value: 15, unit: 'PERCENT' }
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const atkRel = rels.find((r) => r.relationshipType === 'AMPLIFIES_ATTRIBUTE');

  assert.ok(atkRel);
  assert.strictEqual(atkRel.parameter, 'ATK_PERCENT');
  assert.strictEqual(atkRel.effectValue, 15);
  assert.strictEqual(isOffensiveRelationship(atkRel), true);
});

test('7. Amplification: CRIT rate amplification relationship', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'CRIT_RATE_PERCENT',
      category: 'STAT_BUFF',
      value: { type: 'EXACT', value: 8, unit: 'PERCENT' }
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const critRel = rels.find((r) => r.relationshipType === 'AMPLIFIES_ATTRIBUTE');

  assert.ok(critRel);
  assert.strictEqual(critRel.parameter, 'CRIT_RATE_PERCENT');
  assert.strictEqual(critRel.effectValue, 8);
});

test('8. Amplification: CRIT damage amplification relationship', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'CRIT_DAMAGE_PERCENT',
      category: 'STAT_BUFF',
      value: { type: 'EXACT', value: 16, unit: 'PERCENT' }
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const cdRel = rels.find((r) => r.relationshipType === 'AMPLIFIES_ATTRIBUTE');

  assert.ok(cdRel);
  assert.strictEqual(cdRel.parameter, 'CRIT_DAMAGE_PERCENT');
  assert.strictEqual(cdRel.effectValue, 16);
});

test('9. Amplification: elemental damage amplification relationship', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      element: 'Fusion',
      parameter: 'FUSION_DAMAGE_PERCENT',
      category: 'DMG_AMPLIFY',
      value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const elemRel = rels.find((r) => r.relationshipType === 'AMPLIFIES_DAMAGE');

  assert.ok(elemRel);
  assert.strictEqual(elemRel.element, 'Fusion');
  assert.strictEqual(elemRel.target.kind, 'ELEMENT');
  if (elemRel.target.kind === 'ELEMENT') {
    assert.strictEqual(elemRel.target.element, 'Fusion');
  }
  assert.strictEqual(isElementalRelationship(elemRel), true);
});

test('10. Amplification: skill damage amplification relationship', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'SKILL_DAMAGE_PERCENT',
      parameterSafety: 'REQUIRES_CONTEXT',
      value: { type: 'EXACT', value: 25, unit: 'PERCENT' }
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const skillRel = rels.find((r) => r.relationshipType === 'AMPLIFIES_ACTION');

  assert.ok(skillRel);
  assert.strictEqual(skillRel.actionType, 'SKILL');
  assert.strictEqual(skillRel.target.kind, 'ACTION');
  if (skillRel.target.kind === 'ACTION') {
    assert.strictEqual(skillRel.target.actionType, 'SKILL');
  }
});

test('11. Amplification: basic damage amplification relationship', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'BASIC_ATTACK_DAMAGE_PERCENT',
      parameterSafety: 'REQUIRES_CONTEXT',
      value: { type: 'EXACT', value: 18, unit: 'PERCENT' }
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const basicRel = rels.find((r) => r.relationshipType === 'AMPLIFIES_ACTION');

  assert.ok(basicRel);
  assert.strictEqual(basicRel.actionType, 'BASIC');
  assert.strictEqual(basicRel.target.kind, 'ACTION');
});

test('12. Amplification: heavy damage amplification relationship', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'HEAVY_ATTACK_DAMAGE_PERCENT',
      parameterSafety: 'REQUIRES_CONTEXT',
      value: { type: 'EXACT', value: 18, unit: 'PERCENT' }
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const heavyRel = rels.find((r) => r.relationshipType === 'AMPLIFIES_ACTION');

  assert.ok(heavyRel);
  assert.strictEqual(heavyRel.actionType, 'HEAVY');
  assert.strictEqual(heavyRel.target.kind, 'ACTION');
});

test('13. Amplification: liberation damage amplification relationship', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'LIBERATION_DAMAGE_PERCENT',
      parameterSafety: 'REQUIRES_CONTEXT',
      value: { type: 'EXACT', value: 30, unit: 'PERCENT' }
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const libRel = rels.find((r) => r.relationshipType === 'AMPLIFIES_ACTION');

  assert.ok(libRel);
  assert.strictEqual(libRel.actionType, 'LIBERATION');
  assert.strictEqual(libRel.target.kind, 'ACTION');
});

test('14. Amplification: coordinated attack amplification relationship', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'COORDINATED_ATTACK_DAMAGE_PERCENT',
      parameterSafety: 'DIRECT_ENGINE_FACT',
      value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const coordRel = rels.find((r) => r.relationshipType === 'COORDINATED_ATTACK_INTERACTION');

  assert.ok(coordRel);
  assert.strictEqual(coordRel.actionType, 'COORDINATED');
  assert.strictEqual(isMechanicalRelationship(coordRel), true);
});

// ============================================================================
// SUITE 3: DEFENSIVE RELATIONSHIPS (Tests 15-17)
// ============================================================================

test('15. Defensive: defense shred relationship', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'DEF_SHRED_PERCENT',
      category: 'RES_SHRED',
      value: { type: 'EXACT', value: 15, unit: 'PERCENT' }
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const defRel = rels.find((r) => r.relationshipType === 'REDUCES_DEFENSE');

  assert.ok(defRel);
  assert.strictEqual(defRel.category, 'OFFENSIVE');
  assert.strictEqual(defRel.effectValue, 15);
});

test('16. Defensive: resistance shred relationship', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      element: 'Havoc',
      parameter: 'HAVOC_RES_SHRED_PERCENT',
      category: 'RES_SHRED',
      value: { type: 'EXACT', value: 10, unit: 'PERCENT' }
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const resRel = rels.find((r) => r.relationshipType === 'REDUCES_RESISTANCE');

  assert.ok(resRel);
  assert.strictEqual(resRel.element, 'Havoc');
  assert.strictEqual(resRel.target.kind, 'ELEMENT');
});

test('17. Defensive: elemental resistance restriction preserved', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      element: 'Glacio',
      parameter: 'GLACIO_RES_SHRED_PERCENT',
      category: 'RES_SHRED',
      value: { type: 'EXACT', value: 10, unit: 'PERCENT' }
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const elemMatch = rels.find((r) => r.relationshipType === 'ELEMENT_MATCH');

  assert.ok(elemMatch);
  assert.strictEqual(elemMatch.element, 'Glacio');
  assert.strictEqual(elemMatch.target.kind, 'ELEMENT');
  if (elemMatch.target.kind === 'ELEMENT') {
    assert.strictEqual(elemMatch.target.element, 'Glacio');
  }
});

// ============================================================================
// SUITE 4: HEALING & SHIELD RELATIONSHIPS (Tests 18-20)
// ============================================================================

test('18. Healing / Shield: healing provision', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      category: 'HEALING',
      parameter: 'UNRESOLVED_PARAMETER',
      value: { type: 'EXACT', value: 2000, unit: 'FLAT' }
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const healRel = rels.find((r) => r.relationshipType === 'PROVIDES_HEALING');

  assert.ok(healRel);
  assert.strictEqual(healRel.category, 'DEFENSIVE');
  assert.strictEqual(isDefensiveRelationship(healRel), true);
});

test('19. Healing / Shield: healing bonus', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'HEALING_BONUS_PERCENT',
      category: 'STAT_BUFF',
      value: { type: 'EXACT', value: 12, unit: 'PERCENT' }
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const bonusRel = rels.find((r) => r.relationshipType === 'AMPLIFIES_ATTRIBUTE');

  assert.ok(bonusRel);
  assert.strictEqual(bonusRel.parameter, 'HEALING_BONUS_PERCENT');
  assert.strictEqual(bonusRel.effectValue, 12);
});

test('20. Healing / Shield: shield provision', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      category: 'SHIELD',
      parameter: 'UNRESOLVED_PARAMETER',
      value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const shieldRel = rels.find((r) => r.relationshipType === 'PROVIDES_SHIELD');

  assert.ok(shieldRel);
  assert.strictEqual(shieldRel.category, 'DEFENSIVE');
  assert.strictEqual(shieldRel.effectValue, 20);
});

// ============================================================================
// SUITE 5: RESOURCE RELATIONSHIPS (Tests 21-23)
// ============================================================================

test('21. Resource: energy regeneration', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'ENERGY_REGEN_PERCENT',
      category: 'STAT_BUFF',
      value: { type: 'EXACT', value: 12.8, unit: 'PERCENT' }
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const nrgRel = rels.find((r) => r.relationshipType === 'PROVIDES_RESOURCE');

  assert.ok(nrgRel);
  assert.strictEqual(nrgRel.category, 'RESOURCE');
  assert.strictEqual(isResourceRelationship(nrgRel), true);
});

test('22. Resource: cooldown reduction', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'SKILL_COOLDOWN_REDUCTION_PERCENT',
      category: 'RESOURCE_GRANT',
      value: { type: 'EXACT', value: 10, unit: 'PERCENT' }
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const cdRel = rels.find((r) => r.relationshipType === 'REDUCES_COOLDOWN');

  assert.ok(cdRel);
  assert.strictEqual(cdRel.category, 'RESOURCE');
  assert.strictEqual(cdRel.effectValue, 10);
});

test('23. Resource: Forte resource management', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'FORTE_RESOURCE',
      category: 'RESOURCE_GRANT',
      value: { type: 'EXACT', value: 30, unit: 'FLAT' }
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const forteRel = rels.find((r) => r.relationshipType === 'PROVIDES_RESOURCE');

  assert.ok(forteRel);
  assert.strictEqual(forteRel.category, 'RESOURCE');
  assert.strictEqual(forteRel.effectValue, 30);
});

// ============================================================================
// SUITE 6: TARGETING RELATIONSHIPS (Tests 24-27)
// ============================================================================

test('24. Targeting: SELF preserved', () => {
  const cap = buildGameplayCapability(createMockFact({ target: 'SELF' }));
  const rels = buildGameplayRelationshipsForCapability(cap);
  const selfRel = rels.find((r) => r.relationshipType === 'TARGETS');

  assert.ok(selfRel);
  assert.strictEqual(selfRel.target.kind, 'TARGET_CLASS');
  if (selfRel.target.kind === 'TARGET_CLASS') {
    assert.strictEqual(selfRel.target.target, 'SELF');
  }
});

test('25. Targeting: TEAM preserved', () => {
  const cap = buildGameplayCapability(createMockFact({ target: 'TEAM' }));
  const rels = buildGameplayRelationshipsForCapability(cap);
  const teamRel = rels.find((r) => r.relationshipType === 'TARGETS');

  assert.ok(teamRel);
  assert.strictEqual(teamRel.target.kind, 'TARGET_CLASS');
  if (teamRel.target.kind === 'TARGET_CLASS') {
    assert.strictEqual(teamRel.target.target, 'TEAM');
  }
});

test('26. Targeting: NEXT_RESONATOR preserved', () => {
  const cap = buildGameplayCapability(createMockFact({ target: 'NEXT_RESONATOR' }));
  const rels = buildGameplayRelationshipsForCapability(cap);
  const nextRel = rels.find((r) => r.relationshipType === 'NEXT_RESONATOR_INTERACTION');

  assert.ok(nextRel);
  assert.strictEqual(nextRel.target.kind, 'NEXT_RESONATOR');
  assert.strictEqual(isTargetingRelationship(nextRel), true);
});

test('27. Targeting: ACTIVE_CHARACTER preserved', () => {
  const cap = buildGameplayCapability(createMockFact({ target: 'ACTIVE_CHARACTER' }));
  const rels = buildGameplayRelationshipsForCapability(cap);
  const activeRel = rels.find((r) => r.relationshipType === 'TARGETS');

  assert.ok(activeRel);
  assert.strictEqual(activeRel.target.kind, 'TARGET_CLASS');
  if (activeRel.target.kind === 'TARGET_CLASS') {
    assert.strictEqual(activeRel.target.target, 'ACTIVE_CHARACTER');
  }
});

// ============================================================================
// SUITE 7: ACTIONS & TRIGGERS (Tests 28-34)
// ============================================================================

test('28. Actions: BASIC action relationship', () => {
  const cap = buildGameplayCapability(createMockFact({ parameter: 'BASIC_ATTACK_DAMAGE_PERCENT' }));
  const rels = buildGameplayRelationshipsForCapability(cap);
  const basicRel = rels.find((r) => r.actionType === 'BASIC');

  assert.ok(basicRel);
  assert.strictEqual(basicRel.actionType, 'BASIC');
});

test('29. Actions: HEAVY action relationship', () => {
  const cap = buildGameplayCapability(createMockFact({ parameter: 'HEAVY_ATTACK_DAMAGE_PERCENT' }));
  const rels = buildGameplayRelationshipsForCapability(cap);
  const heavyRel = rels.find((r) => r.actionType === 'HEAVY');

  assert.ok(heavyRel);
  assert.strictEqual(heavyRel.actionType, 'HEAVY');
});

test('30. Actions: SKILL action relationship', () => {
  const cap = buildGameplayCapability(createMockFact({ parameter: 'SKILL_DAMAGE_PERCENT' }));
  const rels = buildGameplayRelationshipsForCapability(cap);
  const skillRel = rels.find((r) => r.actionType === 'SKILL');

  assert.ok(skillRel);
  assert.strictEqual(skillRel.actionType, 'SKILL');
});

test('31. Actions: LIBERATION action relationship', () => {
  const cap = buildGameplayCapability(createMockFact({ parameter: 'LIBERATION_DAMAGE_PERCENT' }));
  const rels = buildGameplayRelationshipsForCapability(cap);
  const libRel = rels.find((r) => r.actionType === 'LIBERATION');

  assert.ok(libRel);
  assert.strictEqual(libRel.actionType, 'LIBERATION');
});

test('32. Actions: INTRO trigger relationship', () => {
  const cap = buildGameplayCapability(createMockFact({ condition: { trigger: 'ON_INTRO_SKILL' } }));
  const rels = buildGameplayRelationshipsForCapability(cap);
  const introRel = rels.find((r) => r.relationshipType === 'INTRO_INTERACTION');

  assert.ok(introRel);
  assert.strictEqual(introRel.actionType, 'INTRO');
  assert.strictEqual(isTriggerRelationship(introRel), true);
});

test('33. Actions: OUTRO trigger relationship', () => {
  const cap = buildGameplayCapability(createMockFact({ condition: { trigger: 'ON_OUTRO_SKILL' } }));
  const rels = buildGameplayRelationshipsForCapability(cap);
  const outroRel = rels.find((r) => r.relationshipType === 'OUTRO_INTERACTION');

  assert.ok(outroRel);
  assert.strictEqual(outroRel.actionType, 'OUTRO');
  assert.strictEqual(isTriggerRelationship(outroRel), true);
});

test('34. Actions: COORDINATED relationship', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      category: 'COORDINATED_ATTACK',
      parameter: 'COORDINATED_ATTACK_DAMAGE_PERCENT'
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const coordRel = rels.find((r) => r.relationshipType === 'COORDINATED_ATTACK_INTERACTION');

  assert.ok(coordRel);
  assert.strictEqual(coordRel.actionType, 'COORDINATED');
});

// ============================================================================
// SUITE 8: ELEMENTAL RELATIONSHIPS (Tests 35-42)
// ============================================================================

test('35. Elements: NONE does not create false elemental target', () => {
  const cap = buildGameplayCapability(createMockFact({ element: 'NONE', parameter: 'ATK_PERCENT' }));
  const rels = buildGameplayRelationshipsForCapability(cap);

  for (const rel of rels) {
    assert.notStrictEqual(rel.target.kind, 'ELEMENT');
    assert.notStrictEqual(rel.relationshipType, 'ELEMENT_MATCH');
  }
});

test('36. Elements: All preserves all-element semantics', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      element: 'All',
      parameter: 'ALL_ATTRIBUTE_DAMAGE_PERCENT',
      category: 'DMG_AMPLIFY'
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const allRel = rels.find((r) => r.element === 'All');

  assert.ok(allRel);
  assert.strictEqual(allRel.element, 'All');
  assert.notStrictEqual(allRel.target.kind, 'ELEMENT'); // Does not collapse into single specific element
});

test('37. Elements: Fusion relationship remains Fusion', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      element: 'Fusion',
      parameter: 'FUSION_DAMAGE_PERCENT',
      category: 'DMG_AMPLIFY'
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const fusionRel = rels.find((r) => r.element === 'Fusion');

  assert.ok(fusionRel);
  assert.strictEqual(fusionRel.element, 'Fusion');
});

test('38. Elements: Glacio relationship remains Glacio', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      element: 'Glacio',
      parameter: 'GLACIO_DAMAGE_PERCENT',
      category: 'DMG_AMPLIFY'
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const glacioRel = rels.find((r) => r.element === 'Glacio');

  assert.ok(glacioRel);
  assert.strictEqual(glacioRel.element, 'Glacio');
});

test('39. Elements: Electro relationship remains Electro', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      element: 'Electro',
      parameter: 'ELECTRO_DAMAGE_PERCENT',
      category: 'DMG_AMPLIFY'
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const electroRel = rels.find((r) => r.element === 'Electro');

  assert.ok(electroRel);
  assert.strictEqual(electroRel.element, 'Electro');
});

test('40. Elements: Aero relationship remains Aero', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      element: 'Aero',
      parameter: 'AERO_DAMAGE_PERCENT',
      category: 'DMG_AMPLIFY'
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const aeroRel = rels.find((r) => r.element === 'Aero');

  assert.ok(aeroRel);
  assert.strictEqual(aeroRel.element, 'Aero');
});

test('41. Elements: Spectro relationship remains Spectro', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      element: 'Spectro',
      parameter: 'SPECTRO_DAMAGE_PERCENT',
      category: 'DMG_AMPLIFY'
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const spectroRel = rels.find((r) => r.element === 'Spectro');

  assert.ok(spectroRel);
  assert.strictEqual(spectroRel.element, 'Spectro');
});

test('42. Elements: Havoc relationship remains Havoc', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      element: 'Havoc',
      parameter: 'HAVOC_DAMAGE_PERCENT',
      category: 'DMG_AMPLIFY'
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const havocRel = rels.find((r) => r.element === 'Havoc');

  assert.ok(havocRel);
  assert.strictEqual(havocRel.element, 'Havoc');
});

// ============================================================================
// SUITE 9: COMPOSITE CONTEXT (Tests 43-45)
// ============================================================================

test('43. Composite: element + trigger preserved', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      element: 'Fusion',
      parameter: 'FUSION_DAMAGE_PERCENT',
      condition: { trigger: 'ON_OUTRO_SKILL' },
      consumptionState: 'CONSUMABLE_CONTEXTUAL'
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const elemRel = rels.find((r) => r.relationshipType === 'AMPLIFIES_DAMAGE');
  const outroRel = rels.find((r) => r.relationshipType === 'OUTRO_INTERACTION');

  assert.ok(elemRel);
  assert.ok(outroRel);
  assert.strictEqual(elemRel.element, 'Fusion');
  assert.strictEqual(outroRel.actionType, 'OUTRO');
});

test('44. Composite: action + trigger preserved', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'SKILL_DAMAGE_PERCENT',
      parameterSafety: 'REQUIRES_CONTEXT',
      condition: { trigger: 'ON_INTRO_SKILL' },
      consumptionState: 'CONSUMABLE_CONTEXTUAL'
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const actionRel = rels.find((r) => r.relationshipType === 'AMPLIFIES_ACTION');
  const introRel = rels.find((r) => r.relationshipType === 'INTRO_INTERACTION');

  assert.ok(actionRel);
  assert.ok(introRel);
  assert.strictEqual(actionRel.actionType, 'SKILL');
  assert.strictEqual(introRel.actionType, 'INTRO');
});

test('45. Composite: relationship retains all required context dimensions', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      element: 'Fusion',
      parameter: 'FUSION_DAMAGE_PERCENT',
      condition: { trigger: 'ON_OUTRO_SKILL', zoneActive: true },
      consumptionState: 'CONSUMABLE_CONTEXTUAL'
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  for (const rel of rels) {
    assert.deepStrictEqual(rel.contextRequirements, cap.contextRequirements);
    assert.deepStrictEqual(rel.requiredContext, cap.requiredContext);
  }
});

// ============================================================================
// SUITE 10: UNMODELED & UNKNOWN INTEGRITY (Tests 46-49)
// ============================================================================

test('46. Unmodeled / Unknown: Youhu regression', () => {
  const prodCaps = auditProductionCapabilities().capabilities;
  const youhuOutro = prodCaps.find(
    (c) => c.entityId === 'Youhu' && c.sourceCode === 'OUTRO_SKILL'
  );

  assert.ok(youhuOutro);
  assert.strictEqual(youhuOutro.status, 'UNMODELED');
  assert.strictEqual(youhuOutro.target, 'NEXT_RESONATOR');
});

test('47. Unmodeled / Unknown: Youhu remains UNMODELED', () => {
  const prodCaps = auditProductionCapabilities().capabilities;
  const youhuOutro = prodCaps.find(
    (c) => c.entityId === 'Youhu' && c.sourceCode === 'OUTRO_SKILL'
  );

  assert.ok(youhuOutro);
  const rels = buildGameplayRelationshipsForCapability(youhuOutro);

  // Structural targets exist
  const nextRel = rels.find((r) => r.relationshipType === 'NEXT_RESONATOR_INTERACTION');
  assert.ok(nextRel);

  // Coordinated attack interaction exists structurally
  const coordRel = rels.find((r) => r.relationshipType === 'COORDINATED_ATTACK_INTERACTION');
  assert.ok(coordRel);
});

test('48. Unmodeled / Unknown: Youhu does not produce fabricated numeric relationship', () => {
  const prodCaps = auditProductionCapabilities().capabilities;
  const youhuOutro = prodCaps.find(
    (c) => c.entityId === 'Youhu' && c.sourceCode === 'OUTRO_SKILL'
  );

  assert.ok(youhuOutro);
  const rels = buildGameplayRelationshipsForCapability(youhuOutro);

  for (const rel of rels) {
    assert.strictEqual(rel.effectValue, null);
    assert.notStrictEqual(rel.effectValue, 0);
  }
});

test('49. Unmodeled / Unknown: unknown capability does not produce speculative relationship', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      consumptionState: 'UNKNOWN',
      semanticStatus: 'UNKNOWN',
      parameter: 'UNRESOLVED_PARAMETER',
      value: { type: 'UNRESOLVED', reason: 'Indeterminate mechanic' }
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  assert.strictEqual(rels.length, 0);
});

// ============================================================================
// SUITE 11: RESOLUTION INTEGRATION (Tests 50-53)
// ============================================================================

test('50. Resolution: relationship applicability delegates to capability resolution semantics', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      element: 'Fusion',
      parameter: 'FUSION_DAMAGE_PERCENT',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const rel = rels.find((r) => r.relationshipType === 'AMPLIFIES_DAMAGE');
  assert.ok(rel);

  // Without context -> not applicable
  assert.strictEqual(isGameplayRelationshipApplicable(rel, {}), false);

  // With Fusion context -> applicable
  assert.strictEqual(isGameplayRelationshipApplicable(rel, { element: 'Fusion' }), true);
});

test('51. Resolution: missing context is not treated as applicable', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'SKILL_DAMAGE_PERCENT',
      parameterSafety: 'REQUIRES_CONTEXT',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const rel = rels.find((r) => r.relationshipType === 'AMPLIFIES_ACTION');
  assert.ok(rel);

  assert.strictEqual(isGameplayRelationshipApplicable(rel, undefined), false);
  assert.strictEqual(isGameplayRelationshipApplicable(rel, {}), false);
});

test('52. Resolution: mismatched context is not treated as applicable', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      element: 'Fusion',
      parameter: 'FUSION_DAMAGE_PERCENT',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const rel = rels.find((r) => r.relationshipType === 'AMPLIFIES_DAMAGE');
  assert.ok(rel);

  assert.strictEqual(isGameplayRelationshipApplicable(rel, { element: 'Glacio' }), false);
});

test('53. Resolution: correct context is applicable', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      element: 'Fusion',
      parameter: 'FUSION_DAMAGE_PERCENT',
      condition: { trigger: 'ON_OUTRO_SKILL' },
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
    })
  );

  const rels = buildGameplayRelationshipsForCapability(cap);
  const rel = rels.find((r) => r.relationshipType === 'AMPLIFIES_DAMAGE');
  assert.ok(rel);

  const context: RuntimeEvaluationContext = { element: 'Fusion', trigger: 'ON_OUTRO_SKILL' };
  assert.strictEqual(isGameplayRelationshipApplicable(rel, context), true);
});

// ============================================================================
// SUITE 12: QUERY API (Tests 54-60)
// ============================================================================

test('54. Queries: exact relationship type filtering', () => {
  const audit = auditProductionRelationships();
  const res = findRelationshipsByType(audit.relationships, 'NEXT_RESONATOR_INTERACTION');

  assert.strictEqual(res.length, 29);
  assert.strictEqual(res.every((r) => r.relationshipType === 'NEXT_RESONATOR_INTERACTION'), true);
});

test('55. Queries: entity filtering', () => {
  const audit = auditProductionRelationships();
  const res = findRelationshipsByEntity(audit.relationships, 'Youhu');

  assert.ok(res.length > 0);
  assert.strictEqual(res.every((r) => r.sourceEntityId === 'Youhu'), true);
});

test('56. Queries: target filtering', () => {
  const audit = auditProductionRelationships();
  const res = findRelationshipsByTargetKind(audit.relationships, 'ELEMENT');

  assert.strictEqual(res.length, 88);
  assert.strictEqual(res.every((r) => r.target.kind === 'ELEMENT'), true);
});

test('57. Queries: element filtering', () => {
  const audit = auditProductionRelationships();
  const res = findRelationshipsByElement(audit.relationships, 'Fusion');

  assert.ok(res.length > 0);
  assert.strictEqual(
    res.every((r) => r.target.kind === 'ELEMENT' && r.target.element === 'Fusion'),
    true
  );
});

test('58. Queries: action filtering', () => {
  const audit = auditProductionRelationships();
  const res = findRelationshipsByAction(audit.relationships, 'SKILL');

  assert.ok(res.length > 0);
  assert.strictEqual(
    res.every((r) => r.target.kind === 'ACTION' && r.target.actionType === 'SKILL'),
    true
  );
});

test('59. Queries: AND filter semantics', () => {
  const audit = auditProductionRelationships();
  const res = queryGameplayRelationships(audit.relationships, {
    relationshipType: 'NEXT_RESONATOR_INTERACTION',
    sourceEntityId: 'Youhu'
  });

  assert.strictEqual(res.length, 1);
  assert.strictEqual(res[0].sourceEntityId, 'Youhu');
  assert.strictEqual(res[0].relationshipType, 'NEXT_RESONATOR_INTERACTION');
});

test('60. Queries: deterministic query ordering', () => {
  const audit = auditProductionRelationships();
  const q1 = queryGameplayRelationships(audit.relationships, { category: 'OFFENSIVE' });
  const q2 = queryGameplayRelationships(audit.relationships, { category: 'OFFENSIVE' });

  assert.strictEqual(q1.length, q2.length);
  for (let i = 0; i < q1.length; i++) {
    assert.strictEqual(q1[i].relationshipId, q2[i].relationshipId);
  }
});

// ============================================================================
// SUITE 13: SAFETY & ZERO BYPASS AUDIT (Tests 61-70)
// ============================================================================

test('61. Safety: no parser bypass in relationships module', () => {
  const dir = path.resolve(process.cwd(), 'lib/engine/relationships');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

  for (const f of files) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.strictEqual(code.includes('parseDescription'), false);
    assert.strictEqual(code.includes('parseSkill'), false);
    assert.strictEqual(code.includes('parseResonance'), false);
  }
});

test('62. Safety: no SemanticEffect bypass', () => {
  const dir = path.resolve(process.cwd(), 'lib/engine/relationships');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

  for (const f of files) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.strictEqual(code.includes('SemanticEffect'), false);
  }
});

test('63. Safety: no raw description parsing', () => {
  const dir = path.resolve(process.cwd(), 'lib/engine/relationships');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

  for (const f of files) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.strictEqual(code.includes('originalDescription'), false);
  }
});

test('64. Safety: no Number() conversions in relationships files', () => {
  const dir = path.resolve(process.cwd(), 'lib/engine/relationships');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

  const numberCastingRegex = /(?<!\.)Number\s*\(/;
  for (const f of files) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.strictEqual(numberCastingRegex.test(code), false);
  }
});

test('65. Safety: no parseFloat() in relationships files', () => {
  const dir = path.resolve(process.cwd(), 'lib/engine/relationships');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

  for (const f of files) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.strictEqual(code.includes('parseFloat('), false);
  }
});

test('66. Safety: no parseInt() in relationships files', () => {
  const dir = path.resolve(process.cwd(), 'lib/engine/relationships');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

  for (const f of files) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.strictEqual(code.includes('parseInt('), false);
  }
});

test('67. Safety: no ?? 0 fallbacks in relationships files', () => {
  const dir = path.resolve(process.cwd(), 'lib/engine/relationships');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

  for (const f of files) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.strictEqual(code.includes('?? 0'), false);
  }
});

test('68. Safety: no || 0 fallbacks in relationships files', () => {
  const dir = path.resolve(process.cwd(), 'lib/engine/relationships');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

  for (const f of files) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.strictEqual(code.includes('|| 0'), false);
  }
});

test('69. Safety: no hard-coded gameplay values', () => {
  const dir = path.resolve(process.cwd(), 'lib/engine/relationships');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

  for (const f of files) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.strictEqual(code.includes('synergyScore'), false);
    assert.strictEqual(code.includes('tierList'), false);
    assert.strictEqual(code.includes('metaRanking'), false);
  }
});

test('70. Safety: no LLM or network usage', () => {
  const dir = path.resolve(process.cwd(), 'lib/engine/relationships');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

  for (const f of files) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.strictEqual(code.includes('fetch('), false);
    assert.strictEqual(code.includes('axios'), false);
    assert.strictEqual(code.includes('openai'), false);
    assert.strictEqual(code.includes('anthropic'), false);
  }
});

// ============================================================================
// SUITE 14: PRODUCTION RECONCILIATION & DETERMINISM (Tests 71-75)
// ============================================================================

test('71. Production: production relationship audit completes', () => {
  const audit = auditProductionRelationships();

  assert.strictEqual(audit.totalCapabilities, 292);
  assert.strictEqual(audit.totalRelationships, 735);
  assert.strictEqual(audit.uniqueRelationshipIds, 735);
  assert.strictEqual(audit.duplicateRelationshipIds, 0);
  assert.strictEqual(audit.capabilitiesWithRelationships, 292);
  assert.strictEqual(audit.capabilitiesWithoutRelationships, 0);
});

test('72. Production: all relationships have unique IDs', () => {
  const audit = auditProductionRelationships();
  const idSet = new Set<string>();

  for (const rel of audit.relationships) {
    assert.strictEqual(idSet.has(rel.relationshipId), false);
    idSet.add(rel.relationshipId);
  }
  assert.strictEqual(idSet.size, audit.relationships.length);
});

test('73. Production: all relationships have provenance', () => {
  const audit = auditProductionRelationships();

  for (const rel of audit.relationships) {
    assert.ok(rel.provenance);
    assert.ok(rel.provenance.entityId);
    assert.ok(rel.sourceFactIds.length > 0);
    assert.strictEqual(rel.patchVersion, '3.7');
    assert.ok(rel.evidence);
    assert.strictEqual(rel.evidence.sourceKind, 'CAPABILITY');
  }
});

test('74. Production: production build is deterministic', () => {
  const caps = auditProductionCapabilities().capabilities;
  const rels1 = buildGameplayRelationships(caps);
  const rels2 = buildGameplayRelationships(caps);

  assert.strictEqual(rels1.length, rels2.length);
  for (let i = 0; i < rels1.length; i++) {
    assert.strictEqual(rels1[i].relationshipId, rels2[i].relationshipId);
    assert.deepStrictEqual(rels1[i], rels2[i]);
  }
});

test('75. Production: repeated production builds produce identical output', () => {
  const audit1 = auditProductionRelationships();

  for (let i = 0; i < 10; i++) {
    const auditN = auditProductionRelationships();
    assert.strictEqual(auditN.totalRelationships, audit1.totalRelationships);
    assert.deepStrictEqual(auditN.relationshipsByType, audit1.relationshipsByType);
    assert.deepStrictEqual(auditN.relationshipsByCategory, audit1.relationshipsByCategory);
    assert.deepStrictEqual(auditN.relationshipsByTargetKind, audit1.relationshipsByTargetKind);
  }
});
