// src/domains/prompts/verifiers.js
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { countTokensApprox } from './metrics.js';

export async function measureTotalTokens(cwd, scope) {
  // scope is a glob pattern like ".claude/**/*.md"
  let totalTokens = 0;

  const files = await findFiles(cwd, scope);

  for (const file of files) {
    try {
      const content = await readFile(file, 'utf8');
      totalTokens += countTokensApprox(content);
    } catch { continue; }
  }

  return totalTokens;
}

async function findFiles(cwd, scope) {
  // Simple recursive file finder matching scope pattern
  const results = [];

  async function walk(dir) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else if (entry.name.endsWith('.md')) {
          results.push(full);
        }
      }
    } catch { /* skip unreadable dirs */ }
  }

  // Extract base dir from scope (e.g., ".claude/**/*.md" -> ".claude")
  const baseDir = scope.split('/')[0].split('*')[0];
  await walk(join(cwd, baseDir || '.'));
  return results;
}
