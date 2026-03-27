// test/prediction/engine.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, cleanTempDir } from '../helpers/fixtures.js';
import { PredictionEngine } from '../../src/prediction/engine.js';

describe('PredictionEngine', () => {
  let dir;

  before(async () => {
    dir = await createTempDir();
    // Create a behavior model
    await mkdir(join(dir, '.autoevolve', 'behavior'), { recursive: true });
    await writeFile(join(dir, '.autoevolve', 'behavior', 'model.json'), JSON.stringify({
      updated_at: '2026-03-27T12:00:00Z',
      processed_sessions: ['s1.jsonl'],
      total_sessions_processed: 100,
      total_user_messages: 5000,
      patterns: {
        corrections: {
          '\\berrado\\b': { count: 5, projects: ['hub', 'mindo', 'transfer'], first_seen: '2026-03-20', last_seen: '2026-03-27' },
        },
        frustrations: { short_reply: { count: 30 } },
        approvals: { total: 150 },
      },
      guardrails_active: [],
      weekly_snapshots: [],
    }));
  });

  after(async () => {
    await cleanTempDir(dir);
  });

  it('runs full prediction pipeline for a goal', async () => {
    const engine = new PredictionEngine(dir);
    const result = await engine.predict('implementar auth no mindo');
    assert.ok(result.goal);
    assert.ok(typeof result.risk_score === 'number');
    assert.ok(result.risk_score >= 0 && result.risk_score <= 1);
    assert.ok(Array.isArray(result.scenarios));
    assert.ok(result.scenarios.length > 0);
  });

  it('returns scenarios with required fields', async () => {
    const engine = new PredictionEngine(dir);
    const result = await engine.predict('deploy to production');
    for (const s of result.scenarios) {
      assert.ok(s.id);
      assert.ok(s.description);
      assert.ok(typeof s.probability === 'number');
      assert.ok(s.severity);
      assert.ok(s.prevention);
    }
  });

  it('includes recommended guardrails', async () => {
    const engine = new PredictionEngine(dir);
    const result = await engine.predict('auth credentials login');
    const withGuardrails = result.scenarios.filter(s => s.recommended_guardrail);
    assert.ok(withGuardrails.length > 0);
  });

  it('computes risk score as average probability', async () => {
    const engine = new PredictionEngine(dir);
    const result = await engine.predict('database migration schema');
    const avgProb = result.scenarios.reduce((s, sc) => s + sc.probability, 0) / result.scenarios.length;
    assert.ok(Math.abs(result.risk_score - avgProb) < 0.01);
  });

  it('returns zero risk for unrecognized goals without LLM', async () => {
    const engine = new PredictionEngine(dir);
    const result = await engine.predict('write a haiku about fish');
    assert.equal(result.risk_score, 0);
    assert.equal(result.scenarios.length, 0);
  });

  it('saves prediction to .autoevolve/reports/', async () => {
    const engine = new PredictionEngine(dir);
    await engine.predictAndSave('deploy auth system');
    const { readdir } = await import('node:fs/promises');
    const reports = await readdir(join(dir, '.autoevolve', 'reports'));
    const predFiles = reports.filter(f => f.startsWith('prediction-'));
    assert.ok(predFiles.length >= 1);
  });
});
