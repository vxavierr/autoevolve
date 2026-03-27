// src/prediction/pattern-matcher.js

export class PatternMatcher {
  #patterns; // Map<RegExp, string[]>

  constructor(patternMap) {
    this.#patterns = new Map();
    for (const [keywords, templateIds] of Object.entries(patternMap)) {
      const regex = new RegExp(`\\b(${keywords})\\b`, 'i');
      this.#patterns.set(regex, templateIds);
    }
  }

  match(goal) {
    const matched = new Set();
    for (const [regex, templateIds] of this.#patterns) {
      if (regex.test(goal)) {
        for (const id of templateIds) matched.add(id);
      }
    }
    return [...matched];
  }
}
