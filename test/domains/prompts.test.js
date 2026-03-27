// test/domains/prompts.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { countTokensApprox, measureInstructionDensity } from '../../src/domains/prompts/metrics.js';
import { PromptsDomain } from '../../src/domains/prompts/index.js';

describe('Prompt Metrics', () => {
  it('counts tokens approximately (4 chars per token)', () => {
    const text = 'Hello world this is a test string for counting';
    const count = countTokensApprox(text);
    assert.ok(count > 5);
    assert.ok(count < 50);
  });

  it('measures instruction density (rules per token)', () => {
    const text = `
# Rules
- Always do X
- Never do Y
- Must check Z

# Description
This is some filler text that adds tokens but not rules.
More filler text here.
    `;
    const density = measureInstructionDensity(text);
    assert.ok(density > 0);
    assert.ok(density <= 1);
  });

  it('handles empty input', () => {
    assert.equal(countTokensApprox(''), 0);
    assert.equal(measureInstructionDensity(''), 0);
  });
});

describe('PromptsDomain', () => {
  it('has correct domain metadata', () => {
    const domain = new PromptsDomain({});
    assert.equal(domain.name, 'prompts');
  });
});
