// test/dashboard/server.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, cleanTempDir } from '../helpers/fixtures.js';
import { createDashboardServer } from '../../src/dashboard/server.js';

describe('Dashboard Server', () => {
  let dir;
  let server;
  let port;

  before(async () => {
    dir = await createTempDir();
    // Create fake data
    await mkdir(join(dir, '.autoevolve', 'behavior'), { recursive: true });
    await mkdir(join(dir, '.autoevolve', 'reports'), { recursive: true });
    await mkdir(join(dir, '.autoevolve', 'rules'), { recursive: true });

    await writeFile(join(dir, '.autoevolve', 'projects.json'), JSON.stringify({
      scanned_at: '2026-03-27T12:00:00Z',
      projects: [{ name: 'app-a', path: '/tmp/app-a', hasTests: true }],
    }));
    await writeFile(join(dir, '.autoevolve', 'behavior', 'model.json'), JSON.stringify({
      total_sessions_processed: 100,
      total_user_messages: 5000,
      patterns: { corrections: { '\\berrado\\b': { count: 5 } }, frustrations: {}, approvals: { total: 150 } },
      weekly_snapshots: [{ week: '2026-W13', correction_rate: 0.001 }],
    }));
    await writeFile(join(dir, '.autoevolve', 'rules', 'hardcoded-rules.json'), JSON.stringify([
      { id: 'rule-1', domain: 'code', when: 'lint', do: 'eslint --fix', verified_count: 5 },
    ]));
    await writeFile(join(dir, '.autoevolve', 'reports', 'run-2026-03-27.json'), JSON.stringify({
      goal: 'improve coverage', domain: 'code', iterations: 5, kept: 4, reverted: 1,
    }));

    // Start server on random port
    const srv = createDashboardServer(dir);
    await new Promise(resolve => {
      server = srv.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await cleanTempDir(dir);
  });

  it('serves /api/projects', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/projects`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.projects);
    assert.equal(data.projects.length, 1);
  });

  it('serves /api/behavior', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/behavior`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.total_sessions_processed, 100);
  });

  it('serves /api/rules', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/rules`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.local));
    assert.equal(data.local.length, 1);
  });

  it('serves /api/runs', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/runs`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data));
    assert.ok(data.length >= 1);
  });

  it('returns 404 for unknown API routes', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/nonexistent`);
    assert.equal(res.status, 404);
  });

  it('binds to 127.0.0.1 only', () => {
    const addr = server.address();
    assert.equal(addr.address, '127.0.0.1');
  });
});
