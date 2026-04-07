/**
 * Deployment & Event Planning Page
 * AI blueprint generation → officer assignment → duty notification.
 */
const DeploymentPage = {
  _blueprint: null,
  _deploymentId: null,
  _map: null,

  async render() {
    const content = document.getElementById('page-content');

    try {
      const deployments = await Api.getDeployments();

      content.innerHTML = `
        <div class="page-header">
          <div><h2>Event Deployment & AI Planning</h2>
          <p>Plan police deployment for events using AI blueprint generation</p></div>
          <button class="btn btn-primary btn-sm" onclick="DeploymentPage.openPlanModal()">🤖 Plan New Event</button>
        </div>

        <!-- Deployment Map for Active Deployments -->
        ${deployments.some(d => d.status === 'active') ? `
        <div class="card" style="margin-bottom:20px;padding:16px 16px 0 16px;">
          <div class="card-header"><div class="card-title">🗺️ Active Deployment Map</div></div>
          <div id="deployment-map-container" style="height:350px;border-radius:8px;overflow:hidden;margin-bottom:16px;"></div>
          <div class="map-legend" style="padding-bottom:16px;">
            <div class="legend-item"><div class="legend-dot" style="background:var(--orange);"></div> Active Event</div>
            <div class="legend-item"><div class="legend-dot" style="background:var(--green);"></div> Officer Zone</div>
          </div>
        </div>` : ''}

        <!-- Deployments Table -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">🚀 All Deployments</div>
          </div>
          ${deployments.length === 0 ? Util.emptyState('🚀','No deployments planned yet. Click "Plan New Event" to start.') : `
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th>Event</th><th>Location</th><th>Crowd</th><th>Risk</th>
                <th>Officers Req.</th><th>Status</th><th>Date</th><th>Actions</th>
              </tr></thead>
              <tbody>
                ${deployments.map(d => {
                  const blueprint = d.blueprint || {};
                  return `<tr>
                    <td><strong>${d.event_name}</strong></td>
                    <td class="td-muted">${d.location}</td>
                    <td>${d.crowd_size?.toLocaleString()}</td>
                    <td>${Util.severityBadge(d.risk_level)}</td>
                    <td><strong style="color:var(--accent)">${blueprint.total_officers_required || '—'}</strong></td>
                    <td>${Util.statusBadge(d.status)}</td>
                    <td class="td-muted">${d.event_date ? Util.formatDateOnly(d.event_date) : '—'}</td>
                    <td>
                      <div style="display:flex;gap:6px;">
                        <button class="btn btn-secondary btn-sm" onclick="DeploymentPage.viewBlueprint(${d.id})">
                          📋 Blueprint
                        </button>
                        ${d.status === 'planned' ? `
                          <button class="btn btn-primary btn-sm" onclick="DeploymentPage.openDeployModal(${d.id})">
                            🚀 Deploy
                          </button>` : ''}
                      </div>
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>`}
        </div>

        <!-- Blueprint Modal -->
        <div class="modal-overlay" id="blueprint-modal">
          <div class="modal" style="max-width:800px;">
            <div class="modal-header">
              <div class="modal-title">🤖 AI Deployment Blueprint</div>
              <button class="modal-close" onclick="DeploymentPage.closeModal('blueprint-modal')">✕</button>
            </div>
            <div id="blueprint-content"></div>
          </div>
        </div>

        <!-- Plan Event Modal -->
        <div class="modal-overlay" id="plan-modal">
          <div class="modal" style="max-width:640px;">
            <div class="modal-header">
              <div class="modal-title">🤖 Plan New Event</div>
              <button class="modal-close" onclick="DeploymentPage.closeModal('plan-modal')">✕</button>
            </div>
            <div id="plan-msg"></div>
            <form onsubmit="DeploymentPage.submitPlan(event)">
              <div class="form-row">
                <div class="form-group">
                  <label>Event Name <span class="required">*</span></label>
                  <input type="text" id="ev-name" class="form-control" placeholder="e.g. Chhath Puja 2024" required>
                </div>
                <div class="form-group">
                  <label>Location <span class="required">*</span></label>
                  <input type="text" id="ev-location" class="form-control" placeholder="e.g. Gandhi Maidan, Patna" required>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Expected Crowd Size <span class="required">*</span></label>
                  <input type="number" id="ev-crowd" class="form-control" placeholder="e.g. 50000" min="1" required>
                </div>
                <div class="form-group">
                  <label>Risk Level <span class="required">*</span></label>
                  <select id="ev-risk" class="form-control" required>
                    <option value="low">Low</option>
                    <option value="medium" selected>Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Duration (hours) <span class="required">*</span></label>
                  <input type="number" id="ev-duration" class="form-control" placeholder="e.g. 8" min="0.5" step="0.5" required>
                </div>
                <div class="form-group">
                  <label>Event Date</label>
                  <input type="datetime-local" id="ev-date" class="form-control">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Latitude (optional)</label>
                  <input type="number" step="any" id="ev-lat" class="form-control" placeholder="25.5941">
                </div>
                <div class="form-group">
                  <label>Longitude (optional)</label>
                  <input type="number" step="any" id="ev-lng" class="form-control" placeholder="85.1376">
                </div>
              </div>
              <div style="display:flex;gap:12px;">
                <button type="button" class="btn btn-secondary" style="flex:1" onclick="DeploymentPage.previewPlan()">
                  🔍 Preview Blueprint
                </button>
                <button type="submit" class="btn btn-primary" style="flex:1" id="plan-submit-btn">
                  💾 Save & Plan
                </button>
              </div>
            </form>
            <!-- Blueprint Preview -->
            <div id="plan-preview" style="margin-top:20px;"></div>
          </div>
        </div>

        <!-- Deploy Officers Modal -->
        <div class="modal-overlay" id="deploy-modal">
          <div class="modal">
            <div class="modal-header">
              <div class="modal-title">🚀 Assign Officers to Deployment</div>
              <button class="modal-close" onclick="DeploymentPage.closeModal('deploy-modal')">✕</button>
            </div>
            <div id="deploy-msg"></div>
            <div class="form-group">
              <label>Officer IDs (comma-separated) <span class="required">*</span></label>
              <input type="text" id="deploy-officer-ids" class="form-control" placeholder="e.g. 4, 5, 6, 7">
            </div>
            <button class="btn btn-primary btn-lg" onclick="DeploymentPage.submitDeploy()">🚀 Deploy Officers</button>
          </div>
        </div>
      `;

      // Render active deployment map
      if (deployments.some(d => d.status === 'active')) {
        setTimeout(() => this._initActiveMap(deployments.filter(d => d.status === 'active')), 100);
      }
    } catch(err) {
      content.innerHTML = `<div class="alert-banner alert-error">❌ ${err.message}</div>`;
    }
  },

  _initActiveMap(active) {
    if (this._map) { this._map.remove(); this._map = null; }
    const center = active[0].latitude ? [active[0].latitude, active[0].longitude] : [25.5941, 85.1376];
    this._map = L.map('deployment-map-container').setView(center, 13);
    // Light tile layer (CartoDB Positron)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© CopSense', maxZoom: 19
    }).addTo(this._map);

    active.forEach(d => {
      if (!d.latitude || !d.longitude) return;
      L.circleMarker([d.latitude, d.longitude], {
        radius: 15, fillColor: '#ff9f40', color: '#fff', weight: 2, fillOpacity: 0.85
      }).addTo(this._map).bindPopup(`
        <strong>${d.event_name}</strong><br>${d.location}<br>
        Crowd: ${d.crowd_size?.toLocaleString()}<br>
        Risk: ${d.risk_level.toUpperCase()}<br>
        Officers: ${d.blueprint?.total_officers_required || '—'}
      `);
    });
  },

  openPlanModal() {
    document.getElementById('plan-modal').classList.add('open');
    document.getElementById('plan-msg').innerHTML = '';
    document.getElementById('plan-preview').innerHTML = '';
  },

  closeModal(id) { document.getElementById(id).classList.remove('open'); },

  async previewPlan() {
    const previewEl = document.getElementById('plan-preview');
    previewEl.innerHTML = '<div class="loading-overlay"><div class="spinner-lg"></div></div>';
    try {
      const payload = this._getPlanPayload();
      const data = await Api.planDeployment(payload);
      this._blueprint = data.blueprint;
      previewEl.innerHTML = this._renderBlueprint(data.blueprint);
    } catch(err) {
      previewEl.innerHTML = `<div class="alert-banner alert-error">❌ ${err.message}</div>`;
    }
  },

  async submitPlan(e) {
    e.preventDefault();
    const btn = document.getElementById('plan-submit-btn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Saving...';
    try {
      const payload = this._getPlanPayload();
      const data = await Api.createDeployment(payload);
      Toast.success('Deployment Planned', `Blueprint generated: ${data.blueprint?.total_officers_required} officers required`);
      this.closeModal('plan-modal');
      this.render();
    } catch(err) {
      document.getElementById('plan-msg').innerHTML = `<div class="alert-banner alert-error">❌ ${err.message}</div>`;
    } finally { btn.disabled = false; btn.innerHTML = '💾 Save & Plan'; }
  },

  _getPlanPayload() {
    return {
      event_name:           document.getElementById('ev-name').value.trim(),
      location:             document.getElementById('ev-location').value.trim(),
      crowd_size:           parseInt(document.getElementById('ev-crowd').value),
      risk_level:           document.getElementById('ev-risk').value,
      event_duration_hours: parseFloat(document.getElementById('ev-duration').value),
      event_date:           document.getElementById('ev-date').value || null,
      latitude:             parseFloat(document.getElementById('ev-lat').value) || null,
      longitude:            parseFloat(document.getElementById('ev-lng').value) || null,
    };
  },

  async viewBlueprint(deploymentId) {
    const el = document.getElementById('blueprint-content');
    el.innerHTML = '<div class="loading-overlay"><div class="spinner-lg"></div></div>';
    document.getElementById('blueprint-modal').classList.add('open');
    try {
      const data = await Api.getDeployment(deploymentId);
      el.innerHTML = this._renderBlueprint(data.blueprint);
    } catch(err) {
      el.innerHTML = `<div class="alert-banner alert-error">❌ ${err.message}</div>`;
    }
  },

  _renderBlueprint(bp) {
    if (!bp) return '<p style="color:var(--text-muted)">No blueprint data</p>';
    return `
      <!-- Hero: Officer Count -->
      <div class="officer-count-big">${bp.total_officers_required}</div>
      <p style="text-align:center;color:var(--text-secondary);margin-bottom:20px;">Officers Required for ${bp.event_name}</p>

      <!-- Role Assignments -->
      <div class="blueprint-section">
        <h4>👮 Role Assignments</h4>
        <div class="blueprint-grid">
          ${Object.entries(bp.role_assignments || {}).map(([role, count]) => `
            <div class="blueprint-item">
              <div class="bi-label">${role}</div>
              <div class="bi-value" style="color:var(--accent)">${count} officers</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Patrol Zones -->
      <div class="blueprint-section">
        <h4>📍 Patrol Zones</h4>
        <div class="blueprint-grid">
          ${(bp.patrol_zones || []).map(z => `
            <div class="blueprint-item">
              <div class="bi-label">${z.zone_id} — ${z.name}</div>
              <div class="bi-value">${Util.severityBadge(z.priority)}</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Entry/Exit Points -->
      <div class="blueprint-section">
        <h4>🚪 Entry / Exit Points</h4>
        <div class="blueprint-grid">
          ${(bp.entry_exit_points || []).map(p => `
            <div class="blueprint-item">
              <div class="bi-label">${p.id} — ${p.type}</div>
              <div class="bi-value">${p.location} (${p.officers_required} officers)</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Emergency Routes -->
      <div class="blueprint-section">
        <h4>🚨 Emergency Routes</h4>
        ${(bp.emergency_routes || []).map(r => `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 0;">
            <span class="badge badge-high">${r.type}</span>
            <span style="font-size:13px;">${r.name}</span>
          </div>`).join('')}
      </div>

      <!-- Shifts -->
      <div class="blueprint-section">
        <h4>🕐 Shift Planning</h4>
        <div class="blueprint-grid">
          ${(bp.shifts || []).map(s => `
            <div class="blueprint-item">
              <div class="bi-label">Shift ${s.shift}</div>
              <div class="bi-value">${s.hours} — ${s.strength} officers</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Special Instructions -->
      <div class="blueprint-section">
        <h4>📌 Special Instructions</h4>
        <ul style="list-style:none;padding:0;display:flex;flex-direction:column;gap:6px;">
          ${(bp.special_instructions || []).map(i => `
            <li style="font-size:13px;padding:6px 0;border-bottom:1px solid var(--border);color:var(--text-secondary);">
              ✓ ${i}
            </li>`).join('')}
        </ul>
      </div>

      <!-- Equipment -->
      <div class="blueprint-section">
        <h4>🛡️ Equipment Required</h4>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${(bp.equipment_required || []).map(e => `
            <span class="badge badge-medium">${e}</span>`).join('')}
        </div>
      </div>
    `;
  },

  openDeployModal(id) {
    this._deploymentId = id;
    document.getElementById('deploy-modal').classList.add('open');
  },

  async submitDeploy() {
    const idsStr = document.getElementById('deploy-officer-ids').value;
    const ids = idsStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    if (ids.length === 0) { Toast.error('No Officers', 'Enter at least one officer ID'); return; }
    try {
      const result = await Api.assignOfficers(this._deploymentId, ids);
      Toast.success('Officers Deployed', result.message);
      this.closeModal('deploy-modal');
      this.render();
    } catch(err) {
      document.getElementById('deploy-msg').innerHTML = `<div class="alert-banner alert-error">❌ ${err.message}</div>`;
    }
  }
};
