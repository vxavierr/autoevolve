// test/marketplace/importer.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, cleanTempDir } from '../helpers/fixtures.js';
import { RuleImporter } from '../../src/marketplace/importer.js';

describe('RuleImporter', () => {
  let dir;

  before(async () => {
    dir = await createTempDir();
    await mkdir(join(dir, '.autoevolve', 'rules'), { recursive: true });
    await writeFile(join(dir, '.autoevolve', 'rules', 'hardcoded-rules.json'), '[]');
  });

  after(async () => {
    await cleanTempDir(dir);
  });

  it('imports valid rules from file', async () => {
    const pkgPath = join(dir, 'import.json');
    await writeFile(pkgPath, JSON.stringify({
      name: 'test-rules', version: '1.0.0', rules: [
        { id: 'ext-1', domain: 'code', when: 'lint errors', do: 'eslint --fix', confidence: 1.0, verified_count: 10 },
      ],
    }));

    const importer = new RuleImporter(dir);
    const result = await importer.importFromFile(pkgPath);
    assert.equal(result.imported, 1);
    assert.equal(result.rejected, 0);

    const rules = JSON.parse(await readFile(join(dir, '.autoevolve', 'rules', 'hardcoded-rules.json'), 'utf8'));
    assert.equal(rules.length, 1);
    assert.equal(rules[0].confidence, 0.5); // reduced from 1.0
    assert.ok(rules[0].imported_from);
  });

  it('rejects rules with shell metacharacters in do field', async () => {
    const pkgPath = join(dir, 'bad-rules.json');
    await writeFile(pkgPath, JSON.stringify({
      name: 'bad', version: '1.0.0', rules: [
        { id: 'bad-1', domain: 'code', when: 'test', do: 'rm -rf / && echo pwned', confidence: 1.0 },
        { id: 'bad-2', domain: 'code', when: 'test', do: 'eslint; cat /etc/passwd', confidence: 1.0 },
        { id: 'bad-3', domain: 'code', when: 'test', do: 'echo `whoami`', confidence: 1.0 },
      ],
    }));

    const importer = new RuleImporter(dir);
    const result = await importer.importFromFile(pkgPath);
    assert.equal(result.imported, 0);
    assert.equal(result.rejected, 3);
  });

  it('rejects rules missing required fields', async () => {
    const pkgPath = join(dir, 'incomplete.json');
    await writeFile(pkgPath, JSON.stringify({
      name: 'incomplete', version: '1.0.0', rules: [
        { id: 'x', domain: 'code' }, // missing when and do
      ],
    }));

    const importer = new RuleImporter(dir);
    const result = await importer.importFromFile(pkgPath);
    assert.equal(result.imported, 0);
    assert.equal(result.rejected, 1);
  });

  it('enforces max 50 rules per import', async () => {
    const rules = Array.from({ length: 55 }, (_, i) => ({
      id: `r-${i}`, domain: 'code', when: `test ${i}`, do: 'eslint --fix', confidence: 1.0,
    }));
    const pkgPath = join(dir, 'toomany.json');
    await writeFile(pkgPath, JSON.stringify({ name: 'big', version: '1.0.0', rules }));

    const importer = new RuleImporter(dir);
    const result = await importer.importFromFile(pkgPath);
    assert.equal(result.imported, 50);
    assert.equal(result.truncated, true);
  });
});
