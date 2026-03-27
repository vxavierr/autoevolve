// test/prediction/pattern-matcher.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PatternMatcher } from '../../src/prediction/pattern-matcher.js';

describe('PatternMatcher', () => {
  const PATTERNS = {
    'auth|credentials|login|senha': ['credential-mismatch', 'wrong-account'],
    'database|migration|schema|supabase': ['data-loss-risk', 'missing-backup'],
    'deploy|push|release': ['untested-code', 'broken-ci'],
    'refactor|rename|move': ['scope-creep', 'breaking-imports'],
    'test|coverage|jest|vitest': ['missing-edge-cases', 'flaky-tests'],
  };

  it('matches goal to scenario template IDs', () => {
    const matcher = new PatternMatcher(PATTERNS);
    const result = matcher.match('implementar auth no mindo');
    assert.ok(result.includes('credential-mismatch'));
    assert.ok(result.includes('wrong-account'));
  });

  it('matches multiple patterns', () => {
    const matcher = new PatternMatcher(PATTERNS);
    const result = matcher.match('deploy database migration');
    assert.ok(result.includes('data-loss-risk'));
    assert.ok(result.includes('untested-code'));
  });

  it('returns empty for unrecognized goal', () => {
    const matcher = new PatternMatcher(PATTERNS);
    const result = matcher.match('write a poem about cats');
    assert.deepEqual(result, []);
  });

  it('is case-insensitive', () => {
    const matcher = new PatternMatcher(PATTERNS);
    const result = matcher.match('DEPLOY to production');
    assert.ok(result.includes('untested-code'));
  });

  it('deduplicates template IDs', () => {
    const matcher = new PatternMatcher({
      'auth|login': ['credential-mismatch'],
      'credentials|senha': ['credential-mismatch', 'wrong-account'],
    });
    const result = matcher.match('auth credentials');
    const unique = [...new Set(result)];
    assert.equal(result.length, unique.length);
  });
});
