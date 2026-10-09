/**
 * Wuthering Waves Character Interaction Profile Contract Tests
 * Phase 7 Step 18: Deterministic Character Interaction Aggregation & Evidence Profile Contract
 *
 * Verifies all Contract, Patch Isolation, Directionality, No Inference, Conditions, Status,
 * Provenance, Counts, Determinism, Immutability, Empty Profiles, Invariants, and Canonical Reconciliation.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  CHARACTER_INTERACTION_PROFILE_RULE_VERSION,
  PROFILE_REASON_CODES,
  PROHIBITED_PROFILE_KEYS
} from '../lib/engine/character-interaction-profiles/rules.ts';
import {
  deriveCharacterProfileId,
  compareCharacterInteractionProfiles,
  matchesCharacterInteractionProfileFilter
} from '../lib/engine/character-interaction-profiles/predicates.ts';
import {
  aggregateCharacterInteractionProfiles
} from '../lib/engine/character-interaction-profiles/aggregator.ts';
import {
  getCharacterInteractionProfileResult,
  getAllCharacterInteractionProfiles,
  getCharacterInteractionProfile,
  getOutgoingCharacterInteractions,
  getIncomingCharacterInteractions,
  getCharacterInteractionProfileSummary,
  getCharactersWithOutgoingInteractions,
  getCharactersWithIncomingInteractions,
  queryCharacterInteractionProfiles,
  clearCharacterInteractionProfileCache
} from '../lib/engine/character-interaction-profiles/repository.ts';
import {
  assertNoProhibitedCharacterProfileKeys,
  auditCharacterInteractionProfiles
} from '../lib/engine/character-interaction-profiles/audit.ts';
import {
  explainCharacterInteractionProfile
} from '../lib/engine/character-interaction-profiles/index.ts';
import type {
  CharacterInteractionEvidence,
  CharacterInteractionProfileAggregationInput
} from '../lib/engine/character-interaction-profiles/types.ts';

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
import { CHARACTER_INTERACTION_RULE_VERSION } from '../lib/engine/character-interactions/rules.ts';

const EXPECTED_DATASET_SHA256 = '7abb7cb3b5290dee9e22cba83df4c974e2befd6639fbb7f04041adedc11a68e9';

// Helper to synthesize a valid Step 17 record for isolated tests
function makeMockStep17Evidence(overrides: Partial<CharacterInteractionEvidence> = {}): CharacterInteractionEvidence {
  const source = overrides.sourceCharacterId ?? 'Sanhua';
  const target = overrides.targetCharacterId ?? 'Encore';
  const type = overrides.interactionType ?? 'DAMAGE_AMPLIFICATION';
  return {
    id: `char-interaction:3.7:${source}:${target}:${type}:UNIVERSAL:7.17.1`,
    patchVersion: '3.7',
    ruleVersion: '7.17.1',
    sourceCharacterId: source,
    targetCharacterId: target,
    interactionType: type,
    category: 'OFFENSIVE',
    evidenceStatus: 'AUTHORITATIVE',
    condition: undefined,
    effectValue: 0.38,
    unit: 'PERCENT',
    relationshipIds: ['rel:test:1'],
    evidenceIds: ['ev:test:1'],
    sourceFactIds: ['fact:test:1'],
    sourceCapabilityIds: ['cap:test:1'],
    reasonCodes: ['RELATIONSHIP_COMPOSED'],
    provenance: {
      entityId: source,
      entityName: source,
      sourceType: 'RESONATOR_ABILITY',
      sourceCode: 'OUTRO_SKILL',
      patchVersion: '3.7',
      sourceProvenance: 'Official Test Provenance',
      originalDescription: 'Basic Attack DMG Amplified by 38%'
    },
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// 1. CONTRACT & SCHEMA
// ---------------------------------------------------------------------------
test('Step 18 Contract: ruleVersion is strictly 7.18.1', () => {
  assert.equal(CHARACTER_INTERACTION_PROFILE_RULE_VERSION, '7.18.1');
});

test('Step 18 Contract: aggregation result contains ruleVersion 7.18.1 and patchId 3.7', () => {
  const result = getCharacterInteractionProfileResult();
  assert.equal(result.ruleVersion, '7.18.1');
  assert.equal(result.patchId, '3.7');
  assert.ok(Array.isArray(result.profiles));
  assert.ok(result.summary);
  assert.ok(result.audit);
});

test('Step 18 Contract: every profile has required schema fields and frozen structures', () => {
  const result = getCharacterInteractionProfileResult();
  assert.ok(result.profiles.length > 0);
  for (const p of result.profiles) {
    assert.equal(p.patchVersion, '3.7');
    assert.equal(p.ruleVersion, '7.18.1');
    assert.ok(typeof p.characterId === 'string' && p.characterId.length > 0);
    assert.ok(p.id.startsWith('char-profile:3.7:'));
    assert.ok(Object.isFrozen(p));
    assert.ok(Object.isFrozen(p.outgoing));
    assert.ok(Object.isFrozen(p.incoming));
    assert.ok(Object.isFrozen(p.summary));
  }
});

test('Step 18 Contract: deterministic profile ID derivation format', () => {
  const id = deriveCharacterProfileId('Jiyan', '3.7', '7.18.1');
  assert.equal(id, 'char-profile:3.7:Jiyan:7.18.1');
});

// ---------------------------------------------------------------------------
// 2. PATCH ISOLATION
// ---------------------------------------------------------------------------
test('Step 18 Patch Isolation: patch 3.7 accepted', () => {
  const res = aggregateCharacterInteractionProfiles({
    patchId: '3.7',
    ruleVersion: '7.18.1',
    characterIds: ['Jiyan', 'Aalto'],
    interactionEvidence: [makeMockStep17Evidence({ sourceCharacterId: 'Aalto', targetCharacterId: 'Jiyan' })]
  });
  assert.equal(res.patchId, '3.7');
  assert.equal(res.profiles.length, 2);
});

test('Step 18 Patch Isolation: cross-patch 3.6 input rejected', () => {
  assert.throws(() => {
    aggregateCharacterInteractionProfiles({
      patchId: '3.6',
      ruleVersion: '7.18.1'
    } as any);
  }, /Invalid patch context '3.6'/);
});

test('Step 18 Patch Isolation: cross-patch 3.8 input rejected', () => {
  assert.throws(() => {
    aggregateCharacterInteractionProfiles({
      patchId: '3.8',
      ruleVersion: '7.18.1'
    } as any);
  }, /Invalid patch context '3.8'/);
});

test('Step 18 Patch Isolation: mixed patch evidence rejected', () => {
  assert.throws(() => {
    aggregateCharacterInteractionProfiles({
      patchId: '3.7',
      ruleVersion: '7.18.1',
      interactionEvidence: [
        makeMockStep17Evidence({ patchVersion: '3.6' as any })
      ]
    });
  }, /Invalid patchVersion '3.6'/);
});

// ---------------------------------------------------------------------------
// 3. DIRECTIONALITY & NO INFERENCE
// ---------------------------------------------------------------------------
test('Step 18 Directionality: A -> B appears in A.outgoing and B.incoming', () => {
  const edge = makeMockStep17Evidence({ sourceCharacterId: 'Sanhua', targetCharacterId: 'Encore' });
  const res = aggregateCharacterInteractionProfiles({
    patchId: '3.7',
    ruleVersion: '7.18.1',
    characterIds: ['Sanhua', 'Encore'],
    interactionEvidence: [edge]
  });

  const sanhua = res.profiles.find((p) => p.characterId === 'Sanhua')!;
  const encore = res.profiles.find((p) => p.characterId === 'Encore')!;

  assert.equal(sanhua.outgoing.length, 1);
  assert.equal(sanhua.outgoing[0].targetCharacterId, 'Encore');
  assert.equal(sanhua.incoming.length, 0);

  assert.equal(encore.incoming.length, 1);
  assert.equal(encore.incoming[0].sourceCharacterId, 'Sanhua');
  assert.equal(encore.outgoing.length, 0);
});

test('Step 18 Directionality: B.outgoing does NOT contain A -> B', () => {
  const edge = makeMockStep17Evidence({ sourceCharacterId: 'Aalto', targetCharacterId: 'Jiyan' });
  const res = aggregateCharacterInteractionProfiles({
    patchId: '3.7',
    ruleVersion: '7.18.1',
    characterIds: ['Aalto', 'Jiyan'],
    interactionEvidence: [edge]
  });

  const jiyan = res.profiles.find((p) => p.characterId === 'Jiyan')!;
  assert.equal(jiyan.outgoing.length, 0);
});

test('Step 18 Directionality: B -> A only appears when explicitly present as an independent record', () => {
  const fwd = makeMockStep17Evidence({ id: 'fwd', sourceCharacterId: 'Sanhua', targetCharacterId: 'Encore' });
  const rev = makeMockStep17Evidence({ id: 'rev', sourceCharacterId: 'Encore', targetCharacterId: 'Sanhua' });

  const res = aggregateCharacterInteractionProfiles({
    patchId: '3.7',
    ruleVersion: '7.18.1',
    characterIds: ['Sanhua', 'Encore'],
    interactionEvidence: [fwd, rev]
  });

  const sanhua = res.profiles.find((p) => p.characterId === 'Sanhua')!;
  const encore = res.profiles.find((p) => p.characterId === 'Encore')!;

  assert.equal(sanhua.outgoing.length, 1);
  assert.equal(sanhua.incoming.length, 1);
  assert.equal(encore.outgoing.length, 1);
  assert.equal(encore.incoming.length, 1);
});

test('Step 18 No Inference: A -> B and B -> C does not create A -> C', () => {
  const ab = makeMockStep17Evidence({ id: 'ab', sourceCharacterId: 'Sanhua', targetCharacterId: 'Encore' });
  const bc = makeMockStep17Evidence({ id: 'bc', sourceCharacterId: 'Encore', targetCharacterId: 'Jiyan' });

  const res = aggregateCharacterInteractionProfiles({
    patchId: '3.7',
    ruleVersion: '7.18.1',
    characterIds: ['Sanhua', 'Encore', 'Jiyan'],
    interactionEvidence: [ab, bc]
  });

  const sanhua = res.profiles.find((p) => p.characterId === 'Sanhua')!;
  const jiyan = res.profiles.find((p) => p.characterId === 'Jiyan')!;

  // Sanhua has only Encore as target; zero Jiyan
  assert.equal(sanhua.outgoing.length, 1);
  assert.equal(sanhua.outgoing[0].targetCharacterId, 'Encore');

  // Jiyan has only Encore as incoming source; zero Sanhua
  assert.equal(jiyan.incoming.length, 1);
  assert.equal(jiyan.incoming[0].sourceCharacterId, 'Encore');
});

test('Step 18 No Inference: A -> B does not create B -> A', () => {
  const ab = makeMockStep17Evidence({ id: 'ab', sourceCharacterId: 'Aalto', targetCharacterId: 'Jiyan' });
  const res = aggregateCharacterInteractionProfiles({
    patchId: '3.7',
    ruleVersion: '7.18.1',
    characterIds: ['Aalto', 'Jiyan'],
    interactionEvidence: [ab]
  });

  const jiyan = res.profiles.find((p) => p.characterId === 'Jiyan')!;
  assert.equal(jiyan.outgoing.length, 0);
});

// ---------------------------------------------------------------------------
// 4. CONDITIONS & EPISTEMIC STATUSES
// ---------------------------------------------------------------------------
test('Step 18 Conditions: distinct conditions preserved intact without collapsing', () => {
  const c1 = makeMockStep17Evidence({
    id: 'e1',
    sourceCharacterId: 'Sanhua',
    targetCharacterId: 'Encore',
    condition: { elementRequirement: 'Fusion' }
  });
  const c2 = makeMockStep17Evidence({
    id: 'e2',
    sourceCharacterId: 'Sanhua',
    targetCharacterId: 'Encore',
    condition: { elementRequirement: 'Glacio' }
  });
  const c3 = makeMockStep17Evidence({
    id: 'e3',
    sourceCharacterId: 'Sanhua',
    targetCharacterId: 'Encore',
    condition: { actionTypeRequirement: 'BASIC' }
  });

  const res = aggregateCharacterInteractionProfiles({
    patchId: '3.7',
    ruleVersion: '7.18.1',
    characterIds: ['Sanhua', 'Encore'],
    interactionEvidence: [c1, c2, c3]
  });

  const sanhua = res.profiles.find((p) => p.characterId === 'Sanhua')!;
  assert.equal(sanhua.outgoing.length, 3);
  assert.equal(sanhua.outgoing[0].condition?.elementRequirement || sanhua.outgoing[0].condition?.actionTypeRequirement, 'BASIC');
  assert.equal(sanhua.summary.distinctOutgoingTargets, 1);
});

test('Step 18 Status: AUTHORITATIVE, UNKNOWN, UNMODELED, NOT_APPLICABLE, CONFLICTED all preserved and counted accurately', () => {
  const eAuth = makeMockStep17Evidence({ id: 'e1', sourceCharacterId: 'Aalto', targetCharacterId: 'Jiyan', evidenceStatus: 'AUTHORITATIVE' });
  const eUnk = makeMockStep17Evidence({ id: 'e2', sourceCharacterId: 'Aalto', targetCharacterId: 'Yangyang', evidenceStatus: 'UNKNOWN' });
  const eUnm = makeMockStep17Evidence({ id: 'e3', sourceCharacterId: 'Aalto', targetCharacterId: 'Chixia', evidenceStatus: 'UNMODELED' });
  const eNotApp = makeMockStep17Evidence({ id: 'e4', sourceCharacterId: 'Aalto', targetCharacterId: 'Baizhi', evidenceStatus: 'NOT_APPLICABLE' });
  const eConf = makeMockStep17Evidence({ id: 'e5', sourceCharacterId: 'Aalto', targetCharacterId: 'Yuanwu', evidenceStatus: 'CONFLICTED' });

  const res = aggregateCharacterInteractionProfiles({
    patchId: '3.7',
    ruleVersion: '7.18.1',
    characterIds: ['Aalto', 'Jiyan', 'Yangyang', 'Chixia', 'Baizhi', 'Yuanwu'],
    interactionEvidence: [eAuth, eUnk, eUnm, eNotApp, eConf]
  });

  const aalto = res.profiles.find((p) => p.characterId === 'Aalto')!;
  const s = aalto.summary;
  assert.equal(s.outgoingTotal, 5);
  assert.equal(s.outgoingAuthoritative, 1);
  assert.equal(s.outgoingUnknown, 1);
  assert.equal(s.outgoingUnmodeled, 1);
  assert.equal(s.outgoingNotApplicable, 1);
  assert.equal(s.outgoingConflicted, 1);
  assert.equal(s.distinctOutgoingTargets, 5);
});

// ---------------------------------------------------------------------------
// 5. PROVENANCE & LINEAGE
// ---------------------------------------------------------------------------
test('Step 18 Provenance: lineage arrays and source references preserved without mutation', () => {
  const edge = makeMockStep17Evidence({
    sourceCapabilityIds: ['cap:1', 'cap:2'],
    relationshipIds: ['rel:1'],
    evidenceIds: ['ev:1'],
    sourceFactIds: ['fact:1'],
    reasonCodes: ['RELATIONSHIP_COMPOSED']
  });

  const res = aggregateCharacterInteractionProfiles({
    patchId: '3.7',
    ruleVersion: '7.18.1',
    characterIds: ['Sanhua', 'Encore'],
    interactionEvidence: [edge]
  });

  const sanhua = res.profiles.find((p) => p.characterId === 'Sanhua')!;
  const outEdge = sanhua.outgoing[0];
  assert.deepEqual(outEdge.sourceCapabilityIds, ['cap:1', 'cap:2']);
  assert.deepEqual(outEdge.relationshipIds, ['rel:1']);
  assert.deepEqual(outEdge.evidenceIds, ['ev:1']);
  assert.deepEqual(outEdge.sourceFactIds, ['fact:1']);
  assert.deepEqual(outEdge.reasonCodes, ['RELATIONSHIP_COMPOSED']);
  assert.equal(outEdge.provenance.sourceProvenance, 'Official Test Provenance');
});

// ---------------------------------------------------------------------------
// 6. DETERMINISM & ORDERING
// ---------------------------------------------------------------------------
test('Step 18 Determinism: shuffled input produces identical profile result', () => {
  const e1 = makeMockStep17Evidence({ id: 'e1', sourceCharacterId: 'Aalto', targetCharacterId: 'Jiyan' });
  const e2 = makeMockStep17Evidence({ id: 'e2', sourceCharacterId: 'Sanhua', targetCharacterId: 'Encore' });
  const e3 = makeMockStep17Evidence({ id: 'e3', sourceCharacterId: 'Verina', targetCharacterId: 'Jiyan' });

  const r1 = aggregateCharacterInteractionProfiles({
    patchId: '3.7',
    ruleVersion: '7.18.1',
    characterIds: ['Aalto', 'Jiyan', 'Sanhua', 'Encore', 'Verina'],
    interactionEvidence: [e1, e2, e3]
  });

  const r2 = aggregateCharacterInteractionProfiles({
    patchId: '3.7',
    ruleVersion: '7.18.1',
    characterIds: ['Verina', 'Sanhua', 'Jiyan', 'Encore', 'Aalto'],
    interactionEvidence: [e3, e1, e2]
  });

  const r3 = aggregateCharacterInteractionProfiles({
    patchId: '3.7',
    ruleVersion: '7.18.1',
    characterIds: ['Encore', 'Aalto', 'Verina', 'Jiyan', 'Sanhua'],
    interactionEvidence: [e2, e3, e1]
  });

  assert.equal(JSON.stringify(r1), JSON.stringify(r2));
  assert.equal(JSON.stringify(r2), JSON.stringify(r3));
});

test('Step 18 Determinism: 20-run byte-identical production generation', () => {
  clearCharacterInteractionProfileCache();
  const baseRes = getCharacterInteractionProfileResult();
  const baseJson = JSON.stringify(baseRes);
  const baseHash = crypto.createHash('sha256').update(baseJson).digest('hex');

  for (let i = 0; i < 20; i++) {
    clearCharacterInteractionProfileCache();
    const runRes = getCharacterInteractionProfileResult();
    const runJson = JSON.stringify(runRes);
    const runHash = crypto.createHash('sha256').update(runJson).digest('hex');
    assert.equal(runHash, baseHash);
  }
});

// ---------------------------------------------------------------------------
// 7. SAFETY & PROHIBITED PATTERNS
// ---------------------------------------------------------------------------
test('Step 18 Safety: source files contain zero network calls (fetch, axios, http)', () => {
  const dir = path.join(process.cwd(), 'lib/engine/character-interaction-profiles');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf-8');
    assert.doesNotMatch(content, /\bfetch\s*\(/);
    assert.doesNotMatch(content, /\baxios\b/);
    assert.doesNotMatch(content, /https?:\/\//);
  }
});

test('Step 18 Safety: source files contain zero LLM references', () => {
  const dir = path.join(process.cwd(), 'lib/engine/character-interaction-profiles');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf-8');
    assert.doesNotMatch(content, /\b(openai|gemini|chatgpt|claude|prompt|llm)\b/i);
  }
});

test('Step 18 Safety: source files contain zero nondeterministic randomness or time', () => {
  const dir = path.join(process.cwd(), 'lib/engine/character-interaction-profiles');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf-8');
    assert.doesNotMatch(content, /Math\.random/);
    assert.doesNotMatch(content, /crypto\.randomUUID/);
    assert.doesNotMatch(content, /\brandomUUID\b/);
    assert.doesNotMatch(content, /Date\.now/);
    assert.doesNotMatch(content, /new\s+Date\s*\(/);
    assert.doesNotMatch(content, /performance\.now/);
    assert.doesNotMatch(content, /\bsetTimeout\b/);
    assert.doesNotMatch(content, /\bsetInterval\b/);
  }
});

test('Step 18 Safety: source files contain zero parseFloat or parseInt', () => {
  const dir = path.join(process.cwd(), 'lib/engine/character-interaction-profiles');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf-8');
    assert.doesNotMatch(content, /\bparseFloat\s*\(/);
    assert.doesNotMatch(content, /\bparseInt\s*\(/);
  }
});

test('Step 18 Safety: source files contain zero ?? 0 or || 0 unsafe fallbacks', () => {
  const dir = path.join(process.cwd(), 'lib/engine/character-interaction-profiles');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf-8');
    assert.doesNotMatch(content, /\?\?\s*0/);
    assert.doesNotMatch(content, /\|\|\s*0/);
  }
});

test('Step 18 Boundary: assertNoProhibitedCharacterProfileKeys catches forbidden keys', () => {
  assert.throws(() => {
    assertNoProhibitedCharacterProfileKeys({ characterPower: 99.5 });
  }, /Prohibited property 'characterPower'/);

  assert.throws(() => {
    assertNoProhibitedCharacterProfileKeys({ nested: { synergyScore: 80 } });
  }, /Prohibited property 'synergyScore'/);

  assert.throws(() => {
    assertNoProhibitedCharacterProfileKeys({ dps: 10000 });
  }, /Prohibited property 'dps'/);
});

// ---------------------------------------------------------------------------
// 8. UPSTREAM INTEGRITY & CANONICAL DATASET
// ---------------------------------------------------------------------------
test('Step 18 Canonical Dataset: Patch 3.7 dataset is byte-for-byte unchanged', () => {
  const datasetPath = path.join(process.cwd(), 'data/patches/3.7/patch_3_7_dataset.json');
  const datasetBytes = fs.readFileSync(datasetPath);
  const hash = crypto.createHash('sha256').update(datasetBytes).digest('hex');
  assert.equal(hash, EXPECTED_DATASET_SHA256);
});

test('Step 18 Upstream Immutability: rule versions 7.8.1 through 7.17.1 remain intact', () => {
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

// ---------------------------------------------------------------------------
// 9. PRODUCTION RECONCILIATION & AUDIT
// ---------------------------------------------------------------------------
test('Step 18 Production: total profiles reconciles to 60 canonical Resonators', () => {
  const result = getCharacterInteractionProfileResult();
  assert.equal(result.profiles.length, 60);
  assert.equal(result.summary.totalProfiles, 60);
});

test('Step 18 Production: total underlying interactions reconciles strictly to 3,008', () => {
  const result = getCharacterInteractionProfileResult();
  assert.equal(result.summary.totalUnderlyingInteractions, 3008);
});

test('Step 18 Production: total outgoing and total incoming each reconcile strictly to 3,008', () => {
  const result = getCharacterInteractionProfileResult();
  assert.equal(result.summary.totalOutgoingIndexed, 3008);
  assert.equal(result.summary.totalIncomingIndexed, 3008);
  // Summing both directional perspectives yields 6016
  assert.equal(result.summary.totalOutgoingIndexed + result.summary.totalIncomingIndexed, 6016);
});

test('Step 18 Production: underlying status distribution reconciles exactly to Step 17 baseline', () => {
  const result = getCharacterInteractionProfileResult();
  assert.equal(result.summary.authoritativeTotal, 414);
  assert.equal(result.summary.unknownTotal, 2528);
  assert.equal(result.summary.unmodeledTotal, 66);
  assert.equal(result.summary.notApplicableTotal, 0);
  assert.equal(result.summary.conflictedTotal, 0);
});

test('Step 18 Production: 44 Resonators have outgoing > 0 and all 60 have incoming > 0', () => {
  const result = getCharacterInteractionProfileResult();
  assert.equal(result.summary.charactersWithOutgoing, 44);
  assert.equal(result.summary.charactersWithIncoming, 60);
});

test('Step 18 Production: auditCharacterInteractionProfiles passes cleanly on production result', () => {
  const result = getCharacterInteractionProfileResult();
  assert.doesNotThrow(() => {
    auditCharacterInteractionProfiles(result);
  });
});

// ---------------------------------------------------------------------------
// 10. REPOSITORY & QUERY APIS
// ---------------------------------------------------------------------------
test('Step 18 Repository: getCharacterInteractionProfile retrieves valid canonical profile', () => {
  const aalto = getCharacterInteractionProfile('Aalto');
  assert.ok(aalto);
  assert.equal(aalto.characterId, 'Aalto');
  assert.equal(aalto.outgoing.length, 19);
  assert.equal(aalto.incoming.length, 51);
});

test('Step 18 Repository: getCharacterInteractionProfile throws on non-canonical character', () => {
  assert.throws(() => {
    getCharacterInteractionProfile('UnknownNonExistentResonator');
  }, /Unknown or non-canonical character/);
});

test('Step 18 Repository: getOutgoingCharacterInteractions returns outgoing records', () => {
  const out = getOutgoingCharacterInteractions('Aalto');
  assert.equal(out.length, 19);
  for (const item of out) {
    assert.equal(item.sourceCharacterId, 'Aalto');
  }
});

test('Step 18 Repository: getIncomingCharacterInteractions returns incoming records', () => {
  const inc = getIncomingCharacterInteractions('Jiyan');
  assert.equal(inc.length, 60);
  for (const item of inc) {
    assert.equal(item.targetCharacterId, 'Jiyan');
  }
});

test('Step 18 Repository: character with zero outgoing interactions produces valid empty outgoing array', () => {
  const jiyan = getCharacterInteractionProfile('Jiyan');
  assert.ok(jiyan);
  assert.equal(jiyan.outgoing.length, 0);
  assert.equal(jiyan.summary.outgoingTotal, 0);
  assert.equal(jiyan.summary.distinctOutgoingTargets, 0);
  assert.ok(jiyan.incoming.length > 0);
});

test('Step 18 Repository: queryCharacterInteractionProfiles filters accurately', () => {
  const withOut = queryCharacterInteractionProfiles({ hasOutgoing: true });
  assert.equal(withOut.length, 44);

  const withoutOut = queryCharacterInteractionProfiles({ hasOutgoing: false });
  assert.equal(withoutOut.length, 16);

  const byChar = queryCharacterInteractionProfiles({ characterId: 'Aalto' });
  assert.equal(byChar.length, 1);
  assert.equal(byChar[0].characterId, 'Aalto');
});

test('Step 18 Explanation: explainCharacterInteractionProfile produces factual summary string', () => {
  const aalto = getCharacterInteractionProfile('Aalto')!;
  const expl = explainCharacterInteractionProfile(aalto);
  assert.ok(expl.includes('Character: Aalto'));
  assert.ok(expl.includes('Outgoing Interactions: 19'));
  assert.ok(expl.includes('Incoming Interactions: 51'));
});

// ---------------------------------------------------------------------------
// 11. AUDIT THROWING BEHAVIOR ON INVARIANT VIOLATIONS
// ---------------------------------------------------------------------------
test('Step 18 Invariant Audit: auditCharacterInteractionProfiles throws on null result', () => {
  assert.throws(() => {
    auditCharacterInteractionProfiles(null as any);
  }, /Audit failed: aggregation result is null or undefined/);
});

test('Step 18 Invariant Audit: Invariant A throws on invalid patchId', () => {
  const base = getCharacterInteractionProfileResult();
  assert.throws(() => {
    auditCharacterInteractionProfiles({ ...base, patchId: '3.8' as any });
  }, /Invariant A failure: patchId is '3.8'/);
});

test('Step 18 Invariant Audit: Invariant B throws on invalid ruleVersion', () => {
  const base = getCharacterInteractionProfileResult();
  assert.throws(() => {
    auditCharacterInteractionProfiles({ ...base, ruleVersion: '7.17.1' as any });
  }, /Invariant B failure: ruleVersion is '7.17.1'/);
});

test('Step 18 Invariant Audit: Invariant H throws if outgoing edge has wrong source', () => {
  const base = getCharacterInteractionProfileResult();
  const corruptedProfile = {
    ...base.profiles[0],
    outgoing: [
      {
        ...base.profiles[0].outgoing[0],
        sourceCharacterId: 'WrongCharacter'
      }
    ]
  };
  const corruptedProfiles = [corruptedProfile, ...base.profiles.slice(1)];
  assert.throws(() => {
    auditCharacterInteractionProfiles({ ...base, profiles: corruptedProfiles });
  }, /Invariant H failure: outgoing edge source 'WrongCharacter'/);
});

test('Step 18 Invariant Audit: Invariant I throws if incoming edge has wrong target', () => {
  const base = getCharacterInteractionProfileResult();
  const corruptedProfile = {
    ...base.profiles[0],
    incoming: [
      {
        ...base.profiles[0].incoming[0],
        targetCharacterId: 'WrongCharacter'
      }
    ]
  };
  const corruptedProfiles = [corruptedProfile, ...base.profiles.slice(1)];
  assert.throws(() => {
    auditCharacterInteractionProfiles({ ...base, profiles: corruptedProfiles });
  }, /Invariant I failure: incoming edge target 'WrongCharacter'/);
});

test('Step 18 Invariant Audit: Invariant J throws if summary count mismatches array length', () => {
  const base = getCharacterInteractionProfileResult();
  const corruptedProfile = {
    ...base.profiles[0],
    summary: {
      ...base.profiles[0].summary,
      outgoingTotal: 999
    }
  };
  const corruptedProfiles = [corruptedProfile, ...base.profiles.slice(1)];
  assert.throws(() => {
    auditCharacterInteractionProfiles({ ...base, profiles: corruptedProfiles });
  }, /Invariant J failure: outgoingTotal 999/);
});

test('Step 18 Invariant Audit: Invariant C throws on invalid profile patchVersion', () => {
  const base = getCharacterInteractionProfileResult();
  const corruptedProfile = {
    ...base.profiles[0],
    patchVersion: '3.8' as any
  };
  const corruptedProfiles = [corruptedProfile, ...base.profiles.slice(1)];
  assert.throws(() => {
    auditCharacterInteractionProfiles({ ...base, profiles: corruptedProfiles });
  }, /Invariant C failure: patchVersion is '3.8'/);
});

test('Step 18 Invariant Audit: Invariant D throws on invalid profile ruleVersion', () => {
  const base = getCharacterInteractionProfileResult();
  const corruptedProfile = {
    ...base.profiles[0],
    ruleVersion: '7.17.1' as any
  };
  const corruptedProfiles = [corruptedProfile, ...base.profiles.slice(1)];
  assert.throws(() => {
    auditCharacterInteractionProfiles({ ...base, profiles: corruptedProfiles });
  }, /Invariant D failure: ruleVersion is '7.17.1'/);
});

test('Step 18 Invariant Audit: Invariant E throws on non-canonical characterId', () => {
  const base = getCharacterInteractionProfileResult();
  const corruptedProfile = {
    ...base.profiles[0],
    characterId: 'NonCanonicalResonator'
  };
  const corruptedProfiles = [corruptedProfile, ...base.profiles.slice(1)];
  assert.throws(() => {
    auditCharacterInteractionProfiles({ ...base, profiles: corruptedProfiles });
  }, /Invariant E failure: characterId 'NonCanonicalResonator' is not canonical/);
});

test('Step 18 Invariant Audit: Invariant E throws on duplicate characterId', () => {
  const base = getCharacterInteractionProfileResult();
  const corruptedProfiles = [base.profiles[0], base.profiles[0]];
  assert.throws(() => {
    auditCharacterInteractionProfiles({
      ...base,
      profiles: corruptedProfiles,
      summary: { ...base.summary, totalProfiles: 2 }
    });
  }, /Invariant E failure: duplicate characterId/);
});

test('Step 18 Invariant Audit: Invariant F throws on malformed profile ID', () => {
  const base = getCharacterInteractionProfileResult();
  const corruptedProfile = {
    ...base.profiles[0],
    id: 'malformed-id'
  };
  const corruptedProfiles = [corruptedProfile, ...base.profiles.slice(1)];
  assert.throws(() => {
    auditCharacterInteractionProfiles({ ...base, profiles: corruptedProfiles });
  }, /Invariant F failure: malformed ID 'malformed-id'/);
});

test('Step 18 Invariant Audit: Invariant K throws on out-of-order profiles', () => {
  const base = getCharacterInteractionProfileResult();
  if (base.profiles.length >= 2) {
    const swapped = [base.profiles[1], base.profiles[0], ...base.profiles.slice(2)];
    assert.throws(() => {
      auditCharacterInteractionProfiles({ ...base, profiles: swapped });
    }, /Invariant K failure: out-of-order profiles/);
  }
});

test('Step 18 Invariant Audit: Invariant L throws on summary totalProfiles mismatch', () => {
  const base = getCharacterInteractionProfileResult();
  assert.throws(() => {
    auditCharacterInteractionProfiles({
      ...base,
      summary: { ...base.summary, totalProfiles: 999 }
    });
  }, /Invariant L failure: totalProfiles mismatch/);
});

test('Step 18 Invariant Audit: Invariant L throws on summary totalOutgoingIndexed mismatch', () => {
  const base = getCharacterInteractionProfileResult();
  assert.throws(() => {
    auditCharacterInteractionProfiles({
      ...base,
      summary: { ...base.summary, totalOutgoingIndexed: 999 }
    });
  }, /Invariant L failure: totalOutgoingIndexed mismatch/);
});

test('Step 18 Invariant Audit: Invariant L throws on summary totalIncomingIndexed mismatch', () => {
  const base = getCharacterInteractionProfileResult();
  assert.throws(() => {
    auditCharacterInteractionProfiles({
      ...base,
      summary: { ...base.summary, totalIncomingIndexed: 999 }
    });
  }, /Invariant L failure: totalIncomingIndexed mismatch/);
});

test('Step 18 Invariant Audit: Invariant L throws on summary charactersWithOutgoing mismatch', () => {
  const base = getCharacterInteractionProfileResult();
  assert.throws(() => {
    auditCharacterInteractionProfiles({
      ...base,
      summary: { ...base.summary, charactersWithOutgoing: 999 }
    });
  }, /Invariant L failure: charactersWithOutgoing mismatch/);
});

test('Step 18 Invariant Audit: Invariant L throws on summary charactersWithIncoming mismatch', () => {
  const base = getCharacterInteractionProfileResult();
  assert.throws(() => {
    auditCharacterInteractionProfiles({
      ...base,
      summary: { ...base.summary, charactersWithIncoming: 999 }
    });
  }, /Invariant L failure: charactersWithIncoming mismatch/);
});

test('Step 18 Invariant Audit: Invariant H throws on self-interaction in outgoing edge', () => {
  const base = getCharacterInteractionProfileResult();
  const charId = base.profiles[0].characterId;
  const corruptedProfile = {
    ...base.profiles[0],
    outgoing: [
      {
        ...base.profiles[0].outgoing[0] || makeMockStep17Evidence({ sourceCharacterId: charId, targetCharacterId: 'Encore' }),
        sourceCharacterId: charId,
        targetCharacterId: charId
      }
    ],
    summary: { ...base.profiles[0].summary, outgoingTotal: 1 }
  };
  const corruptedProfiles = [corruptedProfile, ...base.profiles.slice(1)];
  assert.throws(() => {
    auditCharacterInteractionProfiles({ ...base, profiles: corruptedProfiles });
  }, /Invariant H failure: self-interaction detected/);
});

test('Step 18 Invariant Audit: Invariant I throws on self-interaction in incoming edge', () => {
  const base = getCharacterInteractionProfileResult();
  const charId = base.profiles[0].characterId;
  const corruptedProfile = {
    ...base.profiles[0],
    incoming: [
      {
        ...base.profiles[0].incoming[0] || makeMockStep17Evidence({ sourceCharacterId: 'Encore', targetCharacterId: charId }),
        sourceCharacterId: charId,
        targetCharacterId: charId
      }
    ],
    summary: { ...base.profiles[0].summary, incomingTotal: 1 }
  };
  const corruptedProfiles = [corruptedProfile, ...base.profiles.slice(1)];
  assert.throws(() => {
    auditCharacterInteractionProfiles({ ...base, profiles: corruptedProfiles });
  }, /Invariant I failure: self-interaction detected/);
});

test('Step 18 Input Validation: empty characterIds array throws error', () => {
  assert.throws(() => {
    aggregateCharacterInteractionProfiles({
      patchId: '3.7',
      ruleVersion: '7.18.1',
      characterIds: []
    });
  }, /characterIds cannot be an empty array/);
});

test('Step 18 Input Validation: non-canonical character in characterIds array throws error', () => {
  assert.throws(() => {
    aggregateCharacterInteractionProfiles({
      patchId: '3.7',
      ruleVersion: '7.18.1',
      characterIds: ['Jiyan', 'FakeCharacter']
    });
  }, /Unknown or non-canonical characterId 'FakeCharacter'/);
});

test('Step 18 Input Validation: null or undefined evidence record throws error', () => {
  assert.throws(() => {
    aggregateCharacterInteractionProfiles({
      patchId: '3.7',
      ruleVersion: '7.18.1',
      characterIds: ['Jiyan'],
      interactionEvidence: [null as any]
    });
  }, /Null or undefined record/);
});

test('Step 18 Input Validation: non-canonical sourceCharacterId on evidence throws error', () => {
  assert.throws(() => {
    aggregateCharacterInteractionProfiles({
      patchId: '3.7',
      ruleVersion: '7.18.1',
      characterIds: ['Jiyan'],
      interactionEvidence: [makeMockStep17Evidence({ sourceCharacterId: 'FakeHero' })]
    });
  }, /Non-canonical source character 'FakeHero'/);
});

test('Step 18 Input Validation: non-canonical targetCharacterId on evidence throws error', () => {
  assert.throws(() => {
    aggregateCharacterInteractionProfiles({
      patchId: '3.7',
      ruleVersion: '7.18.1',
      characterIds: ['Jiyan'],
      interactionEvidence: [makeMockStep17Evidence({ targetCharacterId: 'FakeHero' })]
    });
  }, /Non-canonical target character 'FakeHero'/);
});

test('Step 18 Input Validation: self-interaction on evidence throws error', () => {
  assert.throws(() => {
    aggregateCharacterInteractionProfiles({
      patchId: '3.7',
      ruleVersion: '7.18.1',
      characterIds: ['Jiyan'],
      interactionEvidence: [makeMockStep17Evidence({ sourceCharacterId: 'Jiyan', targetCharacterId: 'Jiyan' })]
    });
  }, /Self-interaction 'Jiyan -> Jiyan' rejected/);
});

test('Step 18 Input Validation: invalid interactionType on evidence throws error', () => {
  assert.throws(() => {
    aggregateCharacterInteractionProfiles({
      patchId: '3.7',
      ruleVersion: '7.18.1',
      characterIds: ['Jiyan'],
      interactionEvidence: [makeMockStep17Evidence({ interactionType: 'BOGUS_TYPE' as any })]
    });
  }, /Invalid interactionType 'BOGUS_TYPE'/);
});

test('Step 18 Input Validation: invalid category on evidence throws error', () => {
  assert.throws(() => {
    aggregateCharacterInteractionProfiles({
      patchId: '3.7',
      ruleVersion: '7.18.1',
      characterIds: ['Jiyan'],
      interactionEvidence: [makeMockStep17Evidence({ category: 'BOGUS_CAT' as any })]
    });
  }, /Invalid category 'BOGUS_CAT'/);
});

test('Step 18 Input Validation: invalid evidenceStatus on evidence throws error', () => {
  assert.throws(() => {
    aggregateCharacterInteractionProfiles({
      patchId: '3.7',
      ruleVersion: '7.18.1',
      characterIds: ['Jiyan'],
      interactionEvidence: [makeMockStep17Evidence({ evidenceStatus: 'BOGUS_STATUS' as any })]
    });
  }, /Invalid evidenceStatus 'BOGUS_STATUS'/);
});

test('Step 18 Input Validation: missing provenance on evidence throws error', () => {
  assert.throws(() => {
    aggregateCharacterInteractionProfiles({
      patchId: '3.7',
      ruleVersion: '7.18.1',
      characterIds: ['Jiyan'],
      interactionEvidence: [makeMockStep17Evidence({ provenance: null as any })]
    });
  }, /Invalid or missing provenance/);
});

test('Step 18 Input Validation: ruleVersion mismatch on evidence throws error', () => {
  assert.throws(() => {
    aggregateCharacterInteractionProfiles({
      patchId: '3.7',
      ruleVersion: '7.18.1',
      characterIds: ['Jiyan'],
      interactionEvidence: [makeMockStep17Evidence({ ruleVersion: '7.16.1' as any })]
    });
  }, /Invalid ruleVersion '7.16.1'/);
});

test('Step 18 Repository: invalid patchId on repository queries throws error', () => {
  assert.throws(() => {
    getCharacterInteractionProfile('Jiyan', '3.6');
  }, /Invalid patchId '3.6'/);

  assert.throws(() => {
    getOutgoingCharacterInteractions('Jiyan', '3.8');
  }, /Invalid patchId '3.8'/);

  assert.throws(() => {
    getIncomingCharacterInteractions('Jiyan', '3.8');
  }, /Invalid patchId '3.8'/);

  assert.throws(() => {
    getCharacterInteractionProfileSummary('Jiyan', '3.8');
  }, /Invalid patchId '3.8'/);

  assert.throws(() => {
    getCharactersWithOutgoingInteractions('3.8');
  }, /Invalid patchId '3.8'/);

  assert.throws(() => {
    getCharactersWithIncomingInteractions('3.8');
  }, /Invalid patchId '3.8'/);
});

test('Step 18 Predicates: matchesCharacterInteractionProfileFilter tests all filter fields', () => {
  const profile = getCharacterInteractionProfile('Aalto')!;
  assert.ok(matchesCharacterInteractionProfileFilter(profile, { characterId: 'Aalto' }));
  assert.ok(!matchesCharacterInteractionProfileFilter(profile, { characterId: 'Jiyan' }));
  assert.ok(matchesCharacterInteractionProfileFilter(profile, { patchVersion: '3.7' }));
  assert.ok(!matchesCharacterInteractionProfileFilter(profile, { patchVersion: '3.8' as any }));
  assert.ok(matchesCharacterInteractionProfileFilter(profile, { hasOutgoing: true }));
  assert.ok(!matchesCharacterInteractionProfileFilter(profile, { hasOutgoing: false }));
  assert.ok(matchesCharacterInteractionProfileFilter(profile, { minOutgoing: 10 }));
  assert.ok(!matchesCharacterInteractionProfileFilter(profile, { minOutgoing: 50 }));
  assert.ok(matchesCharacterInteractionProfileFilter(profile, { minIncoming: 10 }));
  assert.ok(!matchesCharacterInteractionProfileFilter(profile, { minIncoming: 100 }));
});

