// src/core/git-memory.js
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export class GitMemory {
  #cwd;

  constructor(cwd) {
    this.#cwd = cwd;
  }

  async #git(...args) {
    const { stdout } = await exec('git', args, { cwd: this.#cwd });
    return stdout.trim();
  }

  async commit(message) {
    await this.#git('add', '-A');
    const status = await this.#git('status', '--porcelain');
    if (!status) return null; // nothing to commit
    await this.#git('commit', '-m', `[autoevolve] ${message}`);
    return this.#git('rev-parse', 'HEAD');
  }

  async revertLast() {
    await this.#git('revert', '--no-edit', 'HEAD');
  }

  async getHistory(limit = 20) {
    const log = await this.#git(
      'log',
      `--max-count=${limit}`,
      '--grep=[autoevolve]',
      '--format=%H|||%s|||%ai'
    );
    if (!log) return [];
    return log.split('\n').map(line => {
      const [hash, message, date] = line.split('|||');
      return { hash, message, date };
    });
  }

  async getDiff() {
    try {
      const staged = await this.#git('diff', '--cached');
      const unstaged = await this.#git('diff');
      return [staged, unstaged].filter(Boolean).join('\n');
    } catch {
      return '';
    }
  }
}
