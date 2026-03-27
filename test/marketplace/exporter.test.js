// test/marketplace/exporter.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, cleanTempDir } from '../helpers/fixtures.js';
import { RuleExporter } from '../../src/marketplace/exporter.js';

describe('RuleExporter', () => {
  let dir;

  before(async () => {
    dir = await createTempDir();
    await mkdir(join(dir, '.autoevolve', 'rules'), { recursive: true });
    await writeFile(join(dir, '.autoevolve', 'rules', 'hardcoded-rules.json'), JSON.stringify([
      { id: 'rule-1', domain: 'code', when: 'lint errors', do: 'eslint --fix', confidence: 1.0, verified_count: 10 },
      { id: 'rule-2', domain: 'prompts', when: 'tokens high', do: 'compress', confidence: 1.0, verified_count: 5 },
    ]));
    await writeFile(join(dir, '.autoevolve', 'global-rules.json'), JSON.stringify([
      { id: 'global-1', domain: 'code', when: 'cross-project', do: 'eslint --fix', confidence: 1.0, verified_count: 20, found_in: ['app-a', 'app-b'] },
    ]));
  });

  after(async () => {
    await cleanTempDir(dir);
  });

  it('exports local rules as package', async () => {
    const exporter = new RuleExporter(dir);
    const pkg = await exporter.exportLocal();
    assert.equal(pkg.rules.length, 2);
    assert.ok(pkg.name);
    assert.ok(pkg.version);
    assert.ok(pkg.exported_at);
  });

  it('exports global rules only', async () => {
    const exporter = new RuleExporter(dir);
    const pkg = await exporter.exportGlobal();
    assert.equal(pkg.rules.length, 1);
    assert.equal(pkg.rules[0].id, 'global-1');
  });

  it('strips internal fields from exported rules', async () => {
    const exporter = new RuleExporter(dir);
    const pkg = await exporter.exportLocal();
    for (const rule of pkg.rules) {
      assert.ok(rule.domain);
      assert.ok(rule.when);
      assert.ok(rule.do);
      assert.ok(!rule.created_at); // internal field stripped
      assert.ok(!rule.last_used); // internal field stripped
    }
  });

  it('saves export to file', async () => {
    const exporter = new RuleExporter(dir);
    const outPath = join(dir, 'exported-rules.json');
    await exporter.exportToFile(outPath);
    const { readFile } = await import('node:fs/promises');
    const pkg = JSON.parse(await readFile(outPath, 'utf8'));
    assert.ok(pkg.rules.length >= 2);
  });
});
