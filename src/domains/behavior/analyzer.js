// src/domains/behavior/analyzer.js
const CORRECTION_SIGNALS = [
  /\bno[, ]+not\b/i,
  /\bnot that\b/i,
  /\bI meant\b/i,
  /\bwrong\b/i,
  /\bstop\b/i,
  /\bdon'?t\b/i,
  /\bundo\b/i,
  /\brevert\b/i,
  /\bactually[, ]/i,
];

const APPROVAL_SIGNALS = [
  /\bperfect\b/i,
  /\bgreat\b/i,
  /\blooks good\b/i,
  /\byes\b/i,
  /\bexactly\b/i,
  /\bnice\b/i,
  /\bok\b/i,
  /\bship it\b/i,
  /\bnext\b/i,
  /\bbora\b/i,    // pt-br
  /\bbeleza\b/i,  // pt-br
  /\bshow\b/i,    // pt-br slang for "great"
];

export class BehaviorAnalyzer {
  detectCorrections(events) {
    const patterns = [];
    for (let i = 1; i < events.length; i++) {
      const curr = events[i];
      const prev = events[i - 1];
      if (curr.type !== 'user' || prev.type !== 'assistant') continue;

      for (const regex of CORRECTION_SIGNALS) {
        if (regex.test(curr.content)) {
          patterns.push({
            type: 'correction',
            userMessage: curr.content.slice(0, 200),
            assistantMessage: prev.content.slice(0, 200),
            timestamp: curr.timestamp,
            signal: regex.source,
          });
          break;
        }
      }
    }
    return patterns;
  }

  detectFrustration(events) {
    const patterns = [];
    for (let i = 1; i < events.length; i++) {
      const curr = events[i];
      const prev = events[i - 1];
      if (curr.type !== 'user' || prev.type !== 'assistant') continue;

      // Short user message after long assistant output
      if (prev.content.length > 300 && curr.content.length < 20) {
        patterns.push({
          type: 'frustration',
          userMessage: curr.content,
          assistantOutputLength: prev.content.length,
          timestamp: curr.timestamp,
        });
      }
    }
    return patterns;
  }

  detectApprovals(events) {
    const patterns = [];
    for (let i = 1; i < events.length; i++) {
      const curr = events[i];
      const prev = events[i - 1];
      if (curr.type !== 'user' || prev.type !== 'assistant') continue;

      for (const regex of APPROVAL_SIGNALS) {
        if (regex.test(curr.content) && curr.content.length < 50) {
          patterns.push({
            type: 'approval',
            userMessage: curr.content,
            timestamp: curr.timestamp,
          });
          break;
        }
      }
    }
    return patterns;
  }

  analyzeAll(events) {
    return {
      corrections: this.detectCorrections(events),
      frustrations: this.detectFrustration(events),
      approvals: this.detectApprovals(events),
      stats: {
        totalEvents: events.length,
        userMessages: events.filter(e => e.type === 'user').length,
        assistantMessages: events.filter(e => e.type === 'assistant').length,
        correctionRate: this.detectCorrections(events).length / Math.max(events.filter(e => e.type === 'user').length, 1),
      },
    };
  }
}
