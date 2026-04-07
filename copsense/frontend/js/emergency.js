/**
 * Emergency Response Optimizer Page
 * AI-powered nearest officer suggestion with GPS + Haversine scoring.
 */
const EmergencyPage = {
  _map: null,
  _results: [],

  async render() {
    const content = document.getElementById('page-content');

    content.innerHTML = `
      <div class="page-header">
        <div><h2>Emergency Response Optimizer</h2>
        <p>AI suggests the nearest, most capable available officer for any incident</p></div>
      </div>

      <div class="section-grid" style="margin-bottom:20px;">
        <!-- Input Panel -->
        <div class="card">
          <div class="card-title" style="margin-bottom:20px;">🎯 Incident Details</div>

          <div class="form-group">
            <label>Incident Latitude <span class="required">*</span></label>
            <input type="number" step="any" id="em-lat" class="form-control" placeholder="e.g. 25.5941" value="25.5941">
          </div>
          <div class="form-group">
            <label>Incident Longitude <span class="required">*</span></label>
            <input type="number" step="any" id="em-lng" class="form-control" placeholder="e.g. 85.1376" value="85.1376">
          </div>
          <div class="form-group">
            <label>Required Specialization</label>
            <select id="em-spec" class="form-control">
              <option value="">Any (Best Match)</option>
              <option value="crime">Crime Investigation</option>
              <option value="traffic">Traffic</option>
              <option value="cyber">Cyber Crime</option>
              <option value="vip">VIP / Security</option>
            </select>
          </div>
          <button class="btn btn-secondary btn-sm" style="margin-bottom:16px;" onclick="EmergencyPage.getGPS()">
            📡 Use My GPS
          </button>
          <button class="btn btn-primary btn-lg" onclick="EmergencyPage.findBestOfficer()">
            🆘 Find Best Officer
          </button>
          <div id="em-msg" style="margin-top:12px;"></div>
        </div>

        <!-- Map -->
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div class="card" style="padding:0;overflow:hidden;flex:1;">
            <div id="emergency-map-container" style="height:320px;"></div>
          </div>
          <div class="map-legend">
            <div class="legend-item"><div class="legend-dot" style="background:var(--red);"></div> Incident</div>
            <div class="legend-item"><div class="legend-dot" style="background:var(--green);"></div> Recommended Officer</div>
            <div class="legend-item"><div class="legend-dot" style="background:var(--accent);"></div> Other Officers</div>
          </div>
        </div>
      </div>

      <!-- Results -->
      <div id="em-results"></div>
    `;

    this._initMap(25.5941, 85.1376);
  },

  _initMap(lat, lng) {
    if (this._map) { this._map.remove(); this._map = null; }
    this._map = L.map('emergency-map-container').setView([lat, lng], 13);
    // Light tile layer (CartoDB Positron)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© CopSense', maxZoom: 19
    }).addTo(this._map);
  },

  getGPS() {
    if (!navigator.geolocation) { Toast.error('No GPS','Browser GPS unavailable'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        document.getElementById('em-lat').value = pos.coords.latitude.toFixed(6);
        document.getElementById('em-lng').value = pos.coords.longitude.toFixed(6);
        Toast.success('GPS Acquired', `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        this._initMap(pos.coords.latitude, pos.coords.longitude);
      },
      err => Toast.error('GPS Error', err.message)
    );
  },

  async findBestOfficer() {
    const lat  = parseFloat(document.getElementById('em-lat').value);
    const lng  = parseFloat(document.getElementById('em-lng').value);
    const spec = document.getElementById('em-spec').value;

    if (isNaN(lat) || isNaN(lng)) {
      document.getElementById('em-msg').innerHTML = '<div class="alert-banner alert-error">❌ Valid coordinates required</div>';
      return;
    }

    document.getElementById('em-msg').innerHTML = '<div class="loading-overlay" style="padding:20px;"><div class="spinner-lg"></div></div>';
    document.getElementById('em-results').innerHTML = '';

    try {
      const data = await Api.emergencyOptimizer(lat, lng, spec || null);
      this._results = data.recommendations;
      this._renderResults(data);
      this._renderMap(data);
    } catch(err) {
      document.getElementById('em-msg').innerHTML = `<div class="alert-banner alert-error">❌ ${err.message}</div>`;
    }
  },

  _renderResults(data) {
    const el = document.getElementById('em-results');
    const recs = data.recommendations;
    document.getElementById('em-msg').innerHTML = '';

    if (!recs || recs.length === 0) {
      el.innerHTML = Util.emptyState('😔','No available officers found near this location');
      return;
    }

    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">🏆 Officer Recommendations (Top ${recs.length})</div>
          <span style="font-size:12px;color:var(--text-secondary);">
            📍 Incident: ${data.incident_location.lat.toFixed(4)}, ${data.incident_location.lng.toFixed(4)}
            ${data.required_specialization ? ` | Specialization: ${data.required_specialization}` : ''}
          </span>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;">
          ${recs.map((r, i) => `
            <div style="padding:16px;background:var(--bg-card2);border-radius:${`var(--radius-sm)`};
              border:2px solid ${i === 0 ? 'var(--green)' : 'var(--border)'};
              position:relative;overflow:hidden;">
              ${i === 0 ? `<div style="position:absolute;top:0;right:0;background:var(--green);color:var(--bg-primary);
                font-size:11px;font-weight:700;padding:4px 12px;border-radius:0 0 0 8px;">
                🏆 BEST MATCH
              </div>` : ''}
              <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
                <div style="font-size:28px;">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '👮'}</div>
                <div style="flex:1;">
                  <div style="font-size:16px;font-weight:700;margin-bottom:4px;">
                    ${r.officer_name}
                    <span style="font-size:12px;color:var(--text-muted);font-family:'JetBrains Mono',monospace;margin-left:8px;">${r.badge_id}</span>
                  </div>
                  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
                    <span class="badge badge-active">${r.specialization}</span>
                    <span class="badge badge-medium">📍 ${r.distance_km} km away</span>
                    <span class="badge badge-warning" style="background:rgba(255,159,64,0.15);color:var(--orange);border:1px solid rgba(255,159,64,0.3);">
                      ⏱️ ETA ~${r.eta_minutes} min
                    </span>
                  </div>
                  <!-- Score breakdown -->
                  <div style="display:flex;gap:16px;font-size:12px;color:var(--text-secondary);">
                    <span>Distance Score: <strong style="color:var(--accent)">${r.distance_score}</strong></span>
                    <span>Spec Bonus: <strong style="color:var(--green)">+${r.specialization_bonus}</strong></span>
                    <span>Workload Penalty: <strong style="color:var(--red)">-${r.workload_penalty}</strong></span>
                    <span>Total: <strong style="color:${i===0?'var(--green)':'var(--text-primary)'};font-size:14px">${r.total_score}</strong></span>
                  </div>
                </div>
                ${i === 0 ? `
                <button class="btn btn-success btn-sm" onclick="Toast.success('Dispatching...','${r.officer_name} has been notified')">
                  🚨 Dispatch
                </button>` : ''}
              </div>
            </div>`).join('')}
        </div>
      </div>
    `;
  },

  _renderMap(data) {
    const { lat, lng } = data.incident_location;
    const recs = data.recommendations;

    if (!this._map) this._initMap(lat, lng);
    else this._map.setView([lat, lng], 13);

    // Clear layers (except tiles)
    this._map.eachLayer(layer => {
      if (layer instanceof L.CircleMarker || layer instanceof L.Marker) {
        this._map.removeLayer(layer);
      }
    });

    // Incident marker
    L.circleMarker([lat, lng], {
      radius: 14, fillColor: '#ff4d6d', color: '#fff', weight: 3, fillOpacity: 1
    }).addTo(this._map).bindPopup('<strong>🚨 Incident Location</strong>').openPopup();

    // Officer markers
    recs.forEach((r, i) => {
      // We don't have real officer coords returned but can approximate from distance
      // In production this would use actual last known GPS
      const color = i === 0 ? '#00d4aa' : '#4f7bff';
      // Place at offset from incident for visual demo
      const angle = i * (360 / recs.length) * (Math.PI / 180);
      const offsetLat = lat + Math.cos(angle) * (r.distance_km / 111);
      const offsetLng = lng + Math.sin(angle) * (r.distance_km / 111);

      L.circleMarker([offsetLat, offsetLng], {
        radius: i === 0 ? 12 : 8,
        fillColor: color, color: '#fff', weight: 2, fillOpacity: 0.9
      }).addTo(this._map).bindPopup(`
        <strong>#${i+1} ${r.officer_name}</strong><br>
        ${r.badge_id}<br>
        ${r.distance_km} km away<br>
        ETA: ${r.eta_minutes} min<br>
        Score: ${r.total_score}
      `);

      // Line from incident to officer
      L.polyline([[lat, lng], [offsetLat, offsetLng]], {
        color: color, weight: i === 0 ? 2 : 1, dashArray: i === 0 ? undefined : '4', opacity: 0.6
      }).addTo(this._map);
    });
  }
};
