/**
 * Premium Dashboard — Real-time Command Center.
 * Featuring glassmorphism, animated widgets, and live status feeds.
 */
const Dashboard = {
  _clockInterval: null,

  async render() {
    const content = document.getElementById('page-content');
    const user    = Auth.user();
    
    // Clear any existing clock intervals to prevent memory leaks
    if (this._clockInterval) clearInterval(this._clockInterval);

    try {
      const stats = await Api.dashboardStats();
      const role = user.role;

      content.innerHTML = `
        <div class="animate-in">
          ${Dashboard._header(user)}
          
          <div class="stats-grid">
            ${Dashboard._statsGrid(stats, role)}
          </div>

          <div class="db-main-grid">
            <!-- Left Column: Primary Analytics -->
            <div class="db-left-col">
              <div class="card animate-in delay-2">
                <div class="card-header">
                  <div class="card-title">📊 Detailed FIR Progress</div>
                  ${role === 'ssp' ? '<span class="badge badge-info">Global View</span>' : ''}
                </div>
                <div id="fir-chart-area">
                  ${Dashboard._firAnalytics(stats)}
                </div>
              </div>

              <div class="card animate-in delay-2" style="margin-top:24px;">
                <div class="card-header">
                  <div class="card-title">📁 Strategic Case Priorities</div>
                  <button class="btn btn-secondary btn-sm" onclick="Router.navigate('cases')">Manage Cases</button>
                </div>
                <div id="case-priority-area">
                  ${Dashboard._caseAnalytics(stats)}
                </div>
              </div>

              <div class="card animate-in delay-3" style="margin-top:24px;">
                <div class="card-header">
                  <div class="card-title">⚡ Quick Actions Center</div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(180px, 1fr));gap:12px;">
                  ${Dashboard._quickActions(role)}
                </div>
              </div>
            </div>

            <!-- Right Column: Live Feeds & Personnel -->
            <div class="db-right-col">
              <div class="card animate-in delay-2">
                <div class="card-header">
                  <div class="card-title">👮 Personnel Status</div>
                </div>
                ${Dashboard._personnelWidget(stats)}
              </div>

              <div class="card animate-in delay-4" style="margin-top:24px;">
                <div class="card-header">
                  <div class="card-title">📍 Patrol Compliance</div>
                </div>
                ${Dashboard._patrolCompliance(stats)}
              </div>

              <div class="card animate-in delay-5" style="margin-top:24px;">
                <div class="card-header">
                  <div class="card-title">🔔 Live Alert Stream</div>
                  <button class="btn btn-secondary btn-sm" onclick="Router.navigate('alerts')">Review All</button>
                </div>
                <div id="dashboard-alert-feed" class="activity-feed-premium">
                  <div class="loading-overlay"><div class="spinner-lg"></div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      // Initialize live elements
      Dashboard._initClock();
      Dashboard._loadLiveFeed();

    } catch (err) {
      console.error(err);
      content.innerHTML = `<div class="alert-banner alert-error">❌ System Error: ${err.message}</div>`;
    }
  },

  _header(user) {
    const roles = {
      ssp: { label: 'District Head (SSP)', icon: '🏛️', color: 'var(--ssp-color)' },
      station_officer: { label: 'Station Officer', icon: '🚔', color: 'var(--so-color)' },
      field_officer: { label: 'Field Officer', icon: '👮', color: 'var(--fo-color)' },
      citizen: { label: 'Citizen', icon: '👤', color: 'var(--citizen-color)' }
    };
    const r = roles[user.role] || roles.citizen;

    return `
      <div class="dashboard-header-premium animate-in">
        <div>
          <div class="db-role-indicator" style="color:${r.color}">
            <div class="indicator-glow"></div>
            ${r.icon} ${r.label}
          </div>
          <h2 style="margin-top:12px;font-size:28px;">Good Day, ${user.name.split(' ')[0]}</h2>
          <div class="system-status-indicator">
            <div class="status-dot-pulse"></div>
            <span>System Online: Node-Bihar-Primary (v2.4.0)</span>
          </div>
        </div>
        <div class="live-clock-widget">
          <div class="live-clock-time" id="db-live-clock">--:--:--</div>
          <div class="live-clock-date" id="db-live-date">---, -- ----</div>
        </div>
      </div>`;
  },

  _statsGrid(stats, role) {
    if (role === 'citizen') return '';

    const defs = [
      { label: 'Strategic Cases', value: stats.strategic_cases?.total || 0, icon: '📁', color: 'var(--accent)', trend: 'Investigation', sub: `${stats.strategic_cases?.high || 0} sensitive` },
      { label: 'Active Alerts', value: stats.open_alerts, icon: '🔔', color: 'var(--orange)', trend: 'Real-time', sub: 'Monitoring active' },
      { label: 'Deployment', value: stats.active_deployments, icon: '🚀', color: 'var(--purple)', trend: 'Active units', sub: 'Event management' },
      { label: 'In Custody', value: stats.custody_records, icon: '🔒', color: 'var(--red)', trend: 'Secured', sub: 'Log updated' }
    ];

    return defs.map((s, i) => `
      <div class="stat-card-premium animate-in delay-${i+1}" style="--accent-color:${s.color}">
        <div class="stat-bg-icon">${s.icon}</div>
        <div class="stat-label-sub">
          <span style="color:${s.color}">${s.icon}</span> ${s.label}
        </div>
        <div class="stat-value-big">${s.value ?? 0}</div>
        <div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">
          ${s.trend} <span style="margin-left:8px;color:var(--text-secondary)">${s.sub}</span>
        </div>
        <div class="stat-progress-mini">
          <div class="stat-progress-fill" style="width: ${Math.min(100, (s.value||0)*10)}%"></div>
        </div>
      </div>
    `).join('');
  },

  _firAnalytics(stats) {
    const f = stats.fir_progress || { total:1, open:0, investigating:0, closed:0 };
    const total = f.total || 1;
    const items = [
      { label: 'Open Cases', val: f.open, color: 'var(--red)', icon: '🔴' },
      { label: 'Under Investigation', val: f.investigating, color: 'var(--orange)', icon: '🟠' },
      { label: 'Resolved/Closed', val: f.closed, color: 'var(--green)', icon: '🟢' }
    ];

    return `
      <div style="padding:10px 0;">
        <div style="display:grid;grid-template-columns:1fr;gap:16px;margin-bottom:24px;">
          ${items.map(it => {
            const pct = Math.round((it.val / total) * 100);
            return `
              <div>
                <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;">
                  <span style="font-weight:600;color:var(--text-secondary)">${it.icon} ${it.label}</span>
                  <span style="font-weight:700;font-family:'JetBrains Mono'">${it.val} (${pct}%)</span>
                </div>
                <div style="height:10px;background:var(--bg-primary);border-radius:5px;overflow:hidden;border:1px solid var(--border);">
                  <div style="height:100%;width:${pct}%;background:${it.color};transition:width 1s ease;"></div>
                </div>
              </div>`;
          }).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-card2);padding:14px;border-radius:8px;border:1px solid var(--border);">
          <div style="font-size:13px;color:var(--text-secondary)">Overall Efficiency: <strong style="color:var(--green)">${Math.round((f.closed/total)*100)}%</strong></div>
          <div style="font-size:13px;color:var(--text-primary)">Total: <strong>${f.total} FIRs</strong></div>
        </div>
      </div>
    `;
  },

  _caseAnalytics(stats) {
    const s = stats.strategic_cases || { total:1, high:0, medium:0, low:0, closed:0 };
    const total = s.total || 1;
    const items = [
      { label: 'High Priority (Sensitive)', val: s.high, color: 'var(--red)', icon: '🔴' },
      { label: 'Medium Priority', val: s.medium, color: 'var(--orange)', icon: '🟠' },
      { label: 'Low Priority', val: s.low, color: 'var(--blue)', icon: '🔵' }
    ];

    return `
      <div style="padding:10px 0;">
        <div style="display:grid;grid-template-columns:1fr;gap:12px;margin-bottom:20px;">
          ${items.map(it => {
            const pct = Math.round((it.val / total) * 100);
            return `
              <div style="display:flex;align-items:center;gap:12px;">
                <div style="width:40px;text-align:center;font-size:18px;">${it.icon}</div>
                <div style="flex:1">
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px;font-weight:600;">
                    <span>${it.label}</span>
                    <span>${it.val}</span>
                  </div>
                  <div style="height:6px;background:var(--bg-primary);border-radius:3px;overflow:hidden;">
                    <div style="height:100%;width:${pct}%;background:${it.color};"></div>
                  </div>
                </div>
              </div>`;
          }).join('')}
        </div>
        <div style="background:var(--bg-primary);padding:12px;border-radius:8px;font-size:12px;display:flex;justify-content:space-between;">
           <span>Resolved Rate</span>
           <span style="font-weight:700;color:var(--green)">${Math.round((s.closed/total)*100)}%</span>
        </div>
      </div>
    `;
  },

  _personnelWidget(stats) {
    const total = stats.total_officers || 1;
    const availPct = Math.round((stats.available_officers / total) * 100);

    return `
      <div style="padding:5px 0;">
        <div style="display:flex;align-items:center;justify-content:center;height:120px;position:relative;margin-bottom:20px;">
          <svg viewBox="0 0 36 36" style="height:110px;width:110px;transform:rotate(-90deg);">
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--bg-primary)" stroke-width="3" />
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--green)" stroke-width="3" stroke-dasharray="${availPct}, 100" />
          </svg>
          <div style="position:absolute;text-align:center;">
            <div style="font-size:24px;font-weight:800;color:var(--text-primary);font-family:'JetBrains Mono'">${stats.available_officers}</div>
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">Ready</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;justify-content:space-between;font-size:13px;">
            <span style="color:var(--green)">● Available Units</span>
            <span style="font-weight:600;font-family:'JetBrains Mono';color:var(--text-primary);">${stats.available_officers}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px;">
            <span style="color:var(--orange)">● Active Operations</span>
            <span style="font-weight:600;font-family:'JetBrains Mono';color:var(--text-primary);">${stats.on_duty_officers}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px;padding-top:8px;border-top:1px solid var(--border);">
            <span style="color:var(--text-muted)">Total Force Strength</span>
            <span style="font-weight:700;color:var(--accent)">${stats.total_officers}</span>
          </div>
        </div>
      </div>
    `;
  },

  _patrolCompliance(stats) {
    const vo = stats.out_of_zone_officers || 0;
    const color = vo > 0 ? 'var(--red)' : 'var(--green)';

    return `
      <div style="padding:5px 0;">
        <div style="display:flex;align-items:center;gap:20px;margin-bottom:20px;">
          <div style="width:60px;height:60px;border-radius:12px;background:${vo > 0 ? 'rgba(220, 38, 38, 0.1)' : 'rgba(5, 150, 105, 0.1)'};display:flex;align-items:center;justify-content:center;font-size:24px;">
            ${vo > 0 ? '⚠️' : '✅'}
          </div>
          <div>
            <div style="font-size:20px;font-weight:800;color:${color}">${vo} Deviation${vo === 1 ? '' : 's'}</div>
            <div style="font-size:12px;color:var(--text-secondary)">Officers out of assigned zones</div>
          </div>
        </div>
        <div class="alert-banner ${vo > 0 ? 'alert-error' : 'alert-success'}" style="font-size:12px;margin:0;padding:10px;">
          ${vo > 0 ? 'Action Recommended: Review GPS Logs' : 'All active units are within assigned zones'}
        </div>
      </div>
    `;
  },

  _quickActions(role) {
    const all = {
      ssp: [
        { label: 'Intelligence Map', page: 'heatmap', icon: '🗺️' },
        { label: 'Deploy Forces', page: 'deployment', icon: '🚀' },
        { label: 'Emergency Center', page: 'emergency', icon: '🆘' },
        { label: 'System Alerts', page: 'alerts', icon: '🔔' },
      ],
      station_officer: [
        { label: 'Duty Roster', page: 'duty', icon: '📅' },
        { label: 'Register FIR', page: 'fir', icon: '📋' },
        { label: 'Custody Mgmt', page: 'custody', icon: '🔒' },
        { label: 'Citzen CRM', page: 'complaints', icon: '📢' },
      ],
      field_officer: [
        { label: 'Active Duties', page: 'duty', icon: '📍' },
        { label: 'Report Incident', page: 'alerts', icon: '📱' },
        { label: 'My Alerts', page: 'alerts', icon: '🔔' },
        { label: 'Profile', page: 'me', icon: '👮' },
      ],
      citizen: [
        { label: 'Submit Feedback', page: 'feedback', icon: '💬' },
        { label: 'Lodge Complaint', page: 'complaints', icon: '📢' },
      ]
    };

    return (all[role] || []).map(a => `
      <button class="btn btn-secondary" onclick="Router.navigate('${a.page}')" style="justify-content:flex-start;padding:16px;background:var(--bg-card2);border-radius:12px;border:1px solid var(--border);transition:all 0.2s;">
        <span style="font-size:18px;">${a.icon}</span>
        <span style="font-size:13px;font-weight:600;color:var(--text-primary)">${a.label}</span>
      </button>
    `).join('');
  },

  async _loadLiveFeed() {
    const el = document.getElementById('dashboard-alert-feed');
    if (!el) return;

    try {
      const alerts = await Api.getAlerts();
      if (!alerts || alerts.length === 0) {
        el.innerHTML = Util.emptyState('✨', 'Status Clear: No Active Alerts');
        return;
      }

      const recent = alerts.slice(0, 4);
      el.innerHTML = recent.map(a => `
        <div class="feed-item-premium">
          <div class="feed-item-icon" style="background:${a.severity==='critical'?'rgba(255,77,109,0.15)':a.severity==='high'?'rgba(255,159,64,0.15)':'rgba(79,123,255,0.15)'};color:${a.severity==='critical'?'var(--red)':a.severity==='high'?'var(--orange)':'var(--accent)'}">
            ${a.severity === 'critical' ? '🔥' : a.severity === 'high' ? '⚠️' : 'ℹ️'}
          </div>
          <div class="feed-item-content">
            <div class="feed-item-title" style="font-size:13px;font-weight:600;">${a.message}</div>
            <div class="feed-item-meta">
              <span>${Util.formatDate(a.created_at)}</span>
              <span>•</span>
              ${Util.severityBadge(a.severity)}
            </div>
          </div>
        </div>
      `).join('');
    } catch(e) {
      el.innerHTML = `<p style="color:var(--text-muted);font-size:13px;padding:20px;">Stream synchronization failed</p>`;
    }
  },

  _initClock() {
    const update = () => {
      const now = new Date();
      const clock = document.getElementById('db-live-clock');
      const dateEl = document.getElementById('db-live-date');
      if (clock) clock.textContent = now.toLocaleTimeString('en-IN', { hour12: false });
      if (dateEl) dateEl.textContent = now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    };
    update();
    this._clockInterval = setInterval(update, 1000);
  }
};
