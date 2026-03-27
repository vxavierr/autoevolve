// src/cost/tracker.js

export class CostTracker {
  #pricing;
  #iterations;

  constructor(pricing = {}) {
    this.#pricing = pricing;
    this.#iterations = [];
  }

  calculate({ tokens_in, tokens_out, model }) {
    const rates = this.#pricing[model];
    if (!rates) return { tokens_in, tokens_out, model, cost_usd: 0 };

    const cost_usd = (tokens_in / 1000) * rates.input_per_1k
                   + (tokens_out / 1000) * rates.output_per_1k;

    return {
      tokens_in,
      tokens_out,
      model,
      cost_usd: Math.round(cost_usd * 1000000) / 1000000, // 6 decimal places
    };
  }

  calculateFromChars({ chars_in, chars_out, model }) {
    const tokens_in = Math.round(chars_in / 4);
    const tokens_out = Math.round(chars_out / 4);
    return this.calculate({ tokens_in, tokens_out, model });
  }

  estimateSaving(model, avg_tokens_in, avg_tokens_out) {
    const wouldHaveCost = this.calculate({
      tokens_in: avg_tokens_in,
      tokens_out: avg_tokens_out,
      model,
    });
    return { saved_usd: wouldHaveCost.cost_usd, model };
  }

  recordIteration({ tokens_in, tokens_out, model, was_hardcoded }) {
    const cost = was_hardcoded
      ? { tokens_in: 0, tokens_out: 0, model, cost_usd: 0 }
      : this.calculate({ tokens_in, tokens_out, model });

    this.#iterations.push({
      ...cost,
      was_hardcoded,
      timestamp: new Date().toISOString(),
    });
  }

  getSummary() {
    const total_cost = this.#iterations.reduce((s, i) => s + i.cost_usd, 0);
    const hardcoded_iterations = this.#iterations.filter(i => i.was_hardcoded).length;
    const llm_iterations = this.#iterations.filter(i => !i.was_hardcoded);

    // Estimate savings: avg LLM cost * number of hardcoded iterations
    let hardcoded_savings = 0;
    if (llm_iterations.length > 0 && hardcoded_iterations > 0) {
      const avg_llm_cost = llm_iterations.reduce((s, i) => s + i.cost_usd, 0) / llm_iterations.length;
      hardcoded_savings = avg_llm_cost * hardcoded_iterations;
    }

    return {
      iterations: this.#iterations.length,
      total_cost: Math.round(total_cost * 1000000) / 1000000,
      total_tokens_in: this.#iterations.reduce((s, i) => s + i.tokens_in, 0),
      total_tokens_out: this.#iterations.reduce((s, i) => s + i.tokens_out, 0),
      hardcoded_iterations,
      hardcoded_savings: Math.round(hardcoded_savings * 1000000) / 1000000,
    };
  }

  getIterations() {
    return [...this.#iterations];
  }
}
