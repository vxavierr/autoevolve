// test/cost/tracker.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CostTracker } from '../../src/cost/tracker.js';

describe('CostTracker', () => {
  const PRICING = {
    sonnet: { input_per_1k: 0.003, output_per_1k: 0.015 },
    haiku: { input_per_1k: 0.00025, output_per_1k: 0.00125 },
    opus: { input_per_1k: 0.015, output_per_1k: 0.075 },
  };

  it('calculates cost from token counts', () => {
    const tracker = new CostTracker(PRICING);
    const cost = tracker.calculate({
      tokens_in: 1000,
      tokens_out: 2000,
      model: 'sonnet',
    });
    // 1000/1000 * 0.003 + 2000/1000 * 0.015 = 0.003 + 0.03 = 0.033
    assert.equal(cost.cost_usd, 0.033);
  });

  it('estimates tokens from char counts', () => {
    const tracker = new CostTracker(PRICING);
    const cost = tracker.calculateFromChars({
      chars_in: 4000,
      chars_out: 8000,
      model: 'sonnet',
    });
    // ~1000 tokens in, ~2000 tokens out (4 chars per token)
    assert.ok(cost.tokens_in === 1000);
    assert.ok(cost.tokens_out === 2000);
    assert.equal(cost.cost_usd, 0.033);
  });

  it('calculates savings for hardcoded rule (zero LLM cost)', () => {
    const tracker = new CostTracker(PRICING);
    const saving = tracker.estimateSaving('sonnet', 1500, 3000);
    // What it would have cost if LLM was used
    assert.ok(saving.saved_usd > 0);
  });

  it('handles unknown model gracefully', () => {
    const tracker = new CostTracker(PRICING);
    const cost = tracker.calculate({ tokens_in: 100, tokens_out: 200, model: 'unknown' });
    assert.equal(cost.cost_usd, 0);
    assert.equal(cost.model, 'unknown');
  });

  it('tracks multiple iterations and totals', () => {
    const tracker = new CostTracker(PRICING);
    tracker.recordIteration({ tokens_in: 1000, tokens_out: 2000, model: 'sonnet', was_hardcoded: false });
    tracker.recordIteration({ tokens_in: 500, tokens_out: 1000, model: 'haiku', was_hardcoded: false });
    tracker.recordIteration({ tokens_in: 0, tokens_out: 0, model: 'sonnet', was_hardcoded: true });

    const summary = tracker.getSummary();
    assert.equal(summary.iterations, 3);
    assert.ok(summary.total_cost > 0);
    assert.equal(summary.hardcoded_iterations, 1);
    assert.ok(summary.hardcoded_savings > 0);
  });
});
