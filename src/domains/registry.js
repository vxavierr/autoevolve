// src/domains/registry.js
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export class DomainRegistry {
  #cwd;

  constructor(cwd) {
    this.#cwd = cwd;
  }

  async detectDomains() {
    const detected = [];

    // code: has package.json with test script, or has Makefile, etc.
    if (await this.#hasTestRunner()) detected.push('code');

    // prompts: has CLAUDE.md or .claude/ directory
    if (await this.#hasClaudeConfig()) detected.push('prompts');

    // behavior: always available (session logs are in ~/.claude/)
    detected.push('behavior');

    // flow: has .aios-core/ or other known framework
    if (await this.#hasFramework()) detected.push('flow');

    return detected;
  }

  async #hasTestRunner() {
    try {
      const pkg = await readFile(join(this.#cwd, 'package.json'), 'utf8');
      const parsed = JSON.parse(pkg);
      return !!(parsed.scripts?.test);
    } catch {
      return false;
    }
  }

  async #hasClaudeConfig() {
    const paths = [
      join(this.#cwd, 'CLAUDE.md'),
      join(this.#cwd, '.claude', 'CLAUDE.md'),
    ];
    for (const p of paths) {
      try {
        await access(p);
        return true;
      } catch { continue; }
    }
    return false;
  }

  async #hasFramework() {
    const frameworks = [
      { dir: '.aios-core', name: 'aiox', adapter: '.aios-core/autoevolve/flow.js' },
      // future: other frameworks can be added here
    ];
    for (const fw of frameworks) {
      try {
        await access(join(this.#cwd, fw.dir));
        this.#detectedFramework = fw;
        return true;
      } catch { continue; }
    }
    return false;
  }

  #detectedFramework = null;

  getFrameworkName() {
    return this.#detectedFramework?.name ?? null;
  }

  async loadFlowAdapter() {
    if (!this.#detectedFramework?.adapter) return null;
    const adapterPath = join(this.#cwd, this.#detectedFramework.adapter);
    try {
      await access(adapterPath);
      const mod = await import(`file://${adapterPath.replace(/\\/g, '/')}`);
      const AdapterClass = mod.AIOXFlowAdapter ?? mod.default;
      if (AdapterClass) return new AdapterClass(this.#cwd);
    } catch { /* adapter not installed, flow uses base interface */ }
    return null;
  }
}
