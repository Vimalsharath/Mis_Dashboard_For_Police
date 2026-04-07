/**
 * FIR Management Page — create, list, update status, upload evidence.
 * Full validation with duplicate prevention (server-side).
 */
const FIRPage = {
  async render() {
    const content = document.getElementById('page-content');
    const role    = Auth.role();
    const canCreate = ['ssp','station_officer'].includes(role);

    try {
      const firs = await Api.getFIRs();

      content.innerHTML = `
        <div class="page-header">
          <div><h2>FIR Management</h2><p>First Information Reports — case tracking</p></div>
          ${canCreate ? `<button class="btn btn-primary btn-sm" onclick="FIRPage.openModal()">➕ Register New FIR</button>` : ''}
        </div>

        <!-- Stats -->
        <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px;">
          ${[
            { label:'Total FIRs',   value: firs.length, color:'var(--accent)' },
            { label:'Open',         value: firs.filter(f=>f.status==='open').length, color:'var(--red)' },
            { label:'Investigating',value: firs.filter(f=>f.status==='investigating').length, color:'var(--orange)' },
            { label:'Closed',       value: firs.filter(f=>f.status==='closed').length, color:'var(--green)' },
          ].map(s => `
            <div class="stat-card" style="--accent-color:${s.color}">
              <div class="stat-value">${s.value}</div>
              <div class="stat-label">${s.label}</div>
            </div>`).join('')}
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">📋 FIR Records</div>
          </div>
          ${firs.length === 0 ? Util.emptyState('📋','No FIRs registered') : `
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th>FIR No.</th><th>Crime Type</th><th>IPC Section</th><th>Location</th>
                <th>Severity</th><th>Status</th><th>Filed On</th>
                ${canCreate ? '<th>Actions</th>' : ''}
              </tr></thead>
              <tbody>
                ${firs.map(f => `<tr>
                  <td><code style="color:var(--accent);font-family:'JetBrains Mono',monospace">${f.fir_number}</code></td>
                  <td><strong>${f.crime_type}</strong></td>
                  <td class="td-muted">${f.ipc_section}</td>
                  <td class="td-muted">${f.location}</td>
                  <td>${Util.severityBadge(f.severity)}</td>
                  <td>${Util.statusBadge(f.status)}</td>
                  <td class="td-muted">${Util.formatDate(f.created_at)}</td>
                  ${canCreate ? `<td>
                    <div style="display:flex;gap:6px;">
                      <select style="font-size:12px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;padding:4px 8px;"
                        onchange="FIRPage.updateStatus(${f.id}, this.value)">
                        <option value="open"          ${f.status==='open'?'selected':''}>Open</option>
                        <option value="investigating" ${f.status==='investigating'?'selected':''}>Investigating</option>
                        <option value="closed"        ${f.status==='closed'?'selected':''}>Closed</option>
                      </select>
                      <button class="btn btn-secondary btn-sm" onclick="FIRPage.openEvidenceModal(${f.id},'${f.fir_number}')">📎</button>
                    </div>
                  </td>` : ''}
                </tr>`).join('')}
              </tbody>
            </table>
          </div>`}
        </div>

        ${this._firModal()}
        ${this._evidenceModal()}
      `;
    } catch(err) {
      content.innerHTML = `<div class="alert-banner alert-error">❌ ${err.message}</div>`;
    }
  },

  _firModal() {
    return `
    <div class="modal-overlay" id="fir-modal">
      <div class="modal" style="max-width:680px;">
        <div class="modal-header">
          <div class="modal-title">📋 Register New FIR</div>
          <button class="modal-close" onclick="FIRPage.closeModal('fir-modal')">✕</button>
        </div>
        <div id="fir-msg"></div>
        <form onsubmit="FIRPage.submitFIR(event)">
          <div class="form-row">
            <div class="form-group">
              <label>FIR Number <span class="required">*</span></label>
              <input type="text" id="fir-number" class="form-control" placeholder="e.g. FIR-2024-100" required>
              <div class="field-error" id="err-fir-number"></div>
            </div>
            <div class="form-group">
              <label>Crime Type <span class="required">*</span></label>
              <input type="text" id="fir-crime" class="form-control" placeholder="e.g. Theft, Assault" required>
              <div class="field-error" id="err-fir-crime"></div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>IPC Section <span class="required">*</span></label>
              <input type="text" id="fir-ipc" class="form-control" placeholder="e.g. IPC 379" required>
              <div class="field-error" id="err-fir-ipc"></div>
            </div>
            <div class="form-group">
              <label>Location <span class="required">*</span></label>
              <input type="text" id="fir-location" class="form-control" placeholder="Incident location" required>
              <div class="field-error" id="err-fir-location"></div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Severity <span class="required">*</span></label>
              <select id="fir-severity" class="form-control" required>
                <option value="low">Low</option>
                <option value="medium" selected>Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div class="form-group">
              <label>Assigned Officer ID</label>
              <input type="number" id="fir-officer" class="form-control" placeholder="Officer user ID">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Latitude</label>
              <input type="number" step="any" id="fir-lat" class="form-control" placeholder="e.g. 25.5941">
            </div>
            <div class="form-group">
              <label>Longitude</label>
              <input type="number" step="any" id="fir-lng" class="form-control" placeholder="e.g. 85.1376">
            </div>
          </div>
          <div class="form-group">
            <label>Complainant Name</label>
            <input type="text" id="fir-complainant" class="form-control" placeholder="Complainant's full name">
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea id="fir-desc" class="form-control" rows="3" placeholder="Incident details..."></textarea>
          </div>
          <button type="submit" class="btn btn-primary btn-lg" id="fir-submit-btn">📋 Register FIR</button>
        </form>
      </div>
    </div>`;
  },

  _evidenceModal() {
    return `
    <div class="modal-overlay" id="evidence-modal">
      <div class="modal" style="max-width:420px;">
        <div class="modal-header">
          <div class="modal-title">📎 Upload Evidence</div>
          <button class="modal-close" onclick="FIRPage.closeModal('evidence-modal')">✕</button>
        </div>
        <p id="evidence-fir-label" style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;"></p>
        <div id="evidence-msg"></div>
        <div class="upload-zone" onclick="document.getElementById('evidence-file-input').click()">
          <div class="upload-icon">📎</div>
          <p id="evidence-file-name">Click to select evidence file</p>
          <p class="upload-hint">Photos, videos, documents — Max 50MB</p>
        </div>
        <input type="file" id="evidence-file-input" style="display:none" onchange="FIRPage.onFileSelect()">
        <button class="btn btn-primary btn-lg" style="margin-top:16px;" id="evidence-upload-btn" onclick="FIRPage.submitEvidence()">
          📤 Upload Evidence
        </button>
      </div>
    </div>`;
  },

  _currentFIRId: null,

  openModal() {
    document.getElementById('fir-modal').classList.add('open');
    document.getElementById('fir-msg').innerHTML = '';
  },

  openEvidenceModal(id, number) {
    this._currentFIRId = id;
    document.getElementById('evidence-fir-label').textContent = `FIR: ${number}`;
    document.getElementById('evidence-modal').classList.add('open');
  },

  onFileSelect() {
    const f = document.getElementById('evidence-file-input').files[0];
    if (f) document.getElementById('evidence-file-name').textContent = `✅ ${f.name}`;
  },

  closeModal(id) { document.getElementById(id).classList.remove('open'); },

  async submitFIR(e) {
    e.preventDefault();
    Validate.clearAll('fir-');

    let ok = true;
    const required = [
      ['fir-number','err-fir-number','FIR number is required'],
      ['fir-crime','err-fir-crime','Crime type is required'],
      ['fir-ipc','err-fir-ipc','IPC section is required'],
      ['fir-location','err-fir-location','Location is required'],
    ];
    for (const [id, errId, msg] of required) {
      if (!document.getElementById(id).value.trim()) { Validate.showError(errId, msg); ok = false; }
    }
    if (!ok) return;

    const btn = document.getElementById('fir-submit-btn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Registering...';

    try {
      await Api.createFIR({
        fir_number:       document.getElementById('fir-number').value.trim(),
        crime_type:       document.getElementById('fir-crime').value.trim(),
        ipc_section:      document.getElementById('fir-ipc').value.trim(),
        location:         document.getElementById('fir-location').value.trim(),
        severity:         document.getElementById('fir-severity').value,
        officer_id:       parseInt(document.getElementById('fir-officer').value) || null,
        latitude:         parseFloat(document.getElementById('fir-lat').value) || null,
        longitude:        parseFloat(document.getElementById('fir-lng').value) || null,
        complainant_name: document.getElementById('fir-complainant').value.trim() || null,
        description:      document.getElementById('fir-desc').value.trim() || null,
      });
      Toast.success('FIR Registered','New FIR has been filed successfully');
      this.closeModal('fir-modal');
      this.render();
    } catch(err) {
      document.getElementById('fir-msg').innerHTML = `<div class="alert-banner alert-error">❌ ${err.message}</div>`;
    } finally { btn.disabled = false; btn.innerHTML = '📋 Register FIR'; }
  },

  async updateStatus(id, status) {
    try {
      await Api.updateFIRStatus(id, status);
      Toast.success('Status Updated', `FIR status changed to ${status}`);
      this.render();
    } catch(err) { Toast.error('Error', err.message); }
  },

  async submitEvidence() {
    const file = document.getElementById('evidence-file-input').files[0];
    if (!file) { Toast.error('No file','Please select a file'); return; }
    const btn = document.getElementById('evidence-upload-btn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Uploading...';
    try {
      await Api.uploadEvidence(this._currentFIRId, file);
      Toast.success('Evidence Uploaded','File attached to FIR');
      this.closeModal('evidence-modal');
    } catch(err) {
      document.getElementById('evidence-msg').innerHTML = `<div class="alert-banner alert-error">❌ ${err.message}</div>`;
    } finally { btn.disabled = false; btn.innerHTML = '📤 Upload Evidence'; }
  }
};
