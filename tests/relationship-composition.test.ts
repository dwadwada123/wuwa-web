/**
 * Wuthering Waves Deterministic Relationship Composition & Interaction Evidence Test Suite
 * Phase 7 Step 4: Deterministic Relationship Composition & Interaction Evidence Layer
 *
 * Verifies that the Composition & Interaction Evidence Engine:
 * - Deterministically composes Step 3 relationships into immutable InteractionEvidence
 * - Exposes why interactions exist without computing synergy scores, weights, or rankings
 * - Strictly enforces patch isolation ('3.7') and rejects cross-patch data
 * - Preserves provenance, dimensions, and context requirements
 * - Strictly delegates applicability evaluation to Phase 7 Step 2 capability resolution
 * - Preserves UNMODELED mechanics with null effect values and fails closed for UNKNOWN
 * - Passes all required test specifications and static safety audits
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
import {
  buildGameplayRelationships,
  buildGameplayRelationshipsForCapability
} from '../lib/engine/relationships/builder.ts';
import { auditProductionRelationships } from '../lib/engine/relationships/audit.ts';
import {
  composeInteractionEvidence,
  composeInteractionEvidenceForCapability,
  composePairwiseInteractionEvidence,
  deriveInteractionEvidenceId
} from '../lib/engine/relationships/composition/composer.ts';
import type { GameplayRelationship } from '../lib/engine/relationships/types.ts';
import {
  isInteractionEvidenceApplicable,
  compareInteractionEvidence,
  isTargetEvidence,
  isActionEvidence,
  isElementEvidence,
  isOutroEvidence,
  isIntroEvidence,
  isNextResonatorEvidence,
  isCoordinatedAttackEvidence,
  isResourceEvidence,
  isDefensiveEvidence,
  isOffensiveEvidence,
  isPairwiseEvidence,
  hasExplicitPairwiseTarget
} from '../lib/engine/relationships/composition/predicates.ts';
import {
  queryInteractionEvidence,
  findEvidenceForCapability,
  findEvidenceForEntity,
  findEvidenceByType,
  findEvidenceBetweenCapabilities
} from '../lib/engine/relationships/composition/repository.ts';
import { auditProductionInteractionEvidence } from '../lib/engine/relationships/composition/audit.ts';

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
// SUITE 1: DETERMINISM, ORDERING & INVARIANTS (Tests 1-8)
// ============================================================================

test('1. Core: deterministic generation across runs', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      element: 'Fusion',
      parameter: 'FUSION_DAMAGE_PERCENT',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
    })
  );
  const rels = buildGameplayRelationshipsForCapability(cap);

  const run1 = composeInteractionEvidenceForCapability(cap, rels);
  const run2 = composeInteractionEvidenceForCapability(cap, rels);

  assert.deepStrictEqual(run1, run2);
});

test('2. Core: repeated generation produces identical output', () => {
  const cap = buildGameplayCapability(createMockFact({ parameter: 'ATK_PERCENT' }));
  const rels = buildGameplayRelationshipsForCapability(cap);

  const ev1 = composeInteractionEvidence([cap], rels);
  const ev2 = composeInteractionEvidence([cap], rels);

  assert.strictEqual(ev1.length, ev2.length);
  assert.deepStrictEqual(ev1, ev2);
});

test('3. Core: stable and deterministic IDs', () => {
  const id1 = deriveInteractionEvidenceId(
    '3.7',
    'cap:changli:skill',
    undefined,
    'ELEMENT_EVIDENCE',
    [{ kind: 'ELEMENT', value: 'Fusion' }],
    ['rel:1', 'rel:2']
  );
  const id2 = deriveInteractionEvidenceId(
    '3.7',
    'cap:changli:skill',
    undefined,
    'ELEMENT_EVIDENCE',
    [{ kind: 'ELEMENT', value: 'Fusion' }],
    ['rel:2', 'rel:1']
  );

  assert.strictEqual(id1, id2);
  assert.strictEqual(id1.startsWith('evi:3.7:'), true);
});

test('4. Core: canonical ordering of composed output', () => {
  const capA = buildGameplayCapability(createMockFact({ entityId: 'A', parameter: 'ATK_PERCENT' }));
  const capB = buildGameplayCapability(createMockFact({ entityId: 'B', parameter: 'ATK_PERCENT' }));
  const rels = [
    ...buildGameplayRelationshipsForCapability(capB),
    ...buildGameplayRelationshipsForCapability(capA)
  ];

  const composed = composeInteractionEvidence([capB, capA], rels);
  assert.strictEqual(composed.length >= 2, true);
  assert.strictEqual(composed[0].sourceEntityId, 'A');
  assert.strictEqual(composed[1].sourceEntityId, 'B');
});

test('5. Core: duplicate elimination by canonical identity', () => {
  const cap = buildGameplayCapability(createMockFact({ parameter: 'ATK_PERCENT' }));
  const rels = buildGameplayRelationshipsForCapability(cap);

  const composed = composeInteractionEvidence([cap, cap], [...rels, ...rels]);
  const seenIds = new Set<string>();

  for (const ev of composed) {
    assert.strictEqual(seenIds.has(ev.id), false);
    seenIds.add(ev.id);
  }
});

test('6. Core: provenance preservation', () => {
  const cap = buildGameplayCapability(createMockFact({ entityId: 'changli', sourceCode: 'skill' }));
  const rels = buildGameplayRelationshipsForCapability(cap);

  const composed = composeInteractionEvidenceForCapability(cap, rels);
  assert.ok(composed.length > 0);

  for (const ev of composed) {
    assert.strictEqual(ev.sourceEntityId, 'changli');
    assert.strictEqual(ev.sourceCode, 'skill');
    assert.strictEqual(ev.provenance.entityId, 'mock_entity');
    assert.ok(ev.sourceFactIds.length > 0);
  }
});

test('7. Core: patch isolation enforces 3.7', () => {
  const cap = buildGameplayCapability(createMockFact());
  const rels = buildGameplayRelationshipsForCapability(cap);

  const composed = composeInteractionEvidence([cap], rels, '3.7');
  for (const ev of composed) {
    assert.strictEqual(ev.patchVersion, '3.7');
  }
});

test('8. Core: cross-patch rejection fails closed', () => {
  const cap = buildGameplayCapability(createMockFact());
  const badCap = { ...cap, patchVersion: '3.6' as any };

  assert.throws(() => {
    composeInteractionEvidence([badCap], []);
  }, /cross-patch capability/);
});

// ============================================================================
// SUITE 2: EVIDENCE TAXONOMY & MECHANICAL TYPES (Tests 9-18)
// ============================================================================

test('9. Evidence: TARGET_EVIDENCE for standalone targeting', () => {
  const cap = buildGameplayCapability(createMockFact({ target: 'TEAM' }));
  const rels = buildGameplayRelationshipsForCapability(cap);

  const composed = composeInteractionEvidenceForCapability(cap, rels);
  assert.ok(composed.some((e) => e.target.kind === 'TARGET_CLASS'));
});

test('10. Evidence: ACTION_EVIDENCE for skill damage amplification', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'SKILL_DAMAGE_PERCENT',
      parameterSafety: 'REQUIRES_CONTEXT',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      value: { type: 'EXACT', value: 25, unit: 'PERCENT' }
    })
  );
  const rels = buildGameplayRelationshipsForCapability(cap);

  const composed = composeInteractionEvidenceForCapability(cap, rels);
  const actEv = composed.find((e) => isActionEvidence(e));

  assert.ok(actEv);
  assert.strictEqual(actEv.actionType, 'SKILL');
  assert.strictEqual(actEv.category, 'ACTION');
  assert.strictEqual(actEv.relationshipIds.length >= 2, true); // Combines AMPLIFIES_ACTION + ACTION_MATCH
});

test('11. Evidence: ELEMENT_EVIDENCE for elemental damage amplification', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      element: 'Fusion',
      parameter: 'FUSION_DAMAGE_PERCENT',
      category: 'DMG_AMPLIFY',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
    })
  );
  const rels = buildGameplayRelationshipsForCapability(cap);

  const composed = composeInteractionEvidenceForCapability(cap, rels);
  const elemEv = composed.find((e) => isElementEvidence(e));

  assert.ok(elemEv);
  assert.strictEqual(elemEv.element, 'Fusion');
  assert.strictEqual(elemEv.category, 'ELEMENTAL');
  assert.strictEqual(elemEv.relationshipIds.length >= 2, true); // Combines AMPLIFIES_DAMAGE + ELEMENT_MATCH
});

test('12. Evidence: OUTRO_EVIDENCE for standalone Outro trigger', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      sourceCode: 'OUTRO_SKILL',
      target: 'SELF',
      condition: { trigger: 'ON_OUTRO_SKILL' },
      consumptionState: 'CONSUMABLE_CONTEXTUAL'
    })
  );
  const rels = buildGameplayRelationshipsForCapability(cap);

  const composed = composeInteractionEvidenceForCapability(cap, rels);
  const outroEv = composed.find((e) => isOutroEvidence(e));

  assert.ok(outroEv);
  assert.strictEqual(outroEv.category, 'TRIGGER');
  assert.strictEqual(outroEv.actionType, 'OUTRO');
});

test('13. Evidence: INTRO_EVIDENCE for Intro trigger', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      sourceCode: 'INTRO_SKILL',
      condition: { trigger: 'ON_INTRO_SKILL' },
      consumptionState: 'CONSUMABLE_CONTEXTUAL'
    })
  );
  const rels = buildGameplayRelationshipsForCapability(cap);

  const composed = composeInteractionEvidenceForCapability(cap, rels);
  const introEv = composed.find((e) => isIntroEvidence(e));

  assert.ok(introEv);
  assert.strictEqual(introEv.category, 'TRIGGER');
  assert.strictEqual(introEv.actionType, 'INTRO');
});

test('14. Evidence: NEXT_RESONATOR_EVIDENCE combines Outro and Next Resonator target', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      sourceCode: 'OUTRO_SKILL',
      target: 'NEXT_RESONATOR',
      condition: { trigger: 'ON_OUTRO_SKILL' },
      consumptionState: 'CONSUMABLE_CONTEXTUAL'
    })
  );
  const rels = buildGameplayRelationshipsForCapability(cap);

  const composed = composeInteractionEvidenceForCapability(cap, rels);
  const nextEv = composed.find((e) => isNextResonatorEvidence(e));

  assert.ok(nextEv);
  assert.strictEqual(nextEv.category, 'TRANSITION');
  assert.strictEqual(nextEv.actionType, 'OUTRO');
  assert.strictEqual(nextEv.relationshipIds.length >= 2, true); // NEXT_RESONATOR_INTERACTION + OUTRO_INTERACTION
});

test('15. Evidence: COORDINATED_ATTACK_EVIDENCE for coordinated attack mechanic', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'COORDINATED_ATTACK_DAMAGE_PERCENT',
      value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
    })
  );
  const rels = buildGameplayRelationshipsForCapability(cap);

  const composed = composeInteractionEvidenceForCapability(cap, rels);
  const coordEv = composed.find((e) => isCoordinatedAttackEvidence(e));

  assert.ok(coordEv);
  assert.strictEqual(coordEv.category, 'MECHANICAL');
  assert.strictEqual(coordEv.actionType, 'COORDINATED');
});

test('16. Evidence: RESOURCE_EVIDENCE for energy regeneration', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'ENERGY_REGEN_PERCENT',
      category: 'STAT_BUFF',
      value: { type: 'EXACT', value: 15, unit: 'PERCENT' }
    })
  );
  const rels = buildGameplayRelationshipsForCapability(cap);

  const composed = composeInteractionEvidenceForCapability(cap, rels);
  const resEv = composed.find((e) => isResourceEvidence(e));

  assert.ok(resEv);
  assert.strictEqual(resEv.category, 'RESOURCE');
  assert.strictEqual(resEv.effectValue, 15);
});

test('17. Evidence: DEFENSIVE_EVIDENCE for healing and shield provision', () => {
  const healCap = buildGameplayCapability(
    createMockFact({
      category: 'HEALING',
      parameter: 'UNRESOLVED_PARAMETER',
      value: { type: 'EXACT', value: 2000, unit: 'FLAT' }
    })
  );
  const healRels = buildGameplayRelationshipsForCapability(healCap);
  const healEv = composeInteractionEvidenceForCapability(healCap, healRels).find((e) => isDefensiveEvidence(e));

  assert.ok(healEv);
  assert.strictEqual(healEv.category, 'DEFENSIVE');
  assert.strictEqual(healEv.effectValue, 2000);
});

test('18. Evidence: OFFENSIVE_EVIDENCE for ATK amplification', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'ATK_PERCENT',
      category: 'STAT_BUFF',
      value: { type: 'EXACT', value: 18, unit: 'PERCENT' }
    })
  );
  const rels = buildGameplayRelationshipsForCapability(cap);

  const composed = composeInteractionEvidenceForCapability(cap, rels);
  const offEv = composed.find((e) => isOffensiveEvidence(e));

  assert.ok(offEv);
  assert.strictEqual(offEv.category, 'OFFENSIVE');
  assert.strictEqual(offEv.effectValue, 18);
});

// ============================================================================
// SUITE 3: UNMODELED & UNKNOWN INTEGRITY (Tests 19-21)
// ============================================================================

test('19. Unmodeled / Unknown: UNMODELED preserves structural evidence without fabricated value', () => {
  const prodCaps = auditProductionCapabilities().capabilities;
  const youhuOutro = prodCaps.find((c) => c.entityId === 'Youhu' && c.sourceCode === 'OUTRO_SKILL');

  assert.ok(youhuOutro);
  const prodRels = auditProductionRelationships().relationships;
  const composed = composeInteractionEvidenceForCapability(youhuOutro, prodRels);

  assert.ok(composed.length > 0);
  for (const ev of composed) {
    assert.strictEqual(ev.status, 'UNMODELED');
    assert.strictEqual(ev.effectValue, null); // Strictly null, NEVER 0!
  }
});

test('20. Unmodeled / Unknown: UNKNOWN fails closed with zero evidence', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      consumptionState: 'UNKNOWN',
      value: { type: 'UNRESOLVED', reason: 'Unknown mechanic' }
    })
  );
  const rels = buildGameplayRelationshipsForCapability(cap);

  const composed = composeInteractionEvidenceForCapability(cap, rels);
  assert.strictEqual(composed.length, 0);
});

test('21. Unmodeled / Unknown: NOT_APPLICABLE produces zero active interaction evidence', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      consumptionState: 'NOT_APPLICABLE',
      value: { type: 'UNRESOLVED', reason: 'Non-combat flavor' }
    })
  );
  const rels = buildGameplayRelationshipsForCapability(cap);

  const composed = composeInteractionEvidenceForCapability(cap, rels);
  assert.strictEqual(composed.length, 0);
});

// ============================================================================
// SUITE 4: RESOLUTION INTEGRATION & APPLICABILITY (Tests 22-27)
// ============================================================================

test('22. Applicability: delegates to Step 2 capability resolution', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      element: 'Fusion',
      parameter: 'FUSION_DAMAGE_PERCENT',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
    })
  );
  const rels = buildGameplayRelationshipsForCapability(cap);
  const ev = composeInteractionEvidenceForCapability(cap, rels).find((e) => isElementEvidence(e))!;

  assert.ok(ev);

  // Without context -> not applicable
  const appWithoutContext = isInteractionEvidenceApplicable(ev, {});
  assert.strictEqual(appWithoutContext.isApplicable, false);
  assert.strictEqual(appWithoutContext.status, 'MISSING_CONTEXT');

  // With matching Fusion context -> applicable
  const appWithContext = isInteractionEvidenceApplicable(ev, { element: 'Fusion' });
  assert.strictEqual(appWithContext.isApplicable, true);
  assert.strictEqual(appWithContext.status, 'APPLICABLE');
});

test('23. Applicability: missing context returns MISSING_CONTEXT', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'SKILL_DAMAGE_PERCENT',
      parameterSafety: 'REQUIRES_CONTEXT',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
    })
  );
  const rels = buildGameplayRelationshipsForCapability(cap);
  const ev = composeInteractionEvidenceForCapability(cap, rels).find((e) => isActionEvidence(e))!;

  const res = isInteractionEvidenceApplicable(ev, undefined);
  assert.strictEqual(res.isApplicable, false);
  assert.strictEqual(res.status, 'MISSING_CONTEXT');
});

test('24. Applicability: mismatched context returns CONTEXT_MISMATCH', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      element: 'Fusion',
      parameter: 'FUSION_DAMAGE_PERCENT',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
    })
  );
  const rels = buildGameplayRelationshipsForCapability(cap);
  const ev = composeInteractionEvidenceForCapability(cap, rels).find((e) => isElementEvidence(e))!;

  const res = isInteractionEvidenceApplicable(ev, { element: 'Glacio' });
  assert.strictEqual(res.isApplicable, false);
  assert.strictEqual(res.status, 'CONTEXT_MISMATCH');
});

test('25. Elements: exact element matching preserved', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      element: 'Glacio',
      parameter: 'GLACIO_DAMAGE_PERCENT',
      category: 'DMG_AMPLIFY'
    })
  );
  const rels = buildGameplayRelationshipsForCapability(cap);
  const ev = composeInteractionEvidenceForCapability(cap, rels).find((e) => isElementEvidence(e))!;

  assert.ok(ev);
  assert.strictEqual(ev.element, 'Glacio');
});

test('26. Elements: All-element semantics preserved', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      element: 'All',
      parameter: 'ALL_ATTRIBUTE_DAMAGE_PERCENT',
      category: 'DMG_AMPLIFY'
    })
  );
  const rels = buildGameplayRelationshipsForCapability(cap);
  const ev = composeInteractionEvidenceForCapability(cap, rels).find((e) => isElementEvidence(e))!;

  assert.ok(ev);
  assert.strictEqual(ev.element, 'All');
});

test('27. Elements: NONE does not produce elemental evidence', () => {
  const cap = buildGameplayCapability(createMockFact({ element: 'NONE', parameter: 'ATK_PERCENT' }));
  const rels = buildGameplayRelationshipsForCapability(cap);

  const composed = composeInteractionEvidenceForCapability(cap, rels);
  assert.strictEqual(composed.some((e) => isElementEvidence(e)), false);
});

// ============================================================================
// SUITE 5: SAFETY & ZERO BYPASS AUDIT (Tests 28-34)
// ============================================================================

test('28. Safety: no fabricated numeric values (null preserved, never 0)', () => {
  const audit = auditProductionInteractionEvidence();
  for (const ev of audit.evidence) {
    if (ev.status === 'UNMODELED') {
      assert.strictEqual(ev.effectValue, null);
    }
  }
});

test('29. Safety: no scoring or ranking fields exist in evidence contract', () => {
  const audit = auditProductionInteractionEvidence();
  const forbiddenKeys = [
    'score',
    'synergyScore',
    'compatibilityScore',
    'teamScore',
    'priority',
    'weight',
    'rank',
    'tier',
    'meta',
    'DPS',
    'damageScore',
    'rotationScore'
  ];

  for (const ev of audit.evidence) {
    for (const key of forbiddenKeys) {
      assert.strictEqual(key in ev, false);
    }
  }
});

test('30. Safety: no raw description access in composition module', () => {
  const dir = path.resolve(process.cwd(), 'lib/engine/relationships/composition');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

  for (const f of files) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.strictEqual(code.includes('originalDescription'), false);
  }
});

test('31. Safety: no parser bypass in composition module', () => {
  const dir = path.resolve(process.cwd(), 'lib/engine/relationships/composition');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

  for (const f of files) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.strictEqual(code.includes('parseDescription'), false);
    assert.strictEqual(code.includes('parseSkill'), false);
    assert.strictEqual(code.includes('parseResonance'), false);
    assert.strictEqual(code.includes('SemanticEffect'), false);
  }
});

test('32. Safety: no network or LLM usage in composition module', () => {
  const dir = path.resolve(process.cwd(), 'lib/engine/relationships/composition');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

  for (const f of files) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.strictEqual(code.includes('fetch('), false);
    assert.strictEqual(code.includes('axios'), false);
    assert.strictEqual(code.includes('openai'), false);
    assert.strictEqual(code.includes('anthropic'), false);
  }
});

test('33. Safety: no randomness in composition module', () => {
  const dir = path.resolve(process.cwd(), 'lib/engine/relationships/composition');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

  for (const f of files) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.strictEqual(code.includes('Math.random'), false);
    assert.strictEqual(code.includes('randomUUID'), false);
  }
});

test('34. Safety: no timestamp-based IDs in composition module', () => {
  const dir = path.resolve(process.cwd(), 'lib/engine/relationships/composition');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

  for (const f of files) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.strictEqual(code.includes('Date.now'), false);
    assert.strictEqual(code.includes('new Date()'), false);
  }
});

// ============================================================================
// SUITE 6: PRODUCTION COMPOSITION & AUDIT (Tests 35-40)
// ============================================================================

test('35. Production: complete production composition runs without error', () => {
  const audit = auditProductionInteractionEvidence();
  assert.strictEqual(audit.totalInputCapabilities, 292);
  assert.strictEqual(audit.totalInputRelationships, 735);
  assert.strictEqual(audit.totalEvidence, 365);
  assert.strictEqual(audit.uniqueEvidenceIds, 365);
  assert.strictEqual(audit.duplicateEvidenceIds, 0);
});

test('36. Production: audit metrics pass all verification invariants', () => {
  const audit = auditProductionInteractionEvidence();
  assert.ok(audit.evidenceInvolvingNextResonator > 0);
  assert.ok(audit.evidenceInvolvingOutro > 0);
  assert.ok(audit.evidenceInvolvingIntro > 0);
  assert.ok(audit.evidenceInvolvingElement > 0);
  assert.ok(audit.evidenceInvolvingAction > 0);
  assert.strictEqual(audit.evidenceInvolvingUnmodeled, 3);
  assert.strictEqual(audit.evidenceWithoutNumericValue, 3);
  assert.strictEqual(audit.evidenceWithNumericValue, 362);
});

// ============================================================================
// SUITE 6: REMEDIATION & EXPLICIT PAIRWISE BOUNDARY (Tests 37-50)
// ============================================================================

test('37. Remediation 1 & 3: OUTRO does not automatically pair with arbitrary INTRO', () => {
  const prodCaps = auditProductionCapabilities().capabilities;
  const prodRels = auditProductionRelationships().relationships;

  const mortefiOutro = prodCaps.find((c) => c.entityId === 'Mortefi' && c.sourceCode === 'OUTRO_SKILL')!;
  const jiyanIntro = prodCaps.find((c) => c.entityId === 'Jiyan' && c.actionType === 'INTRO')!;

  assert.ok(mortefiOutro);
  assert.ok(jiyanIntro);

  // Without explicit target linkage in Step 3 relationships, Mortefi Outro + Jiyan Intro MUST produce ZERO pairwise evidence
  const pairwise = findEvidenceBetweenCapabilities(mortefiOutro, jiyanIntro, prodRels, prodRels);
  assert.strictEqual(pairwise.length, 0);
});

test('38. Remediation 2 & 4: matching ACTION does not automatically create pairwise evidence', () => {
  const prodCaps = auditProductionCapabilities().capabilities;
  const prodRels = auditProductionRelationships().relationships;

  const mortefiOutro = prodCaps.find((c) => c.entityId === 'Mortefi' && c.sourceCode === 'OUTRO_SKILL')!;
  const danjinHeavy = prodCaps.find((c) => c.entityId === 'Danjin' && c.actionType === 'HEAVY')!;

  assert.ok(mortefiOutro);
  assert.ok(danjinHeavy);

  // Mortefi amplifies Heavy Attack, and Danjin performs Heavy Attack.
  // This is a dimensional match, NOT an explicit character target.
  // MUST produce ZERO pairwise evidence.
  const pairwise = findEvidenceBetweenCapabilities(mortefiOutro, danjinHeavy, prodRels, prodRels);
  assert.strictEqual(pairwise.length, 0);
});

test('39. Remediation 2 & 5: matching ELEMENT does not automatically create pairwise evidence', () => {
  const prodCaps = auditProductionCapabilities().capabilities;
  const prodRels = auditProductionRelationships().relationships;

  const yinlinOutro = prodCaps.find((c) => c.entityId === 'Yinlin' && c.sourceCode === 'OUTRO_SKILL')!;
  const calcharoCap = prodCaps.find((c) => c.entityId === 'Calcharo' && c.element === 'Electro')!;

  assert.ok(yinlinOutro);
  assert.ok(calcharoCap);

  // Yinlin amplifies Electro damage, and Calcharo has Electro element.
  // Shared ELEMENT alone MUST NOT produce pairwise evidence.
  const pairwise = findEvidenceBetweenCapabilities(yinlinOutro, calcharoCap, prodRels, prodRels);
  assert.strictEqual(pairwise.length, 0);
});

test('40. Remediation 2: matching trigger does not automatically create pairwise evidence', () => {
  const prodCaps = auditProductionCapabilities().capabilities;
  const prodRels = auditProductionRelationships().relationships;

  const verinaOutro = prodCaps.find((c) => c.entityId === 'Verina' && c.sourceCode === 'OUTRO_SKILL')!;
  const jiyanIntro = prodCaps.find((c) => c.entityId === 'Jiyan' && c.actionType === 'INTRO')!;

  assert.ok(verinaOutro);
  assert.ok(jiyanIntro);

  const pairwise = findEvidenceBetweenCapabilities(verinaOutro, jiyanIntro, prodRels, prodRels);
  assert.strictEqual(pairwise.length, 0);
});

test('41. Remediation 5 & 6: explicit target linkage does create pairwise evidence', () => {
  const prodCaps = auditProductionCapabilities().capabilities;
  const mortefiOutro = prodCaps.find((c) => c.entityId === 'Mortefi' && c.sourceCode === 'OUTRO_SKILL')!;
  const jiyanIntro = prodCaps.find((c) => c.entityId === 'Jiyan' && c.actionType === 'INTRO')!;

  // 1. Synthetic relationship with explicit CAPABILITY target
  const explicitCapRel: GameplayRelationship = {
    relationshipId: 'rel:3.7:explicit_cap_link',
    patchVersion: '3.7',
    sourceCapabilityId: mortefiOutro.capabilityId,
    sourceEntityId: mortefiOutro.entityId,
    sourceCode: mortefiOutro.sourceCode,
    relationshipType: 'AMPLIFIES_ACTION',
    category: 'ACTION',
    target: { kind: 'CAPABILITY', capabilityId: jiyanIntro.capabilityId },
    actionType: 'HEAVY',
    effectValue: mortefiOutro.numericValue,
    sourceFactIds: mortefiOutro.factIds,
    provenance: mortefiOutro.provenance,
    evidence: {
      sourceKind: 'CAPABILITY',
      factIds: mortefiOutro.factIds,
      capabilityIds: [mortefiOutro.capabilityId],
      reasonCode: 'EXPLICIT_PAIRWISE_TARGET_LINKAGE'
    }
  };

  assert.strictEqual(hasExplicitPairwiseTarget(explicitCapRel, jiyanIntro), true);
  assert.strictEqual(hasExplicitPairwiseTarget(explicitCapRel, mortefiOutro), false);

  const pairwiseCap = composePairwiseInteractionEvidence(mortefiOutro, jiyanIntro, [explicitCapRel], []);
  assert.strictEqual(pairwiseCap.length, 1);
  assert.strictEqual(pairwiseCap[0].targetCapabilityId, jiyanIntro.capabilityId);
  assert.strictEqual(pairwiseCap[0].targetEntityId, jiyanIntro.entityId);
  assert.strictEqual(isPairwiseEvidence(pairwiseCap[0]), true);
  assert.strictEqual(pairwiseCap[0].reasonCodes.includes('EXPLICIT_PAIRWISE_TARGET_LINKAGE'), true);

  // 2. Synthetic relationship with explicit ENTITY target
  const explicitEntityRel: GameplayRelationship = {
    relationshipId: 'rel:3.7:explicit_ent_link',
    patchVersion: '3.7',
    sourceCapabilityId: mortefiOutro.capabilityId,
    sourceEntityId: mortefiOutro.entityId,
    sourceCode: mortefiOutro.sourceCode,
    relationshipType: 'AMPLIFIES_DAMAGE',
    category: 'ELEMENTAL',
    target: { kind: 'ENTITY', entityId: 'Jiyan' },
    element: 'Aero',
    effectValue: mortefiOutro.numericValue,
    sourceFactIds: mortefiOutro.factIds,
    provenance: mortefiOutro.provenance,
    evidence: {
      sourceKind: 'CAPABILITY',
      factIds: mortefiOutro.factIds,
      capabilityIds: [mortefiOutro.capabilityId],
      reasonCode: 'EXPLICIT_PAIRWISE_TARGET_LINKAGE'
    }
  };

  assert.strictEqual(hasExplicitPairwiseTarget(explicitEntityRel, jiyanIntro), true);
  const pairwiseEnt = composePairwiseInteractionEvidence(mortefiOutro, jiyanIntro, [explicitEntityRel], []);
  assert.strictEqual(pairwiseEnt.length, 1);
  assert.strictEqual(pairwiseEnt[0].targetCapabilityId, jiyanIntro.capabilityId);
  assert.strictEqual(pairwiseEnt[0].targetEntityId, 'Jiyan');
  assert.strictEqual(isPairwiseEvidence(pairwiseEnt[0]), true);
});

test('42. Remediation 7: single-capability evidence remains available in production', () => {
  const audit = auditProductionInteractionEvidence();
  assert.strictEqual(audit.totalEvidence, 365);
  assert.strictEqual(audit.singleCapabilityEvidence, 365);
  assert.strictEqual(audit.pairwiseEvidence, 0);
  assert.strictEqual(audit.explicitTargetPairwiseEvidence, 0);

  // Specific single-capability records remain fully present
  const mortefiSingle = audit.evidence.filter((e) => e.sourceEntityId === 'Mortefi');
  assert.ok(mortefiSingle.length > 0);
  assert.ok(mortefiSingle.some((e) => isNextResonatorEvidence(e)));
  assert.ok(mortefiSingle.some((e) => isActionEvidence(e)));

  const jiyanSingle = audit.evidence.filter((e) => e.sourceEntityId === 'Jiyan');
  assert.ok(jiyanSingle.length > 0);
  assert.ok(jiyanSingle.some((e) => isIntroEvidence(e)));
});

test('43. Remediation 8: pairwise target fields are undefined unless explicitly proven', () => {
  const audit = auditProductionInteractionEvidence();
  assert.strictEqual(audit.evidenceWithTargetCapabilityId, 0);
  assert.strictEqual(audit.evidenceWithoutTargetCapabilityId, 365);

  for (const ev of audit.evidence) {
    assert.strictEqual(ev.targetCapabilityId, undefined);
    assert.strictEqual(isPairwiseEvidence(ev), false);
  }
});

test('44. Remediation 11: production audit reports zero dimensional pairwise inference', () => {
  const audit = auditProductionInteractionEvidence();
  assert.strictEqual(audit.actionOnlyPairwiseInference, 0);
  assert.strictEqual(audit.elementOnlyPairwiseInference, 0);
  assert.strictEqual(audit.outroIntroOnlyPairwiseInference, 0);
});

test('45. Repository: queries filter accurately across multiple dimensions', () => {
  const audit = auditProductionInteractionEvidence();
  const filtered = queryInteractionEvidence(audit.evidence, {
    category: 'TRANSITION',
    involvesNextResonator: true
  });

  assert.strictEqual(filtered.length, 29);
  for (const ev of filtered) {
    assert.strictEqual(ev.category, 'TRANSITION');
    assert.strictEqual(ev.evidenceType, 'NEXT_RESONATOR_EVIDENCE');
  }
});

test('46. Production: repeated audits yield 100% byte-for-byte identical results', () => {
  const audit1 = auditProductionInteractionEvidence();
  const audit2 = auditProductionInteractionEvidence();

  assert.strictEqual(audit1.totalEvidence, audit2.totalEvidence);
  for (let i = 0; i < audit1.evidence.length; i++) {
    assert.strictEqual(audit1.evidence[i].id, audit2.evidence[i].id);
    assert.deepStrictEqual(audit1.evidence[i], audit2.evidence[i]);
  }
});
