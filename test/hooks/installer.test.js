import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, cleanTempDir } from '../helpers/fixtures.js';
import { HookInstaller } from '../../src/hooks/installer.js';

describe('HookInstaller', () => {
  let dir;

  before(async () => {
    dir = await createTempDir();
    // Create a fake settings.json with existing hooks
    await mkdir(join(dir, '.claude'), { recursive: true });
    await writeFile(join(dir, '.claude', 'settings.local.json'), JSON.stringify({
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo existing', timeout: 10 }] }
        ]
      }
    }, null, 2));
  });

  after(async () => {
    await cleanTempDir(dir);
  });

  it('proposes a hook (writes to guardrails-proposed.json)', async () => {
    const installer = new HookInstaller(dir);
    await installer.propose({
      event: 'PreToolUse',
      matcher: 'Bash',
      command: 'node .autoevolve/hooks/verify.cjs',
      timeout: 10,
      description: '[autoevolve] Verify data source',
    });

    const proposals = await installer.getPendingProposals();
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0].status, 'pending');
  });

  it('installs approved hook to settings.local.json (appends)', async () => {
    const installer = new HookInstaller(dir);
    const proposals = await installer.getPendingProposals();
    const proposalId = proposals[0].id;

    await installer.approve(proposalId);

    const settings = JSON.parse(await readFile(join(dir, '.claude', 'settings.local.json'), 'utf8'));
    // Should have 2 PreToolUse entries now (existing + new)
    assert.equal(settings.hooks.PreToolUse.length, 2);
    assert.ok(settings.hooks.PreToolUse[1].hooks[0].command.includes('verify.cjs'));
  });

  it('marks approved proposal as installed', async () => {
    const installer = new HookInstaller(dir);
    const proposals = await installer.getPendingProposals();
    assert.equal(proposals.length, 0); // was approved, no longer pending
  });

  it('rejects a proposal (marks as rejected)', async () => {
    const installer = new HookInstaller(dir);
    await installer.propose({
      event: 'Stop',
      matcher: null,
      command: 'node .autoevolve/hooks/cleanup.cjs',
      timeout: 10,
      description: '[autoevolve] Cleanup on stop',
    });

    const proposals = await installer.getPendingProposals();
    await installer.reject(proposals[0].id);

    const allProposals = await installer.getAllProposals();
    const rejected = allProposals.find(p => p.status === 'rejected');
    assert.ok(rejected);
  });

  it('does not re-propose rejected hooks', async () => {
    const installer = new HookInstaller(dir);
    const wasProposed = installer.wasAlreadyProposed('[autoevolve] Cleanup on stop');
    assert.equal(await wasProposed, true);
  });
});
