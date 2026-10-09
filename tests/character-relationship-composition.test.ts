/**
 * Wuthering Waves Character Relationship Composition & Interaction Evidence Contract Tests
 * Phase 7 Step 17: Deterministic Character Relationship Composition & Interaction Evidence Contract
 *
 * Verifies all Contract, Patch Isolation, Character Validation, Directionality, Self-Interaction,
 * Deduplication, Conflict Handling, Provenance, Conditions, Status, Boundaries, Safety,
 * and Determinism requirements.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  CHARACTER_INTERACTION_RULE_VERSION,
  VALID_CHARACTER_INTERACTION_TYPES,
  VALID_CHARACTER_INTERACTION_CATEGORIES,
  VALID_CHARACTER_INTERACTION_STATUSES,
  INTERACTION_REASON_CODES,
  createDefaultStep17Provenance
} from '../lib/engine/character-interactions/rules.ts';
import {
  deriveConditionKey,
  deriveCharacterInteractionId,
  isInteractionAuthoritative,
  isInteractionUnknown,
  isInteractionUnmodeled,
  isInteractionNotApplicable,
  isInteractionConflicted,
  compareCharacterInteractionEvidence,
  matchesCharacterInteractionFilter
} from '../lib/engine/character-interactions/predicates.ts';
import {
  composeCharacterInteractions
} from '../lib/engine/character-interactions/composer.ts';
import {
  getCharacterInteractionCompositionResult,
  getCharacterInteractions,
  getCharacterInteraction,
  getInteractionsForCharacter,
  getAuthoritativeInteractions,
  getConflictedInteractions,
  queryCharacterInteractions,
  clearCharacterInteractionCache
} from '../lib/engine/character-interactions/repository.ts';
import {
  assertNoProhibitedCharacterInteractionKeys,
  auditCharacterInteractions
} from '../lib/engine/character-interactions/audit.ts';
import {
  explainCharacterInteraction
} from '../lib/engine/character-interactions/index.ts';
import type {
  CharacterInteractionCompositionInput,
  ApprovedCharacterRelationship,
  ApprovedInteractionEvidence
} from '../lib/engine/character-interactions/types.ts';

// Upstream rule version imports
import { CHARACTER_PAIR_SYNERGY_RULE_VERSION } from '../lib/engine/relationships/character-pairs/synergy/rules.ts';
import { TEAM_COMPOSITION_RULE_VERSION } from '../lib/engine/team-composition/rules.ts';
import { TEAM_COMPOSITION_EVALUATION_RULE_VERSION } from '../lib/engine/team-composition/evaluation/rules.ts';
import { TEAM_COMPOSITION_RANKING_RULE_VERSION } from '../lib/engine/team-composition/ranking/rules.ts';
import { OWNED_ROSTER_ELIGIBILITY_RULE_VERSION } from '../lib/engine/roster/rules.ts';
import { RESONATOR_INVESTMENT_RULE_VERSION } from '../lib/engine/investment/rules.ts';
import { TEAM_BUILD_READINESS_RULE_VERSION } from '../lib/engine/team-composition/readiness/rules.ts';
import { INVESTMENT_EFFECT_RESOLUTION_RULE_VERSION } from '../lib/engine/investment/effects/rules.ts';
import { CHARACTER_EVALUATION_RULE_VERSION } from '../lib/engine/character-evaluation/rules.ts';

const EXPECTED_DATASET_SHA256 = '7abb7cb3b5290dee9e22cba83df4c974e2befd6639fbb7f04041adedc11a68e9';

// Helper to create test relationship
function makeTestRelationship(overrides: Partial<ApprovedCharacterRelationship> = {}): ApprovedCharacterRelationship {
  return {
    id: 'rel:test:1',
    patchVersion: '3.7',
    sourceCharacterId: 'Sanhua',
    targetCharacterId: 'Encore',
    relationshipType: 'DAMAGE_AMPLIFICATION',
    category: 'OFFENSIVE',
    effectValue: 0.38,
    unit: 'PERCENT',
    provenance: {
      entityId: 'Sanhua',
      entityName: 'Sanhua',
      sourceType: 'RESONATOR_ABILITY',
      sourceCode: 'OUTRO_SKILL',
      patchVersion: '3.7',
      sourceProvenance: 'Official Test Provenance',
      originalDescription: 'Basic Attack DMG Amplified by 38%'
    },
    ...overrides
  };
}

// Helper to create test interaction
function makeTestInteraction(overrides: Partial<ApprovedInteractionEvidence> = {}): ApprovedInteractionEvidence {
  return {
    id: 'evi:test:1',
    patchVersion: '3.7',
    sourceCharacterId: 'Verina',
    targetCharacterId: 'Jiyan',
    interactionType: 'DAMAGE_AMPLIFICATION',
    category: 'OFFENSIVE',
    evidenceStatus: 'AUTHORITATIVE',
    effectValue: 0.15,
    unit: 'PERCENT',
    provenance: {
      entityId: 'Verina',
      entityName: 'Verina',
      sourceType: 'RESONATOR_ABILITY',
      sourceCode: 'OUTRO_SKILL',
      patchVersion: '3.7',
      sourceProvenance: 'Official Test Provenance',
      originalDescription: 'All-Type DMG Amplified by 15%'
    },
    ...overrides
  };
}

// =========================================================================
// 1. CONTRACT & SCHEMA
// =========================================================================
test('Step 17 Contract: ruleVersion is strictly 7.17.1', () => {
  assert.equal(CHARACTER_INTERACTION_RULE_VERSION, '7.17.1');
});

test('Step 17 Contract: composition result contains ruleVersion 7.17.1 and patchId 3.7', () => {
  const result = composeCharacterInteractions();
  assert.equal(result.ruleVersion, '7.17.1');
  assert.equal(result.patchId, '3.7');
  assert.ok(Array.isArray(result.interactions));
  assert.ok(result.summary);
  assert.ok(result.audit);
});

test('Step 17 Contract: every composed interaction has required schema fields', () => {
  const result = composeCharacterInteractions();
  for (const item of result.interactions) {
    assert.ok(item.id.startsWith('char-interaction:3.7:'));
    assert.equal(item.patchVersion, '3.7');
    assert.equal(item.ruleVersion, '7.17.1');
    assert.ok(item.sourceCharacterId);
    assert.ok(item.targetCharacterId);
    assert.ok(VALID_CHARACTER_INTERACTION_TYPES.includes(item.interactionType));
    assert.ok(VALID_CHARACTER_INTERACTION_CATEGORIES.includes(item.category));
    assert.ok(VALID_CHARACTER_INTERACTION_STATUSES.includes(item.evidenceStatus));
    assert.ok(Array.isArray(item.sourceCapabilityIds));
    assert.ok(Array.isArray(item.relationshipIds));
    assert.ok(Array.isArray(item.evidenceIds));
    assert.ok(Array.isArray(item.sourceFactIds));
    assert.ok(Array.isArray(item.reasonCodes));
    assert.ok(item.provenance);
    assert.equal(item.provenance.patchVersion, '3.7');
  }
});

test('Step 17 Contract: deterministic ID format matches specification', () => {
  const id = deriveCharacterInteractionId('Jiyan', 'Mortefi', 'DAMAGE_AMPLIFICATION', 'UNIVERSAL');
  assert.equal(id, 'char-interaction:3.7:Jiyan:Mortefi:DAMAGE_AMPLIFICATION:UNIVERSAL:7.17.1');
});

// =========================================================================
// 2. PATCH ISOLATION
// =========================================================================
test('Step 17 Patch Isolation: same patch 3.7 accepted', () => {
  const input: CharacterInteractionCompositionInput = {
    patchId: '3.7',
    ruleVersion: '7.17.1',
    sourceRelationships: [makeTestRelationship()]
  };
  const res = composeCharacterInteractions(input);
  assert.equal(res.interactions.length, 1);
});

test('Step 17 Patch Isolation: cross-patch 3.6 input rejected', () => {
  assert.throws(() => {
    composeCharacterInteractions({
      patchId: '3.6',
      ruleVersion: '7.17.1'
    } as any);
  }, /Invalid patch context/);
});

test('Step 17 Patch Isolation: cross-patch 3.8 input rejected', () => {
  assert.throws(() => {
    composeCharacterInteractions({
      patchId: '3.8',
      ruleVersion: '7.17.1'
    } as any);
  }, /Invalid patch context/);
});

test('Step 17 Patch Isolation: cross-patch source relationship rejected', () => {
  assert.throws(() => {
    composeCharacterInteractions({
      patchId: '3.7',
      ruleVersion: '7.17.1',
      sourceRelationships: [makeTestRelationship({ patchVersion: '3.6' as any })]
    });
  }, /Invalid or missing patchVersion/);
});

test('Step 17 Patch Isolation: cross-patch source interaction rejected', () => {
  assert.throws(() => {
    composeCharacterInteractions({
      patchId: '3.7',
      ruleVersion: '7.17.1',
      sourceInteractions: [makeTestInteraction({ patchVersion: '3.6' as any })]
    });
  }, /Invalid or missing patchVersion/);
});

// =========================================================================
// 3. CHARACTER VALIDATION
// =========================================================================
test('Step 17 Character Validation: canonical source and target characters accepted', () => {
  const res = composeCharacterInteractions({
    patchId: '3.7',
    ruleVersion: '7.17.1',
    sourceRelationships: [
      makeTestRelationship({ sourceCharacterId: 'Jiyan', targetCharacterId: 'Mortefi' })
    ]
  });
  assert.equal(res.interactions.length, 1);
  assert.equal(res.interactions[0].sourceCharacterId, 'Jiyan');
  assert.equal(res.interactions[0].targetCharacterId, 'Mortefi');
});

test('Step 17 Character Validation: unknown source character rejected', () => {
  assert.throws(() => {
    composeCharacterInteractions({
      patchId: '3.7',
      ruleVersion: '7.17.1',
      sourceRelationships: [makeTestRelationship({ sourceCharacterId: 'UnknownResonatorXYZ' })]
    });
  }, /Invalid or unknown source character/);
});

test('Step 17 Character Validation: unknown target character rejected', () => {
  assert.throws(() => {
    composeCharacterInteractions({
      patchId: '3.7',
      ruleVersion: '7.17.1',
      sourceRelationships: [makeTestRelationship({ targetCharacterId: 'UnknownResonatorXYZ' })]
    });
  }, /Invalid or unknown target character/);
});

// =========================================================================
// 4. DIRECTIONALITY & REVERSE EDGE INTEGRITY
// =========================================================================
test('Step 17 Directionality: A -> B remains strictly A -> B', () => {
  const res = composeCharacterInteractions({
    patchId: '3.7',
    ruleVersion: '7.17.1',
    sourceRelationships: [
      makeTestRelationship({ sourceCharacterId: 'Sanhua', targetCharacterId: 'Encore' })
    ]
  });
  assert.equal(res.interactions.length, 1);
  assert.equal(res.interactions[0].sourceCharacterId, 'Sanhua');
  assert.equal(res.interactions[0].targetCharacterId, 'Encore');
});

test('Step 17 Directionality: B -> A is NOT automatically generated', () => {
  const res = composeCharacterInteractions({
    patchId: '3.7',
    ruleVersion: '7.17.1',
    sourceRelationships: [
      makeTestRelationship({ sourceCharacterId: 'Sanhua', targetCharacterId: 'Encore' })
    ]
  });
  const reverse = res.interactions.find(
    (i) => i.sourceCharacterId === 'Encore' && i.targetCharacterId === 'Sanhua'
  );
  assert.equal(reverse, undefined, 'Reverse edge Encore -> Sanhua must not be fabricated');
});

test('Step 17 Directionality: distinct directional edges preserved when both explicitly exist', () => {
  const res = composeCharacterInteractions({
    patchId: '3.7',
    ruleVersion: '7.17.1',
    sourceRelationships: [
      makeTestRelationship({ id: 'rel:1', sourceCharacterId: 'Sanhua', targetCharacterId: 'Encore' }),
      makeTestRelationship({ id: 'rel:2', sourceCharacterId: 'Encore', targetCharacterId: 'Sanhua' })
    ]
  });
  assert.equal(res.interactions.length, 2);
  const forward = res.interactions.find((i) => i.sourceCharacterId === 'Sanhua' && i.targetCharacterId === 'Encore');
  const backward = res.interactions.find((i) => i.sourceCharacterId === 'Encore' && i.targetCharacterId === 'Sanhua');
  assert.ok(forward);
  assert.ok(backward);
});

// =========================================================================
// 5. SELF-INTERACTION REJECTION
// =========================================================================
test('Step 17 Self-Interaction: A -> A in relationship is rejected', () => {
  assert.throws(() => {
    composeCharacterInteractions({
      patchId: '3.7',
      ruleVersion: '7.17.1',
      sourceRelationships: [
        makeTestRelationship({ sourceCharacterId: 'Jiyan', targetCharacterId: 'Jiyan' })
      ]
    });
  }, /Self-interaction 'Jiyan -> Jiyan' rejected/);
});

test('Step 17 Self-Interaction: A -> A in interaction evidence is rejected', () => {
  assert.throws(() => {
    composeCharacterInteractions({
      patchId: '3.7',
      ruleVersion: '7.17.1',
      sourceInteractions: [
        makeTestInteraction({ sourceCharacterId: 'Verina', targetCharacterId: 'Verina' })
      ]
    });
  }, /Self-interaction 'Verina -> Verina' rejected/);
});

// =========================================================================
// 6. DEDUPLICATION
// =========================================================================
test('Step 17 Deduplication: duplicate identical interactions merged into one record', () => {
  const r1 = makeTestRelationship({
    id: 'rel:1',
    sourceCharacterId: 'Sanhua',
    targetCharacterId: 'Encore',
    relationshipType: 'DAMAGE_AMPLIFICATION',
    effectValue: 0.38,
    relationshipIds: ['rel:1'],
    sourceFactIds: ['fact:1']
  });
  const r2 = makeTestRelationship({
    id: 'rel:2',
    sourceCharacterId: 'Sanhua',
    targetCharacterId: 'Encore',
    relationshipType: 'DAMAGE_AMPLIFICATION',
    effectValue: 0.38,
    relationshipIds: ['rel:2'],
    sourceFactIds: ['fact:2']
  });

  const res = composeCharacterInteractions({
    patchId: '3.7',
    ruleVersion: '7.17.1',
    sourceRelationships: [r1, r2]
  });

  assert.equal(res.interactions.length, 1);
  assert.equal(res.summary.total, 1);
  assert.equal(res.summary.deduplicated, 1);

  const item = res.interactions[0];
  assert.deepEqual(item.relationshipIds, ['rel:1', 'rel:2']);
  assert.deepEqual(item.sourceFactIds, ['fact:1', 'fact:2']);
  assert.ok(item.reasonCodes.includes(INTERACTION_REASON_CODES.DEDUPLICATED));
});

// =========================================================================
// 7. CONFLICT HANDLING
// =========================================================================
test('Step 17 Conflict: conflicting numeric values mark status as CONFLICTED', () => {
  const r1 = makeTestRelationship({
    id: 'rel:1',
    sourceCharacterId: 'Sanhua',
    targetCharacterId: 'Encore',
    relationshipType: 'DAMAGE_AMPLIFICATION',
    effectValue: 0.38
  });
  const r2 = makeTestRelationship({
    id: 'rel:2',
    sourceCharacterId: 'Sanhua',
    targetCharacterId: 'Encore',
    relationshipType: 'DAMAGE_AMPLIFICATION',
    effectValue: 0.50 // Contradiction!
  });

  const res = composeCharacterInteractions({
    patchId: '3.7',
    ruleVersion: '7.17.1',
    sourceRelationships: [r1, r2]
  });

  assert.equal(res.interactions.length, 1);
  assert.equal(res.interactions[0].evidenceStatus, 'CONFLICTED');
  assert.equal(res.interactions[0].effectValue, null); // nulled out on conflict
  assert.equal(res.summary.conflicted, 1);
  assert.equal(res.audit.conflictsDetected, 1);
  assert.ok(res.interactions[0].reasonCodes.includes(INTERACTION_REASON_CODES.CONFLICT_DETECTED));
});

test('Step 17 Conflict: conflicting status marks record as CONFLICTED', () => {
  const e1 = makeTestInteraction({
    id: 'evi:1',
    sourceCharacterId: 'Verina',
    targetCharacterId: 'Jiyan',
    interactionType: 'DAMAGE_AMPLIFICATION',
    evidenceStatus: 'AUTHORITATIVE'
  });
  const e2 = makeTestInteraction({
    id: 'evi:2',
    sourceCharacterId: 'Verina',
    targetCharacterId: 'Jiyan',
    interactionType: 'DAMAGE_AMPLIFICATION',
    evidenceStatus: 'NOT_APPLICABLE' // Contradiction!
  });

  const res = composeCharacterInteractions({
    patchId: '3.7',
    ruleVersion: '7.17.1',
    sourceInteractions: [e1, e2]
  });

  assert.equal(res.interactions.length, 1);
  assert.equal(res.interactions[0].evidenceStatus, 'CONFLICTED');
  assert.equal(res.summary.conflicted, 1);
  assert.equal(res.audit.conflictsDetected, 1);
});

// =========================================================================
// 8. PROVENANCE PRESERVATION
// =========================================================================
test('Step 17 Provenance: source provenance preserved intact', () => {
  const rel = makeTestRelationship();
  const res = composeCharacterInteractions({
    patchId: '3.7',
    ruleVersion: '7.17.1',
    sourceRelationships: [rel]
  });

  const item = res.interactions[0];
  assert.equal(item.provenance.entityId, 'Sanhua');
  assert.equal(item.provenance.sourceProvenance, 'Official Test Provenance');
  assert.equal(item.provenance.patchVersion, '3.7');
});

test('Step 17 Provenance: missing provenance rejected', () => {
  assert.throws(() => {
    composeCharacterInteractions({
      patchId: '3.7',
      ruleVersion: '7.17.1',
      sourceRelationships: [makeTestRelationship({ provenance: null as any })]
    });
  }, /Missing or invalid provenance/);
});

// =========================================================================
// 9. CONDITIONAL INTERACTIONS
// =========================================================================
test('Step 17 Condition: elementRequirement condition preserved', () => {
  const rel = makeTestRelationship({
    condition: { elementRequirement: 'Glacio' }
  });
  const res = composeCharacterInteractions({
    patchId: '3.7',
    ruleVersion: '7.17.1',
    sourceRelationships: [rel]
  });

  const item = res.interactions[0];
  assert.ok(item.condition);
  assert.equal(item.condition.elementRequirement, 'Glacio');
  assert.equal(deriveConditionKey(item.condition), 'elem:Glacio');
  assert.ok(item.id.includes(':elem:Glacio:'));
});

test('Step 17 Condition: actionTypeRequirement condition preserved', () => {
  const rel = makeTestRelationship({
    condition: { actionTypeRequirement: 'BASIC' }
  });
  const res = composeCharacterInteractions({
    patchId: '3.7',
    ruleVersion: '7.17.1',
    sourceRelationships: [rel]
  });

  const item = res.interactions[0];
  assert.ok(item.condition);
  assert.equal(item.condition.actionTypeRequirement, 'BASIC');
  assert.equal(deriveConditionKey(item.condition), 'act:BASIC');
});

test('Step 17 Condition: sequenceRequirement condition preserved', () => {
  const rel = makeTestRelationship({
    condition: { sequenceRequirement: 4 }
  });
  const res = composeCharacterInteractions({
    patchId: '3.7',
    ruleVersion: '7.17.1',
    sourceRelationships: [rel]
  });

  const item = res.interactions[0];
  assert.ok(item.condition);
  assert.equal(item.condition.sequenceRequirement, 4);
  assert.equal(deriveConditionKey(item.condition), 'seq:4');
});

test('Step 17 Condition: condition distinguishes distinct interactions between same pair', () => {
  const r1 = makeTestRelationship({
    id: 'rel:1',
    condition: { elementRequirement: 'Glacio' }
  });
  const r2 = makeTestRelationship({
    id: 'rel:2',
    condition: { elementRequirement: 'Fusion' }
  });

  const res = composeCharacterInteractions({
    patchId: '3.7',
    ruleVersion: '7.17.1',
    sourceRelationships: [r1, r2]
  });

  // Distinct conditions do not collide into one interaction
  assert.equal(res.interactions.length, 2);
  assert.notEqual(res.interactions[0].id, res.interactions[1].id);
});

// =========================================================================
// 10. STATUS SEMANTICS
// =========================================================================
test('Step 17 Status: AUTHORITATIVE status accurately classified', () => {
  const res = composeCharacterInteractions({
    patchId: '3.7',
    ruleVersion: '7.17.1',
    sourceInteractions: [makeTestInteraction({ evidenceStatus: 'AUTHORITATIVE' })]
  });
  assert.ok(isInteractionAuthoritative(res.interactions[0]));
});

test('Step 17 Status: UNKNOWN status preserved without defaulting', () => {
  const res = composeCharacterInteractions({
    patchId: '3.7',
    ruleVersion: '7.17.1',
    sourceInteractions: [makeTestInteraction({ evidenceStatus: 'UNKNOWN' })]
  });
  assert.ok(isInteractionUnknown(res.interactions[0]));
});

test('Step 17 Status: UNMODELED status preserved distinctly', () => {
  const res = composeCharacterInteractions({
    patchId: '3.7',
    ruleVersion: '7.17.1',
    sourceInteractions: [makeTestInteraction({ evidenceStatus: 'UNMODELED' })]
  });
  assert.ok(isInteractionUnmodeled(res.interactions[0]));
});

test('Step 17 Status: NOT_APPLICABLE status preserved distinctly', () => {
  const res = composeCharacterInteractions({
    patchId: '3.7',
    ruleVersion: '7.17.1',
    sourceInteractions: [makeTestInteraction({ evidenceStatus: 'NOT_APPLICABLE' })]
  });
  assert.ok(isInteractionNotApplicable(res.interactions[0]));
});

// =========================================================================
// 11. BOUNDARY & SAFETY ENFORCEMENT
// =========================================================================
test('Step 17 Boundary: zero prohibited keys on production interactions', () => {
  const res = composeCharacterInteractions();
  for (const item of res.interactions) {
    assertNoProhibitedCharacterInteractionKeys(item);
  }
});

test('Step 17 Boundary: assertNoProhibitedCharacterInteractionKeys catches forbidden keys', () => {
  assert.throws(() => {
    assertNoProhibitedCharacterInteractionKeys({ characterPower: 100 });
  }, /Prohibited property 'characterPower'/);

  assert.throws(() => {
    assertNoProhibitedCharacterInteractionKeys({ teamScore: 85 });
  }, /Prohibited property 'teamScore'/);

  assert.throws(() => {
    assertNoProhibitedCharacterInteractionKeys({ dps: 5000 });
  }, /Prohibited property 'dps'/);

  assert.throws(() => {
    assertNoProhibitedCharacterInteractionKeys({ synergyScore: 50 });
  }, /Prohibited property 'synergyScore'/);
});

test('Step 17 Safety: source files contain zero network calls (fetch, axios, http)', () => {
  const dir = path.join(process.cwd(), 'lib/engine/character-interactions');
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (!file.endsWith('.ts')) continue;
    const content = fs.readFileSync(path.join(dir, file), 'utf-8');
    assert.doesNotMatch(content, /\bfetch\s*\(/);
    assert.doesNotMatch(content, /\baxios\b/);
    assert.doesNotMatch(content, /https?:\/\//);
  }
});

test('Step 17 Safety: source files contain zero LLM references', () => {
  const dir = path.join(process.cwd(), 'lib/engine/character-interactions');
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (!file.endsWith('.ts')) continue;
    const content = fs.readFileSync(path.join(dir, file), 'utf-8');
    assert.doesNotMatch(content, /\bopenai\b/i);
    assert.doesNotMatch(content, /\bgemini\b/i);
    assert.doesNotMatch(content, /\bchatgpt\b/i);
  }
});

test('Step 17 Safety: source files contain zero nondeterministic randomness or time', () => {
  const dir = path.join(process.cwd(), 'lib/engine/character-interactions');
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (!file.endsWith('.ts')) continue;
    const content = fs.readFileSync(path.join(dir, file), 'utf-8');
    assert.doesNotMatch(content, /Math\.random/);
    assert.doesNotMatch(content, /Date\.now/);
    assert.doesNotMatch(content, /new Date/);
    assert.doesNotMatch(content, /randomUUID/);
  }
});

test('Step 17 Safety: source files contain zero parseFloat or parseInt', () => {
  const dir = path.join(process.cwd(), 'lib/engine/character-interactions');
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (!file.endsWith('.ts')) continue;
    const content = fs.readFileSync(path.join(dir, file), 'utf-8');
    assert.doesNotMatch(content, /\bparseFloat\s*\(/);
    assert.doesNotMatch(content, /\bparseInt\s*\(/);
  }
});

test('Step 17 Safety: source files contain zero ?? 0 or || 0 unsafe fallbacks', () => {
  const dir = path.join(process.cwd(), 'lib/engine/character-interactions');
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (!file.endsWith('.ts')) continue;
    const content = fs.readFileSync(path.join(dir, file), 'utf-8');
    assert.doesNotMatch(content, /\?\?\s*0/);
    assert.doesNotMatch(content, /\|\|\s*0/);
  }
});

// =========================================================================
// 12. DETERMINISM & TOTAL ORDERING
// =========================================================================
test('Step 17 Determinism: repeated composition produces identical outputs', () => {
  clearCharacterInteractionCache();
  const res1 = composeCharacterInteractions();
  const res2 = composeCharacterInteractions();
  assert.equal(JSON.stringify(res1), JSON.stringify(res2));
});

test('Step 17 Determinism: input ordering invariance', () => {
  const r1 = makeTestRelationship({ id: 'rel:A', sourceCharacterId: 'Aalto', targetCharacterId: 'Jiyan' });
  const r2 = makeTestRelationship({ id: 'rel:B', sourceCharacterId: 'Sanhua', targetCharacterId: 'Encore' });
  const r3 = makeTestRelationship({ id: 'rel:C', sourceCharacterId: 'Verina', targetCharacterId: 'Jiyan' });

  const resForward = composeCharacterInteractions({
    patchId: '3.7',
    ruleVersion: '7.17.1',
    sourceRelationships: [r1, r2, r3]
  });

  const resReverse = composeCharacterInteractions({
    patchId: '3.7',
    ruleVersion: '7.17.1',
    sourceRelationships: [r3, r2, r1]
  });

  assert.equal(JSON.stringify(resForward), JSON.stringify(resReverse));
});

test('Step 17 Determinism: 20-run byte-identical production generation', () => {
  clearCharacterInteractionCache();
  const firstJson = JSON.stringify(getCharacterInteractionCompositionResult());
  const firstHash = crypto.createHash('sha256').update(firstJson).digest('hex');

  for (let run = 1; run <= 20; run++) {
    clearCharacterInteractionCache();
    const curJson = JSON.stringify(getCharacterInteractionCompositionResult());
    const curHash = crypto.createHash('sha256').update(curJson).digest('hex');
    assert.equal(curHash, firstHash, `Run ${run} deviated in hash.`);
  }
});

// =========================================================================
// 13. CANONICAL DATASET & UPSTREAM IMMUTABILITY
// =========================================================================
test('Step 17 Canonical Dataset: Patch 3.7 dataset is byte-for-byte unchanged', () => {
  const datasetPath = path.join(process.cwd(), 'data/patches/3.7/patch_3_7_dataset.json');
  const buffer = fs.readFileSync(datasetPath);
  const actualHash = crypto.createHash('sha256').update(buffer).digest('hex');
  assert.equal(actualHash, EXPECTED_DATASET_SHA256);
});

test('Step 17 Upstream Immutability: rule versions 7.8.1 through 7.16.1 remain intact', () => {
  assert.equal(CHARACTER_PAIR_SYNERGY_RULE_VERSION, '7.8.1');
  assert.equal(TEAM_COMPOSITION_RULE_VERSION, '7.9.1');
  assert.equal(TEAM_COMPOSITION_EVALUATION_RULE_VERSION, '7.10.1');
  assert.equal(TEAM_COMPOSITION_RANKING_RULE_VERSION, '7.11.1');
  assert.equal(OWNED_ROSTER_ELIGIBILITY_RULE_VERSION, '7.12.1');
  assert.equal(RESONATOR_INVESTMENT_RULE_VERSION, '7.13.1');
  assert.equal(TEAM_BUILD_READINESS_RULE_VERSION, '7.14.1');
  assert.equal(INVESTMENT_EFFECT_RESOLUTION_RULE_VERSION, '7.15.1');
  assert.equal(CHARACTER_EVALUATION_RULE_VERSION, '7.16.1');
  assert.equal(CHARACTER_INTERACTION_RULE_VERSION, '7.17.1');
});

// =========================================================================
// 14. PRODUCTION AUDIT & REPOSITORY APIS
// =========================================================================
test('Step 17 Production Audit: auditCharacterInteractions passes cleanly', () => {
  const res = getCharacterInteractionCompositionResult();
  assert.doesNotThrow(() => {
    auditCharacterInteractions(res);
  });
});

test('Step 17 Repository: queryCharacterInteractions filters accurately', () => {
  const all = getCharacterInteractions();
  assert.ok(all.length > 0);

  const jiyanOut = queryCharacterInteractions({ sourceCharacterId: 'Jiyan' });
  for (const item of jiyanOut) {
    assert.equal(item.sourceCharacterId, 'Jiyan');
  }

  const encoreIn = queryCharacterInteractions({ targetCharacterId: 'Encore' });
  for (const item of encoreIn) {
    assert.equal(item.targetCharacterId, 'Encore');
  }

  const authoritativeOnly = getAuthoritativeInteractions();
  for (const item of authoritativeOnly) {
    assert.equal(item.evidenceStatus, 'AUTHORITATIVE');
  }
});

test('Step 17 Explanation: explainCharacterInteraction generates factual description', () => {
  const all = getCharacterInteractions();
  assert.ok(all.length > 0);
  const sample = all[0];
  const explanation = explainCharacterInteraction(sample);
  assert.ok(explanation.includes(`Interaction: ${sample.sourceCharacterId} -> ${sample.targetCharacterId}`));
  assert.ok(explanation.includes(`Status: ${sample.evidenceStatus}`));
  assert.ok(explanation.includes(`Type: ${sample.interactionType}`));
});

// =========================================================================
// 15. CANONICAL PATCH 3.7 CHARACTER INTERACTIONS & QUERY RECONCILIATION
// =========================================================================
test('Step 17 Production: total composed interactions reconcile to 3008', () => {
  const res = getCharacterInteractionCompositionResult();
  assert.equal(res.summary.total, 3008);
  assert.equal(res.interactions.length, 3008);
});

test('Step 17 Production: authoritative count reconciles to 414', () => {
  const res = getCharacterInteractionCompositionResult();
  assert.equal(res.summary.authoritative, 414);
  const auth = getAuthoritativeInteractions();
  assert.equal(auth.length, 414);
});

test('Step 17 Production: unknown count reconciles to 2528', () => {
  const res = getCharacterInteractionCompositionResult();
  assert.equal(res.summary.unknown, 2528);
});

test('Step 17 Production: unmodeled count reconciles to 66', () => {
  const res = getCharacterInteractionCompositionResult();
  assert.equal(res.summary.unmodeled, 66);
});

test('Step 17 Production: notApplicable count reconciles to 0', () => {
  const res = getCharacterInteractionCompositionResult();
  assert.equal(res.summary.notApplicable, 0);
});

test('Step 17 Production: conflicted count reconciles to 0 in canonical data', () => {
  const res = getCharacterInteractionCompositionResult();
  assert.equal(res.summary.conflicted, 0);
  assert.equal(res.audit.conflictsDetected, 0);
  const conf = getConflictedInteractions();
  assert.equal(conf.length, 0);
});

test('Step 17 Production: deduplicated count reconciles to 339', () => {
  const res = getCharacterInteractionCompositionResult();
  assert.equal(res.summary.deduplicated, 339);
});

test('Step 17 Production: Aalto -> Jiyan transition interaction exists and is queryable', () => {
  const aaltoJiyan = getCharacterInteraction('Aalto', 'Jiyan', 'OUTRO_INTRO_HANDOFF');
  assert.ok(aaltoJiyan);
  assert.equal(aaltoJiyan.sourceCharacterId, 'Aalto');
  assert.equal(aaltoJiyan.targetCharacterId, 'Jiyan');
  assert.equal(aaltoJiyan.interactionType, 'OUTRO_INTRO_HANDOFF');
  assert.equal(aaltoJiyan.category, 'TRANSITION');
  assert.ok(aaltoJiyan.relationshipIds.length > 0);
});

test('Step 17 Production: Sanhua -> Encore interaction exists and is queryable', () => {
  const sanhuaEncore = getCharacterInteraction('Sanhua', 'Encore', 'DAMAGE_AMPLIFICATION', 'act:BASIC');
  assert.ok(sanhuaEncore);
  assert.equal(sanhuaEncore.sourceCharacterId, 'Sanhua');
  assert.equal(sanhuaEncore.targetCharacterId, 'Encore');
  assert.equal(sanhuaEncore.interactionType, 'DAMAGE_AMPLIFICATION');
  assert.equal(sanhuaEncore.category, 'OFFENSIVE');
  assert.equal(sanhuaEncore.condition?.actionTypeRequirement, 'BASIC');
});

test('Step 17 Production: getInteractionsForCharacter returns both incoming and outgoing interactions', () => {
  const verinaInteractions = getInteractionsForCharacter('Verina');
  assert.ok(verinaInteractions.length > 0);
  const outgoing = verinaInteractions.filter((i) => i.sourceCharacterId === 'Verina');
  const incoming = verinaInteractions.filter((i) => i.targetCharacterId === 'Verina');
  assert.ok(outgoing.length > 0);
  assert.ok(incoming.length > 0);
  for (const item of verinaInteractions) {
    assert.ok(item.sourceCharacterId === 'Verina' || item.targetCharacterId === 'Verina');
    assert.notEqual(item.sourceCharacterId, item.targetCharacterId, 'Never self-interaction');
  }
});

// =========================================================================
// 16. INVARIANTS AUDIT DEEP VERIFICATION
// =========================================================================
test('Step 17 Invariant Audit: auditCharacterInteractions throws on null result', () => {
  assert.throws(() => {
    auditCharacterInteractions(null as any);
  }, /Audit failed: composition result is null or undefined/);
});

test('Step 17 Invariant Audit: Invariant A throws on invalid patchId', () => {
  const invalid = {
    patchId: '3.6',
    ruleVersion: '7.17.1',
    interactions: [],
    summary: { total: 0, authoritative: 0, unknown: 0, unmodeled: 0, notApplicable: 0, conflicted: 0, deduplicated: 0 },
    audit: { deterministic: true, patchIsolated: true, provenanceValidated: true, conflictsDetected: 0 }
  };
  assert.throws(() => {
    auditCharacterInteractions(invalid as any);
  }, /Invariant A failure/);
});

test('Step 17 Invariant Audit: Invariant B throws on invalid ruleVersion', () => {
  const invalid = {
    patchId: '3.7',
    ruleVersion: '7.16.1',
    interactions: [],
    summary: { total: 0, authoritative: 0, unknown: 0, unmodeled: 0, notApplicable: 0, conflicted: 0, deduplicated: 0 },
    audit: { deterministic: true, patchIsolated: true, provenanceValidated: true, conflictsDetected: 0 }
  };
  assert.throws(() => {
    auditCharacterInteractions(invalid as any);
  }, /Invariant B failure/);
});

test('Step 17 Invariant Audit: Invariant F throws if item has self-interaction', () => {
  const invalidItem = {
    id: 'char-interaction:3.7:Jiyan:Jiyan:DAMAGE_AMPLIFICATION:UNIVERSAL:7.17.1',
    patchVersion: '3.7',
    ruleVersion: '7.17.1',
    sourceCharacterId: 'Jiyan',
    targetCharacterId: 'Jiyan',
    interactionType: 'DAMAGE_AMPLIFICATION',
    evidenceStatus: 'AUTHORITATIVE',
    category: 'OFFENSIVE',
    effectValue: null,
    unit: null,
    sourceCapabilityIds: [],
    relationshipIds: [],
    evidenceIds: [],
    sourceFactIds: [],
    reasonCodes: [],
    provenance: createDefaultStep17Provenance('Jiyan', 'Jiyan', 'DAMAGE_AMPLIFICATION')
  };
  const invalid = {
    patchId: '3.7',
    ruleVersion: '7.17.1',
    interactions: [invalidItem],
    summary: { total: 1, authoritative: 1, unknown: 0, unmodeled: 0, notApplicable: 0, conflicted: 0, deduplicated: 0 },
    audit: { deterministic: true, patchIsolated: true, provenanceValidated: true, conflictsDetected: 0 }
  };
  assert.throws(() => {
    auditCharacterInteractions(invalid as any);
  }, /Invariant F failure: self-interaction/);
});

test('Step 17 Invariant Audit: Invariant G throws if item has malformed ID', () => {
  const invalidItem = {
    id: 'char-interaction:3.7:Jiyan:Mortefi:DAMAGE_AMPLIFICATION:MALFORMED:7.17.1',
    patchVersion: '3.7',
    ruleVersion: '7.17.1',
    sourceCharacterId: 'Jiyan',
    targetCharacterId: 'Mortefi',
    interactionType: 'DAMAGE_AMPLIFICATION',
    evidenceStatus: 'AUTHORITATIVE',
    category: 'OFFENSIVE',
    condition: undefined,
    effectValue: null,
    unit: null,
    sourceCapabilityIds: [],
    relationshipIds: [],
    evidenceIds: [],
    sourceFactIds: [],
    reasonCodes: [],
    provenance: createDefaultStep17Provenance('Jiyan', 'Mortefi', 'DAMAGE_AMPLIFICATION')
  };
  const invalid = {
    patchId: '3.7',
    ruleVersion: '7.17.1',
    interactions: [invalidItem],
    summary: { total: 1, authoritative: 1, unknown: 0, unmodeled: 0, notApplicable: 0, conflicted: 0, deduplicated: 0 },
    audit: { deterministic: true, patchIsolated: true, provenanceValidated: true, conflictsDetected: 0 }
  };
  assert.throws(() => {
    auditCharacterInteractions(invalid as any);
  }, /Invariant G failure: malformed ID/);
});

test('Step 17 Invariant Audit: Invariant H throws if duplicate IDs exist', () => {
  const item1 = {
    id: 'char-interaction:3.7:Jiyan:Mortefi:DAMAGE_AMPLIFICATION:UNIVERSAL:7.17.1',
    patchVersion: '3.7',
    ruleVersion: '7.17.1',
    sourceCharacterId: 'Jiyan',
    targetCharacterId: 'Mortefi',
    interactionType: 'DAMAGE_AMPLIFICATION',
    evidenceStatus: 'AUTHORITATIVE',
    category: 'OFFENSIVE',
    effectValue: null,
    unit: null,
    sourceCapabilityIds: [],
    relationshipIds: [],
    evidenceIds: [],
    sourceFactIds: [],
    reasonCodes: [],
    provenance: createDefaultStep17Provenance('Jiyan', 'Mortefi', 'DAMAGE_AMPLIFICATION')
  };
  const invalid = {
    patchId: '3.7',
    ruleVersion: '7.17.1',
    interactions: [item1, item1],
    summary: { total: 2, authoritative: 2, unknown: 0, unmodeled: 0, notApplicable: 0, conflicted: 0, deduplicated: 0 },
    audit: { deterministic: true, patchIsolated: true, provenanceValidated: true, conflictsDetected: 0 }
  };
  assert.throws(() => {
    auditCharacterInteractions(invalid as any);
  }, /Invariant H failure: duplicate interaction ID/);
});

test('Step 17 Invariant Audit: Invariant K throws if summary counts mismatch', () => {
  const res = getCharacterInteractionCompositionResult();
  const mismatched = {
    ...res,
    summary: {
      ...res.summary,
      total: 9999 // Mismatch!
    }
  };
  assert.throws(() => {
    auditCharacterInteractions(mismatched);
  }, /Invariant K failure/);
});

// =========================================================================
// 17. PREDICATES & TYPE GUARDS
// =========================================================================
test('Step 17 Predicates: matchesCharacterInteractionFilter works across multiple dimensions', () => {
  const res = getCharacterInteractionCompositionResult();
  const sample = res.interactions[0];

  assert.ok(matchesCharacterInteractionFilter(sample, {}));
  assert.ok(matchesCharacterInteractionFilter(sample, { patchVersion: '3.7' }));
  assert.ok(matchesCharacterInteractionFilter(sample, { sourceCharacterId: sample.sourceCharacterId }));
  assert.ok(matchesCharacterInteractionFilter(sample, { targetCharacterId: sample.targetCharacterId }));
  assert.ok(matchesCharacterInteractionFilter(sample, { resonatorId: sample.sourceCharacterId }));
  assert.ok(matchesCharacterInteractionFilter(sample, { resonatorId: sample.targetCharacterId }));
  assert.ok(matchesCharacterInteractionFilter(sample, { interactionType: sample.interactionType }));
  assert.ok(matchesCharacterInteractionFilter(sample, { category: sample.category }));
  assert.ok(matchesCharacterInteractionFilter(sample, { evidenceStatus: sample.evidenceStatus }));

  // False checks
  assert.equal(matchesCharacterInteractionFilter(sample, { sourceCharacterId: 'NonExistent' }), false);
  assert.equal(matchesCharacterInteractionFilter(sample, { targetCharacterId: 'NonExistent' }), false);
  assert.equal(matchesCharacterInteractionFilter(sample, { patchVersion: '3.6' as any }), false);
});
