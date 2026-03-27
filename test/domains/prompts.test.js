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

describe('measureTotalTokens', () => {
  it('counts tokens across .md files in a directory', async () => {
    const { measureTotalTokens } = await import('../../src/domains/prompts/verifiers.js');
    const { createTempDir, cleanTempDir } = await import('../helpers/fixtures.js');
    const { mkdir, writeFile } = await import('node:fs/promises');
    const { join } = await import('node:path');

    const dir = await createTempDir();
    await mkdir(join(dir, '.claude'), { recursive: true });
    await writeFile(join(dir, '.claude', 'CLAUDE.md'), 'This is a test file with some content for counting tokens');
    await writeFile(join(dir, '.claude', 'rules.md'), 'Another file with rules and instructions');

    const total = await measureTotalTokens(dir, '.claude/**/*.md');
    assert.ok(total > 0);
    assert.ok(total < 100); // two small files

    await cleanTempDir(dir);
  });
});
