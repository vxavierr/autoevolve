// src/core/metric.js
export class Metric {
  constructor(name, direction = 'higher-is-better') {
    this.name = name;
    this.direction = direction;
  }
}

export function compareMetrics(before, after, direction) {
  if (before === after) return 'unchanged';
  if (direction === 'higher-is-better') {
    return after > before ? 'improved' : 'worsened';
  }
  return after < before ? 'improved' : 'worsened';
}
