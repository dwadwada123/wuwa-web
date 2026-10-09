/**
 * Wuthering Waves Deterministic Capability Resolution Test Suite
 * Phase 7 Step 2: Capability Resolution & Applicability Engine
 *
 * Verifies that the Capability Resolution & Applicability Engine:
 * - Deterministically evaluates GameplayCapability against RuntimeEvaluationContext
 * - Preserves known numeric values without bypassing context requirements
 * - Strictly differentiates missing from mismatched context
 * - Never fabricates zeroes or bypasses the semantic safety gate
 * - Passes all 60 required test specifications
 */

import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { NormalizedEngineFact } from '../lib/engine/facts/types.ts';
import {
  buildGameplayCapability,
  buildGameplayCapabilities,
  auditProductionCapabilities
} from '../lib/engine/capabilities/builder.ts';
import type {
  GameplayCapability,
  RuntimeEvaluationContext
} from '../lib/engine/capabilities/types.ts';
import {
  resolveGameplayCapability,
  resolveGameplayCapabilities,
  resolveConsumableCapabilities
} from '../lib/engine/capabilities/resolution/resolver.ts';
import { runProductionCapabilityResolutionAudit } from '../lib/engine/capabilities/resolution/audit.ts';

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

function createMockCapability(overrides?: Partial<GameplayCapability>): GameplayCapability {
  const defaultFact = createMockFact();
  const defaultCap = buildGameplayCapability(defaultFact);
  const requiresAnyContext = Boolean(
    overrides?.requiresElement ||
    overrides?.requiresAction ||
    overrides?.requiresTrigger ||
    overrides?.requiresZone ||
    overrides?.requiresBuff ||
    overrides?.requiresStack ||
    overrides?.requiresRefinement ||
    (overrides?.requiredContext && Object.keys(overrides.requiredContext).length > 0)
  );

  return Object.freeze({
    ...defaultCap,
    requiresRuntimeContext: requiresAnyContext,
    isContextFree: !requiresAnyContext && (overrides?.isNumericValueKnown ?? defaultCap.isNumericValueKnown),
    ...overrides
  });
}

// ============================================================================
// SUITE 1: CORE RESOLUTION (Tests 1-7)
// ============================================================================

test('1. Core: context-free known capability resolves as APPLICABLE', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'ATK_PERCENT',
      element: 'NONE',
      consumptionState: 'CONSUMABLE_STATIC',
      staticNumericValue: 15,
      value: { type: 'EXACT', value: 15, unit: 'PERCENT' }
    })
  );

  assert.strictEqual(cap.isContextFree, true);
  const res = resolveGameplayCapability(cap);

  assert.strictEqual(res.status, 'APPLICABLE');
  assert.strictEqual(res.applicable, true);
  assert.strictEqual(res.numericValue, 15);
  assert.deepStrictEqual(res.missingDimensions, []);
  assert.deepStrictEqual(res.mismatchedDimensions, []);
});

test('2. Core: known numeric value is preserved', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'CRIT_RATE_PERCENT',
      element: 'NONE',
      consumptionState: 'CONSUMABLE_STATIC',
      staticNumericValue: 8.4,
      value: { type: 'EXACT', value: 8.4, unit: 'PERCENT' }
    })
  );

  const res = resolveGameplayCapability(cap);
  assert.strictEqual(res.numericValue, 8.4);
  assert.strictEqual(cap.numericValue, 8.4);
});

test('3. Core: missing context produces MISSING_CONTEXT', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'FUSION_DAMAGE_PERCENT',
      element: 'Fusion',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      staticNumericValue: null,
      value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
    })
  );

  assert.strictEqual(cap.requiresElement, true);
  const res = resolveGameplayCapability(cap, {});

  assert.strictEqual(res.status, 'MISSING_CONTEXT');
  assert.strictEqual(res.applicable, false);
  assert.strictEqual(res.numericValue, null);
  assert.deepStrictEqual(res.missingDimensions, ['ELEMENT']);
  assert.deepStrictEqual(res.mismatchedDimensions, []);
  assert.strictEqual(res.reasons.includes('ELEMENT_MISSING'), true);
});

test('4. Core: mismatch produces CONTEXT_MISMATCH', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'FUSION_DAMAGE_PERCENT',
      element: 'Fusion',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      staticNumericValue: null,
      value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
    })
  );

  const res = resolveGameplayCapability(cap, { element: 'Glacio' });

  assert.strictEqual(res.status, 'CONTEXT_MISMATCH');
  assert.strictEqual(res.applicable, false);
  assert.strictEqual(res.numericValue, null);
  assert.deepStrictEqual(res.missingDimensions, []);
  assert.deepStrictEqual(res.mismatchedDimensions, ['ELEMENT']);
  assert.strictEqual(res.reasons.includes('ELEMENT_MISMATCH'), true);
});

test('5. Core: unmodeled produces UNMODELED', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'UNRESOLVED_PARAMETER',
      consumptionState: 'UNMODELED',
      semanticStatus: 'UNMODELED',
      value: { type: 'UNRESOLVED', reason: 'Unmodeled complex gauge mechanic' },
      staticNumericValue: null
    })
  );

  assert.strictEqual(cap.status, 'UNMODELED');
  const res = resolveGameplayCapability(cap, { element: 'Fusion', actionType: 'RESONANCE_SKILL' });

  assert.strictEqual(res.status, 'UNMODELED');
  assert.strictEqual(res.applicable, false);
  assert.strictEqual(res.numericValue, null);
  assert.strictEqual(res.reasons.includes('UNMODELED_MECHANIC'), true);
});

test('6. Core: unknown value never becomes zero', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'UNRESOLVED_PARAMETER',
      consumptionState: 'UNKNOWN',
      semanticStatus: 'UNKNOWN',
      value: { type: 'UNRESOLVED', reason: 'Unknown multiplier' },
      staticNumericValue: null
    })
  );

  const res = resolveGameplayCapability(cap);
  assert.strictEqual(res.status, 'UNKNOWN');
  assert.strictEqual(res.applicable, false);
  assert.strictEqual(res.numericValue, null);
  assert.notStrictEqual(res.numericValue, 0);
});

test('7. Core: NOT_APPLICABLE remains non-applicable', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'UNRESOLVED_PARAMETER',
      consumptionState: 'NOT_APPLICABLE',
      semanticStatus: 'SAFE_EXPLICIT',
      value: { type: 'EXACT', value: 10, unit: 'PERCENT' },
      staticNumericValue: 10
    })
  );

  const res = resolveGameplayCapability(cap);
  assert.strictEqual(res.status, 'NOT_APPLICABLE');
  assert.strictEqual(res.applicable, false);
  assert.strictEqual(res.numericValue, null);
});

// ============================================================================
// SUITE 2: ELEMENT SEMANTICS (Tests 8-14)
// ============================================================================

test('8. Element: Fusion requires Fusion context', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'FUSION_DAMAGE_PERCENT',
      element: 'Fusion',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      staticNumericValue: null,
      value: { type: 'EXACT', value: 25, unit: 'PERCENT' }
    })
  );

  assert.strictEqual(cap.requiresElement, true);
  assert.strictEqual(cap.requiredContext?.element, 'Fusion');
});

test('9. Element: Fusion without context fails', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'FUSION_DAMAGE_PERCENT',
      element: 'Fusion',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      staticNumericValue: null,
      value: { type: 'EXACT', value: 25, unit: 'PERCENT' }
    })
  );

  const res = resolveGameplayCapability(cap);
  assert.strictEqual(res.status, 'MISSING_CONTEXT');
  assert.strictEqual(res.applicable, false);
  assert.strictEqual(res.numericValue, null);
  assert.deepStrictEqual(res.missingDimensions, ['ELEMENT']);
});

test('10. Element: Fusion with Glacio fails', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'FUSION_DAMAGE_PERCENT',
      element: 'Fusion',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      staticNumericValue: null,
      value: { type: 'EXACT', value: 25, unit: 'PERCENT' }
    })
  );

  const res = resolveGameplayCapability(cap, { element: 'Glacio' });
  assert.strictEqual(res.status, 'CONTEXT_MISMATCH');
  assert.strictEqual(res.applicable, false);
  assert.strictEqual(res.numericValue, null);
  assert.deepStrictEqual(res.mismatchedDimensions, ['ELEMENT']);
});

test('11. Element: Fusion with Fusion passes', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'FUSION_DAMAGE_PERCENT',
      element: 'Fusion',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      staticNumericValue: null,
      value: { type: 'EXACT', value: 25, unit: 'PERCENT' }
    })
  );

  const res = resolveGameplayCapability(cap, { element: 'Fusion' });
  assert.strictEqual(res.status, 'APPLICABLE');
  assert.strictEqual(res.applicable, true);
  assert.strictEqual(res.numericValue, 25);
  assert.deepStrictEqual(res.missingDimensions, []);
  assert.deepStrictEqual(res.mismatchedDimensions, []);
});

test('12. Element: NONE does not require element', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'ATK_PERCENT',
      element: 'NONE',
      consumptionState: 'CONSUMABLE_STATIC',
      staticNumericValue: 12,
      value: { type: 'EXACT', value: 12, unit: 'PERCENT' }
    })
  );

  assert.strictEqual(cap.requiresElement, false);
  const resNoElem = resolveGameplayCapability(cap, {});
  assert.strictEqual(resNoElem.status, 'APPLICABLE');
  assert.strictEqual(resNoElem.applicable, true);
  assert.strictEqual(resNoElem.numericValue, 12);

  const resWithElem = resolveGameplayCapability(cap, { element: 'Fusion' });
  assert.strictEqual(resWithElem.status, 'APPLICABLE');
  assert.strictEqual(resWithElem.applicable, true);
  assert.strictEqual(resWithElem.numericValue, 12);
});

test('13. Element: All follows Phase 6C semantics', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'ALL_ATTRIBUTE_DAMAGE_PERCENT',
      element: 'All',
      consumptionState: 'CONSUMABLE_STATIC',
      staticNumericValue: 10,
      value: { type: 'EXACT', value: 10, unit: 'PERCENT' }
    })
  );

  // Applicable without context
  const resZero = resolveGameplayCapability(cap);
  assert.strictEqual(resZero.status, 'APPLICABLE');
  assert.strictEqual(resZero.numericValue, 10);

  // Applicable with any canonical element
  for (const elem of ['Glacio', 'Fusion', 'Electro', 'Aero', 'Spectro', 'Havoc', 'All'] as const) {
    const res = resolveGameplayCapability(cap, { element: elem });
    assert.strictEqual(res.status, 'APPLICABLE');
    assert.strictEqual(res.applicable, true);
    assert.strictEqual(res.numericValue, 10);
  }
});

test('14. Element: invalid element fails closed', () => {
  const capAll = buildGameplayCapability(
    createMockFact({
      parameter: 'ALL_ATTRIBUTE_DAMAGE_PERCENT',
      element: 'All',
      consumptionState: 'CONSUMABLE_STATIC',
      staticNumericValue: 10,
      value: { type: 'EXACT', value: 10, unit: 'PERCENT' }
    })
  );

  const resInvalid = resolveGameplayCapability(capAll, { element: 'PHYSICAL' as any });
  assert.strictEqual(resInvalid.status, 'CONTEXT_MISMATCH');
  assert.strictEqual(resInvalid.applicable, false);
  assert.strictEqual(resInvalid.numericValue, null);
  assert.deepStrictEqual(resInvalid.mismatchedDimensions, ['ELEMENT']);
  assert.strictEqual(resInvalid.reasons.includes('ELEMENT_MISMATCH'), true);

  const capFusion = buildGameplayCapability(
    createMockFact({
      parameter: 'FUSION_DAMAGE_PERCENT',
      element: 'Fusion',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      staticNumericValue: null,
      value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
    })
  );

  const resInvalidFusion = resolveGameplayCapability(capFusion, { element: 'PHYSICAL' as any });
  assert.strictEqual(resInvalidFusion.status, 'CONTEXT_MISMATCH');
  assert.strictEqual(resInvalidFusion.applicable, false);
  assert.strictEqual(resInvalidFusion.numericValue, null);
});

// ============================================================================
// SUITE 3: ACTION SEMANTICS (Tests 15-18)
// ============================================================================

test('15. Action: Skill-only modifier requires SKILL', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'SKILL_DAMAGE_PERCENT',
      parameterSafety: 'REQUIRES_CONTEXT',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      staticNumericValue: null,
      value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
    })
  );

  assert.strictEqual(cap.requiresAction, true);
  assert.strictEqual(cap.requiredContext?.actionType, 'RESONANCE_SKILL');
  assert.strictEqual(cap.numericValue, 20); // Value preserved on capability
});

test('16. Action: missing action fails', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'SKILL_DAMAGE_PERCENT',
      parameterSafety: 'REQUIRES_CONTEXT',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      staticNumericValue: null,
      value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
    })
  );

  const res = resolveGameplayCapability(cap, {});
  assert.strictEqual(res.status, 'MISSING_CONTEXT');
  assert.strictEqual(res.applicable, false);
  assert.strictEqual(res.numericValue, null);
  assert.deepStrictEqual(res.missingDimensions, ['ACTION']);
  assert.strictEqual(res.reasons.includes('ACTION_MISSING'), true);
});

test('17. Action: wrong action fails', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'SKILL_DAMAGE_PERCENT',
      parameterSafety: 'REQUIRES_CONTEXT',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      staticNumericValue: null,
      value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
    })
  );

  const res = resolveGameplayCapability(cap, { actionType: 'BASIC_ATTACK' });
  assert.strictEqual(res.status, 'CONTEXT_MISMATCH');
  assert.strictEqual(res.applicable, false);
  assert.strictEqual(res.numericValue, null);
  assert.deepStrictEqual(res.mismatchedDimensions, ['ACTION']);
  assert.strictEqual(res.reasons.includes('ACTION_MISMATCH'), true);
});

test('18. Action: correct action passes', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'SKILL_DAMAGE_PERCENT',
      parameterSafety: 'REQUIRES_CONTEXT',
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      staticNumericValue: null,
      value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
    })
  );

  const res = resolveGameplayCapability(cap, { actionType: 'RESONANCE_SKILL' });
  assert.strictEqual(res.status, 'APPLICABLE');
  assert.strictEqual(res.applicable, true);
  assert.strictEqual(res.numericValue, 20);
  assert.deepStrictEqual(res.missingDimensions, []);
  assert.deepStrictEqual(res.mismatchedDimensions, []);
});

// ============================================================================
// SUITE 4: TRIGGER SEMANTICS (Tests 19-21)
// ============================================================================

test('19. Trigger: Outro requirement requires Outro', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      condition: { trigger: 'ON_OUTRO_SKILL' },
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      staticNumericValue: null,
      value: { type: 'EXACT', value: 23, unit: 'PERCENT' }
    })
  );

  assert.strictEqual(cap.requiresTrigger, true);
  assert.strictEqual(cap.requiredContext?.trigger, 'ON_OUTRO_SKILL');

  const res = resolveGameplayCapability(cap, { trigger: 'ON_OUTRO_SKILL' });
  assert.strictEqual(res.status, 'APPLICABLE');
  assert.strictEqual(res.applicable, true);
  assert.strictEqual(res.numericValue, 23);
});

test('20. Trigger: Intro does not satisfy Outro', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      condition: { trigger: 'ON_OUTRO_SKILL' },
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      staticNumericValue: null,
      value: { type: 'EXACT', value: 23, unit: 'PERCENT' }
    })
  );

  const res = resolveGameplayCapability(cap, { trigger: 'ON_INTRO_SKILL' });
  assert.strictEqual(res.status, 'CONTEXT_MISMATCH');
  assert.strictEqual(res.applicable, false);
  assert.strictEqual(res.numericValue, null);
  assert.deepStrictEqual(res.mismatchedDimensions, ['TRIGGER']);
  assert.strictEqual(res.reasons.includes('TRIGGER_MISMATCH'), true);
});

test('21. Trigger: missing trigger fails', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      condition: { trigger: 'ON_OUTRO_SKILL' },
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      staticNumericValue: null,
      value: { type: 'EXACT', value: 23, unit: 'PERCENT' }
    })
  );

  const res = resolveGameplayCapability(cap, {});
  assert.strictEqual(res.status, 'MISSING_CONTEXT');
  assert.strictEqual(res.applicable, false);
  assert.strictEqual(res.numericValue, null);
  assert.deepStrictEqual(res.missingDimensions, ['TRIGGER']);
  assert.strictEqual(res.reasons.includes('TRIGGER_MISSING'), true);
});

// ============================================================================
// SUITE 5: COMPOSITE REQUIREMENTS (Tests 22-26)
// ============================================================================

test('22. Composite: Element + Trigger requires both', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      element: 'Fusion',
      parameter: 'FUSION_DAMAGE_PERCENT',
      condition: { trigger: 'ON_OUTRO_SKILL' },
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      staticNumericValue: null,
      value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
    })
  );

  assert.strictEqual(cap.requiresElement, true);
  assert.strictEqual(cap.requiresTrigger, true);

  const res = resolveGameplayCapability(cap, { element: 'Fusion', trigger: 'ON_OUTRO_SKILL' });
  assert.strictEqual(res.status, 'APPLICABLE');
  assert.strictEqual(res.applicable, true);
  assert.strictEqual(res.numericValue, 20);
});

test('23. Composite: Action + Trigger requires both', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      parameter: 'SKILL_DAMAGE_PERCENT',
      parameterSafety: 'REQUIRES_CONTEXT',
      condition: { trigger: 'ON_INTRO_SKILL' },
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      staticNumericValue: null,
      value: { type: 'EXACT', value: 15, unit: 'PERCENT' }
    })
  );

  assert.strictEqual(cap.requiresAction, true);
  assert.strictEqual(cap.requiresTrigger, true);

  const res = resolveGameplayCapability(cap, { actionType: 'RESONANCE_SKILL', trigger: 'ON_INTRO_SKILL' });
  assert.strictEqual(res.status, 'APPLICABLE');
  assert.strictEqual(res.applicable, true);
  assert.strictEqual(res.numericValue, 15);
});

test('24. Composite: one missing dimension fails', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      element: 'Fusion',
      parameter: 'FUSION_DAMAGE_PERCENT',
      condition: { trigger: 'ON_OUTRO_SKILL' },
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      staticNumericValue: null,
      value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
    })
  );

  // Element present, trigger missing
  const res = resolveGameplayCapability(cap, { element: 'Fusion' });
  assert.strictEqual(res.status, 'MISSING_CONTEXT');
  assert.strictEqual(res.applicable, false);
  assert.strictEqual(res.numericValue, null);
  assert.deepStrictEqual(res.missingDimensions, ['TRIGGER']);
  assert.deepStrictEqual(res.mismatchedDimensions, []);
});

test('25. Composite: one mismatched dimension fails', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      element: 'Fusion',
      parameter: 'FUSION_DAMAGE_PERCENT',
      condition: { trigger: 'ON_OUTRO_SKILL' },
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      staticNumericValue: null,
      value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
    })
  );

  // Element matches (Fusion), trigger mismatches (Intro)
  const res = resolveGameplayCapability(cap, { element: 'Fusion', trigger: 'ON_INTRO_SKILL' });
  assert.strictEqual(res.status, 'CONTEXT_MISMATCH');
  assert.strictEqual(res.applicable, false);
  assert.strictEqual(res.numericValue, null);
  assert.deepStrictEqual(res.missingDimensions, []);
  assert.deepStrictEqual(res.mismatchedDimensions, ['TRIGGER']);
});

test('26. Composite: all dimensions correct passes', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      element: 'Fusion',
      parameter: 'FUSION_DAMAGE_PERCENT',
      condition: { trigger: 'ON_OUTRO_SKILL' },
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      staticNumericValue: null,
      value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
    })
  );

  const res = resolveGameplayCapability(cap, { element: 'Fusion', trigger: 'ON_OUTRO_SKILL' });
  assert.strictEqual(res.status, 'APPLICABLE');
  assert.strictEqual(res.applicable, true);
  assert.strictEqual(res.numericValue, 20);
  assert.deepStrictEqual(res.missingDimensions, []);
  assert.deepStrictEqual(res.mismatchedDimensions, []);
});

// ============================================================================
// SUITE 6: STACK SEMANTICS (Tests 27-31)
// ============================================================================

test('27. Stack: EXACT semantics', () => {
  const cap = createMockCapability({
    requiresStack: true,
    requiredContext: { stackCount: 3, stackOperator: 'EXACT' }
  });

  const resExact = resolveGameplayCapability(cap, { stackCount: 3 });
  assert.strictEqual(resExact.status, 'APPLICABLE');
  assert.strictEqual(resExact.applicable, true);

  const resMismatch = resolveGameplayCapability(cap, { stackCount: 4 });
  assert.strictEqual(resMismatch.status, 'CONTEXT_MISMATCH');
  assert.strictEqual(resMismatch.applicable, false);
  assert.deepStrictEqual(resMismatch.mismatchedDimensions, ['STACK_COUNT']);
});

test('28. Stack: AT_LEAST semantics', () => {
  const cap = createMockCapability({
    requiresStack: true,
    requiredContext: { stackCount: 3, stackOperator: 'AT_LEAST' }
  });

  const resMet = resolveGameplayCapability(cap, { stackCount: 3 });
  assert.strictEqual(resMet.status, 'APPLICABLE');
  assert.strictEqual(resMet.applicable, true);

  const resExceeded = resolveGameplayCapability(cap, { stackCount: 5 });
  assert.strictEqual(resExceeded.status, 'APPLICABLE');
  assert.strictEqual(resExceeded.applicable, true);

  const resUnder = resolveGameplayCapability(cap, { stackCount: 2 });
  assert.strictEqual(resUnder.status, 'CONTEXT_MISMATCH');
  assert.strictEqual(resUnder.applicable, false);
  assert.deepStrictEqual(resUnder.mismatchedDimensions, ['STACK_COUNT']);
});

test('29. Stack: missing stack fails', () => {
  const cap = createMockCapability({
    requiresStack: true,
    requiredContext: { stackCount: 3, stackOperator: 'EXACT' }
  });

  const res = resolveGameplayCapability(cap, {});
  assert.strictEqual(res.status, 'MISSING_CONTEXT');
  assert.strictEqual(res.applicable, false);
  assert.strictEqual(res.numericValue, null);
  assert.deepStrictEqual(res.missingDimensions, ['STACK_COUNT']);
});

test('30. Stack: invalid stack does not default to zero', () => {
  const cap = createMockCapability({
    requiresStack: true,
    requiredContext: { stackCount: 3, stackOperator: 'EXACT' }
  });

  const resNegative = resolveGameplayCapability(cap, { stackCount: -1 });
  assert.strictEqual(resNegative.status, 'CONTEXT_MISMATCH');
  assert.strictEqual(resNegative.applicable, false);
  assert.strictEqual(resNegative.numericValue, null);

  const resNaN = resolveGameplayCapability(cap, { stackCount: NaN });
  assert.strictEqual(resNaN.status, 'CONTEXT_MISMATCH');
  assert.strictEqual(resNaN.applicable, false);
  assert.strictEqual(resNaN.numericValue, null);
});

test('31. Stack: unsupported PER_STACK remains unresolved where formula is unavailable', () => {
  const cap = createMockCapability({
    requiresStack: true,
    requiredContext: { stackCount: 1, stackOperator: 'PER_STACK' }
  });

  const res = resolveGameplayCapability(cap, { stackCount: 4 });
  assert.strictEqual(res.status, 'UNMODELED');
  assert.strictEqual(res.applicable, false);
  assert.strictEqual(res.numericValue, null);
  assert.strictEqual(res.reasons.includes('UNMODELED_MECHANIC'), true);
});

// ============================================================================
// SUITE 7: REFINEMENT SEMANTICS (Tests 32-36)
// ============================================================================

test('32. Refinement: refinement context required', () => {
  const cap = createMockCapability({
    requiresRefinement: true,
    refinementRank: 'R1',
    numericValue: 16,
    requiredContext: { refinementRank: true }
  });

  assert.strictEqual(cap.requiresRefinement, true);
  const res = resolveGameplayCapability(cap, { refinementRank: 'R1' });
  assert.strictEqual(res.status, 'APPLICABLE');
  assert.strictEqual(res.applicable, true);
  assert.strictEqual(res.numericValue, 16);
});

test('33. Refinement: missing refinement fails', () => {
  const cap = createMockCapability({
    requiresRefinement: true,
    refinementRank: 'R1',
    numericValue: 16,
    requiredContext: { refinementRank: true }
  });

  const res = resolveGameplayCapability(cap, {});
  assert.strictEqual(res.status, 'MISSING_CONTEXT');
  assert.strictEqual(res.applicable, false);
  assert.strictEqual(res.numericValue, null);
  assert.deepStrictEqual(res.missingDimensions, ['REFINEMENT_RANK']);
});

test('34. Refinement: wrong refinement fails', () => {
  const cap = createMockCapability({
    requiresRefinement: true,
    refinementRank: 'R1',
    numericValue: 16,
    requiredContext: { refinementRank: true }
  });

  const res = resolveGameplayCapability(cap, { refinementRank: 'R2' });
  assert.strictEqual(res.status, 'CONTEXT_MISMATCH');
  assert.strictEqual(res.applicable, false);
  assert.strictEqual(res.numericValue, null);
  assert.deepStrictEqual(res.mismatchedDimensions, ['REFINEMENT_RANK']);
});

test('35. Refinement: correct refinement passes', () => {
  const cap = createMockCapability({
    requiresRefinement: true,
    refinementRank: 'R5',
    numericValue: 32,
    requiredContext: { refinementRank: true }
  });

  const res = resolveGameplayCapability(cap, { refinementRank: 'R5' });
  assert.strictEqual(res.status, 'APPLICABLE');
  assert.strictEqual(res.applicable, true);
  assert.strictEqual(res.numericValue, 32);
});

test('36. Refinement: no R1 fallback', () => {
  const cap = createMockCapability({
    requiresRefinement: true,
    refinementRank: 'R1',
    numericValue: 16,
    requiredContext: { refinementRank: true }
  });

  // Never fall back to R1 when context is omitted
  const res = resolveGameplayCapability(cap);
  assert.strictEqual(res.status, 'MISSING_CONTEXT');
  assert.strictEqual(res.applicable, false);
  assert.strictEqual(res.numericValue, null);
  assert.notStrictEqual(res.numericValue, 16);
});

// ============================================================================
// SUITE 8: ZONE / BUFF STATE (Tests 37-40)
// ============================================================================

test('37. Zone / Buff: required zone state', () => {
  const cap = createMockCapability({
    requiresZone: true,
    requiredContext: { zoneActive: true }
  });

  const resActive = resolveGameplayCapability(cap, { zoneActive: true });
  assert.strictEqual(resActive.status, 'APPLICABLE');
  assert.strictEqual(resActive.applicable, true);

  const resInactive = resolveGameplayCapability(cap, { zoneActive: false });
  assert.strictEqual(resInactive.status, 'CONTEXT_MISMATCH');
  assert.strictEqual(resInactive.applicable, false);
  assert.deepStrictEqual(resInactive.mismatchedDimensions, ['ZONE_STATE']);
});

test('38. Zone / Buff: required buff state', () => {
  const cap = createMockCapability({
    requiresBuff: true,
    requiredContext: { buffActive: true }
  });

  const resActive = resolveGameplayCapability(cap, { buffActive: true });
  assert.strictEqual(resActive.status, 'APPLICABLE');
  assert.strictEqual(resActive.applicable, true);

  const resInactive = resolveGameplayCapability(cap, { buffActive: false });
  assert.strictEqual(resInactive.status, 'CONTEXT_MISMATCH');
  assert.strictEqual(resInactive.applicable, false);
  assert.deepStrictEqual(resInactive.mismatchedDimensions, ['BUFF_STATE']);
});

test('39. Zone / Buff: missing state fails', () => {
  const cap = createMockCapability({
    requiresZone: true,
    requiredContext: { zoneActive: true }
  });

  const res = resolveGameplayCapability(cap, {});
  assert.strictEqual(res.status, 'MISSING_CONTEXT');
  assert.strictEqual(res.applicable, false);
  assert.strictEqual(res.numericValue, null);
  assert.deepStrictEqual(res.missingDimensions, ['ZONE_STATE']);
});

test('40. Zone / Buff: mismatched state fails', () => {
  const cap = createMockCapability({
    requiresBuff: true,
    requiredContext: { buffActive: true }
  });

  const res = resolveGameplayCapability(cap, { buffActive: false });
  assert.strictEqual(res.status, 'CONTEXT_MISMATCH');
  assert.strictEqual(res.applicable, false);
  assert.strictEqual(res.numericValue, null);
  assert.deepStrictEqual(res.mismatchedDimensions, ['BUFF_STATE']);
});

// ============================================================================
// SUITE 9: DIAGNOSTICS & TRACEABILITY (Tests 41-45)
// ============================================================================

test('41. Diagnostics: missing dimensions are reported', () => {
  const cap = createMockCapability({
    requiresElement: true,
    requiresTrigger: true,
    requiredContext: { element: 'Fusion', trigger: 'Outro' }
  });

  const res = resolveGameplayCapability(cap, {});
  assert.strictEqual(res.status, 'MISSING_CONTEXT');
  assert.deepStrictEqual(res.missingDimensions, ['ELEMENT', 'TRIGGER']);
  assert.deepStrictEqual(res.mismatchedDimensions, []);
});

test('42. Diagnostics: mismatched dimensions are reported', () => {
  const cap = createMockCapability({
    requiresElement: true,
    requiresAction: true,
    requiredContext: { element: 'Fusion', actionType: 'RESONANCE_SKILL' }
  });

  const res = resolveGameplayCapability(cap, { element: 'Glacio', actionType: 'BASIC_ATTACK' });
  assert.strictEqual(res.status, 'CONTEXT_MISMATCH');
  assert.deepStrictEqual(res.missingDimensions, []);
  assert.deepStrictEqual(res.mismatchedDimensions, ['ELEMENT', 'ACTION']);
});

test('43. Diagnostics: reasons are deterministic', () => {
  const cap = createMockCapability({
    requiresElement: true,
    requiredContext: { element: 'Fusion' }
  });

  const res1 = resolveGameplayCapability(cap, { element: 'Glacio' });
  const res2 = resolveGameplayCapability(cap, { element: 'Glacio' });

  assert.deepStrictEqual(res1.reasons, res2.reasons);
  assert.deepStrictEqual(res1.reasons, ['ELEMENT_REQUIRED', 'ELEMENT_MISMATCH']);
});

test('44. Diagnostics: result contains source factIds', () => {
  const cap = createMockCapability({
    factIds: ['fact_alpha', 'fact_beta']
  });

  const res = resolveGameplayCapability(cap);
  assert.deepStrictEqual(res.factIds, ['fact_alpha', 'fact_beta']);
});

test('45. Diagnostics: result remains immutable', () => {
  const cap = createMockCapability();
  const res = resolveGameplayCapability(cap);

  assert.strictEqual(Object.isFrozen(res), true);
  assert.strictEqual(Object.isFrozen(res.missingDimensions), true);
  assert.strictEqual(Object.isFrozen(res.mismatchedDimensions), true);
  assert.strictEqual(Object.isFrozen(res.reasons), true);
  assert.strictEqual(Object.isFrozen(res.factIds), true);
});

// ============================================================================
// SUITE 10: REGRESSION AUDIT (Tests 46-49)
// ============================================================================

test('46. Regression: Youhu NEXT_RESONATOR regression', () => {
  const prodAudit = auditProductionCapabilities();
  const youhuOutro = prodAudit.capabilities.find(
    (c) => c.entityId === 'Youhu' && c.sourceCode === 'OUTRO_SKILL'
  );

  assert.ok(youhuOutro, 'Youhu outro capability must exist in Patch 3.7 production dataset');
  assert.strictEqual(youhuOutro.target, 'NEXT_RESONATOR');
  assert.strictEqual(youhuOutro.kind, 'COORDINATED_ATTACK_AMPLIFICATION');
});

test('47. Regression: Youhu remains UNMODELED', () => {
  const prodAudit = auditProductionCapabilities();
  const youhuOutro = prodAudit.capabilities.find(
    (c) => c.entityId === 'Youhu' && c.sourceCode === 'OUTRO_SKILL'
  );

  assert.ok(youhuOutro);
  assert.strictEqual(youhuOutro.status, 'UNMODELED');
  assert.strictEqual(youhuOutro.semanticStatus, 'UNMODELED');

  const res = resolveGameplayCapability(youhuOutro, { trigger: 'ON_OUTRO_SKILL' });
  assert.strictEqual(res.status, 'UNMODELED');
  assert.strictEqual(res.applicable, false);
});

test('48. Regression: Youhu numericValue remains null', () => {
  const prodAudit = auditProductionCapabilities();
  const youhuOutro = prodAudit.capabilities.find(
    (c) => c.entityId === 'Youhu' && c.sourceCode === 'OUTRO_SKILL'
  );

  assert.ok(youhuOutro);
  assert.strictEqual(youhuOutro.numericValue, null);

  const res = resolveGameplayCapability(youhuOutro);
  assert.strictEqual(res.numericValue, null);
  assert.notStrictEqual(res.numericValue, 0);
});

test('49. Regression: Youhu target is unchanged', () => {
  const prodAudit = auditProductionCapabilities();
  const youhuOutro = prodAudit.capabilities.find(
    (c) => c.entityId === 'Youhu' && c.sourceCode === 'OUTRO_SKILL'
  );

  assert.ok(youhuOutro);
  assert.strictEqual(youhuOutro.target, 'NEXT_RESONATOR');
});

// ============================================================================
// SUITE 11: ENGINE SAFETY & ZERO FABRICATION (Tests 50-57)
// ============================================================================

test('50. Safety: no zero fabrication', () => {
  const audit = runProductionCapabilityResolutionAudit();
  for (const res of audit.zeroContextResolutions) {
    if (!res.applicable) {
      assert.strictEqual(res.numericValue, null);
      assert.notStrictEqual(res.numericValue, 0);
    }
  }
});

test('51. Safety: no parser bypass in resolution module', () => {
  const resolverPath = path.resolve(process.cwd(), 'lib/engine/capabilities/resolution/resolver.ts');
  const code = fs.readFileSync(resolverPath, 'utf8');

  assert.strictEqual(code.includes('parseDescription'), false);
  assert.strictEqual(code.includes('parseSkill'), false);
  assert.strictEqual(code.includes('parseResonance'), false);
  assert.strictEqual(code.includes('regex'), false);
});

test('52. Safety: no raw semantic extraction imports in resolution module', () => {
  const resolverPath = path.resolve(process.cwd(), 'lib/engine/capabilities/resolution/resolver.ts');
  const typesPath = path.resolve(process.cwd(), 'lib/engine/capabilities/resolution/types.ts');
  const code = fs.readFileSync(resolverPath, 'utf8') + fs.readFileSync(typesPath, 'utf8');

  assert.strictEqual(code.includes('SemanticEffect'), false);
  assert.strictEqual(code.includes('lib/semantics/parser'), false);
  assert.strictEqual(code.includes('raw_'), false);
});

test('53. Safety: no Number() conversions in resolution files', () => {
  const resolverPath = path.resolve(process.cwd(), 'lib/engine/capabilities/resolution/resolver.ts');
  const typesPath = path.resolve(process.cwd(), 'lib/engine/capabilities/resolution/types.ts');
  const code = fs.readFileSync(resolverPath, 'utf8') + fs.readFileSync(typesPath, 'utf8');

  // Must not perform dynamic string-to-number casting (Number.isFinite is allowed)
  const numberCastingRegex = /(?<!\.)Number\s*\(/;
  assert.strictEqual(numberCastingRegex.test(code), false);
});

test('54. Safety: no parseFloat() in resolution files', () => {
  const resolverPath = path.resolve(process.cwd(), 'lib/engine/capabilities/resolution/resolver.ts');
  const typesPath = path.resolve(process.cwd(), 'lib/engine/capabilities/resolution/types.ts');
  const code = fs.readFileSync(resolverPath, 'utf8') + fs.readFileSync(typesPath, 'utf8');

  assert.strictEqual(code.includes('parseFloat('), false);
});

test('55. Safety: no parseInt() in resolution files', () => {
  const resolverPath = path.resolve(process.cwd(), 'lib/engine/capabilities/resolution/resolver.ts');
  const typesPath = path.resolve(process.cwd(), 'lib/engine/capabilities/resolution/types.ts');
  const code = fs.readFileSync(resolverPath, 'utf8') + fs.readFileSync(typesPath, 'utf8');

  assert.strictEqual(code.includes('parseInt('), false);
});

test('56. Safety: no ?? 0 default fallbacks in resolution files', () => {
  const resolverPath = path.resolve(process.cwd(), 'lib/engine/capabilities/resolution/resolver.ts');
  const typesPath = path.resolve(process.cwd(), 'lib/engine/capabilities/resolution/types.ts');
  const auditPath = path.resolve(process.cwd(), 'lib/engine/capabilities/resolution/audit.ts');
  const code =
    fs.readFileSync(resolverPath, 'utf8') +
    fs.readFileSync(typesPath, 'utf8') +
    fs.readFileSync(auditPath, 'utf8');

  assert.strictEqual(code.includes('?? 0'), false);
});

test('57. Safety: no || 0 default fallbacks in resolution files', () => {
  const resolverPath = path.resolve(process.cwd(), 'lib/engine/capabilities/resolution/resolver.ts');
  const typesPath = path.resolve(process.cwd(), 'lib/engine/capabilities/resolution/types.ts');
  const auditPath = path.resolve(process.cwd(), 'lib/engine/capabilities/resolution/audit.ts');
  const code =
    fs.readFileSync(resolverPath, 'utf8') +
    fs.readFileSync(typesPath, 'utf8') +
    fs.readFileSync(auditPath, 'utf8');

  assert.strictEqual(code.includes('|| 0'), false);
});

// ============================================================================
// SUITE 12: DETERMINISM & BATCH EVALUATION (Tests 58-60)
// ============================================================================

test('58. Determinism: repeated resolution produces identical results', () => {
  const cap = buildGameplayCapability(
    createMockFact({
      element: 'Fusion',
      parameter: 'FUSION_DAMAGE_PERCENT',
      condition: { trigger: 'ON_OUTRO_SKILL' },
      consumptionState: 'CONSUMABLE_CONTEXTUAL',
      staticNumericValue: null,
      value: { type: 'EXACT', value: 20, unit: 'PERCENT' }
    })
  );

  const context: RuntimeEvaluationContext = { element: 'Fusion', trigger: 'ON_OUTRO_SKILL' };

  const first = resolveGameplayCapability(cap, context);
  for (let i = 0; i < 20; i++) {
    const next = resolveGameplayCapability(cap, context);
    assert.deepStrictEqual(next, first);
  }
});

test('59. Determinism: batch resolution is deterministic and preserves input ordering', () => {
  const caps = auditProductionCapabilities().capabilities;
  const context: RuntimeEvaluationContext = { element: 'Fusion' };

  const run1 = resolveGameplayCapabilities(caps, context);
  const run2 = resolveGameplayCapabilities(caps, context);

  assert.strictEqual(run1.length, caps.length);
  assert.strictEqual(run2.length, caps.length);

  for (let i = 0; i < caps.length; i++) {
    assert.strictEqual(run1[i].capabilityId, caps[i].capabilityId);
    assert.deepStrictEqual(run1[i], run2[i]);
  }

  const consumable = resolveConsumableCapabilities(caps, context);
  assert.strictEqual(consumable.every((r) => r.applicable), true);
});

test('60. Determinism: production audit is completely deterministic', () => {
  const first = runProductionCapabilityResolutionAudit();

  assert.strictEqual(first.totalCapabilities, 292);
  assert.strictEqual(first.applicableWithoutContext, 68);
  assert.strictEqual(first.requiresContext, 222);
  assert.strictEqual(first.unmodeled, 2);
  assert.strictEqual(first.unknown, 0);
  assert.strictEqual(first.notApplicable, 0);

  for (let i = 0; i < 10; i++) {
    const next = runProductionCapabilityResolutionAudit();
    assert.strictEqual(next.totalCapabilities, 292);
    assert.strictEqual(next.applicableWithoutContext, 68);
    assert.strictEqual(next.requiresContext, 222);
    assert.strictEqual(next.unmodeled, 2);
    assert.deepStrictEqual(next.byResolutionStatus, first.byResolutionStatus);
    assert.deepStrictEqual(next.byRequirementDimension, first.byRequirementDimension);
    assert.deepStrictEqual(next.elementBreakdown, first.elementBreakdown);
  }
});
