/**
 * Wuthering Waves Deterministic Team Portfolio Solver
 * Phase 7 Step 22: Deterministic Team Portfolio Selection & Optimization Contract
 *
 * Implements an exact, deterministic branch-and-bound solver to select an optimal
 * portfolio of K mutually disjoint teams from eligible candidate teams and player roster.
 *
 * CENTRAL INVARIANTS:
 * 1. STRICT DISJOINTNESS: Zero Resonator overlap across selected teams.
 * 2. EXACT LEXICOGRAPHIC ORDER: Pure multi-objective hierarchy; zero arbitrary weights or scores.
 * 3. PURE DETERMINISM: Zero network, zero LLMs, zero random seeds, zero clocks.
 * 4. DETERMINISTIC TIE-BREAKING: Canonical portfolio keys resolve all ties into a strict total order.
 */

import {
  TEAM_MEMBER_COUNT,
  ASPECTS_PER_TEAM
} from './rules.ts';
import type {
  TeamBuildEvaluation,
  TeamCompositionCandidateEvaluation
} from './types.ts';

export interface SolverCandidateItem {
  readonly teamBuild: TeamBuildEvaluation;
  readonly synergyEval?: TeamCompositionCandidateEvaluation;
  readonly memberA: string;
  readonly memberB: string;
  readonly memberC: string;
  readonly hasIncompatibleWeapon: boolean;
  readonly isFullyEquipped: boolean;
  readonly isPartiallyEquipped: boolean;
  readonly knownAspects: number;
  readonly synergyScore: number | null;
  readonly matchedPairs: number;
  readonly directionalEdges: number;
}

export interface SolverResult {
  readonly selectedTeams: readonly TeamBuildEvaluation[];
  readonly combinationsExplored: number;
  readonly isInfeasible: boolean;
  readonly isPartial: boolean;
  readonly infeasibilityReasons: readonly string[];
}

interface ObjectiveTuple {
  readonly incompatibleCount: number;      // minimize (0 is best)
  readonly fullyEquippedCount: number;     // maximize
  readonly partiallyEquippedCount: number; // maximize
  readonly knownAspects: number;           // maximize
  readonly totalSynergyScore: number;      // maximize
  readonly totalMatchedPairs: number;      // maximize
  readonly totalDirectionalEdges: number;  // maximize
  readonly canonicalKey: string;           // minimize lexicographically
}

/**
 * Compares two objective tuples according to the approved Step 22 lexicographic hierarchy.
 * Returns > 0 if A is strictly preferred to B, < 0 if B is strictly preferred to A, or 0 if identical.
 */
function compareObjectiveTuples(a: ObjectiveTuple, b: ObjectiveTuple): number {
  // 1. Min incompatible weapons count
  if (a.incompatibleCount !== b.incompatibleCount) {
    return b.incompatibleCount - a.incompatibleCount; // fewer is better
  }
  // 2. Max fully equipped count
  if (a.fullyEquippedCount !== b.fullyEquippedCount) {
    return a.fullyEquippedCount - b.fullyEquippedCount;
  }
  // 3. Max partially equipped count
  if (a.partiallyEquippedCount !== b.partiallyEquippedCount) {
    return a.partiallyEquippedCount - b.partiallyEquippedCount;
  }
  // 4. Max known aspects count
  if (a.knownAspects !== b.knownAspects) {
    return a.knownAspects - b.knownAspects;
  }
  // 5. Max total synergy score
  if (Math.abs(a.totalSynergyScore - b.totalSynergyScore) > 0.001) {
    return a.totalSynergyScore - b.totalSynergyScore;
  }
  // 6. Max total matched pair connections
  if (a.totalMatchedPairs !== b.totalMatchedPairs) {
    return a.totalMatchedPairs - b.totalMatchedPairs;
  }
  // 7. Max total directional synergy edges
  if (a.totalDirectionalEdges !== b.totalDirectionalEdges) {
    return a.totalDirectionalEdges - b.totalDirectionalEdges;
  }
  // 8. Canonical portfolio key tie-breaking (lexicographically smaller key wins)
  const cmpKey = a.canonicalKey.localeCompare(b.canonicalKey);
  return -cmpKey; // smaller string preferred
}

/**
 * Computes the objective tuple for a candidate portfolio.
 */
function computeObjectiveTuple(selected: readonly SolverCandidateItem[]): ObjectiveTuple {
  let incompatibleCount = 0;
  let fullyEquippedCount = 0;
  let partiallyEquippedCount = 0;
  let knownAspects = 0;
  let totalSynergyScore = 0;
  let totalMatchedPairs = 0;
  let totalDirectionalEdges = 0;

  for (const item of selected) {
    if (item.hasIncompatibleWeapon) incompatibleCount++;
    if (item.isFullyEquipped) fullyEquippedCount++;
    if (item.isPartiallyEquipped) partiallyEquippedCount++;
    knownAspects += item.knownAspects;
    if (item.synergyScore !== null) {
      totalSynergyScore += item.synergyScore;
    }
    totalMatchedPairs += item.matchedPairs;
    totalDirectionalEdges += item.directionalEdges;
  }

  const canonicalKey = selected.map((s) => s.teamBuild.id).sort().join(':::');

  return {
    incompatibleCount,
    fullyEquippedCount,
    partiallyEquippedCount,
    knownAspects,
    totalSynergyScore: Math.round(totalSynergyScore * 100) / 100,
    totalMatchedPairs,
    totalDirectionalEdges,
    canonicalKey
  };
}

/**
 * Solves the optimal K-disjoint team portfolio exactly and deterministically.
 */
export function solveTeamPortfolio(
  candidateTeams: readonly TeamBuildEvaluation[],
  targetK: number,
  ownedResonatorIds: ReadonlySet<string>,
  synergyMap?: ReadonlyMap<string, TeamCompositionCandidateEvaluation>,
  allowPartial: boolean = false
): SolverResult {
  const infeasibilityReasons: string[] = [];

  // 1. Roster Cardinality Feasibility Check
  if (ownedResonatorIds.size < targetK * TEAM_MEMBER_COUNT) {
    infeasibilityReasons.push(
      `Insufficient owned Resonators: owned roster has ${ownedResonatorIds.size} Resonators, fewer than the ${targetK * TEAM_MEMBER_COUNT} required for ${targetK} teams.`
    );
    if (!allowPartial) {
      return {
        selectedTeams: Object.freeze([]),
        combinationsExplored: 0,
        isInfeasible: true,
        isPartial: false,
        infeasibilityReasons: Object.freeze(infeasibilityReasons)
      };
    }
  }

  // 2. Pre-filter and Wrap Candidates
  const eligibleItems: SolverCandidateItem[] = [];
  for (const team of candidateTeams) {
    if (team.status === 'PATCH_MISMATCH' || team.status === 'INVALID') {
      continue;
    }
    const [mA, mB, mC] = team.memberResonatorIds;
    if (!ownedResonatorIds.has(mA) || !ownedResonatorIds.has(mB) || !ownedResonatorIds.has(mC)) {
      continue;
    }

    const synEval = synergyMap?.get(team.teamCandidateId);
    eligibleItems.push({
      teamBuild: team,
      synergyEval: synEval,
      memberA: mA,
      memberB: mB,
      memberC: mC,
      hasIncompatibleWeapon: team.weaponAggregation.hasIncompatibleWeapon,
      isFullyEquipped: team.status === 'FULLY_EQUIPPED',
      isPartiallyEquipped: team.status === 'PARTIALLY_EQUIPPED',
      knownAspects: team.completeness.knownTeamAspects,
      synergyScore: synEval?.totalScore ?? null,
      matchedPairs: synEval?.matchedPairCount ?? 0,
      directionalEdges: synEval?.directionalEdgeCount ?? 0
    });
  }

  if (eligibleItems.length < targetK) {
    infeasibilityReasons.push(
      `Eligible candidate pool has ${eligibleItems.length} teams, fewer than the ${targetK} teams requested.`
    );
    if (!allowPartial) {
      return {
        selectedTeams: Object.freeze([]),
        combinationsExplored: 0,
        isInfeasible: true,
        isPartial: false,
        infeasibilityReasons: Object.freeze(infeasibilityReasons)
      };
    }
  }

  // 3. Stably Sort Eligible Candidates by Individual Quality Priority
  eligibleItems.sort((a, b) => {
    // a) Incompatible weapons (false first)
    if (a.hasIncompatibleWeapon !== b.hasIncompatibleWeapon) {
      return a.hasIncompatibleWeapon ? 1 : -1;
    }
    // b) Fully equipped first
    if (a.isFullyEquipped !== b.isFullyEquipped) {
      return a.isFullyEquipped ? -1 : 1;
    }
    // c) Partially equipped second
    if (a.isPartiallyEquipped !== b.isPartiallyEquipped) {
      return a.isPartiallyEquipped ? -1 : 1;
    }
    // d) Known aspects descending
    if (a.knownAspects !== b.knownAspects) {
      return b.knownAspects - a.knownAspects;
    }
    // e) Synergy score descending (non-null first)
    const aSyn = a.synergyScore ?? -1;
    const bSyn = b.synergyScore ?? -1;
    if (Math.abs(aSyn - bSyn) > 0.001) {
      return bSyn - aSyn;
    }
    // f) Matched pairs descending
    if (a.matchedPairs !== b.matchedPairs) {
      return b.matchedPairs - a.matchedPairs;
    }
    // g) Directional edges descending
    if (a.directionalEdges !== b.directionalEdges) {
      return b.directionalEdges - a.directionalEdges;
    }
    // h) Canonical ID ascending tie-breaker
    return a.teamBuild.id.localeCompare(b.teamBuild.id);
  });

  // 4. Exact Recursive Branch-and-Bound Search
  const searchState: {
    combinationsExplored: number;
    bestTuple: ObjectiveTuple | null;
    bestSelection: SolverCandidateItem[] | null;
  } = {
    combinationsExplored: 0,
    bestTuple: null,
    bestSelection: null
  };
  const currentSelection: SolverCandidateItem[] = [];
  const usedResonators = new Set<string>();

  let curIncompatible = 0;
  let curFullyEquipped = 0;
  let curPartiallyEquipped = 0;
  let curKnownAspects = 0;
  let curSynergyScore = 0;
  let curMatchedPairs = 0;
  let curDirectionalEdges = 0;

  // Determine actual search target size
  const maxPossibleTeams = Math.min(
    targetK,
    Math.floor(ownedResonatorIds.size / TEAM_MEMBER_COUNT),
    eligibleItems.length
  );
  const searchK = allowPartial ? maxPossibleTeams : targetK;

  if (searchK <= 0) {
    infeasibilityReasons.push('No disjoint team can be formed.');
    return {
      selectedTeams: Object.freeze([]),
      combinationsExplored: 0,
      isInfeasible: true,
      isPartial: false,
      infeasibilityReasons: Object.freeze(infeasibilityReasons)
    };
  }

  function backtrack(startIdx: number): void {
    if (currentSelection.length === searchK) {
      searchState.combinationsExplored++;
      const currentTuple = computeObjectiveTuple(currentSelection);
      if (!searchState.bestTuple || compareObjectiveTuples(currentTuple, searchState.bestTuple) > 0) {
        searchState.bestTuple = currentTuple;
        searchState.bestSelection = [...currentSelection];
      }
      return;
    }

    const needed = searchK - currentSelection.length;
    const remaining = eligibleItems.length - startIdx;
    if (remaining < needed) {
      return; // Not enough remaining candidates to reach target
    }

    for (let i = startIdx; i < eligibleItems.length; i++) {
      const cand = eligibleItems[i];

      // Branch-and-Bound Upper Bound Pruning
      if (searchState.bestTuple) {
        const best = searchState.bestTuple;

        // Layer 1: Incompatible weapons (minimize)
        const minIncomp = curIncompatible + needed * (cand.hasIncompatibleWeapon ? 1 : 0);
        if (minIncomp > best.incompatibleCount) break;
        if (minIncomp === best.incompatibleCount) {
          // Layer 2: Fully equipped (maximize)
          const maxFully = curFullyEquipped + needed * (cand.isFullyEquipped ? 1 : 0);
          if (maxFully < best.fullyEquippedCount) break;
          if (maxFully === best.fullyEquippedCount) {
            // Layer 3: Partially equipped (maximize)
            const maxPart = curPartiallyEquipped + needed * (cand.isPartiallyEquipped ? 1 : 0);
            if (maxPart < best.partiallyEquippedCount) break;
            if (maxPart === best.partiallyEquippedCount) {
              // Layer 4: Known aspects (maximize)
              const maxAspects = curKnownAspects + needed * cand.knownAspects;
              if (maxAspects < best.knownAspects) break;
              if (maxAspects === best.knownAspects) {
                // Layer 5: Synergy score (maximize)
                const maxScore = curSynergyScore + needed * (cand.synergyScore ?? 0);
                if (maxScore < best.totalSynergyScore - 0.001) break;
                if (Math.abs(maxScore - best.totalSynergyScore) <= 0.001) {
                  // Layer 6: Matched pairs (maximize)
                  const maxPairs = curMatchedPairs + needed * cand.matchedPairs;
                  if (maxPairs < best.totalMatchedPairs) break;
                  if (maxPairs === best.totalMatchedPairs) {
                    // Layer 7: Directional edges (maximize)
                    const maxEdges = curDirectionalEdges + needed * cand.directionalEdges;
                    if (maxEdges < best.totalDirectionalEdges) break;
                  }
                }
              }
            }
          }
        }
      }

      // Prune if any Resonator already used
      if (
        usedResonators.has(cand.memberA) ||
        usedResonators.has(cand.memberB) ||
        usedResonators.has(cand.memberC)
      ) {
        continue;
      }

      // Choose
      usedResonators.add(cand.memberA);
      usedResonators.add(cand.memberB);
      usedResonators.add(cand.memberC);
      currentSelection.push(cand);
      curIncompatible += cand.hasIncompatibleWeapon ? 1 : 0;
      curFullyEquipped += cand.isFullyEquipped ? 1 : 0;
      curPartiallyEquipped += cand.isPartiallyEquipped ? 1 : 0;
      curKnownAspects += cand.knownAspects;
      curSynergyScore += cand.synergyScore ?? 0;
      curMatchedPairs += cand.matchedPairs;
      curDirectionalEdges += cand.directionalEdges;

      // Recurse
      backtrack(i + 1);

      // Backtrack
      curIncompatible -= cand.hasIncompatibleWeapon ? 1 : 0;
      curFullyEquipped -= cand.isFullyEquipped ? 1 : 0;
      curPartiallyEquipped -= cand.isPartiallyEquipped ? 1 : 0;
      curKnownAspects -= cand.knownAspects;
      curSynergyScore -= cand.synergyScore ?? 0;
      curMatchedPairs -= cand.matchedPairs;
      curDirectionalEdges -= cand.directionalEdges;
      currentSelection.pop();
      usedResonators.delete(cand.memberA);
      usedResonators.delete(cand.memberB);
      usedResonators.delete(cand.memberC);
    }
  }

  backtrack(0);

  const chosen = searchState.bestSelection;

  if (!chosen || chosen.length < targetK) {
    if (allowPartial && chosen && chosen.length > 0) {
      return {
        selectedTeams: Object.freeze(chosen.map((s) => s.teamBuild)),
        combinationsExplored: searchState.combinationsExplored,
        isInfeasible: false,
        isPartial: true,
        infeasibilityReasons: Object.freeze([])
      };
    }

    infeasibilityReasons.push(
      `Could not find a combination of ${targetK} mutually disjoint teams among the eligible candidates.`
    );
    return {
      selectedTeams: Object.freeze([]),
      combinationsExplored: searchState.combinationsExplored,
      isInfeasible: true,
      isPartial: false,
      infeasibilityReasons: Object.freeze(infeasibilityReasons)
    };
  }

  // Canonicalize selected teams order by deterministic team id ASC
  const sortedSelected = [...chosen.map((s) => s.teamBuild)].sort((a, b) =>
    a.id.localeCompare(b.id)
  );

  return {
    selectedTeams: Object.freeze(sortedSelected),
    combinationsExplored: searchState.combinationsExplored,
    isInfeasible: false,
    isPartial: false,
    infeasibilityReasons: Object.freeze([])
  };
}
