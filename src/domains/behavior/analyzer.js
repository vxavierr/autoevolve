// src/domains/behavior/analyzer.js
// Signals that indicate user is correcting Claude's approach
// Tuned to avoid false positives from system messages (task-notification, etc.)
const CORRECTION_SIGNALS = [
  /\bno[, ]+not\b/i,
  /\bnot that\b/i,
  /\bI meant\b/i,
  /\bwrong\b/i,
  /\bstop doing\b/i,
  /\bdon'?t do\b/i,
  /\bundo\b/i,
  /\brevert\b/i,
  /\bactually[, ]I\b/i,
  /\bnão era isso\b/i,    // pt-br
  /\bnão[, ]+não\b/i,     // pt-br
  /\bpara com isso\b/i,   // pt-br
  /\berrado\b/i,           // pt-br
  /\bmuda isso\b/i,        // pt-br
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

      // Skip system/task notifications (not real user input)
      if (curr.content.includes('<task-notification>') || curr.content.includes('<command-name>')) continue;
      // Skip very long messages (likely agent prompts, not corrections)
      if (curr.content.length > 500) continue;

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

      // Skip system messages
      if (curr.content.includes('<task-notification>') || curr.content.includes('<command-name>')) continue;

      // Short user message after long assistant output
      // BUT exclude approval signals (those are positive, not frustration)
      if (prev.content.length > 300 && curr.content.length < 20) {
        const isApproval = APPROVAL_SIGNALS.some(r => r.test(curr.content));
        const isChoice = /^\d+$/.test(curr.content.trim()); // "1", "2", "3" = choosing option
        if (!isApproval && !isChoice) {
          patterns.push({
            type: 'frustration',
            userMessage: curr.content,
            assistantOutputLength: prev.content.length,
            timestamp: curr.timestamp,
          });
        }
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
