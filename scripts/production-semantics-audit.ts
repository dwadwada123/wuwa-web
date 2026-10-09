import fs from 'node:fs';
import path from 'node:path';
import { extractSemantics, PARSER_VERSION } from '../lib/semantics/parser.ts';
import { computeSemanticSignature } from '../lib/semantics/taxonomy.ts';
import type { PatchDataset } from '../lib/ingestion/types.ts';
import type {
  ExtractionResult,
  SemanticParameter,
  SemanticTarget,
  ExtractionStatus
} from '../lib/domain/types/semantics.ts';

export interface ProductionAuditRecord {
  entityType: 'RESONATOR_ABILITY' | 'RESONATOR_SEQUENCE' | 'WEAPON_PASSIVE' | 'AREA_EFFECT';
  entityId: string;
  entityName: string;
  sourceCode: string;
  originalText: string;
  result: ExtractionResult;
}

export interface ProductionCoverageAccounting {
  descriptions: {
    total: number;
    complete: number;
    partial: number;
    unresolved: number;
    unsupported: number;
  };
  numericTokens: {
    totalExplicitPercentageTokens: number;
    percentageTokensInCompleteDescriptions: number;
    percentageTokensInPartialDescriptions: number;
    percentageTokensInUnresolvedDescriptions: number;
    percentageTokensInUnsupportedDescriptions: number;
    totalParsedNumericEffects: number;
    totalParsedExplicitDurations: number;
    totalParsedSwapRemovals: number;
  };
  fragments: {
    totalUnmodeledFragments: number;
    fromPartialDescriptions: number;
    fromUnresolvedDescriptions: number;
    fromUnsupportedDescriptions: number;
  };
  singleLabelCategories: Record<string, number>;
  multiLabelOccurrences: Record<string, number>;
}

export interface ProductionSemanticsReport {
  timestamp: string;
  patchVersion: string;
  parserVersion: string;
  totals: {
    descriptionsAudited: number;
    byType: {
      abilities: number;
      sequences: number;
      weapons: number;
      areaEffects: number;
    };
    byStatus: {
      COMPLETE: number;
      PARTIAL: number;
      UNRESOLVED: number;
      UNSUPPORTED: number;
    };
    totalSemanticEffectsExtracted: number;
    bySequenceNode: Record<
      'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6',
      { total: number; COMPLETE: number; PARTIAL: number; UNRESOLVED: number; UNSUPPORTED: number }
    >;
    parameterCounts: Record<string, number>;
    targetCounts: Record<string, number>;
    triggerCounts: Record<string, number>;
    durationCount: number;
    swapRemovalCount: number;
    unresolvedCategories: Record<string, number>;
    accounting: ProductionCoverageAccounting;
    duplicateAudit: {
      totalUniqueIds: number;
      accidentalDuplicates: number;
      legitimateDistinctEffects: number;
    };
    performance: {
      totalDurationMs: number;
      averagePerRecordMs: number;
    };
  };
  records: ProductionAuditRecord[];
}

export function runProductionSemanticsAudit(): ProductionSemanticsReport {
  const startTime = Date.now();

  const datasetPath = path.resolve('data/patches/3.7/patch_3_7_dataset.json');
  const dataset: PatchDataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  const weaponsSnapPath = path.resolve('data/snapshots/3.7/weapons/weapons.json');
  const weaponSnapshots: any[] = JSON.parse(fs.readFileSync(weaponsSnapPath, 'utf8'));
  const weaponSnapMap = new Map<string, any>();
  for (const w of weaponSnapshots) {
    weaponSnapMap.set(w.name.toLowerCase().trim(), w);
  }

  const auditRecords: ProductionAuditRecord[] = [];

  // 1. Resonator Abilities (539 with descriptions out of 540)
  for (const r of dataset.resonators) {
    for (const a of r.abilities) {
      if (!a.description) continue;
      const res = extractSemantics(a.description, {
        entityId: r.name,
        entityName: r.name,
        sourceType: 'RESONATOR_ABILITY',
        sourceCode: a.ability_code,
        patchVersion: '3.7',
        sourceProvenance: a.provenance_source_name,
        defaultTarget: a.ability_category === 'OutroSkill' ? 'NEXT_RESONATOR' : 'SELF'
      });
      auditRecords.push({
        entityType: 'RESONATOR_ABILITY',
        entityId: r.name,
        entityName: r.name,
        sourceCode: a.ability_code,
        originalText: a.description,
        result: res
      });
    }
  }

  // 2. Resonance Sequences (360)
  for (const r of dataset.resonators) {
    for (const s of r.sequence_nodes || []) {
      const res = extractSemantics(s.description, {
        entityId: r.name,
        entityName: r.name,
        sourceType: 'RESONATOR_SEQUENCE',
        sourceCode: s.node_code,
        patchVersion: '3.7',
        sourceProvenance: s.provenance_source_name,
        defaultTarget: 'SELF'
      });
      auditRecords.push({
        entityType: 'RESONATOR_SEQUENCE',
        entityId: r.name,
        entityName: r.name,
        sourceCode: s.node_code,
        originalText: s.description,
        result: res
      });
    }
  }

  // 3. Weapons (66)
  for (const w of dataset.weapons || []) {
    const snap = weaponSnapMap.get(w.name.toLowerCase().trim());
    const desc =
      snap?.passive?.r1?.en || (snap?.passive?.name ? `${snap.passive.name}: No description` : 'No passive');
    const res = extractSemantics(desc, {
      entityId: w.name,
      entityName: w.name,
      sourceType: 'WEAPON_PASSIVE',
      sourceCode: 'Passive',
      patchVersion: '3.7',
      sourceProvenance: w.patch_data.provenance_source_name,
      defaultTarget: 'SELF'
    });
    auditRecords.push({
      entityType: 'WEAPON_PASSIVE',
      entityId: w.name,
      entityName: w.name,
      sourceCode: 'Passive',
      originalText: desc,
      result: res
    });
  }

  // 4. Area Effects (11)
  for (const ae of dataset.area_effects || []) {
    const res = extractSemantics(ae.description, {
      entityId: ae.source_id,
      entityName: ae.name,
      sourceType: 'TOA_AREA_EFFECT',
      sourceCode: 'AreaEffect',
      patchVersion: '3.7',
      sourceProvenance: ae.gameplay_effect.provenance_source_name,
      defaultTarget: ae.gameplay_effect.target
    });
    auditRecords.push({
      entityType: 'AREA_EFFECT',
      entityId: ae.source_id,
      entityName: ae.name,
      sourceCode: 'AreaEffect',
      originalText: ae.description,
      result: res
    });
  }

  // Aggregate Metrics
  const byType = {
    abilities: 0,
    sequences: 0,
    weapons: 0,
    areaEffects: 0
  };

  const byStatus = {
    COMPLETE: 0,
    PARTIAL: 0,
    UNRESOLVED: 0,
    UNSUPPORTED: 0
  };

  const bySequenceNode: Record<
    'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6',
    { total: number; COMPLETE: number; PARTIAL: number; UNRESOLVED: number; UNSUPPORTED: number }
  > = {
    S1: { total: 0, COMPLETE: 0, PARTIAL: 0, UNRESOLVED: 0, UNSUPPORTED: 0 },
    S2: { total: 0, COMPLETE: 0, PARTIAL: 0, UNRESOLVED: 0, UNSUPPORTED: 0 },
    S3: { total: 0, COMPLETE: 0, PARTIAL: 0, UNRESOLVED: 0, UNSUPPORTED: 0 },
    S4: { total: 0, COMPLETE: 0, PARTIAL: 0, UNRESOLVED: 0, UNSUPPORTED: 0 },
    S5: { total: 0, COMPLETE: 0, PARTIAL: 0, UNRESOLVED: 0, UNSUPPORTED: 0 },
    S6: { total: 0, COMPLETE: 0, PARTIAL: 0, UNRESOLVED: 0, UNSUPPORTED: 0 }
  };

  const parameterCounts: Record<string, number> = {};
  const targetCounts: Record<string, number> = {};
  const triggerCounts: Record<string, number> = {};
  let durationCount = 0;
  let swapRemovalCount = 0;
  let totalSemanticEffectsExtracted = 0;
  const unresolvedCategories: Record<string, number> = {};
  const multiLabelOccurrences: Record<string, number> = {};

  let totalExplicitPercentageTokens = 0;
  let percentageTokensInCompleteDescriptions = 0;
  let percentageTokensInPartialDescriptions = 0;
  let percentageTokensInUnresolvedDescriptions = 0;
  let percentageTokensInUnsupportedDescriptions = 0;

  let fragmentsFromPartial = 0;
  let fragmentsFromUnresolved = 0;
  let fragmentsFromUnsupported = 0;

  const seenEffectIds = new Set<string>();
  let accidentalDuplicates = 0;

  for (const rec of auditRecords) {
    if (rec.entityType === 'RESONATOR_ABILITY') byType.abilities++;
    if (rec.entityType === 'RESONATOR_SEQUENCE') byType.sequences++;
    if (rec.entityType === 'WEAPON_PASSIVE') byType.weapons++;
    if (rec.entityType === 'AREA_EFFECT') byType.areaEffects++;

    byStatus[rec.result.status]++;

    if (rec.entityType === 'RESONATOR_SEQUENCE') {
      const sCode = rec.sourceCode as 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6';
      if (bySequenceNode[sCode]) {
        bySequenceNode[sCode].total++;
        bySequenceNode[sCode][rec.result.status]++;
      }
    }

    totalSemanticEffectsExtracted += rec.result.effects.length;

    // Numeric Token Accounting
    const pcts = (rec.originalText.match(/\d+(?:\.\d+)?%/g) || []).length;
    totalExplicitPercentageTokens += pcts;
    if (rec.result.status === 'COMPLETE') percentageTokensInCompleteDescriptions += pcts;
    if (rec.result.status === 'PARTIAL') percentageTokensInPartialDescriptions += pcts;
    if (rec.result.status === 'UNRESOLVED') percentageTokensInUnresolvedDescriptions += pcts;
    if (rec.result.status === 'UNSUPPORTED') percentageTokensInUnsupportedDescriptions += pcts;

    // Fragment Origin Accounting
    if (rec.result.status === 'PARTIAL') fragmentsFromPartial += rec.result.unresolvedFragments.length;
    if (rec.result.status === 'UNRESOLVED') fragmentsFromUnresolved += rec.result.unresolvedFragments.length;
    if (rec.result.status === 'UNSUPPORTED') fragmentsFromUnsupported += rec.result.unresolvedFragments.length;

    // Effect Duplicate Audit within Record
    const recordSignatures = new Set<string>();
    for (const eff of rec.result.effects) {
      if (seenEffectIds.has(eff.id)) {
        accidentalDuplicates++;
      }
      seenEffectIds.add(eff.id);

      const sig = computeSemanticSignature(eff);
      if (recordSignatures.has(sig)) {
        accidentalDuplicates++;
      }
      recordSignatures.add(sig);

      parameterCounts[eff.parameter] = (parameterCounts[eff.parameter] || 0) + 1;
      targetCounts[eff.target] = (targetCounts[eff.target] || 0) + 1;
      if (eff.condition?.trigger) {
        triggerCounts[eff.condition.trigger] = (triggerCounts[eff.condition.trigger] || 0) + 1;
      }
      if (eff.duration?.durationSeconds && eff.duration.durationSeconds > 0) {
        durationCount++;
      }
      if (eff.duration?.removeOnSwap) {
        swapRemovalCount++;
      }
    }

    // Fragment Classification (Single-Label Partition & Multi-Label Occurrences)
    for (const frag of rec.result.unresolvedFragments) {
      const lower = frag.toLowerCase();

      // Multi-label occurrences
      if (lower.includes('forte') || lower.includes('circuit') || lower.includes('melody') || lower.includes('resolve')) {
        multiLabelOccurrences['Forte Resource & Gauge Mechanics'] = (multiLabelOccurrences['Forte Resource & Gauge Mechanics'] || 0) + 1;
      }
      if (lower.includes('pull') || lower.includes('knock') || lower.includes('air') || lower.includes('traction')) {
        multiLabelOccurrences['Crowd Control & Displacement'] = (multiLabelOccurrences['Crowd Control & Displacement'] || 0) + 1;
      }
      if (lower.includes('stack')) {
        multiLabelOccurrences['Stateful Combat Stacks'] = (multiLabelOccurrences['Stateful Combat Stacks'] || 0) + 1;
      }
      if (lower.includes('shield')) {
        multiLabelOccurrences['Shield Generation & Absorption'] = (multiLabelOccurrences['Shield Generation & Absorption'] || 0) + 1;
      }
      if (lower.includes('heal') || lower.includes('recover hp')) {
        multiLabelOccurrences['Dynamic / Scaling Healing'] = (multiLabelOccurrences['Dynamic / Scaling Healing'] || 0) + 1;
      }
      if (lower.includes('cooldown') || lower.includes('cd')) {
        multiLabelOccurrences['Cooldown Dynamics'] = (multiLabelOccurrences['Cooldown Dynamics'] || 0) + 1;
      }
      if (lower.includes('coordinated') || lower.includes('spectro flare') || lower.includes('electro flare')) {
        multiLabelOccurrences['Coordinated & Entity Triggers'] = (multiLabelOccurrences['Coordinated & Entity Triggers'] || 0) + 1;
      }
      if (lower.includes('cooking') || lower.includes('crafting') || lower.includes('dish')) {
        multiLabelOccurrences['Non-Combat Utility'] = (multiLabelOccurrences['Non-Combat Utility'] || 0) + 1;
      }

      // Single-label partition (mutually exclusive classification)
      let cat = 'Other Unmodeled Mechanic';
      if (lower.includes('forte') || lower.includes('circuit') || lower.includes('melody') || lower.includes('resolve')) {
        cat = 'Forte Resource & Gauge Mechanics';
      } else if (lower.includes('pull') || lower.includes('knock') || lower.includes('air') || lower.includes('traction')) {
        cat = 'Crowd Control & Displacement';
      } else if (lower.includes('stack')) {
        cat = 'Stateful Combat Stacks';
      } else if (lower.includes('shield')) {
        cat = 'Shield Generation & Absorption';
      } else if (lower.includes('heal') || lower.includes('recover hp')) {
        cat = 'Dynamic / Scaling Healing';
      } else if (lower.includes('cooldown') || lower.includes('cd')) {
        cat = 'Cooldown Dynamics';
      } else if (lower.includes('coordinated') || lower.includes('spectro flare') || lower.includes('electro flare')) {
        cat = 'Coordinated & Entity Triggers';
      } else if (lower.includes('cooking') || lower.includes('crafting') || lower.includes('dish')) {
        cat = 'Non-Combat Utility';
      }
      unresolvedCategories[cat] = (unresolvedCategories[cat] || 0) + 1;
    }
  }

  const endTime = Date.now();
  const totalDurationMs = endTime - startTime;

  const accounting: ProductionCoverageAccounting = {
    descriptions: {
      total: auditRecords.length,
      complete: byStatus.COMPLETE,
      partial: byStatus.PARTIAL,
      unresolved: byStatus.UNRESOLVED,
      unsupported: byStatus.UNSUPPORTED
    },
    numericTokens: {
      totalExplicitPercentageTokens,
      percentageTokensInCompleteDescriptions,
      percentageTokensInPartialDescriptions,
      percentageTokensInUnresolvedDescriptions,
      percentageTokensInUnsupportedDescriptions,
      totalParsedNumericEffects: totalSemanticEffectsExtracted,
      totalParsedExplicitDurations: durationCount,
      totalParsedSwapRemovals: swapRemovalCount
    },
    fragments: {
      totalUnmodeledFragments: fragmentsFromPartial + fragmentsFromUnresolved + fragmentsFromUnsupported,
      fromPartialDescriptions: fragmentsFromPartial,
      fromUnresolvedDescriptions: fragmentsFromUnresolved,
      fromUnsupportedDescriptions: fragmentsFromUnsupported
    },
    singleLabelCategories: unresolvedCategories,
    multiLabelOccurrences
  };

  return {
    timestamp: '2026-10-08T00:00:00.000Z',
    patchVersion: '3.7',
    parserVersion: PARSER_VERSION,
    totals: {
      descriptionsAudited: auditRecords.length,
      byType,
      byStatus,
      totalSemanticEffectsExtracted,
      bySequenceNode,
      parameterCounts,
      targetCounts,
      triggerCounts,
      durationCount,
      swapRemovalCount,
      unresolvedCategories,
      accounting,
      duplicateAudit: {
        totalUniqueIds: seenEffectIds.size,
        accidentalDuplicates,
        legitimateDistinctEffects: totalSemanticEffectsExtracted
      },
      performance: {
        totalDurationMs,
        averagePerRecordMs: auditRecords.length > 0 ? totalDurationMs / auditRecords.length : 0
      }
    },
    records: auditRecords
  };
}

if (process.argv[1]?.includes('production-semantics-audit')) {
  const report = runProductionSemanticsAudit();
  console.log(`=== WUTHERING WAVES 3.7 PRODUCTION SEMANTICS EXTRACTION AUDIT ===`);
  console.log(`Descriptions Audited:  ${report.totals.descriptionsAudited}`);
  console.log(`- Abilities:           ${report.totals.byType.abilities}`);
  console.log(`- Sequences:           ${report.totals.byType.sequences}`);
  console.log(`- Weapons:             ${report.totals.byType.weapons}`);
  console.log(`- Area Effects:        ${report.totals.byType.areaEffects}`);
  console.log(`Status Breakdown:`);
  console.log(`- COMPLETE:            ${report.totals.byStatus.COMPLETE}`);
  console.log(`- PARTIAL:             ${report.totals.byStatus.PARTIAL}`);
  console.log(`- UNRESOLVED:          ${report.totals.byStatus.UNRESOLVED}`);
  console.log(`- UNSUPPORTED:         ${report.totals.byStatus.UNSUPPORTED}`);
  console.log(`Total Semantic Effects: ${report.totals.totalSemanticEffectsExtracted}`);
  console.log(`Sequences by Node:`);
  for (const s of ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'] as const) {
    const st = report.totals.bySequenceNode[s];
    console.log(
      `  ${s}: total=${st.total} (COMPLETE=${st.COMPLETE}, PARTIAL=${st.PARTIAL}, UNRESOLVED=${st.UNRESOLVED}, UNSUPPORTED=${st.UNSUPPORTED})`
    );
  }
  console.log(`Accounting Summary:`);
  console.log(`- Total % tokens:      ${report.totals.accounting.numericTokens.totalExplicitPercentageTokens}`);
  console.log(`- Total Fragments:     ${report.totals.accounting.fragments.totalUnmodeledFragments}`);
  console.log(`  - from Partial:      ${report.totals.accounting.fragments.fromPartialDescriptions}`);
  console.log(`  - from Unresolved:   ${report.totals.accounting.fragments.fromUnresolvedDescriptions}`);
  console.log(`  - from Unsupported:  ${report.totals.accounting.fragments.fromUnsupportedDescriptions}`);
  console.log(`Duplicate Audit:`);
  console.log(`- Unique Effect IDs:   ${report.totals.duplicateAudit.totalUniqueIds}`);
  console.log(`- Accidental Dups:     ${report.totals.duplicateAudit.accidentalDuplicates}`);
  console.log(`Execution Time:        ${report.totals.performance.totalDurationMs}ms`);
}
