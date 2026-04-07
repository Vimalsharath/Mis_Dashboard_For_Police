/**
 * Officer Duty Board — GPS zone tracking, violations, deployment map.
 */
const DutyPage = {
  _map: null,

  async render() {
    const content = document.getElementById('page-content');
    const role    = Auth.role();

    try {
      const duties = await Api.getDuties();

      const canAssign = ['ssp','station_officer'].includes(role);
      const isFieldOfficer = role === 'field_officer';

      content.innerHTML = `
        <div class="page-header">
          <div><h2>Officer Duty Board</h2>
          <p>GPS zone tracking, active deployments, and out-of-zone alerts</p></div>
          <div style="display:flex;gap:8px;">
            ${canAssign ? `<button class="btn btn-primary btn-sm" onclick="DutyPage.openAssignModal()">➕ Assign Duty</button>` : ''}
            ${isFieldOfficer ? `<button class="btn btn-danger btn-sm" onclick="DutyPage.openViolationModal()">📍 Report Out of Zone</button>` : ''}
          </div>
        </div>

        <!-- GPS Alert for field officers -->
        ${isFieldOfficer ? `
        <div id="gps-status-bar" class="card" style="margin-bottom:16px;padding:16px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="font-size:24px;">📡</span>
            <div>
              <div style="font-weight:600;">GPS Status</div>
              <div id="gps-status-text" style="font-size:13px;color:var(--text-secondary);">Checking location...</div>
            </div>
            <button class="btn btn-secondary btn-sm" style="margin-left:auto;" onclick="DutyPage.checkGPS()">
              🔄 Check Now
            </button>
          </div>
        </div>` : ''}

        <!-- Deployment Map -->
        <div class="card" style="margin-bottom:20px;padding:0;overflow:hidden;">
          <div id="deployment-map-container" style="height:400px;"></div>
        </div>
        <div class="map-legend" style="margin-bottom:20px;padding:0 4px;">
          <div class="legend-item"><div class="legend-dot" style="background:var(--green);"></div> On Duty - In Zone</div>
          <div class="legend-item"><div class="legend-dot" style="background:var(--red);"></div> Out of Zone</div>
          <div class="legend-item"><div class="legend-dot" style="background:var(--text-muted);"></div> Off Duty</div>
        </div>

        <!-- Duties Table -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">📋 Duty Assignments</div>
            <span class="badge badge-active">${duties.length} assignment${duties.length !== 1 ? 's' : ''}</span>
          </div>
          ${duties.length === 0 ? Util.emptyState('📍','No duties assigned') : `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Officer</th><th>Zone</th><th>Start</th><th>End</th><th>Status</th><th>Role</th>${canAssign?'<th>Actions</th>':''}</tr></thead>
              <tbody>
                ${duties.map(d => `
                  <tr>
                    <td style="font-weight:600;">Officer #${d.officer_id}</td>
                    <td>${d.zone}</td>
                    <td class="td-muted">${Util.formatDate(d.duty_start)}</td>
                    <td class="td-muted">${d.duty_end ? Util.formatDate(d.duty_end) : '—'}</td>
                    <td>${Util.statusBadge(d.status)}</td>
                    <td class="td-muted">${d.role_in_deployment || 'Patrol'}</td>
                    ${canAssign ? `<td>
                      ${d.status === 'active' ? `
                        <button class="btn btn-success btn-sm" onclick="DutyPage.completeDuty(${d.id})">✅ Complete</button>
                      ` : '—'}
                    </td>` : ''}
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>`}
        </div>

        <!-- Violations Table (SSP/Station Officer) -->
        ${canAssign ? `
        <div class="card" style="margin-top:20px;">
          <div class="card-header">
            <div class="card-title">⚠️ Out-of-Zone Violations</div>
          </div>
          <div id="violations-table"><div class="loading-overlay"><div class="spinner-lg"></div></div></div>
        </div>` : ''}

        <!-- Modals -->
        ${this._assignModal()}
        ${this._violationModal()}
      `;

      // Load map and violations
      this._initMap(duties);
      if (canAssign) this._loadViolations();
      if (isFieldOfficer) this.checkGPS();
    } catch(err) {
      content.innerHTML = `<div class="alert-banner alert-error">❌ ${err.message}</div>`;
    }
  },

  _initMap(duties) {
    if (this._map) { this._map.remove(); this._map = null; }
    this._map = L.map('deployment-map-container').setView([25.5941, 85.1376], 13);
    // Light tile layer (CartoDB Positron)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© CopSense | © OpenStreetMap', maxZoom: 19
    }).addTo(this._map);

    duties.forEach(d => {
      if (!d.zone_lat || !d.zone_lng) return;
      const color = d.status === 'active' ? '#00d4aa' : '#4a5a7a';
      L.circleMarker([d.zone_lat, d.zone_lng], {
        radius: 10, fillColor: color, color: '#fff', weight: 2, fillOpacity: 0.9
      }).addTo(this._map)
        .bindPopup(`
          <strong>Officer #${d.officer_id}</strong><br>
          Zone: ${d.zone}<br>
          Status: ${d.status}<br>
          Role: ${d.role_in_deployment || 'Patrol'}
        `);

      // Zone radius circle
      if (d.zone_radius_km) {
        L.circle([d.zone_lat, d.zone_lng], {
          radius: d.zone_radius_km * 1000,
          color: color, fillColor: color, fillOpacity: 0.06, weight: 1, dashArray: '4'
        }).addTo(this._map);
      }
    });
  },

  checkGPS() {
    const el = document.getElementById('gps-status-text');
    if (!el) return;
    if (!navigator.geolocation) {
      el.textContent = 'GPS not available in this browser';
      return;
    }
    el.textContent = 'Getting your location...';
    navigator.geolocation.getCurrentPosition(
      pos => { el.innerHTML = `✅ Location detected: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`; },
      err => { el.textContent = `⚠️ GPS unavailable: ${err.message}`; }
    );
  },

  async _loadViolations() {
    const el = document.getElementById('violations-table');
    if (!el) return;
    try {
      const data = await Api.getViolations();
      if (!data || data.length === 0) {
        el.innerHTML = Util.emptyState('✅', 'No zone violations recorded');
        return;
      }
      el.innerHTML = `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Officer</th><th>Zone</th><th>Reason</th><th>Location</th><th>Time</th><th>Status</th></tr></thead>
            <tbody>
              ${data.map(v => `
                <tr>
                  <td><strong>${v.officer_name}</strong></td>
                  <td>${v.zone}</td>
                  <td style="max-width:200px;">${v.reason}</td>
                  <td class="td-muted">${v.lat?.toFixed(4)}, ${v.lng?.toFixed(4)}</td>
                  <td class="td-muted">${Util.formatDate(v.timestamp)}</td>
                  <td>${v.reviewed ? '<span class="badge badge-closed">Reviewed</span>' : '<span class="badge badge-open">Pending</span>'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } catch(_) { el.innerHTML = '<p style="padding:20px;color:var(--text-muted)">Could not load violations</p>'; }
  },

  _assignModal() {
    return `
    <div class="modal-overlay" id="assign-modal">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">📍 Assign Officer Duty</div>
          <button class="modal-close" onclick="DutyPage.closeModal('assign-modal')">✕</button>
        </div>
        <div id="assign-msg"></div>
        <form onsubmit="DutyPage.submitAssign(event)">
          <div class="form-row">
            <div class="form-group">
              <label>Officer ID <span class="required">*</span></label>
              <input type="number" id="duty-officer-id" class="form-control" placeholder="Officer user ID" required>
            </div>
            <div class="form-group">
              <label>Zone Name <span class="required">*</span></label>
              <input type="text" id="duty-zone" class="form-control" placeholder="e.g. Patna City Zone A" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Zone Latitude</label>
              <input type="number" step="any" id="duty-lat" class="form-control" placeholder="25.5941">
            </div>
            <div class="form-group">
              <label>Zone Longitude</label>
              <input type="number" step="any" id="duty-lng" class="form-control" placeholder="85.1376">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Zone Radius (km)</label>
              <input type="number" step="0.1" id="duty-radius" class="form-control" value="2" min="0.1">
            </div>
            <div class="form-group">
              <label>Duty Start <span class="required">*</span></label>
              <input type="datetime-local" id="duty-start" class="form-control" required>
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-lg" id="assign-btn">Assign Duty</button>
        </form>
      </div>
    </div>`;
  },

  _violationModal() {
    return `
    <div class="modal-overlay" id="violation-modal">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">⚠️ Report Out-of-Zone Situation</div>
          <button class="modal-close" onclick="DutyPage.closeModal('violation-modal')">✕</button>
        </div>
        <div id="violation-msg"></div>
        <form onsubmit="DutyPage.submitViolation(event)">
          <div class="form-group">
            <label>Duty ID <span class="required">*</span></label>
            <input type="number" id="viol-duty-id" class="form-control" placeholder="Active duty ID" required>
          </div>
          <div class="form-group">
            <label>Reason for leaving zone <span class="required">*</span> (min 10 chars)</label>
            <textarea id="viol-reason" class="form-control" rows="4"
              placeholder="Explain why you are outside your assigned zone..." required></textarea>
            <div class="field-error" id="err-viol-reason"></div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Current Latitude <span class="required">*</span></label>
              <input type="number" step="any" id="viol-lat" class="form-control" placeholder="Get GPS" required>
            </div>
            <div class="form-group">
              <label>Current Longitude <span class="required">*</span></label>
              <input type="number" step="any" id="viol-lng" class="form-control" placeholder="Get GPS" required>
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="DutyPage.fillGPS()" style="margin-bottom:16px;">
            📡 Auto-fill from GPS
          </button>
          <button type="submit" class="btn btn-danger btn-lg" id="violation-btn">Submit Out-of-Zone Report</button>
        </form>
      </div>
    </div>`;
  },

  openAssignModal() {
    document.getElementById('duty-start').value = new Date().toISOString().slice(0,16);
    document.getElementById('assign-modal').classList.add('open');
  },

  openViolationModal() { document.getElementById('violation-modal').classList.add('open'); },

  closeModal(id) { document.getElementById(id).classList.remove('open'); },

  fillGPS() {
    navigator.geolocation?.getCurrentPosition(pos => {
      document.getElementById('viol-lat').value = pos.coords.latitude.toFixed(6);
      document.getElementById('viol-lng').value = pos.coords.longitude.toFixed(6);
      Toast.success('GPS Acquired', `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
    }, err => Toast.error('GPS Error', err.message));
  },

  async submitAssign(e) {
    e.preventDefault();
    const btn = document.getElementById('assign-btn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Assigning...';
    try {
      await Api.createDuty({
        officer_id:    parseInt(document.getElementById('duty-officer-id').value),
        zone:          document.getElementById('duty-zone').value,
        zone_lat:      parseFloat(document.getElementById('duty-lat').value) || null,
        zone_lng:      parseFloat(document.getElementById('duty-lng').value) || null,
        zone_radius_km: parseFloat(document.getElementById('duty-radius').value) || 2.0,
        duty_start:    document.getElementById('duty-start').value,
      });
      Toast.success('Duty Assigned', 'Officer duty has been created successfully');
      this.closeModal('assign-modal');
      this.render();
    } catch(err) {
      document.getElementById('assign-msg').innerHTML = `<div class="alert-banner alert-error">❌ ${err.message}</div>`;
    } finally { btn.disabled = false; btn.innerHTML = 'Assign Duty'; }
  },

  async submitViolation(e) {
    e.preventDefault();
    const reason = document.getElementById('viol-reason').value.trim();
    if (reason.length < 10) { Validate.showError('err-viol-reason','Reason must be at least 10 characters'); return; }
    const btn = document.getElementById('violation-btn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Submitting...';
    try {
      await Api.reportViolation({
        duty_id:     parseInt(document.getElementById('viol-duty-id').value),
        reason,
        current_lat: parseFloat(document.getElementById('viol-lat').value),
        current_lng: parseFloat(document.getElementById('viol-lng').value),
      });
      Toast.warning('Violation Reported', 'Station officer has been notified');
      this.closeModal('violation-modal');
      this.render();
    } catch(err) {
      document.getElementById('violation-msg').innerHTML = `<div class="alert-banner alert-error">❌ ${err.message}</div>`;
    } finally { btn.disabled = false; btn.innerHTML = 'Submit Out-of-Zone Report'; }
  },

  async completeDuty(id) {
    if (!confirm('Mark this duty as completed?')) return;
    try {
      await Api.completeDuty(id);
      Toast.success('Duty Completed','Officer is now available');
      this.render();
    } catch(err) { Toast.error('Error', err.message); }
  }
};
