import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, cleanTempDir } from '../helpers/fixtures.js';
import { HookGenerator } from '../../src/hooks/generator.js';

describe('HookGenerator', () => {
  let dir;

  before(async () => {
    dir = await createTempDir();
  });

  after(async () => {
    await cleanTempDir(dir);
  });

  it('generates a .cjs hook file from template', async () => {
    const gen = new HookGenerator();
    const result = await gen.generate({
      templateName: 'verify-data-source',
      description: 'Verify account context before credential access',
      basedOn: 'errado correction 5x',
      outputDir: join(dir, '.autoevolve', 'hooks'),
    });

    assert.ok(result.filePath.endsWith('.cjs'));
    assert.ok(result.hookName);

    const { readFile } = await import('node:fs/promises');
    const content = await readFile(result.filePath, 'utf8');
    assert.ok(content.includes('Verify account context'));
    assert.ok(content.includes('errado correction 5x'));
    assert.ok(!content.includes('{{'));  // no unresolved placeholders
  });

  it('generates unique filenames', async () => {
    const gen = new HookGenerator();
    const r1 = await gen.generate({
      templateName: 'confirm-scope',
      description: 'Confirm scope A',
      basedOn: 'test',
      outputDir: join(dir, '.autoevolve', 'hooks'),
    });
    const r2 = await gen.generate({
      templateName: 'confirm-scope',
      description: 'Confirm scope B',
      basedOn: 'test',
      outputDir: join(dir, '.autoevolve', 'hooks'),
    });
    assert.notEqual(r1.filePath, r2.filePath);
  });

  it('returns hook config for settings.json', async () => {
    const gen = new HookGenerator();
    const result = await gen.generate({
      templateName: 'check-branch',
      description: 'Check branch before push',
      basedOn: 'test',
      outputDir: join(dir, '.autoevolve', 'hooks'),
      event: 'PreToolUse',
      matcher: 'Bash',
    });

    assert.ok(result.hookConfig);
    assert.equal(result.hookConfig.event, 'PreToolUse');
    assert.equal(result.hookConfig.matcher, 'Bash');
    assert.ok(result.hookConfig.command.includes('.cjs'));
  });
});
