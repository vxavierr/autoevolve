// test/domains/flow.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FlowInterface } from '../../src/domains/flow/interface.js';

describe('FlowInterface', () => {
  it('defines required methods', () => {
    const flow = new FlowInterface();
    assert.equal(typeof flow.scan, 'function');
    assert.equal(typeof flow.detect, 'function');
    assert.equal(typeof flow.report, 'function');
  });

  it('scan returns empty array by default', async () => {
    const flow = new FlowInterface();
    const items = await flow.scan();
    assert.deepEqual(items, []);
  });

  it('detect returns empty findings by default', async () => {
    const flow = new FlowInterface();
    const findings = await flow.detect();
    assert.deepEqual(findings, []);
  });

  it('report returns structured report', async () => {
    const flow = new FlowInterface();
    const report = await flow.report();
    assert.ok('findings' in report);
    assert.ok('metrics' in report);
  });
});
