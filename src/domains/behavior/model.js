// src/domains/behavior/model.js
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const EMPTY_MODEL = {
  updated_at: null,
  processed_sessions: [],
  total_sessions_processed: 0,
  total_user_messages: 0,
  patterns: {
    corrections: {},
    frustrations: {},
    approvals: { total: 0, rate_trend: [] },
  },
  guardrails_active: [],
  weekly_snapshots: [],
};

export class BehaviorModel {
  #filePath;
  #guardrailThreshold;

  constructor(baseDir, opts = {}) {
    this.#filePath = join(baseDir, '.autoevolve', 'behavior', 'model.json');
    this.#guardrailThreshold = opts.guardrailThreshold ?? 3;
  }

  async load() {
    try {
      const raw = await readFile(this.#filePath, 'utf8');
      return JSON.parse(raw);
    } catch {
      return structuredClone(EMPTY_MODEL);
    }
  }

  async merge(sessionFileName, analysisResult) {
    const data = await this.load();

    // Skip if already processed
    if (data.processed_sessions.includes(sessionFileName)) {
      return { skipped: true };
    }

    // Track session
    data.processed_sessions.push(sessionFileName);
    data.total_sessions_processed++;
    data.total_user_messages += analysisResult.stats?.userMessages ?? 0;

    // Merge corrections
    for (const correction of analysisResult.corrections ?? []) {
      const sig = correction.signal;
      if (!data.patterns.corrections[sig]) {
        data.patterns.corrections[sig] = {
          count: 0,
          projects: [],
          first_seen: new Date().toISOString(),
          last_seen: null,
        };
      }
      data.patterns.corrections[sig].count++;
      data.patterns.corrections[sig].last_seen = new Date().toISOString();
    }

    // Merge frustrations
    for (const frust of analysisResult.frustrations ?? []) {
      const key = 'short_reply_after_long_output';
      if (!data.patterns.frustrations[key]) {
        data.patterns.frustrations[key] = { count: 0, avg_output_length: 0 };
      }
      data.patterns.frustrations[key].count++;
    }

    // Merge approvals
    data.patterns.approvals.total += (analysisResult.approvals?.length ?? 0);

    data.updated_at = new Date().toISOString();
    await this.#save(data);
    return { skipped: false };
  }

  async getGuardrailProposals() {
    const data = await this.load();
    const proposals = [];

    for (const [signal, info] of Object.entries(data.patterns.corrections)) {
      if (info.count >= this.#guardrailThreshold) {
        // Check not already active
        const alreadyActive = data.guardrails_active.some(g => g.signal === signal);
        if (!alreadyActive) {
          proposals.push({
            signal,
            count: info.count,
            suggestion: `Recurring correction pattern "${signal}" detected ${info.count}x. Consider adding a guardrail.`,
            first_seen: info.first_seen,
            last_seen: info.last_seen,
          });
        }
      }
    }

    return proposals;
  }

  async #save(data) {
    await mkdir(join(this.#filePath, '..'), { recursive: true });
    await writeFile(this.#filePath, JSON.stringify(data, null, 2));
  }
}
