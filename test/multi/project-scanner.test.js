// test/multi/project-scanner.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, cleanTempDir } from '../helpers/fixtures.js';
import { ProjectScanner, encodeSessionPath } from '../../src/multi/project-scanner.js';

describe('encodeSessionPath', () => {
  it('encodes Windows path to Claude session dir name', () => {
    assert.equal(
      encodeSessionPath('D:\\workspace\\projects\\mindo'),
      'D--workspace-projects-mindo'
    );
  });

  it('encodes Unix path', () => {
    assert.equal(
      encodeSessionPath('/home/user/projects/myapp'),
      '-home-user-projects-myapp'
    );
  });

  it('handles forward slashes on Windows', () => {
    assert.equal(
      encodeSessionPath('D:/workspace/projects/mindo'),
      'D--workspace-projects-mindo'
    );
  });
});

describe('ProjectScanner', () => {
  let workspace;

  before(async () => {
    workspace = await createTempDir();
    // Create fake projects
    const proj1 = join(workspace, 'projects', 'app-a');
    const proj2 = join(workspace, 'projects', 'app-b');
    const proj3 = join(workspace, 'projects', 'not-a-project');
    await mkdir(proj1, { recursive: true });
    await mkdir(proj2, { recursive: true });
    await mkdir(proj3, { recursive: true });

    // app-a has package.json with test script
    await writeFile(join(proj1, 'package.json'), JSON.stringify({ scripts: { test: 'vitest' } }));

    // app-b has CLAUDE.md
    await writeFile(join(proj2, 'CLAUDE.md'), '# Config');

    // not-a-project has nothing recognizable
    await writeFile(join(proj3, 'random.txt'), 'nothing');
  });

  after(async () => {
    await cleanTempDir(workspace);
  });

  it('discovers projects with package.json or CLAUDE.md', async () => {
    const scanner = new ProjectScanner(workspace);
    const projects = await scanner.scan();
    const names = projects.map(p => p.name);
    assert.ok(names.includes('app-a'));
    assert.ok(names.includes('app-b'));
    assert.ok(!names.includes('not-a-project'));
  });

  it('returns project metadata with path and session dir', async () => {
    const scanner = new ProjectScanner(workspace);
    const projects = await scanner.scan();
    const appA = projects.find(p => p.name === 'app-a');
    assert.ok(appA.path);
    assert.ok(appA.sessionDirName);
    assert.equal(appA.hasTests, true);
  });

  it('saves discovered projects to projects.json', async () => {
    const scanner = new ProjectScanner(workspace);
    await scanner.scanAndSave();
    const { readFile } = await import('node:fs/promises');
    const saved = JSON.parse(await readFile(join(workspace, '.autoevolve', 'projects.json'), 'utf8'));
    assert.ok(saved.projects.length >= 2);
    assert.ok(saved.scanned_at);
  });
});
