// test/domains/behavior-model.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, cleanTempDir } from '../helpers/fixtures.js';
import { BehaviorModel } from '../../src/domains/behavior/model.js';

describe('BehaviorModel', () => {
  let dir;

  before(async () => {
    dir = await createTempDir();
  });

  after(async () => {
    await cleanTempDir(dir);
  });

  it('initializes empty model', async () => {
    const model = new BehaviorModel(dir);
    const data = await model.load();
    assert.equal(data.total_sessions_processed, 0);
    assert.deepEqual(data.processed_sessions, []);
    assert.deepEqual(data.patterns.corrections, {});
  });

  it('merges new analysis results', async () => {
    const model = new BehaviorModel(dir);
    await model.merge('session-abc.jsonl', {
      corrections: [{ signal: '\\berrado\\b', type: 'correction' }],
      frustrations: [],
      approvals: [{ type: 'approval' }],
      stats: { userMessages: 50, assistantMessages: 40 },
    });

    const data = await model.load();
    assert.equal(data.total_sessions_processed, 1);
    assert.ok(data.processed_sessions.includes('session-abc.jsonl'));
    assert.equal(data.patterns.corrections['\\berrado\\b'].count, 1);
    assert.equal(data.total_user_messages, 50);
  });

  it('skips already processed sessions', async () => {
    const model = new BehaviorModel(dir);
    const result = await model.merge('session-abc.jsonl', {
      corrections: [{ signal: '\\berrado\\b', type: 'correction' }],
      frustrations: [],
      approvals: [],
      stats: { userMessages: 10, assistantMessages: 8 },
    });

    assert.equal(result.skipped, true);
    const data = await model.load();
    assert.equal(data.total_sessions_processed, 1); // unchanged
  });

  it('accumulates across multiple sessions', async () => {
    const model = new BehaviorModel(dir);
    await model.merge('session-def.jsonl', {
      corrections: [
        { signal: '\\berrado\\b', type: 'correction' },
        { signal: '\\berrado\\b', type: 'correction' },
      ],
      frustrations: [{ type: 'frustration' }],
      approvals: [],
      stats: { userMessages: 30, assistantMessages: 25 },
    });

    const data = await model.load();
    assert.equal(data.total_sessions_processed, 2);
    assert.equal(data.patterns.corrections['\\berrado\\b'].count, 3); // 1 from before + 2 now
    assert.equal(data.total_user_messages, 80); // 50 + 30
  });

  it('proposes guardrail when correction threshold met', async () => {
    const model = new BehaviorModel(dir, { guardrailThreshold: 3 });
    const proposals = await model.getGuardrailProposals();
    assert.ok(proposals.length >= 1);
    assert.equal(proposals[0].signal, '\\berrado\\b');
    assert.ok(proposals[0].suggestion);
  });
});
