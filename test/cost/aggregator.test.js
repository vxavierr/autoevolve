// test/cost/aggregator.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, cleanTempDir } from '../helpers/fixtures.js';
import { CostAggregator } from '../../src/cost/aggregator.js';

describe('CostAggregator', () => {
  let dir;

  before(async () => {
    dir = await createTempDir();
    await mkdir(join(dir, '.autoevolve', 'logs'), { recursive: true });

    const iterations = [
      { cost_usd: 0.03, was_hardcoded: false, decision: 'keep', tokens_in: 1000, tokens_out: 2000 },
      { cost_usd: 0.02, was_hardcoded: false, decision: 'revert', tokens_in: 800, tokens_out: 1500 },
      { cost_usd: 0.0, was_hardcoded: true, decision: 'keep', tokens_in: 0, tokens_out: 0 },
      { cost_usd: 0.01, was_hardcoded: false, decision: 'keep', tokens_in: 500, tokens_out: 1000 },
    ];
    const jsonl = iterations.map(i => JSON.stringify(i)).join('\n');
    await writeFile(join(dir, '.autoevolve', 'logs', 'iterations.jsonl'), jsonl);
  });

  after(async () => {
    await cleanTempDir(dir);
  });

  it('reads iteration log and computes totals', async () => {
    const agg = new CostAggregator(dir);
    const result = await agg.aggregate();
    assert.equal(result.total_iterations, 4);
    assert.ok(result.total_cost > 0);
    assert.equal(result.kept, 3);
    assert.equal(result.reverted, 1);
  });

  it('calculates cost per improvement', async () => {
    const agg = new CostAggregator(dir);
    const result = await agg.aggregate();
    assert.ok(result.cost_per_improvement > 0);
    assert.ok(result.cost_per_improvement < result.total_cost); // 3 improvements, not just 1
  });

  it('calculates hardcoded savings', async () => {
    const agg = new CostAggregator(dir);
    const result = await agg.aggregate();
    assert.equal(result.hardcoded_iterations, 1);
    assert.ok(result.hardcoded_savings >= 0);
  });

  it('handles empty log', async () => {
    const emptyDir = await createTempDir();
    const agg = new CostAggregator(emptyDir);
    const result = await agg.aggregate();
    assert.equal(result.total_iterations, 0);
    assert.equal(result.total_cost, 0);
    await cleanTempDir(emptyDir);
  });
});
