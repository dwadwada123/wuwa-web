/**
 * Deterministic Combination Generator
 *
 * Generates unordered combinations C(N, 3) from an array.
 * Strictly guarantees no permutations and zero duplicate sets.
 */

/**
 * Generates all unordered 3-combinations from a list of items.
 * Time complexity: O(C(N, 3)), Space complexity: O(C(N, 3)).
 * Iterative nested loop avoiding recursion overhead.
 */
export function generate3Combinations<T>(items: T[]): [T, T, T][] {
  const result: [T, T, T][] = [];
  const n = items.length;
  if (n < 3) return result;

  for (let i = 0; i < n - 2; i++) {
    for (let j = i + 1; j < n - 1; j++) {
      for (let k = j + 1; k < n; k++) {
        result.push([items[i], items[j], items[k]]);
      }
    }
  }

  return result;
}

/**
 * Calculates theoretical combination count C(N, K).
 */
export function calculateCombinationCount(n: number, k: number = 3): number {
  if (n < k || k < 0) return 0;
  if (k === 3) {
    return (n * (n - 1) * (n - 2)) / 6;
  }
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result = (result * (n - i + 1)) / i;
  }
  return result;
}
