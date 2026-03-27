// src/domains/behavior/trends.js

export class BehaviorTrends {
  #snapshots;

  constructor(snapshots = []) {
    this.#snapshots = snapshots;
  }

  analyze() {
    return {
      correction_trend: this.#detectTrend('correction_rate'),
      frustration_trend: this.#detectTrend('frustration_rate'),
      approval_trend: this.#detectTrend('approval_rate'),
      weeks_analyzed: this.#snapshots.length,
    };
  }

  createSnapshot(modelData) {
    const totalMessages = modelData.total_user_messages || 1;
    const totalCorrections = Object.values(modelData.patterns?.corrections ?? {})
      .reduce((s, c) => s + (c.count ?? 0), 0);
    const totalFrustrations = Object.values(modelData.patterns?.frustrations ?? {})
      .reduce((s, f) => s + (f.count ?? 0), 0);
    const totalApprovals = modelData.patterns?.approvals?.total ?? 0;

    // Get ISO week string
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((now - yearStart) / 86400000 + yearStart.getDay() + 1) / 7);
    const week = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;

    return {
      week,
      correction_rate: totalCorrections / totalMessages,
      frustration_rate: totalFrustrations / totalMessages,
      approval_rate: totalApprovals / totalMessages,
      total_messages: totalMessages,
      snapshot_at: now.toISOString(),
    };
  }

  #detectTrend(field) {
    if (this.#snapshots.length < 2) return 'unknown';

    const values = this.#snapshots
      .map(s => s[field])
      .filter(v => typeof v === 'number');

    if (values.length < 2) return 'unknown';

    // Compare first half average to second half average
    const mid = Math.floor(values.length / 2);
    const firstHalf = values.slice(0, mid);
    const secondHalf = values.slice(mid);
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const threshold = 0.001; // 0.1% change = significant
    const diff = avgSecond - avgFirst;

    if (field === 'approval_rate') {
      // For approvals, higher is better
      if (diff > threshold) return 'improving';
      if (diff < -threshold) return 'worsening';
    } else {
      // For corrections/frustrations, lower is better
      if (diff < -threshold) return 'improving';
      if (diff > threshold) return 'worsening';
    }
    return 'stable';
  }
}
