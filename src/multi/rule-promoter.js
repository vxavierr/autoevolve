// src/multi/rule-promoter.js
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ProjectScanner } from './project-scanner.js';
import { randomUUID } from 'node:crypto';

export class RulePromoter {
  #workspace;

  constructor(workspace) {
    this.#workspace = workspace;
  }

  async findCandidates() {
    const scanner = new ProjectScanner(this.#workspace);
    const projects = await scanner.scan();

    // Collect all rules from all projects, keyed by domain+do (case-insensitive)
    const ruleMap = new Map(); // key: "domain::do" → { rule, found_in: [project names] }

    for (const project of projects) {
      const rules = await this.#loadProjectRules(project.path);
      for (const rule of rules) {
        const key = `${rule.domain.toLowerCase()}::${rule.do.toLowerCase()}`;
        if (!ruleMap.has(key)) {
          ruleMap.set(key, { domain: rule.domain, do: rule.do, found_in: [], total_verified: 0 });
        }
        const entry = ruleMap.get(key);
        entry.found_in.push(project.name);
        entry.total_verified += rule.verified_count ?? 0;
      }
    }

    // Return rules found in 2+ projects
    return [...ruleMap.values()].filter(r => r.found_in.length >= 2);
  }

  async promote() {
    const candidates = await this.findCandidates();
    const existing = await this.#loadGlobalRules();
    const existingKeys = new Set(existing.map(r => `${r.domain.toLowerCase()}::${r.do.toLowerCase()}`));

    const newRules = [];
    for (const candidate of candidates) {
      const key = `${candidate.domain.toLowerCase()}::${candidate.do.toLowerCase()}`;
      if (existingKeys.has(key)) continue; // already promoted
      newRules.push({
        id: `global-${randomUUID().slice(0, 8)}`,
        domain: candidate.domain,
        when: `cross-project pattern (${candidate.found_in.join(', ')})`,
        do: candidate.do,
        confidence: 1.0,
        found_in: candidate.found_in,
        total_verified: candidate.total_verified,
        promoted_at: new Date().toISOString(),
      });
    }

    if (newRules.length > 0) {
      const all = [...existing, ...newRules];
      await this.#saveGlobalRules(all);
    }

    return newRules;
  }

  async #loadProjectRules(projectPath) {
    try {
      const raw = await readFile(join(projectPath, '.autoevolve', 'rules', 'hardcoded-rules.json'), 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async #loadGlobalRules() {
    try {
      const raw = await readFile(join(this.#workspace, '.autoevolve', 'global-rules.json'), 'utf8');
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  async #saveGlobalRules(rules) {
    const outDir = join(this.#workspace, '.autoevolve');
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, 'global-rules.json'), JSON.stringify(rules, null, 2));
  }
}
