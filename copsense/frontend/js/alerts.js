/**
 * Smart Alert Center — role-filtered, case assignment, acknowledge/resolve.
 */
const AlertsPage = {
  async render() {
    const content = document.getElementById('page-content');
    const role    = Auth.role();

    try {
      const alerts = await Api.getAlerts();

      const open      = alerts.filter(a => a.status === 'open').length;
      const ack       = alerts.filter(a => a.status === 'acknowledged').length;
      const resolved  = alerts.filter(a => a.status === 'resolved').length;
      const critical  = alerts.filter(a => a.severity === 'critical').length;

      content.innerHTML = `
        <div class="page-header">
          <div><h2>Smart Alert Center</h2>
          <p>System alerts — case assignments, custody, duty violations, and feedback</p></div>
          <button class="btn btn-secondary btn-sm" onclick="AlertsPage.render()">🔄 Refresh</button>
        </div>

        <!-- Stats -->
        <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px;">
          ${[
            { label:'Open',     value: open,     color:'var(--red)' },
            { label:'Acknowledged', value: ack,  color:'var(--orange)' },
            { label:'Resolved', value: resolved,  color:'var(--green)' },
            { label:'Critical', value: critical,  color:'var(--risk-critical)' },
          ].map(s => `
            <div class="stat-card" style="--accent-color:${s.color}">
              <div class="stat-value">${s.value}</div>
              <div class="stat-label">${s.label}</div>
            </div>`).join('')}
        </div>

        <!-- Smart Case Assignment (SSP / Station Officer) -->
        ${['ssp','station_officer'].includes(role) ? `
        <div class="card" style="margin-bottom:20px;">
          <div class="card-header">
            <div class="card-title">🤖 Smart Case Assignment</div>
          </div>
          <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">
            Auto-assign FIRs/Complaints to the most capable available officer based on specialization, workload, and availability.
          </p>
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <div class="form-group" style="flex:1;min-width:150px;">
              <label>Case Type</label>
              <select id="assign-case-type" class="form-control">
                <option value="fir">FIR</option>
                <option value="complaint">Complaint</option>
              </select>
            </div>
            <div class="form-group" style="flex:1;min-width:150px;">
              <label>Case ID</label>
              <input type="number" id="assign-case-id" class="form-control" placeholder="Case ID">
            </div>
            <div style="padding-top:24px;">
              <button class="btn btn-primary" onclick="AlertsPage.smartAssign()">🤖 Auto-Assign</button>
            </div>
          </div>
          <div id="assign-result" style="margin-top:12px;"></div>
        </div>` : ''}

        <!-- Alerts Table -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">🔔 All Alerts</div>
          </div>
          ${alerts.length === 0 ? Util.emptyState('✅','No alerts — system is all clear') : `
          <div style="display:flex;flex-direction:column;gap:10px;">
            ${alerts.map(a => `
              <div style="padding:16px;background:var(--bg-card2);border-radius:${`var(--radius-sm)`};
                border:1px solid var(--border);border-left:4px solid ${
                  a.severity === 'critical' ? '#ff0055' :
                  a.severity === 'high'     ? 'var(--red)' :
                  a.severity === 'medium'   ? 'var(--orange)' : 'var(--green)'
                };">
                <div style="display:flex;align-items:flex-start;gap:12px;">
                  <span style="font-size:24px;">${
                    (a.alert_type || '') === 'custody'       ? '🔒' :
                    (a.alert_type || '') === 'duty_violation'? '📍' :
                    (a.alert_type || '') === 'feedback'      ? '💬' :
                    (a.alert_type || '') === 'case'          ? '📋' : '🔔'
                  }</span>
                  <div style="flex:1;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
                      ${Util.severityBadge(a.severity || 'medium')}
                      <span class="badge badge-medium">${(a.alert_type || 'system').replace('_',' ')}</span>
                      ${Util.statusBadge(a.status || 'open')}
                    </div>
                    <p style="font-size:14px;margin-bottom:6px;">${a.message || 'No message contents'}</p>
                    <p style="font-size:11px;color:var(--text-muted);">${Util.formatDate(a.created_at)}</p>
                  </div>
                  <div style="display:flex;gap:6px;flex-shrink:0;">
                    ${a.status === 'open' ? `
                      <button class="btn btn-warning btn-sm" onclick="AlertsPage.acknowledge(${a.id})">✓ Acknowledge</button>` : ''}
                    ${['ssp','station_officer'].includes(role) && a.status !== 'resolved' ? `
                      <button class="btn btn-success btn-sm" onclick="AlertsPage.resolve(${a.id})">✅ Resolve</button>` : ''}
                  </div>
                </div>
              </div>`).join('')}
          </div>`}
        </div>
      `;
    } catch(err) {
      content.innerHTML = `<div class="alert-banner alert-error">❌ ${err.message}</div>`;
    }
  },

  async smartAssign() {
    const type = document.getElementById('assign-case-type').value;
    const id   = parseInt(document.getElementById('assign-case-id').value);
    const el   = document.getElementById('assign-result');

    if (!id) { el.innerHTML = '<div class="alert-banner alert-warning">⚠️ Enter a valid Case ID</div>'; return; }
    el.innerHTML = '<div class="loading-overlay" style="padding:20px;"><div class="spinner-lg"></div></div>';

    try {
      const result = await Api.assignCase(type, id);
      el.innerHTML = `
        <div class="alert-banner alert-success">
          ✅ Case assigned to <strong>${result.assigned_officer}</strong>
          (Badge: ${result.badge_id || '—'}, Specialization: ${result.specialization || 'general'})
          — Severity: ${Util.severityBadge(result.severity)}
        </div>`;
      Toast.success('Case Assigned', `Assigned to ${result.assigned_officer}`);
    } catch(err) {
      el.innerHTML = `<div class="alert-banner alert-error">❌ ${err.message}</div>`;
    }
  },

  async acknowledge(id) {
    try {
      await Api.acknowledgeAlert(id);
      Toast.info('Alert Acknowledged','You have acknowledged this alert');
      this.render();
    } catch(err) { Toast.error('Error', err.message); }
  },

  async resolve(id) {
    try {
      await Api.resolveAlert(id);
      Toast.success('Alert Resolved','Alert marked as resolved');
      this.render();
    } catch(err) { Toast.error('Error', err.message); }
  }
};
