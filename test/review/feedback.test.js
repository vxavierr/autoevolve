// test/review/feedback.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { ReviewFeedback } from '../../src/review/feedback.js';

async function createTempDir() {
  return mkdtemp(join(tmpdir(), 'autoevolve-feedback-test-'));
}

async function cleanTempDir(dir) {
  await rm(dir, { recursive: true, force: true });
}

describe('ReviewFeedback', () => {
  let dir;
  let feedback;

  before(async () => {
    dir = await createTempDir();
    feedback = new ReviewFeedback(dir);
  });

  after(async () => {
    await cleanTempDir(dir);
  });

  it('loadNegativeRules returns empty array when no file exists', async () => {
    const rules = await feedback.loadNegativeRules();
    assert.deepEqual(rules, []);
  });

  it('saveNegativeRules + loadNegativeRules roundtrip', async () => {
    const rules = [
      { id: 'neg-1', pr_number: 1, pr_title: 'Test PR', reason: 'do not remove tests', learned_at: '2026-01-01T00:00:00.000Z', active: true },
    ];
    await feedback.saveNegativeRules(rules);
    const loaded = await feedback.loadNegativeRules();
    assert.deepEqual(loaded, rules);
  });

  it('checkNegativeRules matches relevant active rules', async () => {
    const rules = [
      { id: 'neg-10', pr_number: 10, pr_title: 'Revert coverage', reason: 'remove coverage thresholds', learned_at: '2026-01-01T00:00:00.000Z', active: true },
      { id: 'neg-11', pr_number: 11, pr_title: 'Unrelated', reason: 'something completely unrelated', learned_at: '2026-01-01T00:00:00.000Z', active: false },
    ];
    await feedback.saveNegativeRules(rules);

    const matches = await feedback.checkNegativeRules('proposed: remove coverage thresholds from jest config');
    assert.equal(matches.length, 1);
    assert.equal(matches[0].id, 'neg-10');
  });

  it('checkNegativeRules ignores inactive rules', async () => {
    const rules = [
      { id: 'neg-20', pr_number: 20, pr_title: 'Inactive', reason: 'delete all test files', learned_at: '2026-01-01T00:00:00.000Z', active: false },
    ];
    await feedback.saveNegativeRules(rules);

    const matches = await feedback.checkNegativeRules('delete all test files from the project');
    assert.equal(matches.length, 0);
  });

  it('learnFromRejections deduplicates by PR number', async () => {
    // Pre-seed two existing rules
    const existing = [
      { id: 'neg-100', pr_number: 100, pr_title: 'Old PR', reason: 'reject something', learned_at: '2026-01-01T00:00:00.000Z', active: true },
    ];
    await feedback.saveNegativeRules(existing);

    // Simulate scanClosedPRs returning PRs — we override the method
    const prs = [
      {
        number: 100, // duplicate — should be skipped
        title: 'Already known PR',
        body: '',
        closedAt: '2026-01-10T00:00:00.000Z',
        comments: [{ body: 'reject this change' }],
      },
      {
        number: 200, // new
        title: 'New rejected PR',
        body: '',
        closedAt: '2026-01-15T00:00:00.000Z',
        comments: [{ body: 'revert — this broke the build' }],
      },
    ];

    // Monkey-patch scanClosedPRs to avoid real gh calls
    feedback.scanClosedPRs = async () => prs;

    const newRules = await feedback.learnFromRejections();
    assert.equal(newRules.length, 1);
    assert.equal(newRules[0].pr_number, 200);

    const all = await feedback.loadNegativeRules();
    const prnumbers = all.map(r => r.pr_number);
    assert.ok(prnumbers.includes(100));
    assert.ok(prnumbers.includes(200));
  });
});
