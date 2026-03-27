// src/prediction/engine.js
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PatternMatcher } from './pattern-matcher.js';
import { ScenarioGenerator } from './scenario-generator.js';
import { BehaviorModel } from '../domains/behavior/model.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class PredictionEngine {
  #baseDir;
  #generateFn;

  constructor(baseDir, opts = {}) {
    this.#baseDir = baseDir;
    this.#generateFn = opts.generateFn ?? null;
  }

  async predict(goal) {
    // 1. Load templates
    const templatesRaw = await readFile(join(__dirname, 'templates.json'), 'utf8');
    const templatesData = JSON.parse(templatesRaw);

    // 2. Load behavior model
    const model = new BehaviorModel(this.#baseDir);
    const modelData = await model.load();

    // 3. Match goal to template IDs
    const matcher = new PatternMatcher(templatesData.goal_patterns);
    const templateIds = matcher.match(goal);

    // 4. Generate scenarios
    const generator = new ScenarioGenerator(templatesData.scenarios, {
      generateFn: this.#generateFn,
    });
    const scenarios = await generator.generate(templateIds, goal, modelData);

    // 5. Compute risk score
    const risk_score = scenarios.length > 0
      ? Math.round((scenarios.reduce((s, sc) => s + sc.probability, 0) / scenarios.length) * 100) / 100
      : 0;

    // 6. Collect recommended guardrails
    const recommended_guardrails = scenarios
      .filter(s => s.recommended_guardrail)
      .map(s => s.recommended_guardrail);

    return {
      goal,
      risk_score,
      scenarios,
      recommended_guardrails,
      model_sessions: modelData.total_sessions_processed,
      timestamp: new Date().toISOString(),
    };
  }

  async predictAndSave(goal) {
    const result = await this.predict(goal);
    const reportsDir = join(this.#baseDir, '.autoevolve', 'reports');
    await mkdir(reportsDir, { recursive: true });
    const filename = `prediction-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
    await writeFile(join(reportsDir, filename), JSON.stringify(result, null, 2));
    return result;
  }
}
