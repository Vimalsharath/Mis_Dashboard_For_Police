/**
 * CopSense API Client
 * Central HTTP layer — all fetch calls go through here with JWT headers.
 */
const API_BASE = 'http://localhost:8000';

const Api = {
  _token: null,

  setToken(t) { this._token = t; },
  clearToken() { this._token = null; },

  headers(extra = {}) {
    const h = { 'Content-Type': 'application/json', ...extra };
    if (this._token) h['Authorization'] = `Bearer ${this._token}`;
    return h;
  },

  async _fetch(method, path, body = null, isForm = false) {
    const opts = {
      method,
      headers: isForm ? { Authorization: `Bearer ${this._token}` } : this.headers()
    };
    if (body) opts.body = isForm ? body : JSON.stringify(body);

    const res = await fetch(API_BASE + path, opts);

    if (res.status === 401) {
      Auth.logout();
      return null;
    }

    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json() : await res.text();

    if (!res.ok) {
      const msg = data?.detail || data?.message || JSON.stringify(data) || `HTTP ${res.status}`;
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
    return data;
  },

  get:    (p)     => Api._fetch('GET',    p),
  post:   (p, b)  => Api._fetch('POST',   p, b),
  put:    (p, b)  => Api._fetch('PUT',    p, b),
  delete: (p)     => Api._fetch('DELETE', p),
  upload: (p, fd) => Api._fetch('POST',   p, fd, true),

  // ── Auth ──────────────────────────────────────────────
  login:    (d) => Api.post('/api/auth/login', d),
  register: (d) => Api.post('/api/auth/register', d),
  me:       ()  => Api.get('/api/auth/me'),

  // ── Dashboard ─────────────────────────────────────────
  dashboardStats: () => Api.get('/api/ai/dashboard-stats'),

  // ── Stations & Officers ───────────────────────────────
  stations:             ()   => Api.get('/api/stations'),
  stationOfficers:      (id) => Api.get(`/api/stations/${id}/officers`),

  // ── Feedback ─────────────────────────────────────────
  submitFeedback:  (d) => Api.post('/api/feedback', d),
  getFeedback:     ()  => Api.get('/api/feedback'),
  feedbackStats:   ()  => Api.get('/api/feedback/stats'),

  // ── FIR ──────────────────────────────────────────────
  createFIR:       (d)    => Api.post('/api/fir', d),
  getFIRs:         ()     => Api.get('/api/fir'),
  updateFIRStatus: (id,s) => Api.put(`/api/fir/${id}/status?status=${s}`),
  uploadEvidence:  (id,f) => {
    const fd = new FormData(); fd.append('file', f);
    return Api.upload(`/api/fir/${id}/evidence`, fd);
  },

  // ── Complaints ───────────────────────────────────────
  createComplaint:  (d)      => Api.post('/api/complaints', d),
  getComplaints:    ()       => Api.get('/api/complaints'),
  assignComplaint:  (id, oid)=> Api.put(`/api/complaints/${id}/assign?officer_id=${oid}`),
  updateComplaint:  (id, s)  => Api.put(`/api/complaints/${id}/status?status=${s}`),

  // ── Duty ─────────────────────────────────────────────
  createDuty:       (d) => Api.post('/api/duty', d),
  getDuties:        ()  => Api.get('/api/duty'),
  getActiveDuties:  ()  => Api.get('/api/duty/active'),
  reportViolation:  (d) => Api.post('/api/duty/report-violation', d),
  completeDuty:     (id)=> Api.put(`/api/duty/${id}/complete`),
  getViolations:    ()  => Api.get('/api/duty/violations'),

  // ── Custody ──────────────────────────────────────────
  addCustody:        (d)    => Api.post('/api/custody', d),
  getCustody:        ()     => Api.get('/api/custody'),
  uploadCustodyVideo:(id,f,note) => {
    const fd = new FormData(); fd.append('file', f);
    return Api.upload(`/api/custody/${id}/video?note=${encodeURIComponent(note||'')}`, fd);
  },
  getCustodyVideos:  (id)  => Api.get(`/api/custody/${id}/videos`),
  checkOverdue:      ()    => Api.get('/api/custody/check-overdue'),
  updateCustody:     (id,s)=> Api.put(`/api/custody/${id}/status?status=${s}`),

  // ── Deployment ───────────────────────────────────────
  planDeployment:    (d)      => Api.post('/api/deployment/plan', d),
  createDeployment:  (d)      => Api.post('/api/deployment', d),
  assignOfficers:    (id, ids)=> Api.post(`/api/deployment/${id}/assign-officers`, ids),
  getDeployments:    ()       => Api.get('/api/deployment'),
  getDeployment:     (id)     => Api.get(`/api/deployment/${id}`),

  // ── Heatmap ──────────────────────────────────────────
  heatmapData:       ()  => Api.get('/api/heatmap/data'),
  stationsOverview:  ()  => Api.get('/api/heatmap/stations-overview'),

  // ── Alerts ───────────────────────────────────────────
  getAlerts:         ()       => Api.get('/api/alerts'),
  resolveAlert:      (id)     => Api.put(`/api/alerts/${id}/resolve`),

  // ── Cases ────────────────────────────────────────────
  getCases:            ()          => Api.get('/api/cases'),
  getCase:             (id)        => Api.get(`/api/cases/${id}`),
  createCase:          (d)         => Api.post('/api/cases', d),
  updateCaseStatus:    (id, s, n)  => Api.patch(`/api/cases/${id}/status?status=${encodeURIComponent(s)}&notes=${encodeURIComponent(n||'')}`),
  overrideCasePriority:(id, p)     => Api.patch(`/api/cases/${id}/priority?priority=${p}`),
  assignOfficer:       (id, oid)   => Api.patch(`/api/cases/${id}/assign?officer_id=${oid}`),

  // ── AI ───────────────────────────────────────────────
  emergencyOptimizer:(lat, lng, spec) => {
    let url = `/api/ai/emergency-response?incident_lat=${lat}&incident_lng=${lng}`;
    if (spec) url += `&required_specialization=${spec}`;
    return Api.post(url);
  },
};

// ── Toast Notifications ───────────────────────────────────────────────────────
const Toast = {
  show(type, title, msg, duration = 4000) {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
      <div class="toast-icon">${icons[type] || 'ℹ️'}</div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
      </div>
    `;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => el.remove(), duration);
  },
  success: (t, m) => Toast.show('success', t, m),
  error:   (t, m) => Toast.show('error',   t, m),
  warning: (t, m) => Toast.show('warning', t, m),
  info:    (t, m) => Toast.show('info',    t, m),
};

// ── Validation Helpers ────────────────────────────────────────────────────────
const Validate = {
  showError(fieldId, msg) {
    const el = document.getElementById(fieldId);
    if (el) { el.textContent = msg; el.classList.add('show'); }
    const input = document.getElementById(fieldId.replace('err-', ''));
    if (input) input.classList.add('error');
  },
  clearError(fieldId) {
    const el = document.getElementById(fieldId);
    if (el) { el.textContent = ''; el.classList.remove('show'); }
    const input = document.getElementById(fieldId.replace('err-', ''));
    if (input) input.classList.remove('error');
  },
  clearAll(prefix) {
    document.querySelectorAll(`[id^="err-${prefix}"]`).forEach(el => {
      el.textContent = ''; el.classList.remove('show');
    });
    document.querySelectorAll('.form-control.error').forEach(el => el.classList.remove('error'));
  },
  phone(v) { return /\d{10,}/.test(v.replace(/\D/g, '')); },
  required(v) { return v && v.trim().length > 0; },
  minLen(v, n) { return v && v.trim().length >= n; },
};

// ── Utility ───────────────────────────────────────────────────────────────────
const Util = {
  formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  },
  formatDateOnly(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' });
  },
  severityBadge(s) {
    const map = { low:'badge-low', medium:'badge-medium', high:'badge-high', critical:'badge-critical' };
    return `<span class="badge ${map[s]||'badge-medium'}">${s||'—'}</span>`;
  },
  statusBadge(s) {
    const map = {
      open:'badge-open', closed:'badge-closed', investigating:'badge-investigating',
      pending:'badge-pending', reviewing:'badge-reviewing', resolved:'badge-resolved',
      active:'badge-active', completed:'badge-completed', in_custody:'badge-open',
      released:'badge-closed', court:'badge-reviewing', planned:'badge-pending'
    };
    const label = s?.replace(/_/g,' ') || '—';
    return `<span class="badge ${map[s]||'badge-medium'}">${label}</span>`;
  },
  riskBadge(r) {
    const map = { green:'badge-green', orange:'badge-orange', red:'badge-red' };
    const label = r === 'green' ? '🟢 Low Risk' : r === 'orange' ? '🟠 Medium Risk' : '🔴 High Risk';
    return `<span class="badge ${map[r]||'badge-green'}">${label}</span>`;
  },
  emptyState(icon, msg) {
    return `<div class="empty-state"><div class="empty-icon">${icon}</div><p>${msg}</p></div>`;
  },
  modal(title, html) {
    const el = document.createElement('div');
    el.id = 'app-modal';
    el.className = 'modal-overlay open';
    el.innerHTML = `
      <div class="modal animate-in">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close" onclick="Util.closeModal()">×</button>
        </div>
        <div class="modal-body">${html}</div>
      </div>
    `;
    document.body.appendChild(el);
  },
  closeModal() {
    const el = document.getElementById('app-modal');
    if (el) el.remove();
  }
};
