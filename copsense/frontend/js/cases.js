/**
 * Case Management Module
 * Comprehensive system for tracking high-sensitivity cases, auto-assignment, 
 * and lifecycle management.
 */
const CasePage = {
  async render() {
    const content = document.getElementById('page-content');
    const role = Auth.role();

    try {
      const cases = await Api.getCases();
      
      content.innerHTML = `
        <div class="page-header animate-in">
          <div>
            <h2>📁 Strategic Case Management</h2>
            <p>Police intelligence operations with automated priority classification and smart officer assignment.</p>
          </div>
          <div style="display:flex;gap:12px;">
            ${['ssp', 'station_officer'].includes(role) ? 
              `<button class="btn btn-primary" onclick="CasePage.showCreateModal()">➕ Register New Case</button>` : ''}
            <div class="top-stats" style="display:flex;gap:16px;">
              <div class="stat-mini">
                <span class="label">Priority 1</span>
                <span class="value" style="color:var(--red)">${cases.filter(c => c.priority === 'critical' || c.priority === 'high').length}</span>
              </div>
              <div class="stat-mini">
                <span class="label">Total Cases</span>
                <span class="value">${cases.length}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="case-filters animate-in" style="margin-bottom:24px;display:flex;gap:12px;background:var(--bg-secondary);padding:16px;border-radius:12px;">
          <input type="text" id="case-search" class="form-control" placeholder="Search by ID or Title..." style="max-width:300px;" oninput="CasePage.filterCases()">
          <select id="prio-filter" class="form-control" style="width:150px" onchange="CasePage.filterCases()">
            <option value="">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select id="status-filter" class="form-control" style="width:200px" onchange="CasePage.filterCases()">
            <option value="">All Statuses</option>
            <option value="Case Opened">Case Opened</option>
            <option value="Assigned">Assigned</option>
            <option value="Under Investigation">Under Investigation</option>
            <option value="Evidence Collection">Evidence Collection</option>
            <option value="Suspect Identified">Suspect Identified</option>
            <option value="Case Closed">Case Closed</option>
          </select>
        </div>

        <div id="case-list-container" class="case-grid">
          ${cases.length === 0 ? Util.emptyState('📁', 'No strategic cases found') : 
            cases.map(c => this._caseCard(c, role)).join('')}
        </div>
      `;
    } catch (err) {
      content.innerHTML = `<div class="alert-banner alert-error">❌ ${err.message}</div>`;
    }
  },

  _caseCard(c, role) {
    const prioColor = this._prioColor(c.priority);
    const stages = [
      "Case Opened", "Assigned", "Under Investigation", 
      "Evidence Collection", "Suspect Identified", "Case Closed"
    ];
    const currentIdx = stages.indexOf(c.status);
    const activeAssignment = c.assignments.find(a => a.is_active);

    return `
      <div class="card case-card animate-in" data-id="${c.id}" data-title="${c.title.toLowerCase()}" data-prio="${c.priority}" data-status="${c.status}" 
           style="border-left: 6px solid ${prioColor}; margin-bottom: 24px;">
        <div class="case-header" style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
               <span class="badge" style="background:${prioColor}20; color:${prioColor}">${c.priority.toUpperCase()}</span>
               <span class="case-id">#CASE-${String(c.id).padStart(4, '0')}</span>
            </div>
            <h3 style="margin:0;font-size:20px;">${c.title}</h3>
            <p style="color:var(--text-secondary);font-size:14px;margin-top:4px;">${c.description.substring(0, 150)}${c.description.length > 150 ? '...' : ''}</p>
          </div>
          <div style="text-align:right">
            <div style="font-size:12px;color:var(--text-muted)">Created On</div>
            <div style="font-size:14px;font-weight:600">${Util.formatDate(c.created_at)}</div>
          </div>
        </div>

        <div class="case-progression" style="margin: 24px 0; background: var(--bg-primary); padding: 24px; border-radius: 12px;">
          <div class="stepper stepper-horizontal">
            ${stages.map((s, i) => `
              <div class="step ${i <= currentIdx ? 'active' : ''} ${i === currentIdx ? 'current' : ''}">
                <div class="step-circle">${i < currentIdx ? '✓' : i + 1}</div>
                <div class="step-label">${s}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="case-footer" style="display:flex;justify-content:space-between;align-items:center;padding-top:20px;border-top:1px solid var(--border)">
          <div class="officer-assignment" style="display:flex;align-items:center;gap:12px;">
            <div class="officer-avatar" style="width:44px;height:44px;background:var(--bg-secondary);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;border:2px solid ${activeAssignment ? 'var(--accent)' : 'var(--border)'}">
              ${activeAssignment ? '👮' : '❓'}
            </div>
            <div>
              <div style="font-weight:700;font-size:14px;">${activeAssignment ? activeAssignment.officer_name : 'Awaiting Assignment'}</div>
              <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">${activeAssignment ? activeAssignment.officer_rank : 'Strategic Queue'}</div>
            </div>
          </div>

          <div class="actions" style="display:flex;gap:10px;">
            <button class="btn btn-secondary btn-sm" onclick="CasePage.viewLogs(${c.id})">🕒 Timeline</button>
            ${['ssp', 'station_officer', 'field_officer'].includes(role) ? `
              <div class="dropdown">
                <button class="btn btn-primary btn-sm dropdown-toggle" onclick="CasePage.toggleDropdown(${c.id})">⚙️ Manage</button>
                <div id="dropdown-${c.id}" class="dropdown-menu">
                  <div class="dropdown-header">Update Lifecycle</div>
                  ${stages.slice(1).map(s => `<a href="#" onclick="CasePage.updateStatus(${c.id}, '${s}')">${s}</a>`).join('')}
                  ${['ssp', 'station_officer'].includes(role) ? `
                    <div class="dropdown-divider"></div>
                    <div class="dropdown-header">Administrative Controls</div>
                    <a href="#" onclick="CasePage.showPriorityModal(${c.id}, '${c.priority}')">⚡ Override Priority</a>
                    <a href="#" onclick="CasePage.showAssignModal(${c.id})">👤 Manual Reassign</a>
                  ` : ''}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  },

  _prioColor(p) {
    const map = { critical: 'var(--red)', high: 'var(--orange)', medium: 'var(--accent)', low: 'var(--text-muted)' };
    return map[p] || 'var(--text-muted)';
  },

  toggleDropdown(id) {
    document.querySelectorAll('.dropdown-menu').forEach(d => {
      if (d.id !== `dropdown-${id}`) d.classList.remove('show');
    });
    document.getElementById(`dropdown-${id}`).classList.toggle('show');
  },

  filterCases() {
    const search = document.getElementById('case-search').value.toLowerCase();
    const prio = document.getElementById('prio-filter').value;
    const status = document.getElementById('status-filter').value;
    
    document.querySelectorAll('.case-card').forEach(card => {
      const title = card.dataset.title;
      const cardPrio = card.dataset.prio;
      const cardStatus = card.dataset.status;
      const caseId = card.dataset.id;
      
      const matchSearch = title.includes(search) || caseId.includes(search);
      const matchPrio = !prio || cardPrio === prio;
      const matchStatus = !status || cardStatus === status;
      
      card.style.display = (matchSearch && matchPrio && matchStatus) ? 'block' : 'none';
    });
  },

  async updateStatus(id, status) {
    const notes = prompt(`Update notes for ${status}:`, `Progressing to ${status} stage.`);
    if (notes === null) return;
    
    try {
      await Api.updateCaseStatus(id, status, notes);
      Toast.success('Lifecycle Updated', `Case #${id} is now in ${status} stage.`);
      this.render();
    } catch (err) {
      Toast.error('Update Failed', err.message);
    }
  },

  async showPriorityModal(id, current) {
    const p = prompt('Enter new priority (low, medium, high, critical):', current);
    if (!p) return;
    try {
      await Api.overrideCasePriority(id, p.toLowerCase());
      Toast.success('Priority Overridden', `Case #${id} priority set to ${p}.`);
      this.render();
    } catch (err) {
      Toast.error('Override Failed', err.message);
    }
  },

  async showAssignModal(id) {
    try {
      const stationId = Auth.user().station_id;
      const officers = await Api.stationOfficers(stationId);
      
      let list = officers.map(o => `${o.id}: ${o.rank} ${o.name}`).join('\n');
      const oid = prompt(`Select Officer ID to reassign:\n\n${list}`);
      
      if (oid) {
        await Api.assignOfficer(id, parseInt(oid));
        Toast.success('Case Reassigned', `Officer updated for Case #${id}.`);
        this.render();
      }
    } catch (err) {
      Toast.error('Reassignment Failed', err.message);
    }
  },

  async viewLogs(id) {
    try {
      const c = await Api.getCase(id);
      let logs = c.status_logs.map(l => `
        <div style="border-left:2px solid var(--accent); padding-left:12px; margin-bottom:12px;">
          <div style="font-weight:700; font-size:13px;">${l.status}</div>
          <div style="font-size:12px; color:var(--text-secondary)">${l.notes}</div>
          <div style="font-size:10px; color:var(--text-muted)">${Util.formatDate(l.timestamp)}</div>
        </div>
      `).join('');
      
      Util.modal('Case Timeline', `<div style="max-height:400px; overflow-y:auto;">${logs || 'No timeline records found.'}</div>`);
    } catch (err) {
      Toast.error('Logs Failed', err.message);
    }
  },

  showCreateModal() {
    Util.modal('Register Strategic Case', `
      <form id="create-case-form" onsubmit="CasePage.handleCreate(event)">
        <div class="form-group">
          <label>Case Title</label>
          <input type="text" id="case-title" class="form-control" placeholder="e.g., Sensitive Investigation #102" required>
        </div>
        <div class="form-group">
          <label>Detailed Description</label>
          <textarea id="case-desc" class="form-control" rows="5" placeholder="Provide full details. Auto-classification will scan for keywords." required></textarea>
          <small style="color:var(--text-muted)">* Keywords like 'women', 'children', or 'emergency' trigger High Priority.</small>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div class="form-group">
            <label>Latitude (Optional)</label>
            <input type="number" step="any" id="case-lat" class="form-control" placeholder="25.5941">
          </div>
          <div class="form-group">
            <label>Longitude (Optional)</label>
            <input type="number" step="any" id="case-lng" class="form-control" placeholder="85.1376">
          </div>
        </div>
        <button type="submit" class="btn btn-primary btn-block" style="margin-top:16px;">Register Case & Auto-Assign</button>
      </form>
    `);
  },

  async handleCreate(e) {
    e.preventDefault();
    const payload = {
      title: document.getElementById('case-title').value,
      description: document.getElementById('case-desc').value,
      latitude: parseFloat(document.getElementById('case-lat').value) || null,
      longitude: parseFloat(document.getElementById('case-lng').value) || null
    };

    try {
      const res = await Api.createCase(payload);
      Util.closeModal();
      Toast.success('Case Registered', `Case #${res.id} created with ${res.priority} priority.`);
      this.render();
    } catch (err) {
      Toast.error('Registration Failed', err.message);
    }
  }
};
