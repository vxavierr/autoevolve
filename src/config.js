// src/config.js
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import yaml from 'js-yaml';

const DEFAULTS = {
  domains: {
    code: { enabled: 'auto', metrics: ['coverage', 'lint-errors'], verify_command: null, scope: 'src/**/*.{js,ts}' },
    prompts: { enabled: 'auto', metrics: ['token-usage', 'instruction-density'], scope: '.claude/**/*.md' },
    behavior: { enabled: 'auto', log_source: null },
    flow: { enabled: 'auto' },
  },
  loop: {
    max_iterations: 20,
    strategy: 'one-change-at-a-time',
    auto_revert: true,
    plateau_threshold: 3,
  },
  evolution: {
    extract_after_repeats: 3,
    require_verified_count: 3,
  },
};

export async function loadConfig(baseDir) {
  const configPaths = [
    join(baseDir, '.autoevolve', 'config.yaml'),
    join(baseDir, '.autoevolve', 'config.yml'),
    join(baseDir, 'autoevolve.config.yaml'),
  ];

  for (const p of configPaths) {
    try {
      const raw = await readFile(p, 'utf8');
      const parsed = yaml.load(raw);
      return deepMerge(DEFAULTS, parsed);
    } catch {
      continue;
    }
  }

  return { ...DEFAULTS };
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] ?? {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
