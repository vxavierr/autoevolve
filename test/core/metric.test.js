// test/core/metric.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Metric, compareMetrics } from '../../src/core/metric.js';
import { Verifier } from '../../src/core/verifier.js';

describe('Metric', () => {
  it('creates a metric with name and direction', () => {
    const m = new Metric('coverage', 'higher-is-better');
    assert.equal(m.name, 'coverage');
    assert.equal(m.direction, 'higher-is-better');
  });

  it('compares higher-is-better correctly', () => {
    assert.equal(compareMetrics(70, 80, 'higher-is-better'), 'improved');
    assert.equal(compareMetrics(80, 70, 'higher-is-better'), 'worsened');
    assert.equal(compareMetrics(70, 70, 'higher-is-better'), 'unchanged');
  });

  it('compares lower-is-better correctly', () => {
    assert.equal(compareMetrics(10, 5, 'lower-is-better'), 'improved');
    assert.equal(compareMetrics(5, 10, 'lower-is-better'), 'worsened');
    assert.equal(compareMetrics(5, 5, 'lower-is-better'), 'unchanged');
  });
});

describe('Verifier', () => {
  it('runs a command and returns exit code + stdout', async () => {
    const v = new Verifier('node -e "console.log(42)"');
    const result = await v.run();
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('42'));
  });

  it('captures non-zero exit code without throwing', async () => {
    const v = new Verifier('node -e "process.exit(1)"');
    const result = await v.run();
    assert.equal(result.exitCode, 1);
  });

  it('extracts a number from stdout using regex', async () => {
    const v = new Verifier('node -e "console.log(\'Coverage: 78.5%\')"');
    const result = await v.run();
    const value = v.extractNumber(result.stdout, /(\d+\.?\d*)%/);
    assert.equal(value, 78.5);
  });
});
