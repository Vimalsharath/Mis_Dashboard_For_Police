/**
 * Citizen Feedback Flow — multi-step NLP-powered submission.
 * Citizens: select station → view officers → submit feedback.
 * Officers/SSP: view feedback table with sensitivity.
 */
const FeedbackPage = {
  _step: 1,
  _station: null,
  _officers: [],
  _selected: [],
  _feedbackType: 'officer',

  async render() {
    const role = Auth.role();
    const content = document.getElementById('page-content');

    if (role === 'citizen') {
      this._step = 1;
      this._station = null;
      this._selected = [];
      await this._renderCitizenFlow(content);
    } else {
      await this._renderStaffView(content);
    }
  },

  async _renderCitizenFlow(content) {
    try {
      const stations = await Api.stations();

      content.innerHTML = `
        <div class="page-header">
          <div><h2>Submit Officer Feedback</h2>
          <p>Your feedback helps improve policing standards</p></div>
        </div>

        <!-- Step Indicator -->
        <div class="steps" id="step-indicator">
          <div class="step ${this._step >= 1 ? 'active' : ''}" id="step-s1">
            <div class="step-num">1</div>
            <div class="step-label">Select Station</div>
          </div>
          <div class="step-line ${this._step > 1 ? 'done' : ''}"></div>
          <div class="step ${this._step >= 2 ? 'active' : ''}" id="step-s2">
            <div class="step-num">2</div>
            <div class="step-label">Choose Officers</div>
          </div>
          <div class="step-line ${this._step > 2 ? 'done' : ''}"></div>
          <div class="step ${this._step >= 3 ? 'active' : ''}" id="step-s3">
            <div class="step-num">3</div>
            <div class="step-label">Write Feedback</div>
          </div>
        </div>

        <!-- Step 1: Select Station -->
        <div id="fb-step1" class="card" ${this._step !== 1 ? 'style="display:none"' : ''}>
          <div class="card-title" style="margin-bottom:20px;">🚔 Select a Police Station</div>
          <div class="form-group">
            <label>Police Station <span class="required">*</span></label>
            <select id="fb-station" class="form-control" onchange="FeedbackPage._onStationChange()">
              <option value="">-- Select Station --</option>
              ${stations.map(s => `<option value="${s.id}" data-name="${s.name}">${s.name} — ${s.district}</option>`).join('')}
            </select>
            <div class="field-error" id="err-fb-station"></div>
          </div>
          <button class="btn btn-primary" onclick="FeedbackPage._nextStep(1)">
            Next: View Officers →
          </button>
        </div>

        <!-- Step 2: Select Officers -->
        <div id="fb-step2" style="${this._step !== 2 ? 'display:none' : ''}">
          <div class="card" style="margin-bottom:16px;">
            <div class="card-title" style="margin-bottom:16px;">👮 Officers at Selected Station</div>
            <div class="form-group">
              <label>Feedback Type <span class="required">*</span></label>
              <select id="fb-type" class="form-control" onchange="FeedbackPage._onTypeChange()">
                <option value="officer">Against a Specific Officer</option>
                <option value="multiple">Against Multiple Officers</option>
                <option value="station">Against Entire Station</option>
              </select>
            </div>
            <div id="officer-grid-wrap">
              <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">
                Click to select officer(s). Selected: <strong id="selected-count">0</strong>
              </p>
              <div class="officer-grid" id="officer-grid">
                <div class="loading-overlay"><div class="spinner-lg"></div></div>
              </div>
              <div class="field-error" id="err-fb-officers"></div>
            </div>
          </div>
          <div style="display:flex;gap:12px;">
            <button class="btn btn-secondary" onclick="FeedbackPage._goStep(1)">← Back</button>
            <button class="btn btn-primary" onclick="FeedbackPage._nextStep(2)">Next: Write Feedback →</button>
          </div>
        </div>

        <!-- Step 3: Write Feedback -->
        <div id="fb-step3" class="card" style="${this._step !== 3 ? 'display:none' : ''}">
          <div class="card-title" style="margin-bottom:20px;">✍️ Write Your Feedback</div>

          <div id="fb-selection-summary" style="background:var(--bg-card2);border-radius:8px;padding:14px;margin-bottom:20px;border:1px solid var(--border);">
          </div>

          <div class="form-group">
            <label>Your Feedback <span class="required">*</span> (10–2000 characters)</label>
            <textarea id="fb-text" class="form-control" rows="6"
              placeholder="Describe your experience in detail. Be specific about the officer's behavior and the incident..."
              oninput="FeedbackPage._onTextInput()"></textarea>
            <div class="char-counter"><span id="fb-char-count">0</span> / 2000</div>
            <div class="field-error" id="err-fb-text"></div>
          </div>

          <!-- NLP Preview (live analysis) -->
          <div class="nlp-result" id="nlp-preview">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">
              🤖 Sensitivity Analysis (AI Preview)
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <span id="nlp-level-badge"></span>
              <span id="nlp-keywords" style="font-size:12px;color:var(--text-secondary);"></span>
            </div>
            <div class="sensitivity-bar">
              <div class="sensitivity-fill" id="nlp-fill" style="width:0%;background:var(--green);"></div>
            </div>
          </div>

          <div id="fb-submit-msg" style="margin-top:12px;"></div>

          <div style="display:flex;gap:12px;margin-top:20px;">
            <button class="btn btn-secondary" onclick="FeedbackPage._goStep(2)">← Back</button>
            <button class="btn btn-primary" id="fb-submit-btn" onclick="FeedbackPage._submit()">
              📤 Submit Feedback
            </button>
          </div>
        </div>
      `;

      // Load officers if step 2
      if (this._step === 2 && this._station) {
        await this._loadOfficers(this._station);
      }
    } catch(err) {
      content.innerHTML = `<div class="alert-banner alert-error">❌ ${err.message}</div>`;
    }
  },

  _onTypeChange() {
    this._feedbackType = document.getElementById('fb-type').value;
    const grid = document.getElementById('officer-grid-wrap');
    grid.style.display = this._feedbackType === 'station' ? 'none' : 'block';
    this._selected = [];
    document.querySelectorAll('.officer-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('selected-count').textContent = '0';
  },

  async _onStationChange() {
    const sel = document.getElementById('fb-station');
    this._station = sel.value;
    Validate.clearError('err-fb-station');
  },

  async _nextStep(from) {
    if (from === 1) {
      const stationEl = document.getElementById('fb-station');
      if (!stationEl.value) {
        Validate.showError('err-fb-station', 'Please select a police station');
        return;
      }
      this._station = stationEl.value;
      this._goStep(2);
      await this._loadOfficers(this._station);
    } else if (from === 2) {
      this._feedbackType = document.getElementById('fb-type').value;
      if (this._feedbackType !== 'station' && this._selected.length === 0) {
        Validate.showError('err-fb-officers', 'Please select at least one officer');
        return;
      }
      if (this._feedbackType === 'officer' && this._selected.length > 1) {
        this._selected = [this._selected[0]];
      }
      this._goStep(3);
      this._renderSelectionSummary();
    }
  },

  _goStep(n) {
    this._step = n;
    for (let i = 1; i <= 3; i++) {
      const el = document.getElementById(`fb-step${i}`);
      if (el) el.style.display = i === n ? 'block' : 'none';
      const si = document.getElementById(`step-s${i}`);
      if (si) {
        si.className = `step ${i < n ? 'done' : i === n ? 'active' : ''}`;
      }
    }
  },

  async _loadOfficers(stationId) {
    const grid = document.getElementById('officer-grid');
    if (!grid) return;
    grid.innerHTML = '<div class="loading-overlay"><div class="spinner-lg"></div></div>';
    try {
      this._officers = await Api.stationOfficers(stationId);
      if (this._officers.length === 0) {
        grid.innerHTML = Util.emptyState('👮', 'No officers registered at this station');
        return;
      }
      grid.innerHTML = this._officers.map(o => `
        <div class="officer-card" id="oc-${o.id}" onclick="FeedbackPage._toggleOfficer(${o.id})">
          <img src="${o.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(o.name)}&background=1a2744&color=fff&size=128`}"
               alt="${o.name}" class="officer-photo"
               onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(o.name)}&background=1a2744&color=fff&size=128'">
          <div class="officer-name">${o.name}</div>
          <div class="officer-badge">${o.badge_id || '—'}</div>
          <div class="officer-rank">${o.rank || 'Officer'}</div>
          <div style="margin-top:8px;">
            ${o.is_available ? '<span class="badge badge-active">● Active</span>' : '<span class="badge badge-closed">● Off Duty</span>'}
          </div>
        </div>
      `).join('');
    } catch(err) {
      grid.innerHTML = `<div class="alert-banner alert-error">❌ ${err.message}</div>`;
    }
  },

  _toggleOfficer(id) {
    const type = document.getElementById('fb-type').value;
    const card = document.getElementById(`oc-${id}`);
    const idx  = this._selected.indexOf(id);

    if (type === 'officer') {
      // Single selection
      this._selected = [id];
      document.querySelectorAll('.officer-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
    } else {
      if (idx === -1) {
        this._selected.push(id);
        card.classList.add('selected');
      } else {
        this._selected.splice(idx, 1);
        card.classList.remove('selected');
      }
    }
    document.getElementById('selected-count').textContent = this._selected.length;
    Validate.clearError('err-fb-officers');
  },

  _renderSelectionSummary() {
    const el = document.getElementById('fb-selection-summary');
    if (!el) return;
    const type = this._feedbackType;
    const stationSel = document.getElementById('fb-station');
    const stationName = stationSel?.options[stationSel.selectedIndex]?.dataset.name || 'Selected Station';

    if (type === 'station') {
      el.innerHTML = `<strong>📋 Feedback target:</strong> Entire station — <em>${stationName}</em>`;
    } else {
      const names = this._selected.map(id => {
        const o = this._officers.find(x => x.id === id);
        return o ? o.name : `Officer #${id}`;
      });
      el.innerHTML = `<strong>📋 Feedback target${names.length > 1 ? 's' : ''}:</strong> ${names.join(', ')}`;
    }
  },

  _nlpAnalyze: (() => {
    // Client-side lightweight keyword preview (mirrors backend)
    const critical = ['rape','torture','bribe','extortion','murder','brutality','corruption','blackmail'];
    const high     = ['assault','beat','abuse','drunk','threat','misbehave','harass','bribery','demand'];
    const medium   = ['late','slow','delay','ignored','unhelpful','impolite','careless','poor service'];

    return (text) => {
      const t = text.toLowerCase();
      if (critical.some(k => t.includes(k))) return { level:'critical', score:100, color:'var(--risk-critical)' };
      if (high.some(k => t.includes(k)))     return { level:'high',     score:75,  color:'var(--red)' };
      if (medium.some(k => t.includes(k)))   return { level:'medium',   score:45,  color:'var(--orange)' };
      return { level:'low', score:15, color:'var(--green)' };
    };
  })(),

  _onTextInput() {
    const text = document.getElementById('fb-text').value;
    document.getElementById('fb-char-count').textContent = text.length;

    const preview  = document.getElementById('nlp-preview');
    const levelBadge = document.getElementById('nlp-level-badge');
    const fill     = document.getElementById('nlp-fill');

    if (text.length >= 10) {
      preview.classList.add('show');
      const result = this._nlpAnalyze(text);
      levelBadge.innerHTML = Util.severityBadge(result.level);
      fill.style.width  = result.score + '%';
      fill.style.background = result.color;
    } else {
      preview.classList.remove('show');
    }

    if (text.length < 10) Validate.showError('err-fb-text', 'Feedback must be at least 10 characters');
    else if (text.length > 2000) Validate.showError('err-fb-text', 'Cannot exceed 2000 characters');
    else Validate.clearError('err-fb-text');
  },

  async _submit() {
    const text = document.getElementById('fb-text').value.trim();

    if (!text || text.length < 10) {
      Validate.showError('err-fb-text', 'Feedback must be at least 10 characters');
      return;
    }
    if (text.length > 2000) {
      Validate.showError('err-fb-text', 'Cannot exceed 2000 characters');
      return;
    }

    const btn = document.getElementById('fb-submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Submitting...';

    const payload = {
      station_id:    parseInt(this._station),
      officer_ids:   this._selected,
      feedback_type: this._feedbackType,
      text
    };

    try {
      const result = await Api.submitFeedback(payload);
      document.getElementById('fb-submit-msg').innerHTML = `
        <div class="alert-banner alert-success">
          ✅ Feedback submitted successfully!
          Sensitivity classified as: ${Util.severityBadge(result.sensitivity)}
          ${['high','critical'].includes(result.sensitivity) ? '<br>⚠️ Alert sent to higher officer for review.' : ''}
        </div>`;
      document.getElementById('fb-text').value = '';
      Toast.success('Feedback Submitted', 'Your feedback has been recorded.');
      setTimeout(() => this.render(), 3000);
    } catch(err) {
      document.getElementById('fb-submit-msg').innerHTML =
        `<div class="alert-banner alert-error">❌ ${err.message}</div>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '📤 Submit Feedback';
    }
  },

  async _renderStaffView(content) {
    try {
      const [feedbacks, statsRaw] = await Promise.allSettled([Api.getFeedback(), Api.feedbackStats()]);
      const fb    = feedbacks.status === 'fulfilled' ? feedbacks.value : [];
      const stats = statsRaw.status  === 'fulfilled' ? statsRaw.value  : {};

      content.innerHTML = `
        <div class="page-header">
          <div><h2>Citizen Feedback</h2><p>NLP-classified feedback from citizens</p></div>
        </div>

        <!-- Stats -->
        <div class="stats-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:20px;">
          ${[
            { label:'Total',    value: stats.total    || 0, color:'var(--accent)' },
            { label:'Low',      value: stats.low      || 0, color:'var(--green)' },
            { label:'Medium',   value: stats.medium   || 0, color:'var(--orange)' },
            { label:'High',     value: stats.high     || 0, color:'var(--red)' },
            { label:'Critical', value: stats.critical || 0, color:'var(--risk-critical)' },
          ].map(s => `
            <div class="stat-card" style="--accent-color:${s.color}">
              <div class="stat-value">${s.value}</div>
              <div class="stat-label">${s.label} Sensitivity</div>
            </div>`).join('')}
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">💬 All Feedback</div>
          </div>
          ${fb.length === 0 ? Util.emptyState('💬','No feedback submitted yet') : `
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th>#</th><th>Type</th><th>Station</th><th>Feedback</th>
                <th>Sensitivity</th><th>Date</th>
              </tr></thead>
              <tbody>
                ${fb.map((f,i) => `
                  <tr>
                    <td class="td-muted">${i+1}</td>
                    <td><span class="badge badge-medium">${f.feedback_type}</span></td>
                    <td class="td-muted">${f.station_id}</td>
                    <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
                        title="${f.text}">${f.text}</td>
                    <td>${Util.severityBadge(f.sensitivity)}</td>
                    <td class="td-muted">${Util.formatDate(f.created_at)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>`}
        </div>
      `;
    } catch(err) {
      content.innerHTML = `<div class="alert-banner alert-error">❌ ${err.message}</div>`;
    }
  }
};
