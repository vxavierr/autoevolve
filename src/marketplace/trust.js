// src/marketplace/trust.js
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const MAX_FAILURES = 3;
const CONFIDENCE_BOOST = 0.1;
const CONFIDENCE_MAX = 1.0;

export class TrustEngine {
  #rulesPath;

  constructor(baseDir) {
    this.#rulesPath = join(baseDir, '.autoevolve', 'rules', 'hardcoded-rules.json');
  }

  async recordSuccess(ruleId) {
    const rules = await this.#load();
    const rule = rules.find(r => r.id === ruleId);
    if (!rule || !rule.imported_from) return; // only adjust imported rules

    rule.local_verified_count = (rule.local_verified_count ?? 0) + 1;
    rule.confidence = Math.min(CONFIDENCE_MAX, (rule.confidence ?? 0.5) + CONFIDENCE_BOOST);
    rule.last_used = new Date().toISOString();

    await this.#save(rules);
  }

  async recordFailure(ruleId) {
    let rules = await this.#load();
    const rule = rules.find(r => r.id === ruleId);
    if (!rule || !rule.imported_from) return;

    rule.local_fail_count = (rule.local_fail_count ?? 0) + 1;

    if (rule.local_fail_count >= MAX_FAILURES) {
      rules = rules.filter(r => r.id !== ruleId);
    }

    await this.#save(rules);
  }

  async #load() {
    try {
      const parsed = JSON.parse(await readFile(this.#rulesPath, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async #save(rules) {
    await writeFile(this.#rulesPath, JSON.stringify(rules, null, 2));
  }
}
