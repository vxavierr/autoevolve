// src/domains/code/index.js
import { CODE_VERIFIERS } from './verifiers.js';

export class CodeDomain {
  constructor(config) {
    this.name = 'code';
    this.config = config;
    this.metrics = Object.keys(CODE_VERIFIERS);
  }

  getVerifier(metricName) {
    return CODE_VERIFIERS[metricName] ?? null;
  }

  getScope() {
    return this.config.scope ?? 'src/**/*.{js,ts}';
  }
}
