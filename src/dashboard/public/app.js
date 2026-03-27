// src/dashboard/public/app.js
// autoevolve dashboard — data pipeline preserved, visual layer rewritten
(async function () {
  const $ = (sel) => document.querySelector(sel);

  // ─── Helpers ─────────────────────────────────────────────

  async function fetchJson(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return res.json();
    } catch { return null; }
  }

  function trendArrow(trend) {
    if (trend === 'improving') return '<span class="trend-improving">&#9650; melhorando</span>';
    if (trend === 'worsening') return '<span class="trend-worsening">&#9660; piorando</span>';
    if (trend === 'stable')    return '<span class="trend-stable">&#8212; estavel</span>';
    return '<span class="trend-stable">? desconhecido</span>';
  }

  function severityIcon(sev) {
    if (sev === 'critical') return '<span class="severity-badge severity-critical">&#9679; critical</span>';
    if (sev === 'high')     return '<span class="severity-badge severity-high">&#9679; high</span>';
    if (sev === 'medium')   return '<span class="severity-badge severity-medium">&#9679; medium</span>';
    return '<span class="severity-badge severity-low">&#9675; low</span>';
  }

  function riskClass(score) {
    if (score >= 0.75) return 'risk-critical';
    if (score >= 0.5)  return 'risk-high';
    if (score >= 0.25) return 'risk-medium';
    return 'risk-low';
  }

  // Animated number counter
  function animateCount(el, target, prefix = '', suffix = '', decimals = 0) {
    const duration = 700;
    const start = performance.now();
    const from = 0;
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
      const val = from + (target - from) * ease;
      el.textContent = prefix + val.toFixed(decimals) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ─── Projects ──────────────────────────────────────────────

  async function renderProjects() {
    const data = await fetchJson('/api/projects');
    const el = $('#projects-content');
    const badge = $('#projects-count');

    if (!data?.projects?.length) {
      el.innerHTML = '<p class="empty-state">Nenhum projeto descoberto. Rode autoevolve scan.</p>';
      return;
    }

    if (badge) badge.textContent = data.projects.length;

    el.innerHTML = `<div class="projects-list">${
      data.projects.map(p => {
        const flags = [
          p.hasTests     && `<span class="flag-chip flag-tests">tests</span>`,
          p.hasClaudeMd  && `<span class="flag-chip flag-claude">claude</span>`,
          p.hasAiosCore  && `<span class="flag-chip flag-aiox">aiox</span>`
        ].filter(Boolean);
        return `
          <div class="project-item">
            <span class="project-name">${p.name}</span>
            <span class="project-flags">${flags.join('')}</span>
          </div>`;
      }).join('')
    }</div>`;
  }

  // ─── Evolution ─────────────────────────────────────────────

  async function renderEvolution() {
    const [rules, cost] = await Promise.all([fetchJson('/api/rules'), fetchJson('/api/cost')]);
    const el = $('#evolution-content');

    const localCount  = rules?.local?.length ?? 0;
    const globalCount = rules?.global?.length ?? 0;
    const totalCost   = cost?.total_cost ?? 0;
    const savings     = cost?.hardcoded_savings ?? 0;
    const hardcoded   = cost?.hardcoded_iterations ?? 0;
    const total       = cost?.total_iterations ?? 0;
    const codeRatio   = total > 0 ? Math.round((hardcoded / total) * 100) : 0;

    el.innerHTML = `
      <div class="evolution-metrics">
        <div class="evo-metric">
          <div class="evo-metric-label">Regras locais</div>
          <div class="evo-metric-value evo-metric-value--accent" id="evo-local">0</div>
          <div class="evo-metric-sub">escopo do projeto</div>
        </div>
        <div class="evo-metric">
          <div class="evo-metric-label">Regras globais</div>
          <div class="evo-metric-value" id="evo-global">0</div>
          <div class="evo-metric-sub">todo o workspace</div>
        </div>
        <div class="evo-metric">
          <div class="evo-metric-label">Razao codigo</div>
          <div class="evo-metric-value evo-metric-value--accent" id="evo-ratio">0%</div>
          <div class="code-ratio-bar">
            <div class="code-ratio-fill" id="ratio-fill" style="width:0%"></div>
          </div>
        </div>
        <div class="evo-metric">
          <div class="evo-metric-label">Iteracoes</div>
          <div class="evo-metric-value" id="evo-total">0</div>
          <div class="evo-metric-sub"><span id="evo-hardcoded">0</span> hardcoded</div>
        </div>
        <div class="evo-metric">
          <div class="evo-metric-label">Custo economizado</div>
          <div class="evo-metric-value evo-metric-value--savings" id="evo-savings">$0</div>
          <div class="evo-metric-sub">por regras hardcoded</div>
        </div>
        <div class="evo-metric">
          <div class="evo-metric-label">Custo total</div>
          <div class="evo-metric-value evo-metric-value--cost" id="evo-cost">$0</div>
          <div class="evo-metric-sub">gasto com LLM</div>
        </div>
      </div>`;

    // Animate numbers after render
    requestAnimationFrame(() => {
      animateCount($('#evo-local'),     localCount);
      animateCount($('#evo-global'),    globalCount);
      animateCount($('#evo-total'),     total);
      animateCount($('#evo-hardcoded'), hardcoded);
      // Ratio with % suffix
      const ratioEl = $('#evo-ratio');
      animateCount(ratioEl, codeRatio, '', '%');
      // Cost values
      const savingsEl = $('#evo-savings');
      animateCount(savingsEl, savings, '$', '', 4);
      const costEl = $('#evo-cost');
      animateCount(costEl, totalCost, '$', '', 4);
      // Bar fill
      setTimeout(() => {
        const fill = $('#ratio-fill');
        if (fill) fill.style.width = codeRatio + '%';
      }, 80);
    });
  }

  // ─── Behavior ──────────────────────────────────────────────

  async function renderBehavior() {
    const data = await fetchJson('/api/behavior');
    const el = $('#behavior-content');

    if (!data?.total_sessions_processed) {
      el.innerHTML = '<p class="empty-state">Sem dados de comportamento ainda. Rode /autoevolve predict.</p>';
      return;
    }

    const msgs      = data.total_user_messages || 1;
    const corrCount = Object.values(data.patterns?.corrections ?? {}).reduce((s, c) => s + c.count, 0);
    const frustCount= Object.values(data.patterns?.frustrations ?? {}).reduce((s, f) => s + f.count, 0);
    const apprCount = data.patterns?.approvals?.total ?? 0;

    // Trends from weekly snapshots
    const snapshots  = data.weekly_snapshots ?? [];
    let corrTrend = 'unknown', frustTrend = 'unknown';
    if (snapshots.length >= 2) {
      const last = snapshots[snapshots.length - 1];
      const prev = snapshots[snapshots.length - 2];
      corrTrend  = last.correction_rate < prev.correction_rate ? 'improving'
                 : last.correction_rate > prev.correction_rate ? 'worsening' : 'stable';
      frustTrend = (last.frustration_rate ?? 0) < (prev.frustration_rate ?? 0) ? 'improving' : 'stable';
    }

    const corrPct  = ((corrCount / msgs) * 100).toFixed(1);
    const frustPct = ((frustCount / msgs) * 100).toFixed(1);

    el.innerHTML = `
      <div class="behavior-grid">
        <div class="beh-metric">
          <div class="beh-metric-value" id="beh-sessions">${data.total_sessions_processed.toLocaleString()}</div>
          <div class="beh-metric-label">sessoes</div>
        </div>
        <div class="beh-metric">
          <div class="beh-metric-value" id="beh-msgs">${msgs.toLocaleString()}</div>
          <div class="beh-metric-label">mensagens</div>
        </div>
        <div class="beh-metric">
          <div class="beh-metric-value" id="beh-corr">${corrCount}</div>
          <div class="beh-metric-label">correcoes</div>
          <div class="beh-metric-pct">${corrPct}% das msgs</div>
        </div>
        <div class="beh-metric">
          <div class="beh-metric-value" id="beh-appr">${apprCount}</div>
          <div class="beh-metric-label">aprovacoes</div>
        </div>
      </div>
      <div class="beh-trends">
        <div class="beh-trend-row">
          <span class="beh-trend-label">Tendencia de correcao</span>
          ${trendArrow(corrTrend)}
        </div>
        <div class="beh-trend-row">
          <span class="beh-trend-label">Tendencia de frustracao</span>
          ${trendArrow(frustTrend)}
        </div>
        <div class="beh-trend-row">
          <span class="beh-trend-label">Frustracoes</span>
          <span class="stat-value">${frustCount} <span class="beh-metric-pct">(${frustPct}%)</span></span>
        </div>
      </div>`;
  }

  // ─── Predictions ───────────────────────────────────────────

  async function renderPredictions() {
    const data = await fetchJson('/api/predictions');
    const el = $('#predictions-content');

    if (!data?.length) {
      el.innerHTML = '<p class="empty-state">Sem predicoes ainda. Rode /autoevolve predict --simulate "objetivo".</p>';
      return;
    }

    const latest  = data[0];
    const score   = latest.risk_score ?? 0;
    const pct     = Math.round(score * 100);
    const rc      = riskClass(score);
    const riskLabel = rc.replace('risk-', '').toUpperCase();

    const scenariosHtml = (latest.scenarios ?? []).map(s => `
      <div class="scenario-row">
        ${severityIcon(s.severity)}
        <span style="flex:1">${s.description}</span>
        <span class="scenario-prob">${(s.probability * 100).toFixed(0)}%</span>
      </div>`).join('');

    const guardrailsHtml = latest.recommended_guardrails?.length
      ? `<div class="guardrails-tag">
           <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
             <path d="M5.5 1L10 9.5H1L5.5 1Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
             <line x1="5.5" y1="4" x2="5.5" y2="7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
             <circle cx="5.5" cy="8.5" r="0.6" fill="currentColor"/>
           </svg>
           ${latest.recommended_guardrails.length} guardrail${latest.recommended_guardrails.length > 1 ? 's' : ''} pendente${latest.recommended_guardrails.length > 1 ? 's' : ''}
         </div>`
      : '';

    el.innerHTML = `
      <div class="predictions-content">
        <div>
          <div class="risk-label">nivel de risco &mdash; ${riskLabel}</div>
          <div class="risk-score-wrap">
            <span class="risk-score-big ${rc}" id="pred-score">0%</span>
          </div>
          <div class="risk-bar">
            <div class="risk-bar-fill ${rc}" id="risk-fill" style="width:0%"></div>
          </div>
        </div>
        <div class="stat">
          <span class="stat-label">objetivo</span>
          <span class="stat-value" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${latest.goal}</span>
        </div>
        <div class="scenarios-list">${scenariosHtml}</div>
        ${guardrailsHtml}
      </div>`;

    // Animate risk score
    requestAnimationFrame(() => {
      const scoreEl = $('#pred-score');
      if (scoreEl) animateCount(scoreEl, pct, '', '%');
      setTimeout(() => {
        const fill = $('#risk-fill');
        if (fill) fill.style.width = pct + '%';
      }, 80);
    });
  }

  // ─── Runs ──────────────────────────────────────────────────

  async function renderRuns() {
    const data = await fetchJson('/api/runs');
    const el = $('#runs-content');

    if (!data?.length) {
      el.innerHTML = '<div style="padding:16px 20px"><p class="empty-state">Sem execucoes ainda.</p></div>';
      return;
    }

    const rows = data.slice(0, 15).map(r => {
      const date   = r.timestamp ? new Date(r.timestamp).toLocaleString('pt-BR', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
      const result = r.kept != null ? `+${r.kept} kept, ${r.reverted ?? 0} rev` : '—';
      const cost   = r.cost_usd ? `$${r.cost_usd.toFixed(3)}` : '—';
      const goal   = (r.goal ?? '').slice(0, 55);
      const domain = r.domain ?? '—';

      return `<tr>
        <td class="run-date">${date}</td>
        <td><span class="run-domain">${domain}</span></td>
        <td class="run-result">${result}</td>
        <td class="run-goal">${goal}</td>
        <td class="run-cost">${cost}</td>
      </tr>`;
    }).join('');

    el.innerHTML = `
      <table class="runs-table">
        <thead>
          <tr>
            <th>data</th>
            <th>dominio</th>
            <th>resultado</th>
            <th>objetivo</th>
            <th>custo</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  // ─── Orchestration ─────────────────────────────────────────

  async function refresh() {
    const btn = $('#refresh-btn');
    if (btn) btn.classList.add('spinning');

    await Promise.all([
      renderProjects(),
      renderEvolution(),
      renderBehavior(),
      renderPredictions(),
      renderRuns()
    ]);

    const ts = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    $('#last-updated').textContent = `atualizado ${ts}`;

    if (btn) btn.classList.remove('spinning');
  }

  // Initial load
  await refresh();

  // Auto-refresh every 30s
  setInterval(refresh, 30000);

  // Manual refresh button
  $('#refresh-btn').addEventListener('click', refresh);
})();
