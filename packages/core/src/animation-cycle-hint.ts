/**
 * Scans HTML/JS source for numeric patterns that likely represent animation
 * cycle lengths. Returns up to 3 hint strings in descending confidence order.
 *
 * Normalisation rule: bare numbers < 100 are treated as seconds and converted
 * to ms; numbers >= 100 are treated as ms directly.
 */

function toMs(value: number, unit?: string): number {
  if (unit === 'ms') return value;
  if (unit === 's' || unit === undefined) {
    return value < 100 ? value * 1000 : value;
  }
  return value;
}

function hint(ms: number, source: string): string {
  return `Found possible cycle length (${source}): ${ms}ms → try --duration ${ms}`;
}

export function scanForCycleLengths(html: string): string[] {
  const candidates: Array<{ ms: number; source: string }> = [];
  const seen = new Set<number>();

  function add(ms: number, source: string): void {
    const rounded = Math.round(ms);
    if (rounded > 0 && !seen.has(rounded)) {
      seen.add(rounded);
      candidates.push({ ms: rounded, source });
    }
  }

  // Pass 1 (highest confidence): CSS animation-duration
  // Matches: animation-duration: 1.5s  or  animation-duration: 500ms
  const cssRe = /animation-duration\s*:\s*([\d.]+)(ms|s)?/gi;
  for (const m of html.matchAll(cssRe)) {
    const val = parseFloat(m[1]!);
    const unit = (m[2] ?? 's') as 'ms' | 's';
    if (!isNaN(val)) add(toMs(val, unit), 'CSS animation-duration');
  }

  // Pass 2 (medium confidence): JS variable assignment
  // Matches: duration: 5000  |  CYCLE = 3000  |  totalDuration = 8
  const jsVarRe = /(?:duration|cycle|loop|total[Dd]uration|CYCLE|LOOP|DURATION)\s*[=:]\s*([\d.]+)\s*(?:,|;|\n|\r|\/\/|\*\/)?/g;
  for (const m of html.matchAll(jsVarRe)) {
    const val = parseFloat(m[1]!);
    if (!isNaN(val)) add(toMs(val), 'JS variable assignment');
  }

  // Pass 3 (lower confidence): rAF comparison
  // Matches: if (t >= 14)  |  timestamp % 14000
  const rafRe = /(?:if\s*\(\s*\w+\s*>=\s*([\d.]+)\s*\)|\w+\s*%\s*([\d.]+))/g;
  for (const m of html.matchAll(rafRe)) {
    const val = parseFloat((m[1] ?? m[2])!);
    if (!isNaN(val)) add(toMs(val), 'rAF comparison');
  }

  return candidates.slice(0, 3).map((c) => hint(c.ms, c.source));
}
