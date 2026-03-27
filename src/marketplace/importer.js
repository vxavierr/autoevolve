// src/marketplace/importer.js
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const REQUIRED_FIELDS = ['domain', 'when', 'do'];
const SHELL_METACHAR = /[;&|`$(){}]/;
const MAX_RULES_PER_IMPORT = 50;

export class RuleImporter {
  #baseDir;
  #rulesPath;

  constructor(baseDir) {
    this.#baseDir = baseDir;
    this.#rulesPath = join(baseDir, '.autoevolve', 'rules', 'hardcoded-rules.json');
  }

  async importFromFile(filePath) {
    const raw = await readFile(filePath, 'utf8');
    const pkg = JSON.parse(raw);
    return this.#processPackage(pkg, filePath);
  }

  async importFromUrl(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
    const pkg = await res.json();
    return this.#processPackage(pkg, url);
  }

  async #processPackage(pkg, source) {
    if (!pkg.rules || !Array.isArray(pkg.rules)) {
      return { imported: 0, rejected: 0, errors: ['No rules array in package'] };
    }

    let truncated = false;
    let rules = pkg.rules;
    if (rules.length > MAX_RULES_PER_IMPORT) {
      rules = rules.slice(0, MAX_RULES_PER_IMPORT);
      truncated = true;
    }

    const existing = await this.#loadExisting();
    let imported = 0;
    let rejected = 0;
    const errors = [];

    for (const rule of rules) {
      const validation = this.#validate(rule);
      if (!validation.valid) {
        rejected++;
        errors.push(`${rule.id ?? 'unknown'}: ${validation.reason}`);
        continue;
      }

      existing.push({
        ...rule,
        confidence: 0.5, // imported rules start at reduced confidence
        imported_from: source,
        imported_at: new Date().toISOString(),
        local_verified_count: 0,
        local_fail_count: 0,
      });
      imported++;
    }

    await mkdir(join(this.#rulesPath, '..'), { recursive: true });
    await writeFile(this.#rulesPath, JSON.stringify(existing, null, 2));

    return { imported, rejected, truncated, errors };
  }

  #validate(rule) {
    // Required fields
    for (const field of REQUIRED_FIELDS) {
      if (!rule[field]) return { valid: false, reason: `missing required field: ${field}` };
    }

    // Shell metacharacter sanitization
    if (SHELL_METACHAR.test(rule.do)) {
      return { valid: false, reason: `'do' field contains shell metacharacters: ${rule.do}` };
    }

    return { valid: true };
  }

  async #loadExisting() {
    try {
      const parsed = JSON.parse(await readFile(this.#rulesPath, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
