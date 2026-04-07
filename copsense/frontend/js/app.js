/**
 * CopSense App Router & Navigation
 * Builds sidebar by role, handles page routing.
 */

const NAV_ITEMS = {
  ssp: [
    { section: 'Overview' },
    { id: 'dashboard',   icon: '📊', label: 'Dashboard' },
    { id: 'alerts',      icon: '🔔', label: 'Smart Alert Center', badge: true },
    { section: 'Operations' },
    { id: 'heatmap',     icon: '🗺️', label: 'Crime Heatmap' },
    { id: 'deployment',  icon: '🚀', label: 'Deployment & Events' },
    { id: 'duty',        icon: '📍', label: 'Officer Duty Board' },
    { id: 'emergency',   icon: '🆘', label: 'Emergency Optimizer' },
    { section: 'Case Management' },
    { id: 'fir',         icon: '📋', label: 'FIR Management' },
    { id: 'cases',       icon: '📁', label: 'Strategic Cases' },
    { id: 'complaints',  icon: '📢', label: 'Complaints' },
    { id: 'custody',     icon: '🔒', label: 'Custody Safety' },
    { section: 'Intelligence' },
    { id: 'feedback',    icon: '💬', label: 'Citizen Feedback' },
  ],
  station_officer: [
    { section: 'Overview' },
    { id: 'dashboard',   icon: '📊', label: 'Dashboard' },
    { id: 'alerts',      icon: '🔔', label: 'Alert Center', badge: true },
    { section: 'My Station' },
    { id: 'duty',        icon: '📍', label: 'Officer Duty Board' },
    { id: 'deployment',  icon: '🚀', label: 'Event Deployment' },
    { id: 'heatmap',     icon: '🗺️', label: 'Crime Heatmap' },
    { section: 'Cases' },
    { id: 'fir',         icon: '📋', label: 'FIR Management' },
    { id: 'cases',       icon: '📁', label: 'Strategic Cases' },
    { id: 'complaints',  icon: '📢', label: 'Complaints' },
    { id: 'custody',     icon: '🔒', label: 'Custody Safety' },
    { id: 'feedback',    icon: '💬', label: 'Citizen Feedback' },
  ],
  field_officer: [
    { section: 'My Assignments' },
    { id: 'dashboard',   icon: '📊', label: 'My Dashboard' },
    { id: 'alerts',      icon: '🔔', label: 'My Alerts', badge: true },
    { id: 'duty',        icon: '📍', label: 'My Duty' },
    { id: 'custody',     icon: '🔒', label: 'Custody Updates' },
    { id: 'fir',         icon: '📋', label: 'FIR Records' },
    { id: 'cases',       icon: '📁', label: 'Assigned Cases' },
  ],
  citizen: [
    { section: 'Citizen Portal' },
    { id: 'feedback',    icon: '💬', label: 'Submit Feedback' },
    { id: 'complaints',  icon: '📢', label: 'Lodge Complaint' },
    { id: 'cases',       icon: '📁', label: 'Track Case Status' },
  ],
};

const Router = {
  _current: null,
  _alertCount: 0,

  navigate(page) {
    this._current = page;
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    const titles = {
      dashboard:   '📊 Dashboard',
      heatmap:     '🗺️ Crime Heatmap',
      deployment:  '🚀 Event Deployment & Planning',
      duty:        '📍 Officer Duty Board',
      fir:         '📋 FIR Management',
      cases:       '📁 Case Files',
      complaints:  '📢 Complaints',
      custody:     '🔒 Custody Safety Monitoring',
      feedback:    '💬 Citizen Feedback',
      alerts:      '🔔 Smart Alert Center',
      emergency:   '🆘 Emergency Response Optimizer',
    };
    document.getElementById('page-title').textContent = titles[page] || page;

    const content = document.getElementById('page-content');
    content.innerHTML = '<div class="loading-overlay"><div class="spinner-lg"></div></div>';

    // Route to page modules
    const routes = {
      dashboard:  () => Dashboard.render(),
      heatmap:    () => HeatmapPage.render(),
      deployment: () => DeploymentPage.render(),
      duty:       () => DutyPage.render(),
      fir:        () => FIRPage.render(),
      complaints: () => ComplaintsPage.render(),
      custody:    () => CustodyPage.render(),
      feedback:   () => FeedbackPage.render(),
      cases:      () => CasePage.render(),
      alerts:     () => AlertsPage.render(),
      emergency:  () => EmergencyPage.render(),
    };

    const fn = routes[page];
    if (fn) fn();
    else content.innerHTML = '<p style="color:var(--text-secondary);padding:40px;">Page not found</p>';
  }
};

const App = {
  async init(user) {
    // Set user in topbar
    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=1a2744&color=fff&size=128`;
    document.getElementById('user-avatar').src   = avatar;
    document.getElementById('topbar-avatar').src = avatar;
    document.getElementById('user-name').textContent = user.name;

    const roleBadge = document.getElementById('user-role-badge');
    const roleLabels = {
      ssp: { label: '🏛️ District Head (SSP)', cls: 'role-ssp' },
      station_officer: { label: '🚔 Station Officer', cls: 'role-station' },
      field_officer:   { label: '👮 Field Officer',   cls: 'role-field' },
      citizen:         { label: '👤 Citizen',          cls: 'role-citizen' },
    };
    const ri = roleLabels[user.role] || { label: user.role, cls: '' };
    roleBadge.textContent = ri.label;
    roleBadge.className   = ri.cls;

    // Build sidebar
    this.buildNav(user.role);

    // Check alerts
    this.pollAlerts();
    setInterval(() => this.pollAlerts(), 30000);

    // Navigate to default page
    const defaultPage = user.role === 'citizen' ? 'feedback' : 'dashboard';
    Router.navigate(defaultPage);
  },

  buildNav(role) {
    const items = NAV_ITEMS[role] || NAV_ITEMS.field_officer;
    const nav   = document.getElementById('sidebar-nav');
    nav.innerHTML = '';
    items.forEach(item => {
      if (item.section) {
        nav.insertAdjacentHTML('beforeend', `<div class="nav-section-title">${item.section}</div>`);
      } else {
        const badgeHtml = item.badge ? `<span class="nav-badge" id="nav-badge-${item.id}" style="display:none">0</span>` : '';
        nav.insertAdjacentHTML('beforeend', `
          <div class="nav-item" data-page="${item.id}" onclick="Router.navigate('${item.id}')">
            <span class="nav-icon">${item.icon}</span>
            <span>${item.label}</span>
            ${badgeHtml}
          </div>
        `);
      }
    });
  },

  async pollAlerts() {
    try {
      const alerts = await Api.getAlerts();
      if (!alerts) return;
      const open = alerts.filter(a => a.status === 'open').length;
      const dot  = document.getElementById('alert-dot');
      const nb   = document.getElementById('nav-badge-alerts');
      if (dot)  dot.style.display  = open > 0 ? 'block' : 'none';
      if (nb && open > 0) { nb.textContent = open; nb.style.display = 'block'; }
      Router._alertCount = open;
    } catch(_) {}
  }
};

// Init on load
window.addEventListener('load', () => Auth.init());
