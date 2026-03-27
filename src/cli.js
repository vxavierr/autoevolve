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
  autoevolve run "goal"              Run improvement loop for a goal
  autoevolve predict                 Analyze behavior patterns
  autoevolve flow                    Audit workflow (if framework detected)
  autoevolve status                  Show current state and metrics
  autoevolve rules                   List hardcoded rules
  autoevolve rules export            Export rules to share

Options:
  --max <n>          Max iterations (default: 20)
  --domain <name>    Only run specific domain
  --dry-run          Show what would change without executing
  -h, --help         Show this help
`);
}

async function cmdInit(cwd) {
  const registry = new DomainRegistry(cwd);
  const detected = await registry.detectDomains();
  console.log('Detected domains:', detected.join(', '));
  console.log('Run `autoevolve run "your goal"` to start improving.');
}

async function cmdStatus(cwd) {
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
  const { BehaviorDomain } = await import('./domains/behavior/index.js');
  const domain = new BehaviorDomain({});
  const homedir = (await import('node:os')).homedir();
  // Auto-detect session dir
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
