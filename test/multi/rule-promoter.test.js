// test/multi/rule-promoter.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, cleanTempDir } from '../helpers/fixtures.js';
import { RulePromoter } from '../../src/multi/rule-promoter.js';

describe('RulePromoter', () => {
  let workspace;

  before(async () => {
    workspace = await createTempDir();
    // Two projects with overlapping rules
    const proj1 = join(workspace, 'projects', 'app-a');
    const proj2 = join(workspace, 'projects', 'app-b');
    await mkdir(join(proj1, '.autoevolve', 'rules'), { recursive: true });
    await mkdir(join(proj2, '.autoevolve', 'rules'), { recursive: true });
    await writeFile(join(proj1, 'package.json'), '{}');
    await writeFile(join(proj2, 'package.json'), '{}');

    // Same rule in both projects (domain + do match)
    await writeFile(join(proj1, '.autoevolve', 'rules', 'hardcoded-rules.json'), JSON.stringify([
      { id: 'rule-a1', domain: 'code', when: 'eslint fixable > 0', do: 'run eslint --fix', confidence: 1.0, verified_count: 5 },
      { id: 'rule-a2', domain: 'code', when: 'coverage low', do: 'add missing test', confidence: 1.0, verified_count: 3 },
    ]));
    await writeFile(join(proj2, '.autoevolve', 'rules', 'hardcoded-rules.json'), JSON.stringify([
      { id: 'rule-b1', domain: 'code', when: 'lint errors present', do: 'run eslint --fix', confidence: 1.0, verified_count: 4 },
      { id: 'rule-b2', domain: 'prompts', when: 'tokens high', do: 'compress instructions', confidence: 1.0, verified_count: 2 },
    ]));
  });

  after(async () => {
    await cleanTempDir(workspace);
  });

  it('finds rules that match across projects (domain+do)', async () => {
    const promoter = new RulePromoter(workspace);
    const candidates = await promoter.findCandidates();
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].do, 'run eslint --fix');
    assert.equal(candidates[0].domain, 'code');
    assert.ok(candidates[0].found_in.length >= 2);
  });

  it('promotes candidates to global-rules.json', async () => {
    const promoter = new RulePromoter(workspace);
    await promoter.promote();
    const { readFile } = await import('node:fs/promises');
    const global = JSON.parse(await readFile(join(workspace, '.autoevolve', 'global-rules.json'), 'utf8'));
    assert.equal(global.length, 1);
    assert.equal(global[0].do, 'run eslint --fix');
    assert.ok(global[0].promoted_at);
  });

  it('does not duplicate already promoted rules', async () => {
    const promoter = new RulePromoter(workspace);
    await promoter.promote();
    await promoter.promote(); // run again
    const { readFile } = await import('node:fs/promises');
    const global = JSON.parse(await readFile(join(workspace, '.autoevolve', 'global-rules.json'), 'utf8'));
    assert.equal(global.length, 1); // still just 1
  });
});
