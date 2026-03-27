// src/domains/flow/interface.js

/**
 * FlowInterface — base class for framework-specific workflow auditors.
 *
 * Framework adapters (e.g., AIOX) extend this class and implement
 * scan(), detect(), and report() with framework-specific logic.
 *
 * Location: framework adapters live INSIDE the framework, not in autoevolve.
 * Example: .aios-core/autoevolve/flow.js extends FlowInterface
 */
export class FlowInterface {
  constructor(cwd) {
    this.cwd = cwd;
    this.name = 'flow';
  }

  /**
   * Discover workflow items (tasks, stories, tickets, etc.)
   * @returns {Promise<Array<{id: string, status: string, age_days: number, type: string}>>}
   */
  async scan() {
    return [];
  }

  /**
   * Detect bottlenecks, stale items, violations
   * @returns {Promise<Array<{type: string, severity: string, message: string, item_id?: string}>>}
   */
  async detect() {
    return [];
  }

  /**
   * Generate structured report from scan + detect
   * @returns {Promise<{findings: Array, metrics: Object}>}
   */
  async report() {
    const items = await this.scan();
    const findings = await this.detect();

    return {
      findings,
      metrics: {
        total_items: items.length,
        stale_count: items.filter(i => i.age_days > 7).length,
        finding_count: findings.length,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
