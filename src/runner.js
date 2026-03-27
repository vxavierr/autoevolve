#!/usr/bin/env node
// src/runner.js — Autonomous runner for autoevolve
// Called by Task Scheduler or /loop. Runs the full cycle:
// 1. For each active domain, run the tight loop or analysis
// 2. Log results to .autoevolve/
// 3. Exit cleanly
//
// Usage:
//   node runner.js                    # run once (all domains)
//   node runner.js --domain code      # single domain
//   node runner.js --install          # install Windows Task Scheduler (every 2h)
//   node runner.js --uninstall        # remove scheduled task
//   node runner.js --status           # check if installed
//
// This runs OUTSIDE Claude Code — it calls `claude` CLI for LLM decisions.

import { execSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { homedir } from 'node:os';

const execFileAsync = promisify(execFile);

const TASK_NAME = 'AutoEvolve';

const { values } = parseArgs({
  options: {
    domain: { type: 'string' },
    install: { type: 'boolean', default: false },
    uninstall: { type: 'boolean', default: false },
    status: { type: 'boolean', default: false },
    cwd: { type: 'string' },
    interval: { type: 'string', default: '2' }, // hours
  },
});

// Detect project root: --cwd flag, or the directory where .autoevolve/ or package.json lives
const projectRoot = resolve(values.cwd ?? process.cwd());

async function main() {
  if (values.install) return install();
  if (values.uninstall) return uninstall();
  if (values.status) return status();

  await runCycle();
}

// ─── Core cycle ───

async function runCycle() {
  const startTime = Date.now();
  log(`autoevolve runner starting in ${projectRoot}`);

  const outputDir = join(projectRoot, '.autoevolve');
  await mkdir(join(outputDir, 'reports'), { recursive: true });
  await mkdir(join(outputDir, 'logs'), { recursive: true });

  // Build the prompt for Claude CLI
  const domains = values.domain ? [values.domain] : ['code', 'prompts', 'behavior', 'flow'];
  const domainArg = values.domain ? `--domain ${values.domain}` : '--auto';

  const prompt = `
You have the /autoevolve skill installed. Run it now in autonomous mode.

Execute: /autoevolve ${domainArg} --max 10

Important:
- This is an autonomous run (no human in the loop)
- For "code" domain: only make safe, reversible changes (tests, lint fixes)
- For "prompts" domain: optimize token usage without losing quality
- For "behavior" domain: analyze session logs and propose guardrails
- For "flow" domain: scan stories and report bottlenecks (don't modify stories)
- Commit each change with [autoevolve] prefix
- If plateau (3x no improvement), stop that domain and move to next
- Write a summary report to .autoevolve/reports/run-${timestamp()}.json
- Do NOT ask questions. Act autonomously.
`.trim();

  log('Calling Claude CLI...');
  const result = await runClaude(prompt, 'sonnet', 300, 30);

  // Log the run
  const runLog = {
    timestamp: new Date().toISOString(),
    duration_seconds: Math.round((Date.now() - startTime) / 1000),
    domains: domains,
    cwd: projectRoot,
    output_length: result.length,
    success: !result.includes('ERROR'),
  };

  const logLine = JSON.stringify(runLog);
  const logPath = join(outputDir, 'logs', 'runner.jsonl');
  try {
    const existing = await readFile(logPath, 'utf8').catch(() => '');
    await writeFile(logPath, existing + logLine + '\n');
  } catch { /* first run */ }

  log(`Done in ${runLog.duration_seconds}s. Output: ${result.length} chars.`);

  // Print abbreviated output
  const lines = result.split('\n');
  if (lines.length > 20) {
    console.log(lines.slice(0, 10).join('\n'));
    console.log(`... (${lines.length - 20} lines omitted) ...`);
    console.log(lines.slice(-10).join('\n'));
  } else {
    console.log(result);
  }
}

// ─── Claude CLI wrapper ───

async function runClaude(prompt, model = 'sonnet', timeout = 300, maxTurns = 20) {
  const cmd = 'claude';
  const args = [
    '--print', '--bare',
    '--model', model,
    '--max-turns', String(maxTurns),
    '-p', prompt,
  ];

  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      cwd: projectRoot,
      timeout: timeout * 1000,
      encoding: 'utf-8',
      env: { ...process.env },
    });
    return stdout + (stderr || '');
  } catch (err) {
    return `ERROR: ${err.message}\n${err.stdout ?? ''}\n${err.stderr ?? ''}`;
  }
}

// ─── Task Scheduler (Windows) ───

function install() {
  const hours = parseInt(values.interval, 10) || 2;
  const nodeExe = process.execPath;
  const scriptPath = resolve(import.meta.dirname, 'runner.js');
  const cwdArg = projectRoot;

  try {
    // Delete if exists
    try { execSync(`schtasks /delete /tn "${TASK_NAME}" /f`, { stdio: 'ignore' }); } catch {}

    const cmd = `schtasks /create /tn "${TASK_NAME}" /tr "${nodeExe} ${scriptPath} --cwd ${cwdArg}" /sc HOURLY /mo ${hours} /st 00:00 /f`;
    execSync(cmd, { stdio: 'inherit' });
    log(`Installed: runs every ${hours}h. Task name: ${TASK_NAME}`);
  } catch (err) {
    log(`Install failed: ${err.message}`);
  }
}

function uninstall() {
  try {
    execSync(`schtasks /delete /tn "${TASK_NAME}" /f`, { stdio: 'inherit' });
    log('Uninstalled.');
  } catch {
    log('Task not found or already removed.');
  }
}

function status() {
  try {
    const out = execSync(`schtasks /query /tn "${TASK_NAME}"`, { encoding: 'utf-8' });
    console.log(out);
  } catch {
    log('Not installed. Run with --install to enable.');
  }
}

// ─── Helpers ───

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

main().catch(err => {
  console.error('autoevolve runner error:', err.message);
  process.exit(1);
});
