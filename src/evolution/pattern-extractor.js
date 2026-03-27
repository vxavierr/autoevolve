// src/evolution/pattern-extractor.js
export class PatternExtractor {
  #threshold;

  constructor(threshold = 3) {
    this.#threshold = threshold;
  }

  extract(iterations) {
    // Count kept actions only
    const counts = new Map();
    for (const iter of iterations) {
      if (iter.decision !== 'keep') continue;
      const key = `${iter.domain}::${iter.action}`;
      const entry = counts.get(key) ?? { action: iter.action, domain: iter.domain, count: 0, iterations: [] };
      entry.count++;
      entry.iterations.push(iter.number ?? iter.timestamp ?? 'unknown');
      counts.set(key, entry);
    }

    return [...counts.values()].filter(p => p.count >= this.#threshold);
  }
}
