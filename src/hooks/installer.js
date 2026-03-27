import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export class HookInstaller {
  #baseDir;
  #proposalsPath;
  #settingsPath;

  constructor(baseDir) {
    this.#baseDir = baseDir;
    this.#proposalsPath = join(baseDir, '.autoevolve', 'behavior', 'guardrails-proposed.json');
    this.#settingsPath = join(baseDir, '.claude', 'settings.local.json');
  }

  async propose(hookConfig) {
    const proposals = await this.getAllProposals();

    // Don't re-propose if already exists (pending or rejected)
    if (proposals.some(p => p.description === hookConfig.description)) {
      return null;
    }

    const proposal = {
      id: `proposal-${randomUUID().slice(0, 8)}`,
      ...hookConfig,
      status: 'pending',
      proposed_at: new Date().toISOString(),
    };

    proposals.push(proposal);
    await this.#saveProposals(proposals);
    return proposal;
  }

  async approve(proposalId) {
    const proposals = await this.getAllProposals();
    const proposal = proposals.find(p => p.id === proposalId);
    if (!proposal || proposal.status !== 'pending') return false;

    // Install to settings.json
    await this.#installHook(proposal);

    // Mark as installed
    proposal.status = 'installed';
    proposal.installed_at = new Date().toISOString();
    await this.#saveProposals(proposals);
    return true;
  }

  async reject(proposalId) {
    const proposals = await this.getAllProposals();
    const proposal = proposals.find(p => p.id === proposalId);
    if (!proposal) return false;

    proposal.status = 'rejected';
    proposal.rejected_at = new Date().toISOString();
    await this.#saveProposals(proposals);
    return true;
  }

  async getPendingProposals() {
    const all = await this.getAllProposals();
    return all.filter(p => p.status === 'pending');
  }

  async getAllProposals() {
    try {
      const raw = await readFile(this.#proposalsPath, 'utf8');
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  async wasAlreadyProposed(description) {
    const all = await this.getAllProposals();
    return all.some(p => p.description === description);
  }

  async #installHook(proposal) {
    // Read existing settings
    let settings;
    try {
      settings = JSON.parse(await readFile(this.#settingsPath, 'utf8'));
    } catch {
      settings = {};
    }

    if (!settings.hooks) settings.hooks = {};
    const event = proposal.event;
    if (!settings.hooks[event]) settings.hooks[event] = [];

    // Build hook entry in Claude Code format
    const entry = {
      hooks: [{
        type: 'command',
        command: proposal.command,
        timeout: proposal.timeout ?? 10,
      }],
    };

    if (proposal.matcher) {
      entry.matcher = proposal.matcher;
    }

    // Append (never overwrite)
    settings.hooks[event].push(entry);

    // Write back
    await mkdir(join(this.#baseDir, '.claude'), { recursive: true });
    await writeFile(this.#settingsPath, JSON.stringify(settings, null, 2));
  }

  async #saveProposals(proposals) {
    await mkdir(join(this.#proposalsPath, '..'), { recursive: true });
    await writeFile(this.#proposalsPath, JSON.stringify(proposals, null, 2));
  }
}
