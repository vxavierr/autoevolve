// src/marketplace/exporter.js
import { readFile, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';

const EXPORT_FIELDS = ['id', 'domain', 'when', 'do', 'confidence', 'verified_count'];

export class RuleExporter {
  #baseDir;

  constructor(baseDir) {
    this.#baseDir = baseDir;
  }

  async exportLocal() {
    const rules = await this.#loadJson(join(this.#baseDir, '.autoevolve', 'rules', 'hardcoded-rules.json'), []);
    return this.#buildPackage(rules, 'local');
  }

  async exportGlobal() {
    const rules = await this.#loadJson(join(this.#baseDir, '.autoevolve', 'global-rules.json'), []);
    return this.#buildPackage(rules, 'global');
  }

  async exportToFile(filePath, globalOnly = false) {
    const pkg = globalOnly ? await this.exportGlobal() : await this.exportLocal();
    await writeFile(filePath, JSON.stringify(pkg, null, 2));
    return pkg;
  }

  #buildPackage(rules, source) {
    const cleanRules = rules.map(r => {
      const clean = {};
      for (const field of EXPORT_FIELDS) {
        if (r[field] !== undefined) clean[field] = r[field];
      }
      return clean;
    });

    return {
      name: `autoevolve-rules-${basename(this.#baseDir)}`,
      version: '1.0.0',
      description: `Hardcoded rules exported from ${source} (${cleanRules.length} rules)`,
      source,
      source_projects: 1,
      total_verified: cleanRules.reduce((s, r) => s + (r.verified_count ?? 0), 0),
      exported_at: new Date().toISOString(),
      rules: cleanRules,
    };
  }

  async #loadJson(path, fallback) {
    try {
      const parsed = JSON.parse(await readFile(path, 'utf8'));
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }
}
