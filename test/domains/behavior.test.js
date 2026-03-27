// test/domains/behavior.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, cleanTempDir } from '../helpers/fixtures.js';
import { SessionCollector } from '../../src/domains/behavior/collectors.js';
import { BehaviorAnalyzer } from '../../src/domains/behavior/analyzer.js';

describe('SessionCollector', () => {
  let dir;

  before(async () => {
    dir = await createTempDir();
    await mkdir(join(dir, 'sessions'), { recursive: true });

    // Create a fake session JSONL
    const events = [
      { type: 'user', message: { role: 'user', content: 'add a login page' }, timestamp: '2026-03-27T10:00:00Z', uuid: '1' },
      { type: 'assistant', message: { role: 'assistant', content: 'I will create a login component...' }, timestamp: '2026-03-27T10:00:05Z', uuid: '2' },
      { type: 'user', message: { role: 'user', content: 'no not that, I meant a signup page' }, timestamp: '2026-03-27T10:00:30Z', uuid: '3' },
      { type: 'assistant', message: { role: 'assistant', content: 'Got it, creating signup...' }, timestamp: '2026-03-27T10:00:35Z', uuid: '4' },
      { type: 'user', message: { role: 'user', content: 'perfect' }, timestamp: '2026-03-27T10:01:00Z', uuid: '5' },
    ];
    const jsonl = events.map(e => JSON.stringify(e)).join('\n');
    await writeFile(join(dir, 'sessions', 'session-1.jsonl'), jsonl);
  });

  after(async () => {
    await cleanTempDir(dir);
  });

  it('parses session JSONL into structured events', async () => {
    const collector = new SessionCollector(join(dir, 'sessions'));
    const sessions = await collector.collectAll();
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].events.length, 5);
  });

  it('separates user and assistant messages', async () => {
    const collector = new SessionCollector(join(dir, 'sessions'));
    const sessions = await collector.collectAll();
    const userMsgs = sessions[0].events.filter(e => e.type === 'user');
    const assistantMsgs = sessions[0].events.filter(e => e.type === 'assistant');
    assert.equal(userMsgs.length, 3);
    assert.equal(assistantMsgs.length, 2);
  });
});

describe('BehaviorAnalyzer', () => {
  it('detects correction patterns', () => {
    const events = [
      { type: 'user', content: 'add a login page', timestamp: '2026-03-27T10:00:00Z' },
      { type: 'assistant', content: 'Creating login...', timestamp: '2026-03-27T10:00:05Z' },
      { type: 'user', content: 'no not that, I meant signup', timestamp: '2026-03-27T10:00:30Z' },
    ];
    const analyzer = new BehaviorAnalyzer();
    const patterns = analyzer.detectCorrections(events);
    assert.ok(patterns.length >= 1);
    assert.equal(patterns[0].type, 'correction');
  });

  it('detects frustration signals (short msg after long output)', () => {
    const events = [
      { type: 'assistant', content: 'A'.repeat(500), timestamp: '2026-03-27T10:00:00Z' },
      { type: 'user', content: 'no', timestamp: '2026-03-27T10:00:02Z' },
    ];
    const analyzer = new BehaviorAnalyzer();
    const patterns = analyzer.detectFrustration(events);
    assert.ok(patterns.length >= 1);
    assert.equal(patterns[0].type, 'frustration');
  });

  it('detects approval patterns', () => {
    const events = [
      { type: 'assistant', content: 'Here is the component...', timestamp: '2026-03-27T10:00:00Z' },
      { type: 'user', content: 'perfect, next step', timestamp: '2026-03-27T10:00:10Z' },
    ];
    const analyzer = new BehaviorAnalyzer();
    const patterns = analyzer.detectApprovals(events);
    assert.ok(patterns.length >= 1);
    assert.equal(patterns[0].type, 'approval');
  });

  it('filters out system/task notifications from corrections', () => {
    const events = [
      { type: 'assistant', content: 'Working on it...', timestamp: '2026-03-27T10:00:00Z' },
      { type: 'user', content: '<task-notification>task done stop</task-notification>', timestamp: '2026-03-27T10:00:05Z' },
    ];
    const analyzer = new BehaviorAnalyzer();
    const patterns = analyzer.detectCorrections(events);
    assert.equal(patterns.length, 0);
  });

  it('filters out approvals and choices from frustrations', () => {
    const events = [
      { type: 'assistant', content: 'A'.repeat(500), timestamp: '2026-03-27T10:00:00Z' },
      { type: 'user', content: 'sim', timestamp: '2026-03-27T10:00:02Z' },
      { type: 'assistant', content: 'B'.repeat(500), timestamp: '2026-03-27T10:00:10Z' },
      { type: 'user', content: '2', timestamp: '2026-03-27T10:00:12Z' },
      { type: 'assistant', content: 'C'.repeat(500), timestamp: '2026-03-27T10:00:20Z' },
      { type: 'user', content: '@dev', timestamp: '2026-03-27T10:00:22Z' },
    ];
    const analyzer = new BehaviorAnalyzer();
    const patterns = analyzer.detectFrustration(events);
    assert.equal(patterns.length, 0);
  });

  it('detects pt-br correction signals', () => {
    const events = [
      { type: 'assistant', content: 'Abri o perfil X...', timestamp: '2026-03-27T10:00:00Z' },
      { type: 'user', content: 'você abriu o perfil errado', timestamp: '2026-03-27T10:00:05Z' },
    ];
    const analyzer = new BehaviorAnalyzer();
    const patterns = analyzer.detectCorrections(events);
    assert.ok(patterns.length >= 1);
    assert.equal(patterns[0].signal, '\\berrado\\b');
  });

  it('detects pt-br approval signals', () => {
    const events = [
      { type: 'assistant', content: 'Pronto, feito.', timestamp: '2026-03-27T10:00:00Z' },
      { type: 'user', content: 'beleza', timestamp: '2026-03-27T10:00:05Z' },
    ];
    const analyzer = new BehaviorAnalyzer();
    const approvals = analyzer.detectApprovals(events);
    assert.ok(approvals.length >= 1);
  });
});

describe('BehaviorPredictor', () => {
  it('predicts recurring corrections when threshold met', async () => {
    const { BehaviorPredictor } = await import('../../src/domains/behavior/predictor.js');
    const history = [
      { corrections: [{ signal: '\\berrado\\b' }, { signal: '\\berrado\\b' }] },
      { corrections: [{ signal: '\\berrado\\b' }] },
      { corrections: [{ signal: '\\bnot that\\b' }] },
    ];
    const predictor = new BehaviorPredictor(history);
    const result = predictor.predict();
    assert.ok(result.predictions.length >= 1);
    assert.equal(result.predictions[0].type, 'recurring_correction');
    assert.equal(result.predictions[0].signal, '\\berrado\\b');
  });

  it('returns no predictions when below threshold', async () => {
    const { BehaviorPredictor } = await import('../../src/domains/behavior/predictor.js');
    const history = [
      { corrections: [{ signal: '\\berrado\\b' }] },
      { corrections: [{ signal: '\\bnot that\\b' }] },
    ];
    const predictor = new BehaviorPredictor(history);
    const result = predictor.predict();
    assert.equal(result.predictions.length, 0);
  });
});
