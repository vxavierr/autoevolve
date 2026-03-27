// src/review/feedback.js
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const exec = promisify(execFile);

export class ReviewFeedback {
  #cwd;
  #rulesPath;

  constructor(cwd) {
    this.#cwd = cwd;
    this.#rulesPath = join(cwd, '.autoevolve', 'rules', 'negative-rules.json');
  }

  async loadNegativeRules() {
    try {
      const raw = await readFile(this.#rulesPath, 'utf8');
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  async saveNegativeRules(rules) {
    const dir = join(this.#cwd, '.autoevolve', 'rules');
    await mkdir(dir, { recursive: true });
    await writeFile(this.#rulesPath, JSON.stringify(rules, null, 2));
  }

  async scanClosedPRs() {
    try {
      const { stdout } = await exec('gh', [
        'pr', 'list', '--state', 'closed', '--label', 'autoevolve',
        '--json', 'number,title,body,comments,closedAt',
        '--limit', '20'
      ], { cwd: this.#cwd });
      return JSON.parse(stdout);
    } catch {
      return [];
    }
  }

  async extractLessons(prs) {
    const lessons = [];
    for (const pr of prs) {
      // Look for rejection comments (not merged = rejected)
      const comments = pr.comments || [];
      for (const comment of comments) {
        const body = comment.body || '';
        if (body.toLowerCase().includes('reject') || body.toLowerCase().includes('não') || body.toLowerCase().includes('revert')) {
          lessons.push({
            pr_number: pr.number,
            pr_title: pr.title,
            reason: body.slice(0, 500),
            closed_at: pr.closedAt,
          });
        }
      }
    }
    return lessons;
  }

  async learnFromRejections() {
    const prs = await this.scanClosedPRs();
    if (!prs.length) return [];

    const lessons = await this.extractLessons(prs);
    if (!lessons.length) return [];

    const existing = await this.loadNegativeRules();
    const existingPRs = new Set(existing.map(r => r.pr_number));

    const newRules = lessons
      .filter(l => !existingPRs.has(l.pr_number))
      .map(l => ({
        id: `neg-${l.pr_number}`,
        pr_number: l.pr_number,
        pr_title: l.pr_title,
        reason: l.reason,
        learned_at: new Date().toISOString(),
        active: true,
      }));

    if (newRules.length) {
      await this.saveNegativeRules([...existing, ...newRules]);
    }

    return newRules;
  }

  async checkNegativeRules(proposedChange) {
    const rules = await this.loadNegativeRules();
    return rules.filter(r => r.active && proposedChange.toLowerCase().includes(r.reason.toLowerCase().slice(0, 50)));
  }
}
