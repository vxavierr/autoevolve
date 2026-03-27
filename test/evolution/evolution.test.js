// test/evolution/evolution.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTempDir, cleanTempDir } from '../helpers/fixtures.js';
import { RuleStore } from '../../src/evolution/rule-store.js';
import { PatternExtractor } from '../../src/evolution/pattern-extractor.js';
import { RuleCompiler } from '../../src/evolution/rule-compiler.js';

describe('RuleStore', () => {
  let dir;
  let store;

  before(async () => {
    dir = await createTempDir();
    store = new RuleStore(dir);
  });

  after(async () => {
    await cleanTempDir(dir);
  });

  it('starts empty', async () => {
    const rules = await store.loadAll();
    assert.deepEqual(rules, []);
  });

  it('adds and retrieves a rule', async () => {
    await store.add({
      domain: 'code',
      when: 'eslint fixable > 0',
      do: 'run eslint --fix',
      confidence: 1.0,
    });
    const rules = await store.loadAll();
    assert.equal(rules.length, 1);
    assert.ok(rules[0].id.startsWith('rule-'));
  });

  it('finds matching rules', async () => {
    const matches = await store.findMatches('code', 'eslint fixable > 0');
    assert.equal(matches.length, 1);
  });

  it('returns empty for non-matching domain', async () => {
    const matches = await store.findMatches('prompts', 'eslint fixable > 0');
    assert.equal(matches.length, 0);
  });

  it('markUsed updates last_used and verified_count', async () => {
    const rules = await store.loadAll();
    const ruleId = rules[0].id;
    assert.equal(rules[0].last_used, null);
    const oldCount = rules[0].verified_count;

    await store.markUsed(ruleId);

    const updated = await store.loadAll();
    const rule = updated.find(r => r.id === ruleId);
    assert.ok(rule.last_used !== null);
    assert.equal(rule.verified_count, oldCount + 1);
  });
});

describe('PatternExtractor', () => {
  it('detects repeated actions from iteration history', () => {
    const iterations = [
      { action: 'run eslint --fix', decision: 'keep', domain: 'code' },
      { action: 'add test for login', decision: 'keep', domain: 'code' },
      { action: 'run eslint --fix', decision: 'keep', domain: 'code' },
      { action: 'run eslint --fix', decision: 'keep', domain: 'code' },
    ];
    const extractor = new PatternExtractor(3); // threshold = 3
    const patterns = extractor.extract(iterations);
    assert.equal(patterns.length, 1);
    assert.equal(patterns[0].action, 'run eslint --fix');
    assert.equal(patterns[0].count, 3);
  });

  it('ignores reverted actions', () => {
    const iterations = [
      { action: 'bad change', decision: 'revert', domain: 'code' },
      { action: 'bad change', decision: 'revert', domain: 'code' },
      { action: 'bad change', decision: 'revert', domain: 'code' },
    ];
    const extractor = new PatternExtractor(3);
    const patterns = extractor.extract(iterations);
    assert.equal(patterns.length, 0);
  });
});

describe('RuleCompiler', () => {
  it('compiles pattern into rule format', () => {
    const compiler = new RuleCompiler();
    const rule = compiler.compile({
      action: 'run eslint --fix',
      count: 3,
      domain: 'code',
      iterations: ['iter-1', 'iter-5', 'iter-9'],
    });
    assert.equal(rule.domain, 'code');
    assert.equal(rule.do, 'run eslint --fix');
    assert.ok(rule.id);
    assert.equal(rule.confidence, 1.0);
  });
});
