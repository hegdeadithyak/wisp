/**
 * Trims code context to stay within token budget.
 *
 * Strategy:
 *   - Keep the last N lines of prefix (most relevant for completion)
 *   - Keep the first N lines of suffix (immediate context after cursor)
 *
 * Why limit context?
 *   Every extra token costs prefill time (linear on CPU).
 *   50-100 lines of prefix is enough for 95% of completions.
 */

const MAX_PREFIX_LINES = 100;
const MAX_SUFFIX_LINES = 30;

export function trimContext(
  prefix: string,
  suffix: string
): { prefix: string; suffix: string } {
  const prefixLines = prefix.split("\n");
  const suffixLines = suffix.split("\n");
  return {
    prefix: prefixLines.slice(-MAX_PREFIX_LINES).join("\n"),
    suffix: suffixLines.slice(0, MAX_SUFFIX_LINES).join("\n"),
  };
}
