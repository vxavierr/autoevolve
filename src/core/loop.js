// src/core/loop.js
import { StateManager } from './state.js';
import { GitMemory } from './git-memory.js';
import { Verifier } from './verifier.js';
import { compareMetrics } from './metric.js';

export class Loop {
  #opts;

  constructor(opts) {
    this.#opts = {
      cwd: opts.cwd,
      goal: opts.goal,
      maxIterations: opts.maxIterations ?? 20,
      plateauThreshold: opts.plateauThreshold ?? 3,
      verifyCommand: opts.verifyCommand,
      metricRegex: opts.metricRegex,
      metricDirection: opts.metricDirection ?? 'higher-is-better',
      changeFn: opts.changeFn, // async ({ cwd, goal, history, metric }) => description
      gitConfig: opts.gitConfig ?? { create_branch: false, create_pr: false, base_branch: 'master', remote: 'origin' },
    };
  }

  async run() {
    const { cwd, goal, maxIterations, plateauThreshold, verifyCommand, metricRegex, metricDirection, changeFn, gitConfig } = this.#opts;

    const state = new StateManager(cwd);
    const git = new GitMemory(cwd);
    const verifier = new Verifier(verifyCommand, cwd);

    // MEASURE baseline
    const baselineResult = await verifier.run();
    const baselineValue = verifier.extractNumber(baselineResult.stdout, metricRegex);

    const startedAt = new Date().toISOString();
    await state.update({
      status: 'running',
      goal,
      baseline: { value: baselineValue, timestamp: startedAt },
      started_at: startedAt,
    });

    // BRANCH — create isolated branch before the loop
    let originalBranch = null;
    let branchName = null;
    if (gitConfig.create_branch) {
      originalBranch = await git.getCurrentBranch();
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      branchName = `autoevolve/cycle-${stamp}`;
      await git.createBranch(branchName);
    }

    let currentMetric = baselineValue;
    let plateauCount = 0;
    let kept = 0;
    let reverted = 0;
    let iterations = 0;
    let stopReason = 'max_iterations';

    for (let i = 0; i < maxIterations; i++) {
      iterations++;
      const history = await git.getHistory(20);

      // ANALYZE + CHANGE (delegated to changeFn)
      const description = await changeFn({
        cwd,
        goal,
        history,
        metric: currentMetric,
        iteration: i + 1,
      });

      // COMMIT
      const commitHash = await git.commit(`iteration ${i + 1}: ${description}`);
      if (!commitHash) {
        // nothing changed, count as plateau
        plateauCount++;
        if (plateauCount >= plateauThreshold) {
          stopReason = 'plateau';
          break;
        }
        continue;
      }

      // VERIFY
      const verifyResult = await verifier.run();
      const newMetric = verifier.extractNumber(verifyResult.stdout, metricRegex);

      // DECIDE
      const comparison = compareMetrics(currentMetric, newMetric, metricDirection);

      if (comparison === 'worsened' || verifyResult.exitCode !== 0) {
        await git.revertLast();
        reverted++;
        plateauCount = 0; // a revert is not plateau
        await state.appendIteration({
          number: i + 1,
          action: description,
          metric_before: currentMetric,
          metric_after: newMetric,
          decision: 'revert',
          commit: commitHash,
        });
      } else {
        if (comparison === 'unchanged') {
          plateauCount++;
        } else {
          plateauCount = 0;
        }
        currentMetric = newMetric;
        kept++;
        await state.appendIteration({
          number: i + 1,
          action: description,
          metric_before: currentMetric,
          metric_after: newMetric,
          decision: 'keep',
          commit: commitHash,
        });
      }

      if (plateauCount >= plateauThreshold) {
        stopReason = 'plateau';
        break;
      }
    }

    const loadedState = await state.load();
    const report = {
      goal,
      iterations,
      baseline: { value: baselineValue },
      final: { value: currentMetric },
      improvement: currentMetric - baselineValue,
      kept,
      reverted,
      stop_reason: stopReason,
      duration_seconds: Math.round((Date.now() - new Date(loadedState.started_at).getTime()) / 1000),
    };

    // POST-LOOP: push branch and open PR if improvements were kept
    if (gitConfig.create_branch && branchName) {
      if (kept > 0 && gitConfig.create_pr) {
        await git.pushBranch(gitConfig.remote);
        const prBody = [
          `**Goal:** ${goal}`,
          `**Baseline:** ${baselineValue}`,
          `**Final metric:** ${currentMetric}`,
          `**Improvement:** ${currentMetric - baselineValue}`,
          `**Iterations:** ${iterations}`,
          `**Kept:** ${kept}`,
          `**Reverted:** ${reverted}`,
          `**Stop reason:** ${stopReason}`,
        ].join('\n');
        const prUrl = await git.createPR(`[autoevolve] ${goal}`, prBody, gitConfig.base_branch);
        report.branch_name = branchName;
        report.pr_url = prUrl;
      } else if (kept === 0) {
        // Nothing improved — go back to original branch and delete autoevolve branch
        await git.checkout(originalBranch);
        await git.deleteBranch(branchName);
      }
    }

    await state.update({ status: 'completed', report });
    return report;
  }
}
