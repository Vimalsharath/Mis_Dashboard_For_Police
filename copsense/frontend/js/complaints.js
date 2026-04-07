/**
 * Complaints Page — full validation, assignment, status management.
 */
const ComplaintsPage = {
  async render() {
    const content = document.getElementById('page-content');
    const role    = Auth.role();

    content.innerHTML = `
      <div class="page-header">
        <div><h2>Complaint Management</h2><p>Citizen complaints — filed and tracked</p></div>
        <button class="btn btn-primary btn-sm" onclick="ComplaintsPage.openModal()">➕ Lodge New Complaint</button>
      </div>
      <div id="complaints-body"><div class="loading-overlay"><div class="spinner-lg"></div></div></div>
      ${this._modal()}
    `;
    await this._loadComplaints();
  },

  async _loadComplaints() {
    const el = document.getElementById('complaints-body');
    try {
      const role = Auth.role();
      let complaints = [];
      if (['ssp','station_officer'].includes(role)) {
        complaints = await Api.getComplaints();
      }

      const stats = [
        { label:'Total',    value: complaints.length,                                  color:'var(--accent)' },
        { label:'Pending',  value: complaints.filter(c=>c.status==='pending').length,  color:'var(--yellow)' },
        { label:'Reviewing',value: complaints.filter(c=>c.status==='reviewing').length,color:'var(--orange)' },
        { label:'Resolved', value: complaints.filter(c=>c.status==='resolved').length, color:'var(--green)' },
      ];

      el.innerHTML = `
        ${['ssp','station_officer'].includes(role) ? `
        <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px;">
          ${stats.map(s => `
            <div class="stat-card" style="--accent-color:${s.color}">
              <div class="stat-value">${s.value}</div>
              <div class="stat-label">${s.label}</div>
            </div>`).join('')}
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">📢 All Complaints</div></div>
          ${complaints.length === 0 ? Util.emptyState('📢','No complaints filed') : `
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th>Citizen</th><th>Phone</th><th>Type</th><th>Description</th>
                <th>Location</th><th>Date</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                ${complaints.map(c => `<tr>
                  <td><strong>${c.citizen_name}</strong></td>
                  <td class="td-muted">${c.phone}</td>
                  <td><span class="badge badge-medium">${c.complaint_type}</span></td>
                  <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${c.description}">${c.description}</td>
                  <td class="td-muted">${c.location}</td>
                  <td class="td-muted">${Util.formatDateOnly(c.date)}</td>
                  <td>${Util.statusBadge(c.status)}</td>
                  <td>
                    <div style="display:flex;gap:6px;">
                      ${c.status === 'pending' ? `
                        <button class="btn btn-warning btn-sm" onclick="ComplaintsPage.updateStatus(${c.id},'reviewing')">Review</button>
                      ` : ''}
                      ${c.status !== 'resolved' ? `
                        <button class="btn btn-success btn-sm" onclick="ComplaintsPage.updateStatus(${c.id},'resolved')">Resolve</button>
                      ` : ''}
                    </div>
                  </td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>`}
        </div>` : `
        <div class="alert-banner alert-info">
          ℹ️ Use the "Lodge New Complaint" button to submit a complaint. Citizens can submit but cannot view the full list.
        </div>`}
      `;
    } catch(err) {
      el.innerHTML = `<div class="alert-banner alert-error">❌ ${err.message}</div>`;
    }
  },

  _modal() {
    return `
    <div class="modal-overlay" id="complaint-modal">
      <div class="modal" style="max-width:640px;">
        <div class="modal-header">
          <div class="modal-title">📢 Lodge a Complaint</div>
          <button class="modal-close" onclick="ComplaintsPage.closeModal()">✕</button>
        </div>
        <div id="complaint-msg"></div>
        <form onsubmit="ComplaintsPage.submitComplaint(event)">
          <div class="form-row">
            <div class="form-group">
              <label>Your Name <span class="required">*</span></label>
              <input type="text" id="comp-name" class="form-control" placeholder="Full name" required>
              <div class="field-error" id="err-comp-name"></div>
            </div>
            <div class="form-group">
              <label>Phone Number <span class="required">*</span></label>
              <input type="tel" id="comp-phone" class="form-control" placeholder="10-digit mobile" required>
              <div class="field-error" id="err-comp-phone"></div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Complaint Type <span class="required">*</span></label>
              <select id="comp-type" class="form-control" required>
                <option value="">Select type</option>
                <option>Noise Pollution</option>
                <option>Theft</option>
                <option>Assault</option>
                <option>Road Accident</option>
                <option>Missing Person</option>
                <option>Fraud</option>
                <option>Harassment</option>
                <option>Other</option>
              </select>
              <div class="field-error" id="err-comp-type"></div>
            </div>
            <div class="form-group">
              <label>Date of Incident <span class="required">*</span></label>
              <input type="datetime-local" id="comp-date" class="form-control" required>
            </div>
          </div>
          <div class="form-group">
            <label>Location <span class="required">*</span></label>
            <input type="text" id="comp-location" class="form-control" placeholder="Where did the incident occur?" required>
            <div class="field-error" id="err-comp-location"></div>
          </div>
          <div class="form-group">
            <label>Description <span class="required">*</span> (min 10 characters)</label>
            <textarea id="comp-desc" class="form-control" rows="4"
              placeholder="Describe the incident in detail..." oninput="ComplaintsPage.onDescInput()"></textarea>
            <div class="char-counter"><span id="comp-char">0</span> chars</div>
            <div class="field-error" id="err-comp-desc"></div>
          </div>
          <button type="submit" class="btn btn-primary btn-lg" id="complaint-btn">📢 Submit Complaint</button>
        </form>
      </div>
    </div>`;
  },

  openModal() {
    document.getElementById('comp-date').value = new Date().toISOString().slice(0,16);
    document.getElementById('complaint-modal').classList.add('open');
    document.getElementById('complaint-msg').innerHTML = '';
  },

  closeModal() { document.getElementById('complaint-modal').classList.remove('open'); },

  onDescInput() {
    const v = document.getElementById('comp-desc').value;
    document.getElementById('comp-char').textContent = v.length;
    if (v.length < 10) Validate.showError('err-comp-desc','Min 10 characters');
    else Validate.clearError('err-comp-desc');
  },

  async submitComplaint(e) {
    e.preventDefault();
    Validate.clearAll('comp-');

    let ok = true;
    const checks = [
      ['comp-name','err-comp-name','Name is required'],
      ['comp-type','err-comp-type','Please select complaint type'],
      ['comp-location','err-comp-location','Location is required'],
    ];
    for (const [id, errId, msg] of checks) {
      if (!document.getElementById(id).value.trim()) { Validate.showError(errId, msg); ok = false; }
    }
    const phone = document.getElementById('comp-phone').value;
    if (!Validate.phone(phone)) { Validate.showError('err-comp-phone','Valid 10-digit number required'); ok = false; }
    const desc = document.getElementById('comp-desc').value.trim();
    if (desc.length < 10) { Validate.showError('err-comp-desc','Description must be at least 10 characters'); ok = false; }
    if (!ok) return;

    const btn = document.getElementById('complaint-btn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Submitting...';

    try {
      await Api.createComplaint({
        citizen_name:   document.getElementById('comp-name').value.trim(),
        phone,
        complaint_type: document.getElementById('comp-type').value,
        description:    desc,
        date:           document.getElementById('comp-date').value,
        location:       document.getElementById('comp-location').value.trim(),
      });
      document.getElementById('complaint-msg').innerHTML =
        '<div class="alert-banner alert-success">✅ Complaint submitted successfully! Authorities have been notified.</div>';
      Toast.success('Complaint Filed','Your complaint has been registered');
      setTimeout(() => { this.closeModal(); this.render(); }, 2000);
    } catch(err) {
      document.getElementById('complaint-msg').innerHTML = `<div class="alert-banner alert-error">❌ ${err.message}</div>`;
    } finally { btn.disabled = false; btn.innerHTML = '📢 Submit Complaint'; }
  },

  async updateStatus(id, status) {
    try {
      await Api.updateComplaint(id, status);
      Toast.success('Updated', `Complaint marked as ${status}`);
      this._loadComplaints();
    } catch(err) { Toast.error('Error', err.message); }
  }
};
