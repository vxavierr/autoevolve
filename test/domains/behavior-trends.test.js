// test/domains/behavior-trends.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BehaviorTrends } from '../../src/domains/behavior/trends.js';

describe('BehaviorTrends', () => {
  it('calculates trend from weekly snapshots', () => {
    const snapshots = [
      { week: '2026-W10', correction_rate: 0.010, frustration_rate: 0.008 },
      { week: '2026-W11', correction_rate: 0.008, frustration_rate: 0.007 },
      { week: '2026-W12', correction_rate: 0.005, frustration_rate: 0.004 },
      { week: '2026-W13', correction_rate: 0.003, frustration_rate: 0.003 },
    ];
    const trends = new BehaviorTrends(snapshots);
    const result = trends.analyze();
    assert.equal(result.correction_trend, 'improving');
    assert.equal(result.frustration_trend, 'improving');
  });

  it('detects worsening trend', () => {
    const snapshots = [
      { week: '2026-W10', correction_rate: 0.001 },
      { week: '2026-W11', correction_rate: 0.003 },
      { week: '2026-W12', correction_rate: 0.008 },
    ];
    const trends = new BehaviorTrends(snapshots);
    const result = trends.analyze();
    assert.equal(result.correction_trend, 'worsening');
  });

  it('detects stable trend', () => {
    const snapshots = [
      { week: '2026-W10', correction_rate: 0.005 },
      { week: '2026-W11', correction_rate: 0.005 },
      { week: '2026-W12', correction_rate: 0.005 },
    ];
    const trends = new BehaviorTrends(snapshots);
    const result = trends.analyze();
    assert.equal(result.correction_trend, 'stable');
  });

  it('returns unknown with insufficient data', () => {
    const trends = new BehaviorTrends([]);
    const result = trends.analyze();
    assert.equal(result.correction_trend, 'unknown');
  });

  it('creates weekly snapshot from model data', () => {
    const trends = new BehaviorTrends([]);
    const snapshot = trends.createSnapshot({
      total_user_messages: 1000,
      patterns: {
        corrections: { '\\berrado\\b': { count: 5 } },
        frustrations: { short_reply: { count: 10 } },
        approvals: { total: 50 },
      },
    });
    assert.ok(snapshot.week);
    assert.ok(typeof snapshot.correction_rate === 'number');
    assert.ok(typeof snapshot.frustration_rate === 'number');
    assert.ok(typeof snapshot.approval_rate === 'number');
  });
});
