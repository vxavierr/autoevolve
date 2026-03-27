// src/domains/code/verifiers.js
export const CODE_VERIFIERS = {
  coverage: {
    command: 'npm test -- --coverage --silent 2>&1',
    regex: /All files\s*\|\s*([\d.]+)/,
    direction: 'higher-is-better',
    fallbackRegex: /[Cc]overage[:\s]+([\d.]+)%/,
  },
  'lint-errors': {
    command: 'npx eslint . --format json 2>&1',
    regex: null, // uses parseLintOutput
    direction: 'lower-is-better',
    parser: 'lint',
  },
  'build-time': {
    command: 'npm run build 2>&1',
    regex: /Done in ([\d.]+)s/,
    direction: 'lower-is-better',
  },
};
