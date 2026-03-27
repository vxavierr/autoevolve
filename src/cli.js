#!/usr/bin/env node
// src/cli.js
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { loadConfig } from './config.js';
import { DomainRegistry } from './domains/registry.js';
import { RuleStore } from './evolution/rule-store.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    max: { type: 'string', default: '20' },
    domain: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    all: { type: 'boolean', default: false },
    'cross-project': { type: 'boolean', default: false },
    simulate: { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

const command = positionals[0];
const goal = positionals.slice(1).join(' ');
const cwd = resolve('.');

async function main() {
  if (values.help || !command) {
    printHelp();
    return;
  }

  switch (command) {
    case 'init':
      await cmdInit(cwd);
      break;
    case 'scan':
      await cmdScan(cwd);
      break;
    case 'run':
      await cmdRun(cwd, goal, values);
      break;
    case 'status':
      await cmdStatus(cwd);
      break;
    case 'predict':
      await cmdPredict(cwd);
      break;
    case 'flow':
      await cmdFlow(cwd);
      break;
    case 'rules':
      await cmdRules(cwd, positionals[1]);
      break;
    default:
      // treat entire positionals as goal
      await cmdRun(cwd, [command, ...positionals.slice(1)].join(' '), values);
  }
}

function printHelp() {
  console.log(`
autoevolve — Autonomous improvement engine

Usage:
  autoevolve init                    Generate config, auto-detect domains
  autoevolve scan                    Discover all projects in workspace
  autoevolve run "goal"              Run improvement loop for a goal
  autoevolve run --all "goal"        Run on all discovered projects
  autoevolve predict                 Analyze behavior patterns
  autoevolve predict --simulate "g"  Predict friction for a goal
  autoevolve flow                    Audit workflow (if framework detected)
  autoevolve status                  Show current state and metrics
  autoevolve status --all            Aggregated status across all projects
  autoevolve rules                   List hardcoded rules
  autoevolve rules export            Export rules to share
  autoevolve rules --cross-project   Promote and show global rules

Options:
  --max <n>              Max iterations (default: no limit, plateau stops)
  --domain <name>        Only run specific domain
  --all                  Run on all discovered projects
  --cross-project        Show/promote cross-project rules
  --simulate "goal"      Predict friction scenarios for a goal
  --dry-run              Show what would change without executing
  -h, --help             Show this help
`);
}

async function cmdInit(cwd) {
  const registry = new DomainRegistry(cwd);
  const detected = await registry.detectDomains();
  console.log('Detected domains:', detected.join(', '));
  console.log('Run `autoevolve run "your goal"` to start improving.');
}

async function cmdScan(cwd) {
  const { ProjectScanner } = await import('./multi/project-scanner.js');
  const scanner = new ProjectScanner(cwd);
  const projects = await scanner.scanAndSave();
  if (projects.length === 0) {
    console.log('No projects found. Try running in a workspace with projects/ subdirectory.');
    return;
  }
  console.log(`Found ${projects.length} projects:`);
  for (const p of projects) {
    const flags = [p.hasTests && 'tests', p.hasClaudeMd && 'claude', p.hasAiosCore && 'aiox'].filter(Boolean);
    console.log(`  ${p.name} [${flags.join(', ')}]`);
  }
}

async function cmdStatus(cwd) {
  if (values.all) {
    const { Orchestrator } = await import('./multi/orchestrator.js');
    const orch = new Orchestrator(cwd);
    const report = await orch.aggregateReports();
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  const { StateManager } = await import('./core/state.js');
  const state = new StateManager(cwd);
  const s = await state.load();
  console.log(JSON.stringify(s, null, 2));
}

async function cmdRun(cwd, goal, opts) {
  console.log(`autoevolve: running with goal "${goal}"`);
  console.log('Note: in standalone mode, an LLM backend is required for the ANALYZE step.');
  console.log('Configure llm.provider in .autoevolve/config.yaml');
  // Full implementation requires LLM integration — primary usage is as Claude Code skill
}

async function cmdPredict(cwd) {
  if (values.simulate) {
    const { PredictionEngine } = await import('./prediction/engine.js');
    const engine = new PredictionEngine(cwd);
    const result = await engine.predictAndSave(values.simulate);
    console.log(`\nGoal: ${result.goal}`);
    console.log(`Risk score: ${result.risk_score}`);
    console.log(`Scenarios: ${result.scenarios.length}\n`);
    for (const s of result.scenarios) {
      const icon = s.severity === 'critical' ? '🔴' : s.severity === 'high' ? '🟠' : '🟡';
      console.log(`  ${icon} [${s.probability}] ${s.description}`);
      console.log(`     Prevention: ${s.prevention}`);
      if (s.based_on?.length > 0) {
        console.log(`     Evidence: ${s.based_on.join(', ')}`);
      }
    }
    if (result.recommended_guardrails.length > 0) {
      console.log(`\nRecommended guardrails: ${result.recommended_guardrails.length}`);
      for (const g of result.recommended_guardrails) {
        console.log(`  → ${g.description} (${g.event}:${g.matcher})`);
      }
    }
    return;
  }

  const { BehaviorDomain } = await import('./domains/behavior/index.js');
  const domain = new BehaviorDomain({});
  const homedir = (await import('node:os')).homedir();
  const sessionDir = resolve(homedir, '.claude', 'projects');
  console.log('Behavior analysis requires session data from Claude Code.');
  console.log(`Looking in: ${sessionDir}`);
}

async function cmdFlow(cwd) {
  const registry = new DomainRegistry(cwd);
  const detected = await registry.detectDomains();
  if (!detected.includes('flow')) {
    console.log('No framework detected. Flow domain is inactive.');
    return;
  }
  console.log('Flow domain detected. Running audit...');
}

async function cmdRules(cwd, subcommand) {
  if (values['cross-project']) {
    const { RulePromoter } = await import('./multi/rule-promoter.js');
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const promoter = new RulePromoter(cwd);
    const promoted = await promoter.promote();
    if (promoted.length > 0) {
      console.log(`Promoted ${promoted.length} new global rules.`);
    }
    try {
      const global = JSON.parse(await readFile(join(cwd, '.autoevolve', 'global-rules.json'), 'utf8'));
      console.log(`${global.length} global rules:`);
      for (const r of global) {
        console.log(`  ${r.id} [${r.domain}] ${r.do} (from: ${r.found_in.join(', ')})`);
      }
    } catch {
      console.log('No global rules yet. Rules are promoted when the same pattern appears in 2+ projects.');
    }
    return;
  }

  const store = new RuleStore(cwd);
  const rules = await store.loadAll();

  if (subcommand === 'export') {
    console.log(JSON.stringify(rules, null, 2));
    return;
  }

  if (rules.length === 0) {
    console.log('No hardcoded rules yet. Rules are extracted after repeated successful patterns.');
    return;
  }

  console.log(`${rules.length} hardcoded rules:\n`);
  for (const rule of rules) {
    console.log(`  ${rule.id} [${rule.domain}] ${rule.when} → ${rule.do} (used ${rule.verified_count}x)`);
  }
}

main().catch(err => {
  console.error('autoevolve error:', err.message);
  process.exit(1);
});
