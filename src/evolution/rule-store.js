// src/evolution/rule-store.js
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export class RuleStore {
  #filePath;

  constructor(baseDir) {
    this.#filePath = join(baseDir, '.autoevolve', 'rules', 'hardcoded-rules.json');
  }

  async loadAll() {
    try {
      const raw = await readFile(this.#filePath, 'utf8');
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  async add(rule) {
    const rules = await this.loadAll();
    const newRule = {
      id: `rule-${randomUUID().slice(0, 8)}`,
      ...rule,
      extracted_from: rule.extracted_from ?? [],
      verified_count: rule.verified_count ?? 0,
      created_at: new Date().toISOString(),
      last_used: null,
    };
    rules.push(newRule);
    await this.#save(rules);
    return newRule;
  }

  async findMatches(domain, context) {
    const rules = await this.loadAll();
    return rules.filter(r =>
      r.domain === domain &&
      context.toLowerCase().includes(r.when.toLowerCase())
    );
  }

  async markUsed(ruleId) {
    const rules = await this.loadAll();
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      rule.last_used = new Date().toISOString();
      rule.verified_count = (rule.verified_count ?? 0) + 1;
      await this.#save(rules);
    }
  }

  async #save(rules) {
    await mkdir(join(this.#filePath, '..'), { recursive: true });
    await writeFile(this.#filePath, JSON.stringify(rules, null, 2));
  }
}
