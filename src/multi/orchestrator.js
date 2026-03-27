// src/multi/orchestrator.js
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ProjectScanner } from './project-scanner.js';

export class Orchestrator {
  #workspace;

  constructor(workspace) {
    this.#workspace = workspace;
  }

  async discoverProjects() {
    const scanner = new ProjectScanner(this.#workspace);
    return scanner.scan();
  }

  async aggregateReports() {
    const projects = await this.discoverProjects();
    const projectReports = [];

    for (const project of projects) {
      const reports = await this.#readProjectReports(project.path);
      projectReports.push({
        name: project.name,
        path: project.path,
        reports,
        total_iterations: reports.reduce((s, r) => s + (r.iterations ?? 0), 0),
        total_kept: reports.reduce((s, r) => s + (r.kept ?? 0), 0),
        total_reverted: reports.reduce((s, r) => s + (r.reverted ?? 0), 0),
      });
    }

    return {
      timestamp: new Date().toISOString(),
      workspace: this.#workspace,
      projects: projectReports,
      total_iterations: projectReports.reduce((s, p) => s + p.total_iterations, 0),
      total_kept: projectReports.reduce((s, p) => s + p.total_kept, 0),
      total_reverted: projectReports.reduce((s, p) => s + p.total_reverted, 0),
    };
  }

  async aggregateAndSave() {
    const report = await this.aggregateReports();
    const outDir = join(this.#workspace, '.autoevolve', 'reports');
    await mkdir(outDir, { recursive: true });
    const filename = `cross-project-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
    await writeFile(join(outDir, filename), JSON.stringify(report, null, 2));
    return report;
  }

  async #readProjectReports(projectPath) {
    const reportsDir = join(projectPath, '.autoevolve', 'reports');
    try {
      const files = await readdir(reportsDir);
      const reports = [];
      for (const file of files.filter(f => f.endsWith('.json'))) {
        try {
          const raw = await readFile(join(reportsDir, file), 'utf8');
          reports.push(JSON.parse(raw));
        } catch { continue; }
      }
      return reports;
    } catch {
      return [];
    }
  }
}
