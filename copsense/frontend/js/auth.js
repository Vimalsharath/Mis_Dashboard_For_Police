/**
 * CopSense Auth Module
 * Handles login, register, logout, session persistence, and role switching.
 */
const Auth = {
  _user: null,

  init() {
    const token = localStorage.getItem('cs_token');
    const user  = localStorage.getItem('cs_user');
    if (token && user) {
      this._user = JSON.parse(user);
      Api.setToken(token);
      this.showApp();
    }
  },

  showTab(tab) {
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active', tab === 'register');
    document.getElementById('login-form').style.display    = tab === 'login'    ? 'block' : 'none';
    document.getElementById('register-form').style.display = tab === 'register' ? 'block' : 'none';
    document.getElementById('auth-msg').innerHTML = '';
  },

  quickLogin(email, password) {
    document.getElementById('login-email').value = email;
    document.getElementById('login-password').value = password;
  },

  toggleOfficerFields() {
    const role = document.getElementById('reg-role').value;
    const show = ['field_officer', 'station_officer', 'ssp'].includes(role);
    document.getElementById('officer-fields').style.display = show ? 'block' : 'none';
  },

  async login(e) {
    e.preventDefault();
    Validate.clearAll('login-');
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    // Client-side validation
    let ok = true;
    if (!email) { Validate.showError('err-login-email', 'Email is required'); ok = false; }
    if (!password) { Validate.showError('err-login-password', 'Password is required'); ok = false; }
    if (!ok) return;

    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Signing in...';

    try {
      const data = await Api.login({ email, password });
      this._saveSession(data);
      this.showApp();
    } catch (err) {
      document.getElementById('auth-msg').innerHTML =
        `<div class="alert-banner alert-error">❌ ${err.message}</div>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Sign In';
    }
  },

  async register(e) {
    e.preventDefault();
    const name     = document.getElementById('reg-name').value.trim();
    const email    = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const role     = document.getElementById('reg-role').value;

    let ok = true;
    if (!name)     { Validate.showError('err-reg-name', 'Name is required'); ok = false; }
    if (!role)     { document.getElementById('reg-msg').innerHTML = '<div class="alert-banner alert-error">Please select a role</div>'; ok = false; }
    if (!ok) return;

    const payload = {
      name, email, password, role,
      badge_id:       document.getElementById('reg-badge')?.value   || null,
      rank:           document.getElementById('reg-rank')?.value    || null,
      specialization: document.getElementById('reg-spec')?.value    || null,
      station_id:     parseInt(document.getElementById('reg-station')?.value) || null,
    };

    const btn = document.getElementById('register-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Creating Account...';

    try {
      const data = await Api.register(payload);
      this._saveSession(data);
      this.showApp();
    } catch (err) {
      document.getElementById('reg-msg').innerHTML =
        `<div class="alert-banner alert-error">❌ ${err.message}</div>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Create Account';
    }
  },

  _saveSession(data) {
    this._user = {
      id:         data.user_id,
      name:       data.name,
      role:       data.role,
      station_id: data.station_id,
      token:      data.access_token
    };
    localStorage.setItem('cs_token', data.access_token);
    localStorage.setItem('cs_user',  JSON.stringify(this._user));
    Api.setToken(data.access_token);
  },

  showApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-screen').style.display  = 'flex';
    App.init(this._user);
  },

  logout() {
    localStorage.removeItem('cs_token');
    localStorage.removeItem('cs_user');
    Api.clearToken();
    this._user = null;
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display  = 'none';
    // Reset login form
    document.getElementById('login-form').reset();
    document.getElementById('auth-msg').innerHTML = '';
  },

  user() { return this._user; },
  role() { return this._user?.role; },
  isSSP()    { return this._user?.role === 'ssp'; },
  isOfficer(){ return ['ssp','station_officer','field_officer'].includes(this._user?.role); },
  isCitizen(){ return this._user?.role === 'citizen'; },
};
