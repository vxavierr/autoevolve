// src/core/state.js
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_STATE = {
  status: 'idle',
  goal: null,
  domain: null,
  current_iteration: 0,
  iterations: [],
  baseline: null,
  started_at: null,
  updated_at: null,
};

export class StateManager {
  #filePath;

  constructor(baseDir) {
    this.baseDir = baseDir;
    this.#filePath = join(baseDir, '.autoevolve', 'state.json');
  }

  async load() {
    try {
      const raw = await readFile(this.#filePath, 'utf8');
      return JSON.parse(raw);
    } catch {
      return { ...DEFAULT_STATE };
    }
  }

  async save(state) {
    const dir = join(this.baseDir, '.autoevolve');
    await mkdir(dir, { recursive: true });
    state.updated_at = new Date().toISOString();
    await writeFile(this.#filePath, JSON.stringify(state, null, 2));
  }

  async update(partial) {
    const current = await this.load();
    const merged = { ...current, ...partial };
    await this.save(merged);
    return merged;
  }

  async appendIteration(iteration) {
    const current = await this.load();
    current.iterations.push({
      ...iteration,
      timestamp: new Date().toISOString(),
    });
    current.current_iteration = current.iterations.length;
    await this.save(current);
    return current;
  }

  async reset() {
    await this.save({ ...DEFAULT_STATE });
  }
}
