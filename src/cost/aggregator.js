// src/cost/aggregator.js
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export class CostAggregator {
  #baseDir;

  constructor(baseDir) {
    this.#baseDir = baseDir;
  }

  async aggregate() {
    const iterations = await this.#readIterations();

    if (iterations.length === 0) {
      return {
        total_iterations: 0, total_cost: 0, kept: 0, reverted: 0,
        cost_per_improvement: 0, hardcoded_iterations: 0, hardcoded_savings: 0,
        total_tokens_in: 0, total_tokens_out: 0,
      };
    }

    const total_cost = iterations.reduce((s, i) => s + (i.cost_usd ?? 0), 0);
    const kept = iterations.filter(i => i.decision === 'keep').length;
    const reverted = iterations.filter(i => i.decision === 'revert').length;
    const hardcoded = iterations.filter(i => i.was_hardcoded);
    const llm = iterations.filter(i => !i.was_hardcoded);

    const cost_per_improvement = kept > 0 ? total_cost / kept : 0;

    let hardcoded_savings = 0;
    if (llm.length > 0 && hardcoded.length > 0) {
      const avg_llm_cost = llm.reduce((s, i) => s + (i.cost_usd ?? 0), 0) / llm.length;
      hardcoded_savings = avg_llm_cost * hardcoded.length;
    }

    return {
      total_iterations: iterations.length,
      total_cost: Math.round(total_cost * 1000000) / 1000000,
      kept,
      reverted,
      cost_per_improvement: Math.round(cost_per_improvement * 1000000) / 1000000,
      hardcoded_iterations: hardcoded.length,
      hardcoded_savings: Math.round(hardcoded_savings * 1000000) / 1000000,
      total_tokens_in: iterations.reduce((s, i) => s + (i.tokens_in ?? 0), 0),
      total_tokens_out: iterations.reduce((s, i) => s + (i.tokens_out ?? 0), 0),
    };
  }

  async #readIterations() {
    const logPath = join(this.#baseDir, '.autoevolve', 'logs', 'iterations.jsonl');
    try {
      const raw = await readFile(logPath, 'utf8');
      return raw.split('\n')
        .filter(line => line.trim())
        .map(line => {
          try { return JSON.parse(line); } catch { return null; }
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }
}
