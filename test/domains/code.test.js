// test/domains/code.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCoverageOutput, parseLintOutput } from '../../src/domains/code/metrics.js';
import { CodeDomain } from '../../src/domains/code/index.js';

describe('Code Metrics', () => {
  it('parses jest coverage output', () => {
    const output = `
----------|---------|----------|---------|---------|
File      | % Stmts | % Branch | % Funcs | % Lines |
----------|---------|----------|---------|---------|
All files |   78.5  |    65.2  |   90.1  |   78.5  |
----------|---------|----------|---------|---------|
`;
    const coverage = parseCoverageOutput(output);
    assert.equal(coverage, 78.5);
  });

  it('parses eslint JSON output', () => {
    const output = JSON.stringify([
      { errorCount: 3, warningCount: 2 },
      { errorCount: 1, warningCount: 0 },
    ]);
    const count = parseLintOutput(output);
    assert.equal(count, 4); // total errors
  });

  it('returns null for unparseable output', () => {
    assert.equal(parseCoverageOutput('garbage'), null);
    assert.equal(parseLintOutput('not json'), null);
  });
});

describe('CodeDomain', () => {
  it('has correct domain metadata', () => {
    const domain = new CodeDomain({});
    assert.equal(domain.name, 'code');
    assert.ok(domain.metrics.length > 0);
  });
});
