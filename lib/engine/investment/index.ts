/**
 * Wuthering Waves Deterministic Resonator Investment Module
 * Phase 7 Step 13: Deterministic Resonator Investment Snapshot & Capability Contract
 *
 * Public entrypoint for Step 13 Resonator investment contracts, normalization,
 * completeness inspection, query repository, and audit facilities.
 */

export * from './types.ts';
export * from './rules.ts';
export * from './predicates.ts';
export * from './normalization.ts';
export * from './repository.ts';
export * from './audit.ts';
export * from './effects/index.ts';

import type {
  ResonatorInvestmentSnapshot,
  ResonatorInvestmentExplanation
} from './types.ts';
import { computeInvestmentCompleteness } from './normalization.ts';

/**
 * Formats an objective presentation explanation of a Resonator's investment state.
 * Presentation only: this string output MUST NEVER become an engine input or score.
 */
export function explainResonatorInvestment(
  snapshot: ResonatorInvestmentSnapshot
): ResonatorInvestmentExplanation {
  const completeness = computeInvestmentCompleteness(snapshot);
  const parts: string[] = [];

  const isLevelKnown = snapshot.characterLevel.status === 'KNOWN';
  const charLevel = isLevelKnown ? snapshot.characterLevel.value : null;
  if (isLevelKnown) {
    parts.push(`Lv. ${charLevel}`);
  } else {
    parts.push('Lv. UNKNOWN');
  }

  const isSeqKnown = snapshot.sequenceLevel.status === 'KNOWN';
  const seqLevel = isSeqKnown ? snapshot.sequenceLevel.value : null;
  if (isSeqKnown) {
    parts.push(`S${seqLevel}`);
  } else {
    parts.push('Sequence UNKNOWN');
  }

  const isWpnKnown = snapshot.weapon !== null;
  const wpnId = isWpnKnown ? snapshot.weapon.weaponId : null;
  const isWpnLvlKnown = isWpnKnown && snapshot.weapon.weaponLevel.status === 'KNOWN';
  const wpnLvl = isWpnLvlKnown ? snapshot.weapon.weaponLevel.value : null;
  const isRefKnown = isWpnKnown && snapshot.weapon.refinementRank.status === 'KNOWN';
  const refRank = isRefKnown ? snapshot.weapon.refinementRank.value : null;

  if (isWpnKnown) {
    const wpnDetails: string[] = [wpnId!];
    if (isWpnLvlKnown) wpnDetails.push(`Lv. ${wpnLvl}`);
    if (isRefKnown) wpnDetails.push(`R${refRank}`);
    parts.push(`Weapon: [${wpnDetails.join(', ')}]`);
  } else {
    parts.push('Weapon: UNKNOWN');
  }

  const isEchoKnown = snapshot.echoInvestment !== null;
  const eqCount =
    isEchoKnown && snapshot.echoInvestment.equippedCount.status === 'KNOWN'
      ? snapshot.echoInvestment.equippedCount.value
      : null;
  const sonataId = isEchoKnown ? snapshot.echoInvestment.sonataSetId : null;

  if (isEchoKnown) {
    const echoDetails: string[] = [];
    if (eqCount !== null) echoDetails.push(`${eqCount}/5 equipped`);
    if (sonataId !== null) echoDetails.push(`Sonata: ${sonataId}`);
    parts.push(`Echoes: [${echoDetails.join(', ')}]`);
  } else {
    parts.push('Echoes: UNKNOWN');
  }

  const pct =
    completeness.completenessRatio !== null
      ? `${(completeness.completenessRatio * 100).toFixed(1)}%`
      : 'N/A';
  const summary = `Resonator {${snapshot.resonatorId}} investment state: ${parts.join(' | ')} (Data completeness: ${completeness.knownDimensions}/${completeness.totalDimensions} dimensions [${pct}]).`;

  return Object.freeze({
    investmentId: snapshot.id,
    resonatorId: snapshot.resonatorId,
    isCharacterLevelKnown: isLevelKnown,
    characterLevel: charLevel,
    isWeaponKnown: isWpnKnown,
    weaponId: wpnId,
    weaponLevel: wpnLvl,
    refinementRank: refRank,
    isSequenceKnown: isSeqKnown,
    sequenceLevel: seqLevel,
    isEchoKnown,
    equippedEchoCount: eqCount,
    sonataSetId: sonataId,
    completenessRatio: completeness.completenessRatio,
    summary
  });
}
