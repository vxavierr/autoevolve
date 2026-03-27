// src/domains/behavior/index.js
import { SessionCollector } from './collectors.js';
import { BehaviorAnalyzer } from './analyzer.js';
import { BehaviorPredictor } from './predictor.js';

export class BehaviorDomain {
  constructor(config) {
    this.name = 'behavior';
    this.config = config;
    this.metrics = ['correction-rate', 'frustration-rate'];
  }

  async analyze(sessionDir, limit = 50) {
    const collector = new SessionCollector(sessionDir);
    const sessions = await collector.collectAll(limit);

    const analyzer = new BehaviorAnalyzer();
    const results = sessions.map(s => analyzer.analyzeAll(s.events));

    const predictor = new BehaviorPredictor(results);
    const predictions = predictor.predict();

    return {
      sessions: results.length,
      aggregated: this.#aggregate(results),
      predictions,
    };
  }

  #aggregate(results) {
    const total = results.reduce((acc, r) => ({
      corrections: acc.corrections + r.corrections.length,
      frustrations: acc.frustrations + r.frustrations.length,
      approvals: acc.approvals + r.approvals.length,
      userMessages: acc.userMessages + r.stats.userMessages,
    }), { corrections: 0, frustrations: 0, approvals: 0, userMessages: 0 });

    return {
      ...total,
      correctionRate: total.corrections / Math.max(total.userMessages, 1),
      frustrationRate: total.frustrations / Math.max(total.userMessages, 1),
      approvalRate: total.approvals / Math.max(total.userMessages, 1),
    };
  }
}
