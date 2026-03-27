// src/domains/behavior/collectors.js
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export class SessionCollector {
  #dir;

  constructor(sessionDir) {
    this.#dir = sessionDir;
  }

  async collectAll(limit = 50) {
    const files = await this.#findSessionFiles();
    const sessions = [];

    for (const file of files.slice(-limit)) {
      const events = await this.#parseJsonl(file);
      if (events.length > 0) {
        sessions.push({ file, events });
      }
    }

    return sessions;
  }

  async #findSessionFiles() {
    try {
      const entries = await readdir(this.#dir);
      return entries
        .filter(e => e.endsWith('.jsonl'))
        .map(e => join(this.#dir, e))
        .sort();
    } catch {
      return [];
    }
  }

  async #parseJsonl(filePath) {
    try {
      const raw = await readFile(filePath, 'utf8');
      const events = [];
      for (const line of raw.split('\n')) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === 'user' || event.type === 'assistant') {
            events.push({
              type: event.type,
              content: this.#extractContent(event),
              timestamp: event.timestamp,
              uuid: event.uuid,
            });
          }
        } catch { continue; }
      }
      return events;
    } catch {
      return [];
    }
  }

  #extractContent(event) {
    const msg = event.message;
    if (!msg) return '';
    if (typeof msg.content === 'string') return msg.content;
    if (Array.isArray(msg.content)) {
      return msg.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('\n');
    }
    return '';
  }
}
