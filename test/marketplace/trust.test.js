// test/marketplace/trust.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, cleanTempDir } from '../helpers/fixtures.js';
import { TrustEngine } from '../../src/marketplace/trust.js';

describe('TrustEngine', () => {
  let dir;

  before(async () => {
    dir = await createTempDir();
    await mkdir(join(dir, '.autoevolve', 'rules'), { recursive: true });
    await writeFile(join(dir, '.autoevolve', 'rules', 'hardcoded-rules.json'), JSON.stringify([
      { id: 'imported-1', domain: 'code', when: 'lint', do: 'eslint --fix', confidence: 0.5, imported_from: 'test', local_verified_count: 0, local_fail_count: 0 },
      { id: 'imported-2', domain: 'code', when: 'test', do: 'bad action', confidence: 0.5, imported_from: 'test', local_verified_count: 0, local_fail_count: 2 },
      { id: 'native-1', domain: 'code', when: 'native', do: 'native action', confidence: 1.0, verified_count: 5 },
    ]));
  });

  after(async () => {
    await cleanTempDir(dir);
  });

  it('boosts confidence on successful use', async () => {
    const engine = new TrustEngine(dir);
    await engine.recordSuccess('imported-1');
    const rules = JSON.parse(await readFile(join(dir, '.autoevolve', 'rules', 'hardcoded-rules.json'), 'utf8'));
    const rule = rules.find(r => r.id === 'imported-1');
    assert.ok(rule.confidence > 0.5);
    assert.equal(rule.local_verified_count, 1);
  });

  it('reduces confidence on failure', async () => {
    const engine = new TrustEngine(dir);
    await engine.recordFailure('imported-1');
    const rules = JSON.parse(await readFile(join(dir, '.autoevolve', 'rules', 'hardcoded-rules.json'), 'utf8'));
    const rule = rules.find(r => r.id === 'imported-1');
    assert.equal(rule.local_fail_count, 1);
  });

  it('removes rule after 3 failures', async () => {
    const engine = new TrustEngine(dir);
    await engine.recordFailure('imported-2'); // was at 2, now 3
    const rules = JSON.parse(await readFile(join(dir, '.autoevolve', 'rules', 'hardcoded-rules.json'), 'utf8'));
    const removed = rules.find(r => r.id === 'imported-2');
    assert.equal(removed, undefined);
  });

  it('does not modify native rules', async () => {
    const engine = new TrustEngine(dir);
    await engine.recordSuccess('native-1');
    const rules = JSON.parse(await readFile(join(dir, '.autoevolve', 'rules', 'hardcoded-rules.json'), 'utf8'));
    const rule = rules.find(r => r.id === 'native-1');
    assert.equal(rule.confidence, 1.0); // unchanged
  });
});
