import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, 'templates');

export class HookGenerator {
  async generate({ templateName, description, basedOn, outputDir, event, matcher }) {
    // Read template
    const tmplPath = join(TEMPLATES_DIR, `${templateName}.cjs.tmpl`);
    let content = await readFile(tmplPath, 'utf8');

    // Fill placeholders
    content = content
      .replace(/\{\{DESCRIPTION\}\}/g, description)
      .replace(/\{\{BASED_ON\}\}/g, basedOn)
      .replace(/\{\{GENERATED_AT\}\}/g, new Date().toISOString());

    // Write to output dir
    await mkdir(outputDir, { recursive: true });
    const hookName = `${templateName}-${randomUUID().slice(0, 6)}`;
    const filePath = join(outputDir, `${hookName}.cjs`);
    await writeFile(filePath, content);

    return {
      hookName,
      filePath,
      hookConfig: {
        event: event ?? 'PreToolUse',
        matcher: matcher ?? 'Bash',
        command: `node "${filePath}"`,
        timeout: 10,
        description: `[autoevolve] ${description}`,
      },
    };
  }
}
