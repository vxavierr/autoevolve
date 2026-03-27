// src/domains/code/metrics.js
export function parseCoverageOutput(stdout) {
  // Jest/istanbul format: "All files | XX.X |"
  const match = stdout.match(/All files\s*\|\s*([\d.]+)/);
  if (match) return parseFloat(match[1]);

  // Generic: "Coverage: XX.X%"
  const generic = stdout.match(/[Cc]overage[:\s]+([\d.]+)%/);
  if (generic) return parseFloat(generic[1]);

  return null;
}

export function parseLintOutput(stdout) {
  try {
    const results = JSON.parse(stdout);
    if (Array.isArray(results)) {
      return results.reduce((sum, r) => sum + (r.errorCount ?? 0), 0);
    }
    return null;
  } catch {
    // Try line-based: "X problems"
    const match = stdout.match(/(\d+)\s+problems?/);
    if (match) return parseInt(match[1], 10);
    return null;
  }
}
