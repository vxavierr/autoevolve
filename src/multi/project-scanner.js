// src/multi/project-scanner.js
import { readdir, readFile, access, mkdir, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';

/**
 * Encode a filesystem path to Claude Code's session directory name.
 * Claude replaces path separators with '--' and removes drive colons.
 * E.g., D:\workspace\projects\mindo → D--workspace-projects-mindo
 */
export function encodeSessionPath(fsPath) {
  // Replace colon+separator(s) (Windows drive separator) with '--'
  // then replace remaining separators with '-'
  return fsPath
    .replace(/:[/\\]+/, '--')
    .replace(/[/\\]/g, '-');
}

export class ProjectScanner {
  #workspace;

  constructor(workspace) {
    this.#workspace = workspace;
  }

  async scan() {
    const projects = [];
    const dirs = await this.#findProjectDirs();

    for (const dir of dirs) {
      const meta = await this.#analyzeProject(dir);
      if (meta) projects.push(meta);
    }

    return projects;
  }

  async scanAndSave() {
    const projects = await this.scan();
    const outDir = join(this.#workspace, '.autoevolve');
    await mkdir(outDir, { recursive: true });
    await writeFile(
      join(outDir, 'projects.json'),
      JSON.stringify({ scanned_at: new Date().toISOString(), projects }, null, 2)
    );
    return projects;
  }

  async #findProjectDirs() {
    const dirs = [];
    // Check workspace/projects/ subdirectories
    const projectsDir = join(this.#workspace, 'projects');
    try {
      const entries = await readdir(projectsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          dirs.push(join(projectsDir, entry.name));
        }
      }
    } catch { /* no projects/ dir */ }

    // Also check workspace root itself (it might be a project)
    dirs.push(this.#workspace);

    return dirs;
  }

  async #analyzeProject(dir) {
    const hasPackageJson = await this.#fileExists(join(dir, 'package.json'));
    const hasClaudeMd = await this.#fileExists(join(dir, 'CLAUDE.md'))
      || await this.#fileExists(join(dir, '.claude', 'CLAUDE.md'));
    const hasAiosCore = await this.#fileExists(join(dir, '.aios-core'));

    if (!hasPackageJson && !hasClaudeMd && !hasAiosCore) return null;

    let hasTests = false;
    if (hasPackageJson) {
      try {
        const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
        hasTests = !!(pkg.scripts?.test);
      } catch {}
    }

    return {
      name: basename(dir),
      path: dir,
      sessionDirName: encodeSessionPath(dir),
      hasPackageJson,
      hasClaudeMd,
      hasAiosCore,
      hasTests,
    };
  }

  async #fileExists(path) {
    try { await access(path); return true; } catch { return false; }
  }
}
