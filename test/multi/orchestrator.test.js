// test/multi/orchestrator.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, cleanTempDir } from '../helpers/fixtures.js';
import { Orchestrator } from '../../src/multi/orchestrator.js';

describe('Orchestrator', () => {
  let workspace;

  before(async () => {
    workspace = await createTempDir();
    // Create two fake projects with .autoevolve reports
    const proj1 = join(workspace, 'projects', 'app-a');
    const proj2 = join(workspace, 'projects', 'app-b');
    await mkdir(join(proj1, '.autoevolve', 'reports'), { recursive: true });
    await mkdir(join(proj2, '.autoevolve', 'reports'), { recursive: true });
    await writeFile(join(proj1, 'package.json'), JSON.stringify({ scripts: { test: 'vitest' } }));
    await writeFile(join(proj2, 'package.json'), JSON.stringify({ scripts: { test: 'jest' } }));

    // Fake reports
    await writeFile(join(proj1, '.autoevolve', 'reports', 'run-1.json'), JSON.stringify({
      goal: 'improve coverage', domain: 'code', iterations: 3, kept: 2, reverted: 1,
      baseline: { value: 60 }, final: { value: 70 }, improvement: 10
    }));
    await writeFile(join(proj2, '.autoevolve', 'reports', 'run-1.json'), JSON.stringify({
      goal: 'fix lint', domain: 'code', iterations: 2, kept: 2, reverted: 0,
      baseline: { value: 10 }, final: { value: 0 }, improvement: -10
    }));
  });

  after(async () => {
    await cleanTempDir(workspace);
  });

  it('discovers and lists projects', async () => {
    const orch = new Orchestrator(workspace);
    const projects = await orch.discoverProjects();
    assert.ok(projects.length >= 2);
  });

  it('aggregates reports from all projects', async () => {
    const orch = new Orchestrator(workspace);
    const report = await orch.aggregateReports();
    assert.ok(report.projects.length >= 2);
    assert.ok(typeof report.total_iterations === 'number');
    assert.ok(typeof report.total_kept === 'number');
  });

  it('saves cross-project report', async () => {
    const orch = new Orchestrator(workspace);
    await orch.aggregateAndSave();
    const { readFile } = await import('node:fs/promises');
    const files = await import('node:fs/promises').then(m => m.readdir(join(workspace, '.autoevolve', 'reports')));
    const crossFiles = files.filter(f => f.startsWith('cross-project'));
    assert.ok(crossFiles.length >= 1);
  });
});
