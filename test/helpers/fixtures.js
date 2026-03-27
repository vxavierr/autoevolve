// test/helpers/fixtures.js
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export async function createTempDir() {
  return mkdtemp(join(tmpdir(), 'autoevolve-test-'));
}

export async function cleanTempDir(dir) {
  await rm(dir, { recursive: true, force: true });
}
