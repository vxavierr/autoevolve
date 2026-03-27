// src/dashboard/public/app.js
(async function () {
  const $ = (sel) => document.querySelector(sel);

  async function fetchJson(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return res.json();
    } catch { return null; }
  }

  function trendArrow(trend) {
    if (trend === 'improving') return '<span class="trend-improving">&#9650; improving</span>';
    if (trend === 'worsening') return '<span class="trend-worsening">&#9660; worsening</span>';
    if (trend === 'stable') return '<span class="trend-stable">&#8212; stable</span>';
    return '<span class="trend-stable">? unknown</span>';
  }

  function severityIcon(sev) {
    if (sev === 'critical') return '<span class="severity-critical">&#x1F534;</span>';
    if (sev === 'high') return '<span class="severity-high">&#x1F7E0;</span>';
    if (sev === 'medium') return '<span class="severity-medium">&#x1F7E1;</span>';
    return '<span class="severity-low">&#x26AA;</span>';
  }

  async function renderProjects() {
    const data = await fetchJson('/api/projects');
    const el = $('#projects-content');
    if (!data?.projects?.length) { el.innerHTML = '<p class="empty">No projects discovered. Run autoevolve scan.</p>'; return; }
    el.innerHTML = data.projects.map(p => {
      const flags = [p.hasTests && 'tests', p.hasClaudeMd && 'claude', p.hasAiosCore && 'aiox'].filter(Boolean);
      return `<div class="project-item"><strong>${p.name}</strong> <span class="stat-label">[${flags.join(', ')}]</span></div>`;
    }).join('');
  }

  async function renderEvolution() {
    const rules = await fetchJson('/api/rules');
    const cost = await fetchJson('/api/cost');
    const el = $('#evolution-content');

    const localCount = rules?.local?.length ?? 0;
    const globalCount = rules?.global?.length ?? 0;
    const totalCost = cost?.total_cost?.toFixed(4) ?? '0';
    const savings = cost?.hardcoded_savings?.toFixed(4) ?? '0';
    const hardcoded = cost?.hardcoded_iterations ?? 0;
    const total = cost?.total_iterations ?? 0;
    const codeRatio = total > 0 ? Math.round((hardcoded / total) * 100) : 0;

    el.innerHTML = `
      <div class="stat"><span class="stat-label">Local rules</span><span class="stat-value">${localCount}</span></div>
      <div class="stat"><span class="stat-label">Global rules</span><span class="stat-value">${globalCount}</span></div>
      <div class="stat"><span class="stat-label">Code ratio</span><span class="stat-value">${codeRatio}%</span></div>
      <div class="stat"><span class="stat-label">Total cost</span><span class="stat-value">$${totalCost}</span></div>
      <div class="stat"><span class="stat-label">Saved (hardcoded)</span><span class="stat-value trend-improving">$${savings}</span></div>
      <div class="stat"><span class="stat-label">Iterations</span><span class="stat-value">${total} (${hardcoded} hardcoded)</span></div>
    `;
  }

  async function renderBehavior() {
    const data = await fetchJson('/api/behavior');
    const el = $('#behavior-content');
    if (!data?.total_sessions_processed) { el.innerHTML = '<p class="empty">No behavior data yet. Run /autoevolve predict.</p>'; return; }

    const msgs = data.total_user_messages || 1;
    const corrCount = Object.values(data.patterns?.corrections ?? {}).reduce((s, c) => s + c.count, 0);
    const frustCount = Object.values(data.patterns?.frustrations ?? {}).reduce((s, f) => s + f.count, 0);
    const apprCount = data.patterns?.approvals?.total ?? 0;

    // Simple trend from snapshots
    const snapshots = data.weekly_snapshots ?? [];
    let corrTrend = 'unknown', frustTrend = 'unknown';
    if (snapshots.length >= 2) {
      const last = snapshots[snapshots.length - 1];
      const prev = snapshots[snapshots.length - 2];
      corrTrend = last.correction_rate < prev.correction_rate ? 'improving' : last.correction_rate > prev.correction_rate ? 'worsening' : 'stable';
      frustTrend = (last.frustration_rate ?? 0) < (prev.frustration_rate ?? 0) ? 'improving' : 'stable';
    }

    el.innerHTML = `
      <div class="stat"><span class="stat-label">Sessions</span><span class="stat-value">${data.total_sessions_processed}</span></div>
      <div class="stat"><span class="stat-label">Messages</span><span class="stat-value">${msgs.toLocaleString()}</span></div>
      <div class="stat"><span class="stat-label">Corrections</span><span class="stat-value">${corrCount} (${(corrCount/msgs*100).toFixed(2)}%)</span></div>
      <div class="stat"><span class="stat-label">Frustrations</span><span class="stat-value">${frustCount} (${(frustCount/msgs*100).toFixed(2)}%)</span></div>
      <div class="stat"><span class="stat-label">Approvals</span><span class="stat-value">${apprCount}</span></div>
      <div class="stat"><span class="stat-label">Correction trend</span>${trendArrow(corrTrend)}</div>
      <div class="stat"><span class="stat-label">Frustration trend</span>${trendArrow(frustTrend)}</div>
    `;
  }

  async function renderPredictions() {
    const data = await fetchJson('/api/predictions');
    const el = $('#predictions-content');
    if (!data?.length) { el.innerHTML = '<p class="empty">No predictions yet. Run /autoevolve predict --simulate "goal".</p>'; return; }

    const latest = data[0];
    el.innerHTML = `
      <div class="stat"><span class="stat-label">Last goal</span><span class="stat-value">${latest.goal}</span></div>
      <div class="stat"><span class="stat-label">Risk score</span><span class="stat-value">${(latest.risk_score * 100).toFixed(0)}%</span></div>
      <div style="margin-top:0.5rem">
        ${latest.scenarios.map(s => `<div style="padding:0.2rem 0">${severityIcon(s.severity)} [${(s.probability*100).toFixed(0)}%] ${s.description}</div>`).join('')}
      </div>
      ${latest.recommended_guardrails?.length ? `<div style="margin-top:0.5rem;color:var(--yellow)">Guardrails pending: ${latest.recommended_guardrails.length}</div>` : ''}
    `;
  }

  async function renderRuns() {
    const data = await fetchJson('/api/runs');
    const el = $('#runs-content');
    if (!data?.length) { el.innerHTML = '<p class="empty">No runs yet.</p>'; return; }

    const header = '<div class="run-row run-header"><span>Date</span><span>Domain</span><span>Result</span><span>Goal</span><span>Cost</span></div>';
    const rows = data.slice(0, 15).map(r => {
      const date = r.timestamp ? new Date(r.timestamp).toLocaleString() : '—';
      const result = r.kept != null ? `+${r.kept} kept, ${r.reverted ?? 0} rev` : '—';
      const cost = r.cost_usd ? `$${r.cost_usd.toFixed(3)}` : '—';
      return `<div class="run-row"><span>${date}</span><span>${r.domain ?? '—'}</span><span>${result}</span><span>${(r.goal ?? '').slice(0, 50)}</span><span>${cost}</span></div>`;
    }).join('');

    el.innerHTML = header + rows;
  }

  async function refresh() {
    await Promise.all([renderProjects(), renderEvolution(), renderBehavior(), renderPredictions(), renderRuns()]);
    $('#last-updated').textContent = `Updated: ${new Date().toLocaleTimeString()}`;
  }

  // Initial load
  await refresh();

  // Auto-refresh every 30s
  setInterval(refresh, 30000);

  // Manual refresh button
  $('#refresh-btn').addEventListener('click', refresh);
})();
