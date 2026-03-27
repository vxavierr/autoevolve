// test/domains/registry.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, cleanTempDir } from '../helpers/fixtures.js';
import { DomainRegistry } from '../../src/domains/registry.js';
import { loadConfig } from '../../src/config.js';

describe('loadConfig', () => {
  let dir;

  before(async () => {
    dir = await createTempDir();
  });

  after(async () => {
    await cleanTempDir(dir);
  });

  it('returns default config when no file exists', async () => {
    const config = await loadConfig(dir);
    assert.ok(config.domains);
    assert.ok(config.loop);
    assert.ok(config.evolution);
  });

  it('loads config from YAML file', async () => {
    await mkdir(join(dir, '.autoevolve'), { recursive: true });
    await writeFile(join(dir, '.autoevolve', 'config.yaml'), `
domains:
  code:
    enabled: true
    verify_command: "npm test"
loop:
  max_iterations: 5
`);
    const config = await loadConfig(dir);
    assert.equal(config.domains.code.enabled, true);
    assert.equal(config.loop.max_iterations, 5);
  });
});

describe('DomainRegistry', () => {
  let dir;

  before(async () => {
    dir = await createTempDir();
  });

  after(async () => {
    await cleanTempDir(dir);
  });

  it('detects code domain when package.json has test script', async () => {
    await writeFile(join(dir, 'package.json'), JSON.stringify({
      scripts: { test: 'jest' }
    }));
    const registry = new DomainRegistry(dir);
    const detected = await registry.detectDomains();
    assert.ok(detected.includes('code'));
  });

  it('detects prompts domain when CLAUDE.md exists', async () => {
    await mkdir(join(dir, '.claude'), { recursive: true });
    await writeFile(join(dir, '.claude', 'CLAUDE.md'), '# Config');
    // Also need CLAUDE.md in root or .claude/
    await writeFile(join(dir, 'CLAUDE.md'), '# Config');
    const registry = new DomainRegistry(dir);
    const detected = await registry.detectDomains();
    assert.ok(detected.includes('prompts'));
  });

  it('detects flow domain when .aios-core exists', async () => {
    await mkdir(join(dir, '.aios-core'), { recursive: true });
    const registry = new DomainRegistry(dir);
    const detected = await registry.detectDomains();
    assert.ok(detected.includes('flow'));
  });

  it('does not detect flow when no framework found', async () => {
    const emptyDir = await createTempDir();
    const registry = new DomainRegistry(emptyDir);
    const detected = await registry.detectDomains();
    assert.ok(!detected.includes('flow'));
    await cleanTempDir(emptyDir);
  });
});
