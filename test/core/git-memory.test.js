// test/core/git-memory.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, cleanTempDir } from '../helpers/fixtures.js';
import { GitMemory } from '../../src/core/git-memory.js';

describe('GitMemory', () => {
  let dir;
  let git;

  before(async () => {
    dir = await createTempDir();
    execSync('git init', { cwd: dir });
    execSync('git config user.email "test@test.com"', { cwd: dir });
    execSync('git config user.name "Test"', { cwd: dir });
    // initial commit
    await writeFile(join(dir, 'file.txt'), 'initial');
    execSync('git add -A && git commit -m "init"', { cwd: dir });
    git = new GitMemory(dir);
  });

  after(async () => {
    await cleanTempDir(dir);
  });

  it('commits a change with autoevolve prefix', async () => {
    await writeFile(join(dir, 'file.txt'), 'changed');
    const hash = await git.commit('test improvement');
    assert.ok(hash);
    const log = execSync('git log --oneline -1', { cwd: dir, encoding: 'utf8' });
    assert.ok(log.includes('[autoevolve]'));
  });

  it('reverts last commit', async () => {
    await writeFile(join(dir, 'file.txt'), 'will revert');
    await git.commit('bad change');
    await git.revertLast();
    const log = execSync('git log --oneline -1', { cwd: dir, encoding: 'utf8' });
    assert.ok(log.includes('Revert'));
  });

  it('reads autoevolve commit history', async () => {
    await writeFile(join(dir, 'file.txt'), 'another');
    await git.commit('iteration 3');
    const history = await git.getHistory(10);
    assert.ok(history.length >= 1);
    assert.ok(history[0].message.includes('[autoevolve]'));
  });

  it('gets current diff (staged + unstaged)', async () => {
    await writeFile(join(dir, 'file.txt'), 'diffable');
    const diff = await git.getDiff();
    assert.ok(diff.includes('diffable'));
  });
});
