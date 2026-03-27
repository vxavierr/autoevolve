// src/domains/prompts/index.js
export class PromptsDomain {
  constructor(config) {
    this.name = 'prompts';
    this.config = config;
    this.metrics = ['token-usage', 'instruction-density'];
  }

  getScope() {
    return this.config.scope ?? '.claude/**/*.md';
  }
}
