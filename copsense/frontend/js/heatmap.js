/**
 * Crime Heatmap Page — Leaflet.js + Leaflet.heat
 * Shows crime events as color-coded intensity map + station risk markers.
 */
const HeatmapPage = {
  _map: null,
  _heatLayer: null,

  async render() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Crime Heatmap</h2>
          <p>Real-time crime distribution and zone risk levels</p>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary btn-sm" onclick="HeatmapPage.refresh()">🔄 Refresh</button>
        </div>
      </div>

      <!-- Summary Stats -->
      <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px;" id="heatmap-stats"></div>

      <!-- Map -->
      <div class="card" style="padding:0;overflow:hidden;">
        <div id="heatmap-container" style="height:500px;"></div>
      </div>

      <!-- Legend -->
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-top:12px;">
        <div class="map-legend">
          <div class="legend-item"><div class="legend-dot" style="background:#00d4aa;"></div> Low Crime</div>
          <div class="legend-item"><div class="legend-dot" style="background:#ff9f40;"></div> Medium Crime</div>
          <div class="legend-item"><div class="legend-dot" style="background:#ff4d6d;"></div> High Crime</div>
        </div>
        <div style="font-size:12px;color:var(--text-muted)">
          🔵 Circle markers = Police Stations. Click marker for details.
        </div>
      </div>

      <!-- Station Table -->
      <div class="card" style="margin-top:20px;">
        <div class="card-header">
          <div class="card-title">🚔 Station Risk Overview</div>
        </div>
        <div id="station-overview-table"></div>
      </div>
    `;

    await this.refresh();
  },

  async refresh() {
    try {
      const [heatData, stationsData] = await Promise.all([
        Api.heatmapData(),
        Api.stationsOverview()
      ]);

      this._renderStats(heatData.summary);
      this._renderMap(heatData.points, stationsData);
      this._renderStationTable(stationsData);
    } catch(err) {
      Toast.error('Heatmap Error', err.message);
    }
  },

  _renderStats(summary) {
    const el = document.getElementById('heatmap-stats');
    if (!el || !summary) return;
    el.innerHTML = [
      { label:'Total Events',     value: summary.total_events, color:'var(--accent)',  icon:'📍' },
      { label:'FIR Count',        value: summary.fir_count,    color:'var(--red)',     icon:'📋' },
      { label:'High Crimes',      value: summary.high_crimes,  color:'var(--red)',     icon:'🔴' },
      { label:'Overall Risk',     value: summary.overall_risk.toUpperCase(), color: summary.overall_risk==='red'?'var(--red)':summary.overall_risk==='orange'?'var(--orange)':'var(--green)', icon:'🗺️' },
    ].map(s => `
      <div class="stat-card" style="--accent-color:${s.color}">
        <div class="stat-icon">${s.icon}</div>
        <div class="stat-value" style="font-size:24px;">${s.value}</div>
        <div class="stat-label">${s.label}</div>
      </div>`).join('');
  },

  _renderMap(points, stations) {
    // Destroy old map instance
    if (this._map) { this._map.remove(); this._map = null; }

    const center = stations.length > 0
      ? [stations[0].lat, stations[0].lng]
      : [25.5941, 85.1376];

    this._map = L.map('heatmap-container').setView(center, 13);

    // Light tile layer (CartoDB Positron)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© CopSense | © OpenStreetMap | © CARTO',
      maxZoom: 19,
    }).addTo(this._map);

    // Heatmap layer
    if (points && points.length > 0) {
      const heatPoints = points.map(p => [p.lat, p.lng, p.intensity]);
      this._heatLayer = L.heatLayer(heatPoints, {
        radius: 35,
        blur: 20,
        maxZoom: 17,
        gradient: { 0.0: '#00d4aa', 0.4: '#ff9f40', 0.7: '#ff4d6d', 1.0: '#ff0055' }
      }).addTo(this._map);
    }

    // Station markers
    stations.forEach(s => {
      const color = s.risk_level === 'red' ? '#ff4d6d' : s.risk_level === 'orange' ? '#ff9f40' : '#00d4aa';
      const marker = L.circleMarker([s.lat, s.lng], {
        radius: 12,
        fillColor: color,
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.85
      }).addTo(this._map);

      marker.bindPopup(`
        <div style="font-family:Inter,sans-serif;min-width:200px;">
          <strong style="font-size:14px;">🚔 ${s.station_name}</strong><br>
          <span style="color:#888;font-size:12px;">${s.district}</span><br><br>
          <table style="width:100%;font-size:12px;">
            <tr><td>FIRs:</td><td><strong>${s.fir_count}</strong></td></tr>
            <tr><td>Open FIRs:</td><td><strong style="color:#ff4d6d">${s.open_firs}</strong></td></tr>
            <tr><td>Complaints:</td><td><strong>${s.complaint_count}</strong></td></tr>
            <tr><td>Risk Level:</td><td><strong style="color:${color}">${s.risk_level.toUpperCase()}</strong></td></tr>
          </table>
        </div>
      `, { maxWidth: 250 });
    });
  },

  _renderStationTable(stations) {
    const el = document.getElementById('station-overview-table');
    if (!el) return;
    if (!stations || stations.length === 0) {
      el.innerHTML = Util.emptyState('🚔', 'No station data available');
      return;
    }
    el.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Station</th><th>District</th><th>FIRs</th><th>Open FIRs</th><th>Complaints</th><th>Risk Level</th>
          </tr></thead>
          <tbody>
            ${stations.map(s => `
              <tr>
                <td><strong>${s.station_name}</strong></td>
                <td class="td-muted">${s.district}</td>
                <td>${s.fir_count}</td>
                <td style="color:var(--red);font-weight:600;">${s.open_firs}</td>
                <td>${s.complaint_count}</td>
                <td>${Util.riskBadge(s.risk_level)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }
};
