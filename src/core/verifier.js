// src/core/verifier.js
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export class Verifier {
  #command;
  #cwd;

  constructor(command, cwd = process.cwd()) {
    this.#command = command;
    this.#cwd = cwd;
  }

  async run() {
    try {
      const { stdout, stderr } = await execAsync(this.#command, {
        cwd: this.#cwd,
        timeout: 120_000,
      });
      return { exitCode: 0, stdout, stderr };
    } catch (err) {
      return {
        exitCode: err.code ?? 1,
        stdout: err.stdout ?? '',
        stderr: err.stderr ?? '',
      };
    }
  }

  extractNumber(stdout, regex) {
    const match = stdout.match(regex);
    if (!match) return null;
    return parseFloat(match[1]);
  }
}
