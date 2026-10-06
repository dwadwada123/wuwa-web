/**
 * Deterministic Tie-Breaking Engine
 *
 * Orders candidate stage scores using strict deterministic criteria:
 * 1. Validity (valid > invalid)
 * 2. Higher totalScore
 * 3. Higher elementalMatchup weighted score
 * 4. Higher stageBuffCompatibility weighted score
 * 5. Lexicographically smaller candidateKey
 */

import type { TeamStageScore } from './types.ts';

export function compareTeamStageScores(a: TeamStageScore, b: TeamStageScore): number {
  // 1. Validity
  if (a.valid !== b.valid) {
    return a.valid ? -1 : 1;
  }

  // 2. Higher totalScore
  if (b.totalScore !== a.totalScore) {
    return b.totalScore - a.totalScore;
  }

  // 3. Higher elementalMatchup weighted score
  const elemDiff =
    b.dimensions.elementalMatchup.weightedScore -
    a.dimensions.elementalMatchup.weightedScore;
  if (elemDiff !== 0) {
    return elemDiff;
  }

  // 4. Higher stageBuffCompatibility weighted score
  const buffDiff =
    b.dimensions.stageBuffCompatibility.weightedScore -
    a.dimensions.stageBuffCompatibility.weightedScore;
  if (buffDiff !== 0) {
    return buffDiff;
  }

  // 5. Lexicographical tie-breaker on candidate key
  return a.candidateKey.localeCompare(b.candidateKey);
}

/**
 * Sorts an array of TeamStageScore deterministically in-place or returning a new array.
 */
export function sortTeamStageScores(scores: TeamStageScore[]): TeamStageScore[] {
  return [...scores].sort(compareTeamStageScores);
}
