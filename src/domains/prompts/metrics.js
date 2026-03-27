// src/domains/prompts/metrics.js

export function countTokensApprox(text) {
  if (!text) return 0;
  // Rough approximation: ~4 chars per token for English
  // More accurate: split on whitespace and punctuation
  const words = text.split(/\s+/).filter(Boolean);
  return Math.ceil(words.length * 1.3); // words * 1.3 ≈ tokens
}

export function measureInstructionDensity(text) {
  if (!text) return 0;
  const tokens = countTokensApprox(text);
  if (tokens === 0) return 0;

  // Count actionable instructions: lines starting with -, *, numbered, or containing MUST/NEVER/ALWAYS
  const lines = text.split('\n');
  let ruleCount = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[-*]\s/.test(trimmed)) ruleCount++;
    if (/^\d+\.\s/.test(trimmed)) ruleCount++;
    if (/\b(MUST|NEVER|ALWAYS|REQUIRED|BLOCKED)\b/.test(trimmed)) ruleCount++;
  }

  return ruleCount / tokens;
}
