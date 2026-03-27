// src/dashboard/server.js
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
};

export function createDashboardServer(workspaceDir) {
  const autoevolveDir = join(workspaceDir, '.autoevolve');

  return createServer(async (req, res) => {
    try {
      if (req.url.startsWith('/api/')) {
        await handleApi(req, res, autoevolveDir, workspaceDir);
      } else {
        await handleStatic(req, res);
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

async function handleApi(req, res, autoevolveDir, workspaceDir) {
  res.setHeader('Content-Type', 'application/json');
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  switch (path) {
    case '/api/projects':
      return jsonResponse(res, await safeReadJson(join(autoevolveDir, 'projects.json'), { projects: [] }));

    case '/api/behavior': {
      const model = await safeReadJson(join(autoevolveDir, 'behavior', 'model.json'), {});
      // Truncate correction patterns to avoid leaking full message content
      if (model.patterns?.corrections) {
        for (const val of Object.values(model.patterns.corrections)) {
          if (val.userMessage) val.userMessage = val.userMessage.slice(0, 100);
        }
      }
      return jsonResponse(res, model);
    }

    case '/api/rules': {
      const local = await safeReadJson(join(autoevolveDir, 'rules', 'hardcoded-rules.json'), []);
      const global = await safeReadJson(join(autoevolveDir, 'global-rules.json'), []);
      return jsonResponse(res, { local, global });
    }

    case '/api/cost': {
      try {
        const { CostAggregator } = await import('../cost/aggregator.js');
        const agg = new CostAggregator(workspaceDir);
        const data = await agg.aggregate();
        return jsonResponse(res, data);
      } catch {
        return jsonResponse(res, { total_cost: 0, total_iterations: 0, hardcoded_iterations: 0, hardcoded_savings: 0 });
      }
    }

    case '/api/runs': {
      const reportsDir = join(autoevolveDir, 'reports');
      try {
        const files = (await readdir(reportsDir)).filter(f => f.endsWith('.json')).sort().reverse().slice(0, 20);
        const reports = [];
        for (const f of files) {
          try {
            const raw = await readFile(join(reportsDir, f), 'utf8');
            reports.push(JSON.parse(raw));
          } catch { continue; }
        }
        return jsonResponse(res, reports);
      } catch {
        return jsonResponse(res, []);
      }
    }

    case '/api/predictions': {
      const reportsDir = join(autoevolveDir, 'reports');
      try {
        const files = (await readdir(reportsDir)).filter(f => f.startsWith('prediction-')).sort().reverse().slice(0, 5);
        const predictions = [];
        for (const f of files) {
          try {
            const raw = await readFile(join(reportsDir, f), 'utf8');
            predictions.push(JSON.parse(raw));
          } catch { continue; }
        }
        return jsonResponse(res, predictions);
      } catch {
        return jsonResponse(res, []);
      }
    }

    default:
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
  }
}

async function handleStatic(req, res) {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = join(PUBLIC_DIR, filePath);

  try {
    const content = await readFile(filePath);
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain' });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}

function jsonResponse(res, data) {
  res.writeHead(200);
  res.end(JSON.stringify(data));
}

async function safeReadJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}
