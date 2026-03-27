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
    port: { type: 'string', default: '4040' },
    file: { type: 'string' },
    trust: { type: 'boolean', default: false },
    global: { type: 'boolean', default: false },
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
    case 'dashboard':
      await cmdDashboard(cwd);
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
autoevolve — motor de melhoria autonoma

Uso:
  autoevolve init                    Gera config, detecta dominios automaticamente
  autoevolve scan                    Descobre todos os projetos no workspace
  autoevolve run "objetivo"          Roda o loop de melhoria para um objetivo
  autoevolve run --all "objetivo"    Roda em todos os projetos descobertos
  autoevolve predict                 Analisa padroes de comportamento
  autoevolve predict --simulate "o"  Prediz atrito para um objetivo
  autoevolve flow                    Audita workflow (se framework detectado)
  autoevolve status                  Mostra estado atual e metricas
  autoevolve status --all            Status agregado de todos os projetos
  autoevolve rules                   Lista regras hardcoded
  autoevolve rules export            Exporta regras para stdout
  autoevolve rules export --file f   Exporta regras para arquivo
  autoevolve rules export --global   Exporta apenas regras cross-project
  autoevolve rules import <arquivo>  Importa regras de arquivo
  autoevolve rules import --trust <url>  Importa de URL
  autoevolve rules --cross-project   Promove e exibe regras globais
  autoevolve dashboard               Abre dashboard web (localhost:4040)

Opcoes:
  --max <n>              Max iteracoes (padrao: sem limite, para no plateau)
  --domain <nome>        Roda apenas o dominio especifico
  --all                  Roda em todos os projetos descobertos
  --cross-project        Exibe/promove regras cross-project
  --simulate "objetivo"  Prediz cenarios de atrito para um objetivo
  --port <n>             Porta do dashboard (padrao: 4040)
  --file <caminho>       Exporta regras para arquivo
  --global               Exporta apenas regras globais
  --trust                Permite importar de URLs remotas
  --dry-run              Mostra o que mudaria sem executar
  -h, --help             Exibe esta ajuda
`);
}

async function cmdInit(cwd) {
  const registry = new DomainRegistry(cwd);
  const detected = await registry.detectDomains();
  console.log('Dominios detectados:', detected.join(', '));
  console.log('Rode `autoevolve run "seu objetivo"` para comecar a melhorar.');
}

async function cmdScan(cwd) {
  const { ProjectScanner } = await import('./multi/project-scanner.js');
  const scanner = new ProjectScanner(cwd);
  const projects = await scanner.scanAndSave();
  if (projects.length === 0) {
    console.log('Nenhum projeto encontrado. Tente rodar em um workspace com subdiretorio projects/.');
    return;
  }
  console.log(`${projects.length} projetos encontrados:`);
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
  console.log(`autoevolve: rodando com objetivo "${goal}"`);
  console.log('Nota: no modo standalone, um backend LLM e necessario para a etapa ANALYZE.');
  console.log('Configure llm.provider em .autoevolve/config.yaml');
  // Full implementation requires LLM integration — primary usage is as Claude Code skill
}

async function cmdPredict(cwd) {
  if (values.simulate) {
    const { PredictionEngine } = await import('./prediction/engine.js');
    const engine = new PredictionEngine(cwd);
    const result = await engine.predictAndSave(values.simulate);
    console.log(`\nObjetivo: ${result.goal}`);
    console.log(`Risco: ${result.risk_score}`);
    console.log(`Cenarios: ${result.scenarios.length}\n`);
    for (const s of result.scenarios) {
      const icon = s.severity === 'critical' ? '🔴' : s.severity === 'high' ? '🟠' : '🟡';
      console.log(`  ${icon} [${s.probability}] ${s.description}`);
      console.log(`     Prevencao: ${s.prevention}`);
      if (s.based_on?.length > 0) {
        console.log(`     Evidencia: ${s.based_on.join(', ')}`);
      }
    }
    if (result.recommended_guardrails.length > 0) {
      console.log(`\nGuardrails recomendados: ${result.recommended_guardrails.length}`);
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
  console.log('Analise de comportamento requer dados de sessao do Claude Code.');
  console.log(`Procurando em: ${sessionDir}`);
}

async function cmdFlow(cwd) {
  const registry = new DomainRegistry(cwd);
  const detected = await registry.detectDomains();
  if (!detected.includes('flow')) {
    console.log('Nenhum framework detectado. Dominio flow esta inativo.');
    return;
  }
  console.log('Dominio flow detectado. Rodando auditoria...');
}

async function cmdRules(cwd, subcommand) {
  if (values['cross-project']) {
    const { RulePromoter } = await import('./multi/rule-promoter.js');
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const promoter = new RulePromoter(cwd);
    const promoted = await promoter.promote();
    if (promoted.length > 0) {
      console.log(`${promoted.length} novas regras globais promovidas.`);
    }
    try {
      const global = JSON.parse(await readFile(join(cwd, '.autoevolve', 'global-rules.json'), 'utf8'));
      console.log(`${global.length} regras globais:`);
      for (const r of global) {
        console.log(`  ${r.id} [${r.domain}] ${r.do} (de: ${r.found_in.join(', ')})`);
      }
    } catch {
      console.log('Nenhuma regra global ainda. Regras sao promovidas quando o mesmo padrao aparece em 2+ projetos.');
    }
    return;
  }

  const store = new RuleStore(cwd);
  const rules = await store.loadAll();

  if (subcommand === 'export') {
    const { RuleExporter } = await import('./marketplace/exporter.js');
    const exporter = new RuleExporter(cwd);
    const pkg = values.global ? await exporter.exportGlobal() : await exporter.exportLocal();
    if (values.file) {
      await exporter.exportToFile(values.file, values.global);
      console.log(`${pkg.rules.length} regras exportadas para ${values.file}`);
    } else {
      console.log(JSON.stringify(pkg, null, 2));
    }
    return;
  }

  if (subcommand === 'import') {
    const source = positionals[2];
    if (!source) { console.log('Uso: autoevolve rules import <arquivo|url>'); return; }
    const { RuleImporter } = await import('./marketplace/importer.js');
    const importer = new RuleImporter(cwd);
    const isUrl = source.startsWith('http');
    if (isUrl && !values.trust) {
      console.log('Importacao remota requer a flag --trust: autoevolve rules import --trust <url>');
      return;
    }
    const result = isUrl ? await importer.importFromUrl(source) : await importer.importFromFile(source);
    console.log(`Importadas: ${result.imported}, Rejeitadas: ${result.rejected}${result.truncated ? ' (truncado em 50)' : ''}`);
    if (result.errors?.length) {
      for (const e of result.errors) console.log(`  x ${e}`);
    }
    return;
  }

  if (rules.length === 0) {
    console.log('Nenhuma regra hardcoded ainda. Regras sao extraidas apos padroes bem-sucedidos repetidos.');
    return;
  }

  console.log(`${rules.length} regras hardcoded:\n`);
  for (const rule of rules) {
    console.log(`  ${rule.id} [${rule.domain}] ${rule.when} → ${rule.do} (used ${rule.verified_count}x)`);
  }
}

async function cmdDashboard(cwd) {
  const { createDashboardServer } = await import('./dashboard/server.js');
  const port = parseInt(values.port, 10) || 4040;
  const server = createDashboardServer(cwd);
  server.listen(port, '127.0.0.1', () => {
    console.log(`autoevolve dashboard rodando em http://127.0.0.1:${port}`);
    console.log('Pressione Ctrl+C para parar.');
  });
}

main().catch(err => {
  console.error('autoevolve erro:', err.message);
  process.exit(1);
});
