// src/prediction/scenario-generator.js

// Correction signals that indicate data/credential errors
const DATA_ERROR_SIGNALS = ['\\berrado\\b', '\\bwrong\\b', '\\bnot that\\b', '\\bnão era isso\\b'];

export class ScenarioGenerator {
  #templates;
  #generateFn;

  constructor(templates, opts = {}) {
    this.#templates = templates;
    this.#generateFn = opts.generateFn ?? null;
  }

  fromTemplates(templateIds, goal, behaviorModel) {
    const scenarios = [];
    for (const id of templateIds) {
      const tmpl = this.#templates[id];
      if (!tmpl) continue;

      const probability = this.#adjustProbability(tmpl, behaviorModel);

      const scenario = {
        id,
        description: tmpl.description,
        probability,
        severity: tmpl.severity,
        prevention: tmpl.prevention,
        source: 'template',
        based_on: this.#findSupportingEvidence(tmpl, behaviorModel),
      };

      if (tmpl.guardrail) {
        scenario.recommended_guardrail = { ...tmpl.guardrail };
      }

      scenarios.push(scenario);
    }

    return scenarios.sort((a, b) => b.probability - a.probability);
  }

  async generate(templateIds, goal, behaviorModel) {
    // Templates first
    if (templateIds.length > 0) {
      return this.fromTemplates(templateIds, goal, behaviorModel);
    }

    // LLM fallback
    if (this.#generateFn) {
      return this.#generateFn(goal, behaviorModel);
    }

    return [];
  }

  #adjustProbability(template, model) {
    let prob = template.default_probability;

    if (!model?.patterns?.corrections) return prob;

    // Boost probability if behavior model shows related correction patterns
    const corrections = model.patterns.corrections;
    const totalCorrections = Object.values(corrections).reduce((s, c) => s + c.count, 0);

    if (totalCorrections > 0) {
      // Check if any data-error signals are present (boost credential/data scenarios)
      const hasDataErrors = DATA_ERROR_SIGNALS.some(sig => corrections[sig]?.count > 0);
      if (hasDataErrors && (template.default_probability >= 0.5)) {
        const boost = Math.min(0.2, totalCorrections * 0.02);
        prob += boost;
      }
    }

    return Math.min(0.95, Math.round(prob * 100) / 100);
  }

  #findSupportingEvidence(template, model) {
    const evidence = [];
    if (!model?.patterns?.corrections) return evidence;

    for (const [signal, data] of Object.entries(model.patterns.corrections)) {
      if (DATA_ERROR_SIGNALS.includes(signal) && data.count >= 2) {
        evidence.push(`${signal} correction ${data.count}x in ${data.projects?.join(', ') ?? 'unknown'}`);
      }
    }

    return evidence;
  }
}
