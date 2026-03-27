// test/core/state.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { StateManager } from '../../src/core/state.js';

describe('StateManager', () => {
  let dir;
  let state;

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), 'autoevolve-test-'));
    state = new StateManager(dir);
  });

  after(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('initializes empty state', async () => {
    const s = await state.load();
    assert.equal(s.status, 'idle');
    assert.deepEqual(s.iterations, []);
    assert.equal(s.current_iteration, 0);
  });

  it('saves and loads state', async () => {
    await state.update({ status: 'running', goal: 'improve coverage' });
    const s = await state.load();
    assert.equal(s.status, 'running');
    assert.equal(s.goal, 'improve coverage');
  });

  it('appends iteration', async () => {
    await state.appendIteration({
      number: 1,
      action: 'added test',
      metric_before: 60,
      metric_after: 65,
      decision: 'keep'
    });
    const s = await state.load();
    assert.equal(s.iterations.length, 1);
    assert.equal(s.iterations[0].decision, 'keep');
  });

  it('resets state', async () => {
    await state.reset();
    const s = await state.load();
    assert.equal(s.status, 'idle');
    assert.deepEqual(s.iterations, []);
  });
});
