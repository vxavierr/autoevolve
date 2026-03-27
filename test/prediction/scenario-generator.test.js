// test/prediction/scenario-generator.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ScenarioGenerator } from '../../src/prediction/scenario-generator.js';

const TEMPLATES = {
  'credential-mismatch': {
    description: 'Claude uses wrong credentials',
    default_probability: 0.7,
    severity: 'high',
    prevention: 'Confirm project context',
    guardrail: { event: 'PreToolUse', matcher: 'Bash', hook_template: 'verify-data-source', description: 'Verify data source' },
  },
  'scope-creep': {
    description: 'Refactoring expands beyond scope',
    default_probability: 0.6,
    severity: 'medium',
    prevention: 'Define file list first',
    guardrail: null,
  },
};

const BEHAVIOR_MODEL = {
  patterns: {
    corrections: {
      '\\berrado\\b': { count: 5, projects: ['hub', 'mindo'] },
    },
  },
  total_user_messages: 19000,
};

describe('ScenarioGenerator', () => {
  it('generates scenarios from template IDs', () => {
    const gen = new ScenarioGenerator(TEMPLATES);
    const scenarios = gen.fromTemplates(['credential-mismatch', 'scope-creep'], 'implement auth', BEHAVIOR_MODEL);
    assert.equal(scenarios.length, 2);
    assert.equal(scenarios[0].id, 'credential-mismatch');
    assert.ok(scenarios[0].probability > 0);
    assert.ok(scenarios[0].description);
    assert.ok(scenarios[0].prevention);
  });

  it('boosts probability when behavior model has matching corrections', () => {
    const gen = new ScenarioGenerator(TEMPLATES);
    const scenarios = gen.fromTemplates(['credential-mismatch'], 'implement auth', BEHAVIOR_MODEL);
    // credential-mismatch default is 0.7, should be boosted because "errado" pattern exists (data errors)
    assert.ok(scenarios[0].probability >= 0.7);
  });

  it('caps probability at 0.95', () => {
    const heavyModel = {
      patterns: { corrections: { '\\berrado\\b': { count: 100, projects: ['hub'] } } },
      total_user_messages: 100,
    };
    const gen = new ScenarioGenerator(TEMPLATES);
    const scenarios = gen.fromTemplates(['credential-mismatch'], 'auth', heavyModel);
    assert.ok(scenarios[0].probability <= 0.95);
  });

  it('includes guardrail recommendations for scenarios that have them', () => {
    const gen = new ScenarioGenerator(TEMPLATES);
    const scenarios = gen.fromTemplates(['credential-mismatch', 'scope-creep'], 'auth refactor', BEHAVIOR_MODEL);
    const withGuardrail = scenarios.filter(s => s.recommended_guardrail);
    const withoutGuardrail = scenarios.filter(s => !s.recommended_guardrail);
    assert.ok(withGuardrail.length >= 1);
    assert.ok(withoutGuardrail.length >= 1);
  });

  it('uses fallback generateFn for empty template matches', async () => {
    const gen = new ScenarioGenerator(TEMPLATES, {
      generateFn: async (goal, model) => [{
        id: 'llm-generated-1',
        description: 'LLM generated scenario',
        probability: 0.5,
        severity: 'medium',
        prevention: 'LLM suggested prevention',
        source: 'llm',
      }],
    });
    const scenarios = await gen.generate([], 'write a poem', BEHAVIOR_MODEL);
    assert.equal(scenarios.length, 1);
    assert.equal(scenarios[0].source, 'llm');
  });

  it('returns empty when no templates match and no generateFn', async () => {
    const gen = new ScenarioGenerator(TEMPLATES);
    const scenarios = await gen.generate([], 'write a poem', BEHAVIOR_MODEL);
    assert.deepEqual(scenarios, []);
  });
});
