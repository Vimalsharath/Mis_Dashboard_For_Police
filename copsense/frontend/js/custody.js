/**
 * Custody Safety Monitoring Page
 * 4-hour video upload enforcement, relative notification log, overdue alerts.
 */
const CustodyPage = {
  async render() {
    const content = document.getElementById('page-content');
    const role = Auth.role();

    try {
      const [records, overdue] = await Promise.allSettled([
        Api.getCustody(),
        Api.checkOverdue()
      ]);
      const custody = records.status === 'fulfilled' ? records.value : [];
      const overdueData = overdue.status === 'fulfilled' ? overdue.value : { overdue_count: 0, overdue_records: [] };

      content.innerHTML = `
        <div class="page-header">
          <div><h2>Custody Safety Monitoring</h2>
          <p>Track detained persons — 4-hour video update required</p></div>
          <button class="btn btn-primary btn-sm" onclick="CustodyPage.openAddModal()">➕ Add Arrest Record</button>
        </div>

        <!-- Overdue Alert Banner -->
        ${overdueData.overdue_count > 0 ? `
        <div class="gps-alert-banner">
          <span style="font-size:32px;">🚨</span>
          <div>
            <strong style="font-size:16px;">CUSTODY UPDATE MISSING</strong>
            <p style="font-size:14px;margin-top:4px;">
              ${overdueData.overdue_count} record(s) have not been updated with video in over 4 hours.
            </p>
          </div>
        </div>` : `
        <div class="alert-banner alert-success" style="margin-bottom:16px;">
          ✅ All custody records are up-to-date with video uploads
        </div>`}

        <!-- Stats -->
        <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px;">
          ${[
            { label:'Total Arrests',   value: custody.length,                                         color:'var(--accent)' },
            { label:'In Custody',      value: custody.filter(c=>c.status==='in_custody').length,      color:'var(--red)' },
            { label:'Video Overdue',   value: overdueData.overdue_count,                              color: overdueData.overdue_count > 0 ? 'var(--red)' : 'var(--green)' },
            { label:'Released',        value: custody.filter(c=>c.status==='released').length,        color:'var(--green)' },
          ].map(s => `
            <div class="stat-card" style="--accent-color:${s.color}">
              <div class="stat-value">${s.value}</div>
              <div class="stat-label">${s.label}</div>
            </div>`).join('')}
        </div>

        <!-- Custody Records Table -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">🔒 Custody Records</div>
          </div>
          ${custody.length === 0 ? Util.emptyState('🔒','No custody records') : `
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th>Arrest ID</th><th>Accused</th><th>Location</th><th>Arrest Date</th>
                <th>Relative Phone</th><th>Last Video</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                ${custody.map(c => {
                  const hoursAgo = c.last_video_upload
                    ? Math.round((Date.now() - new Date(c.last_video_upload)) / 3600000)
                    : null;
                  const isOverdue = !c.last_video_upload || hoursAgo >= 4;
                  return `<tr class="${isOverdue && c.status === 'in_custody' ? 'overdue-row' : ''}">
                    <td><code style="color:var(--accent);font-family:'JetBrains Mono',monospace">${c.arrest_id}</code></td>
                    <td><strong>${c.accused_name}</strong></td>
                    <td class="td-muted">${c.custody_location}</td>
                    <td class="td-muted">${Util.formatDate(c.arrest_date)}</td>
                    <td>
                      📱 <span class="td-muted">${c.relative_phone}</span>
                      ${c.relative_name ? `<br><span style="font-size:11px;color:var(--text-muted)">${c.relative_name}</span>` : ''}
                    </td>
                    <td>
                      ${c.last_video_upload
                        ? `<span style="color:${isOverdue?'var(--red)':'var(--green)'};font-size:13px;">
                            ${isOverdue ? '🔴' : '🟢'} ${hoursAgo}h ago
                          </span>`
                        : '<span style="color:var(--red);font-weight:600;">❌ Never</span>'}
                    </td>
                    <td>${Util.statusBadge(c.status)}</td>
                    <td>
                      <div style="display:flex;gap:6px;">
                        ${c.status === 'in_custody' ? `
                          <button class="btn btn-warning btn-sm" onclick="CustodyPage.openVideoModal(${c.id},'${c.accused_name}')">
                            📹 Upload Video
                          </button>` : ''}
                        ${['ssp','station_officer'].includes(role) && c.status === 'in_custody' ? `
                          <button class="btn btn-success btn-sm" onclick="CustodyPage.release(${c.id})">
                            🔓 Release
                          </button>` : ''}
                      </div>
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>`}
        </div>

        <!-- Modals -->
        ${this._addModal()}
        ${this._videoModal()}
      `;
    } catch(err) {
      content.innerHTML = `<div class="alert-banner alert-error">❌ ${err.message}</div>`;
    }
  },

  _addModal() {
    return `
    <div class="modal-overlay" id="add-custody-modal">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">➕ Add Arrest Record</div>
          <button class="modal-close" onclick="CustodyPage.closeModal('add-custody-modal')">✕</button>
        </div>
        <div id="custody-add-msg"></div>
        <form onsubmit="CustodyPage.submitAdd(event)">
          <div class="form-row">
            <div class="form-group">
              <label>Arrest ID <span class="required">*</span></label>
              <input type="text" id="c-arrest-id" class="form-control" placeholder="e.g. ARR-2024-100" required>
              <div class="field-error" id="err-c-arrest-id"></div>
            </div>
            <div class="form-group">
              <label>Accused Name <span class="required">*</span></label>
              <input type="text" id="c-accused" class="form-control" placeholder="Full name" required>
              <div class="field-error" id="err-c-accused"></div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Arrest Date & Time <span class="required">*</span></label>
              <input type="datetime-local" id="c-arrest-date" class="form-control" required>
            </div>
            <div class="form-group">
              <label>Custody Location <span class="required">*</span></label>
              <input type="text" id="c-location" class="form-control" placeholder="Lock-up room / cell" required>
              <div class="field-error" id="err-c-location"></div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Relative Phone <span class="required">*</span></label>
              <input type="tel" id="c-rel-phone" class="form-control" placeholder="10-digit mobile number" required>
              <div class="field-error" id="err-c-rel-phone"></div>
            </div>
            <div class="form-group">
              <label>Relative Name</label>
              <input type="text" id="c-rel-name" class="form-control" placeholder="e.g. Sita Devi (wife)">
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-lg" id="custody-add-btn">🔒 Add Arrest Record</button>
        </form>
      </div>
    </div>`;
  },

  _videoModal() {
    return `
    <div class="modal-overlay" id="custody-video-modal">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">📹 Upload Custody Video Update</div>
          <button class="modal-close" onclick="CustodyPage.closeModal('custody-video-modal')">✕</button>
        </div>
        <div style="background:var(--bg-card2);border-radius:8px;padding:12px;margin-bottom:16px;border:1px solid var(--orange);">
          <p style="font-size:13px;color:var(--orange);">⚠️ This video will be logged as sent to the relative's WhatsApp and uploaded to the higher officer's dashboard.</p>
          <p style="font-size:12px;color:var(--text-muted);margin-top:4px;">Accused: <strong id="video-accused-name" style="color:var(--text-primary)">—</strong></p>
        </div>
        <div id="video-custody-msg"></div>
        <div class="form-group">
          <label>Video Note / Status Message</label>
          <input type="text" id="video-note" class="form-control" placeholder="e.g. Detainee is safe and cooperative">
        </div>
        <div class="form-group">
          <label>Custody Video <span class="required">*</span></label>
          <div class="upload-zone" onclick="document.getElementById('video-file-input').click()">
            <div class="upload-icon">🎬</div>
            <p id="video-file-name">Click to select video file</p>
            <p class="upload-hint">MP4, AVI, MOV — Max 100MB</p>
          </div>
          <input type="file" id="video-file-input" accept="video/*" style="display:none"
            onchange="CustodyPage.onVideoSelect()">
        </div>
        <div id="video-wa-log" style="display:none;background:var(--bg-card2);border-radius:8px;padding:12px;
          border:1px solid var(--green);font-size:12px;font-family:'JetBrains Mono',monospace;color:var(--green);margin-bottom:12px;"></div>
        <button class="btn btn-primary btn-lg" id="video-upload-btn" onclick="CustodyPage.submitVideo()">
          📤 Upload & Notify
        </button>
      </div>
    </div>`;
  },

  _currentCustodyId: null,

  openAddModal() {
    document.getElementById('c-arrest-date').value = new Date().toISOString().slice(0,16);
    document.getElementById('add-custody-modal').classList.add('open');
  },

  openVideoModal(custodyId, accusedName) {
    this._currentCustodyId = custodyId;
    document.getElementById('video-accused-name').textContent = accusedName;
    document.getElementById('custody-video-modal').classList.add('open');
  },

  onVideoSelect() {
    const file = document.getElementById('video-file-input').files[0];
    if (file) document.getElementById('video-file-name').textContent = `✅ ${file.name} (${(file.size/1024/1024).toFixed(1)} MB)`;
  },

  closeModal(id) { document.getElementById(id).classList.remove('open'); },

  async submitAdd(e) {
    e.preventDefault();
    Validate.clearAll('c-');

    const fields = [
      ['c-arrest-id', 'err-c-arrest-id', 'Arrest ID is required'],
      ['c-accused',   'err-c-accused',   'Accused name is required'],
      ['c-location',  'err-c-location',  'Custody location is required'],
    ];
    let ok = true;
    for (const [id, errId, msg] of fields) {
      if (!document.getElementById(id).value.trim()) {
        Validate.showError(errId, msg); ok = false;
      }
    }
    const phone = document.getElementById('c-rel-phone').value;
    if (!phone || !/\d{10,}/.test(phone.replace(/\D/g,''))) {
      Validate.showError('err-c-rel-phone', 'Valid 10-digit phone number required'); ok = false;
    }
    if (!ok) return;

    const btn = document.getElementById('custody-add-btn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Adding...';

    try {
      await Api.addCustody({
        arrest_id:       document.getElementById('c-arrest-id').value.trim(),
        accused_name:    document.getElementById('c-accused').value.trim(),
        arrest_date:     document.getElementById('c-arrest-date').value,
        custody_location:document.getElementById('c-location').value.trim(),
        relative_phone:  phone,
        relative_name:   document.getElementById('c-rel-name').value.trim() || null,
      });
      Toast.success('Arrest Record Added','Custody monitoring active — video due in 4 hours');
      this.closeModal('add-custody-modal');
      this.render();
    } catch(err) {
      document.getElementById('custody-add-msg').innerHTML = `<div class="alert-banner alert-error">❌ ${err.message}</div>`;
    } finally { btn.disabled = false; btn.innerHTML = '🔒 Add Arrest Record'; }
  },

  async submitVideo() {
    const file = document.getElementById('video-file-input').files[0];
    if (!file) { Toast.error('No file selected','Please select a video file'); return; }
    const note = document.getElementById('video-note').value;
    const btn  = document.getElementById('video-upload-btn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Uploading...';

    try {
      const result = await Api.uploadCustodyVideo(this._currentCustodyId, file, note);
      document.getElementById('video-wa-log').style.display = 'block';
      document.getElementById('video-wa-log').textContent   = result.whatsapp_notification;
      document.getElementById('video-custody-msg').innerHTML =
        '<div class="alert-banner alert-success">✅ Video uploaded! WhatsApp notification sent (mock).</div>';
      Toast.success('Video Uploaded','Relative notified (mock WhatsApp log)');
      setTimeout(() => { this.closeModal('custody-video-modal'); this.render(); }, 2000);
    } catch(err) {
      document.getElementById('video-custody-msg').innerHTML = `<div class="alert-banner alert-error">❌ ${err.message}</div>`;
    } finally { btn.disabled = false; btn.innerHTML = '📤 Upload & Notify'; }
  },

  async release(custodyId) {
    if (!confirm('Release this detainee from custody?')) return;
    try {
      await Api.updateCustody(custodyId, 'released');
      Toast.success('Released','Detainee released from custody');
      this.render();
    } catch(err) { Toast.error('Error', err.message); }
  }
};
