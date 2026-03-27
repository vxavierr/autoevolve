// test/core/loop.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, cleanTempDir } from '../helpers/fixtures.js';
import { Loop } from '../../src/core/loop.js';

describe('Loop', () => {
  let dir;

  before(async () => {
    dir = await createTempDir();
    execSync('git init', { cwd: dir });
    execSync('git config user.email "test@test.com"', { cwd: dir });
    execSync('git config user.name "Test"', { cwd: dir });
    // Create a file with a known metric: count lines
    await writeFile(join(dir, 'code.txt'), 'line1\nline2\nline3\n');
    execSync('git add -A && git commit -m "init"', { cwd: dir });
  });

  after(async () => {
    await cleanTempDir(dir);
  });

  it('runs a single iteration with mock changeFn', async () => {
    const loop = new Loop({
      cwd: dir,
      goal: 'add more lines',
      maxIterations: 1,
      plateauThreshold: 3,
      verifyCommand: 'node -e "const fs=require(\'fs\'); const c=fs.readFileSync(\'code.txt\',\'utf8\').split(\'\\n\').filter(Boolean).length; console.log(\'Lines: \'+c)"',
      metricRegex: /Lines: (\d+)/,
      metricDirection: 'higher-is-better',
      changeFn: async ({ cwd, goal, history, metric }) => {
        const content = await readFile(join(cwd, 'code.txt'), 'utf8');
        await writeFile(join(cwd, 'code.txt'), content + 'newline\n');
        return 'added a line';
      },
    });

    const report = await loop.run();
    assert.equal(report.iterations, 1);
    assert.equal(report.kept, 1);
    assert.equal(report.reverted, 0);
    assert.ok(report.final.value > report.baseline.value);
  });

  it('reverts when metric worsens', async () => {
    const loop = new Loop({
      cwd: dir,
      goal: 'add lines but changeFn removes them',
      maxIterations: 1,
      plateauThreshold: 3,
      verifyCommand: 'node -e "const fs=require(\'fs\'); const c=fs.readFileSync(\'code.txt\',\'utf8\').split(\'\\n\').filter(Boolean).length; console.log(\'Lines: \'+c)"',
      metricRegex: /Lines: (\d+)/,
      metricDirection: 'higher-is-better',
      changeFn: async ({ cwd }) => {
        await writeFile(join(cwd, 'code.txt'), 'only1\n');
        return 'removed lines';
      },
    });

    const report = await loop.run();
    assert.equal(report.reverted, 1);
    assert.equal(report.kept, 0);
  });

  it('stops at plateau threshold', async () => {
    let callCount = 0;
    const loop = new Loop({
      cwd: dir,
      goal: 'no-op changes',
      maxIterations: 10,
      plateauThreshold: 3,
      verifyCommand: 'node -e "console.log(\'Lines: 5\')"', // always returns 5
      metricRegex: /Lines: (\d+)/,
      metricDirection: 'higher-is-better',
      changeFn: async ({ cwd }) => {
        callCount++;
        // change something so git has something to commit
        await writeFile(join(cwd, `noop-${callCount}.txt`), 'x');
        return 'no-op';
      },
    });

    const report = await loop.run();
    assert.equal(report.stop_reason, 'plateau');
    assert.ok(report.iterations <= 4); // 3 plateau + possible 1 initial
  });

  it('persists state with report after loop completes', async () => {
    const { StateManager } = await import('../../src/core/state.js');
    const state = new StateManager(dir);
    const s = await state.load();
    assert.equal(s.status, 'completed');
    assert.ok(s.report);
    assert.ok(s.report.goal);
    assert.ok(typeof s.report.iterations === 'number');
    assert.ok(typeof s.report.kept === 'number');
    assert.ok(typeof s.report.reverted === 'number');
  });
});
