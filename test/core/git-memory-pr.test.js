// test/core/git-memory-pr.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, cleanTempDir } from '../helpers/fixtures.js';
import { GitMemory } from '../../src/core/git-memory.js';

describe('GitMemory — branch/PR methods', () => {
  let dir;
  let git;

  before(async () => {
    dir = await createTempDir();
    execSync('git init', { cwd: dir });
    execSync('git config user.email "test@test.com"', { cwd: dir });
    execSync('git config user.name "Test"', { cwd: dir });
    await writeFile(join(dir, 'file.txt'), 'initial');
    execSync('git add -A && git commit -m "init"', { cwd: dir });
    git = new GitMemory(dir);
  });

  after(async () => {
    await cleanTempDir(dir);
  });

  it('getCurrentBranch returns a string', async () => {
    const branch = await git.getCurrentBranch();
    assert.equal(typeof branch, 'string');
    assert.ok(branch.length > 0);
  });

  it('createBranch creates and checks out the branch', async () => {
    const name = 'autoevolve/cycle-test-001';
    const result = await git.createBranch(name);
    assert.equal(result, name);
    const current = await git.getCurrentBranch();
    assert.equal(current, name);
    // cleanup: go back to original branch
    execSync('git checkout -', { cwd: dir });
  });

  it('hasCommitsSince returns false when no new commits', async () => {
    const baseBranch = await git.getCurrentBranch();
    const has = await git.hasCommitsSince(baseBranch);
    assert.equal(has, false);
  });

  it('hasCommitsSince returns true after committing on a new branch', async () => {
    const base = await git.getCurrentBranch();
    const testBranch = 'autoevolve/cycle-test-002';
    await git.createBranch(testBranch);
    await writeFile(join(dir, 'new.txt'), 'content');
    execSync('git add -A && git commit -m "[autoevolve] test commit"', { cwd: dir });
    const has = await git.hasCommitsSince(base);
    assert.equal(has, true);
    // cleanup
    execSync(`git checkout ${base}`, { cwd: dir });
    execSync(`git branch -D ${testBranch}`, { cwd: dir });
  });

  it('deleteBranch removes the branch', async () => {
    const name = 'autoevolve/cycle-test-delete';
    execSync(`git branch ${name}`, { cwd: dir });
    await git.deleteBranch(name);
    const branches = execSync('git branch', { cwd: dir, encoding: 'utf8' });
    assert.ok(!branches.includes(name));
  });
});
