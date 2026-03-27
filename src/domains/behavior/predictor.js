// src/domains/behavior/predictor.js
export class BehaviorPredictor {
  constructor(analysisHistory = []) {
    this.history = analysisHistory;
  }

  predict() {
    // v1: simple heuristic predictions based on pattern frequency
    // v2+: this will use hardcoded rules from evolution engine
    const predictions = [];

    if (this.history.length === 0) {
      return { predictions: [], confidence: 0 };
    }

    // Aggregate correction patterns across sessions
    const correctionTopics = new Map();
    for (const session of this.history) {
      for (const correction of session.corrections ?? []) {
        const key = correction.signal;
        correctionTopics.set(key, (correctionTopics.get(key) ?? 0) + 1);
      }
    }

    // Predict: frequent corrections → will happen again
    for (const [signal, count] of correctionTopics) {
      if (count >= 3) {
        predictions.push({
          type: 'recurring_correction',
          signal,
          frequency: count,
          suggestion: `User frequently corrects with pattern "${signal}". Consider adding a guardrail or default.`,
        });
      }
    }

    return {
      predictions,
      confidence: Math.min(this.history.length / 10, 1), // more history = more confidence
    };
  }
}
