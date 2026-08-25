/**
 * TruckitTools – Broker + Admin auth via Supabase Auth (email/password)
 * Profiles (role, name, etc.) stored in truckit_auth_profiles (cloud + local)
 */
(function (global) {
  const USERS_KEY = 'truckit_auth_profiles';
  const LEGACY_USERS_KEY = 'truckit_broker_users';
  const SESSION_KEY = 'truckit_broker_session';
  const MAX_BROKERS = 10;

  function truckitAppUrl(file) {
    file = String(file || '').replace(/^\//, '');
    try {
      const parts = (location.pathname || '/').split('/').filter(Boolean);
      if (parts.length && /\.html?$/i.test(parts[parts.length - 1])) parts.pop();
      const base = '/' + parts.join('/') + (parts.length ? '/' : '/');
      return base + file;
    } catch (e) { return file; }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getProfiles() {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function saveProfiles(list) {
    localStorage.setItem(USERS_KEY, JSON.stringify(list));
    if (global.TruckitCloud && TruckitCloud.pushKeyFromLocal) {
      TruckitCloud.pushKeyFromLocal(USERS_KEY);
    }
  }

  async function pullProfiles() {
    if (global.TruckitCloud && TruckitCloud.pullKey && TruckitCloud.isConfigured && TruckitCloud.isConfigured()) {
      try { await TruckitCloud.pullKey(USERS_KEY); } catch (e) { console.warn(e); }
    }
    return getProfiles();
  }

  function findProfileByEmail(email) {
    const e = String(email || '').trim().toLowerCase();
    return getProfiles().find(function (p) {
      return String(p.email || '').toLowerCase() === e;
    }) || null;
  }

  function findProfileById(id) {
    return getProfiles().find(function (p) { return p.id === id; }) || null;
  }

  function upsertProfile(profile) {
    const list = getProfiles();
    const idx = list.findIndex(function (p) {
      return (profile.id && p.id === profile.id) ||
        (String(p.email || '').toLowerCase() === String(profile.email || '').toLowerCase());
    });
    if (idx >= 0) list[idx] = Object.assign({}, list[idx], profile);
    else list.push(profile);
    saveProfiles(list);
    return list;
  }

  function setMirrorSession(user, profile) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        id: user && user.id,
        email: user && user.email,
        role: (profile && profile.role) || (user && user.user_metadata && user.user_metadata.role) || 'broker',
        at: Date.now()
      }));
    } catch (e) {}
  }

  function clearBrokerSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  function getBrokerSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function isBrokerLoggedIn() {
    return !!getBrokerSession();
  }

  async function refreshSessionFromAuth() {
    if (!global.TruckitCloud || !TruckitCloud.getSession) return null;
    const session = await TruckitCloud.getSession();
    if (!session || !session.user) {
      clearBrokerSession();
      return null;
    }
    await pullProfiles();
    let profile = findProfileById(session.user.id) || findProfileByEmail(session.user.email);
    if (!profile) {
      const role = (session.user.user_metadata && session.user.user_metadata.role) || 'broker';
      profile = {
        id: session.user.id,
        email: session.user.email,
        role: role,
        firstName: (session.user.user_metadata && session.user.user_metadata.firstName) || '',
        lastName: (session.user.user_metadata && session.user.user_metadata.lastName) || '',
        createdAt: new Date().toISOString()
      };
      upsertProfile(profile);
    }
    setMirrorSession(session.user, profile);
    return { session: session, profile: profile };
  }

  function ensureModalRoot() {
    let root = document.getElementById('ttAuthModals');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'ttAuthModals';
    document.body.appendChild(root);
    if (!document.getElementById('ttAuthStyles')) {
      const st = document.createElement('style');
      st.id = 'ttAuthStyles';
      st.textContent = [
        '.tt-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px}',
        '.tt-modal{background:#020617;border:1px solid #14532d;border-radius:10px;padding:18px;max-width:400px;width:100%;color:#e5e7eb}',
        '.tt-modal h3{margin:0 0 8px;color:#22c55e}',
        '.tt-modal label{display:block;font-size:13px;color:#94a3b8;margin:10px 0 4px}',
        '.tt-modal input{width:100%;box-sizing:border-box;padding:10px;border-radius:6px;border:1px solid #14532d;background:#000;color:#22c55e;font-size:16px}',
        '.tt-modal .tt-err{color:#fca5a5;font-size:13px;margin-top:8px}',
        '.tt-modal .tt-actions{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}',
        '.tt-modal button{background:#16a34a;color:#000;border:none;padding:10px 14px;border-radius:6px;font-weight:bold;cursor:pointer}',
        '.tt-modal button.secondary{background:#334155;color:#e2e8f0}',
        '.tt-modal .tt-hint{font-size:12px;color:#64748b;margin:8px 0 0}'
      ].join('');
      document.head.appendChild(st);
    }
    return root;
  }

  function cloudReady() {
    return global.TruckitCloud && TruckitCloud.isConfigured && TruckitCloud.isConfigured() &&
      typeof global.supabase !== 'undefined';
  }

  function showBrokerLogin(onSuccess) {
    const root = ensureModalRoot();
    root.innerHTML =
      '<div class="tt-modal-overlay"><div class="tt-modal">' +
      '<h3>Broker Portal Login</h3>' +
      '<p style="font-size:13px;color:#94a3b8;margin:0">Sign in with email and password (Supabase Auth).</p>' +
      '<label>Email</label><input type="email" id="ttBrokerUser" autocomplete="username">' +
      '<label>Password</label><input type="password" id="ttBrokerPass" autocomplete="current-password">' +
      '<div class="tt-err hidden" id="ttBrokerErr"></div>' +
      '<div class="tt-actions">' +
      '<button type="button" id="ttBrokerSubmit">Sign In</button>' +
      '<button type="button" class="secondary" id="ttBrokerCancel">Cancel</button>' +
      '</div>' +
      '<p class="tt-hint">Create users in Admin Tools. In Supabase: Authentication → Providers → Email on. Turn off "Confirm email" while testing.</p>' +
      '</div></div>';

    const err = document.getElementById('ttBrokerErr');
    function fail(msg) {
      err.textContent = msg || 'Login failed.';
      err.classList.remove('hidden');
    }

    document.getElementById('ttBrokerCancel').onclick = function () { root.innerHTML = ''; };
    document.getElementById('ttBrokerSubmit').onclick = async function () {
      if (!cloudReady()) {
        fail('Cloud/Auth not configured.');
        return;
      }
      const email = (document.getElementById('ttBrokerUser').value || '').trim();
      const password = document.getElementById('ttBrokerPass').value || '';
      if (!email || !password) { fail('Email and password required.'); return; }
      try {
        await TruckitCloud.signIn(email, password);
        await pullProfiles();
        const user = await TruckitCloud.getUser();
        let profile = findProfileById(user.id) || findProfileByEmail(user.email);
        const role = (profile && profile.role) || (user.user_metadata && user.user_metadata.role) || 'broker';
        if (role !== 'broker' && role !== 'admin') {
          await TruckitCloud.signOut();
          fail('This account is not allowed for Broker Portal.');
          return;
        }
        if (!profile) {
          profile = {
            id: user.id, email: user.email, role: role,
            firstName: (user.user_metadata && user.user_metadata.firstName) || '',
            lastName: (user.user_metadata && user.user_metadata.lastName) || '',
            createdAt: new Date().toISOString()
          };
          upsertProfile(profile);
        }
        setMirrorSession(user, profile);
        root.innerHTML = '';
        if (typeof onSuccess === 'function') onSuccess();
      } catch (e) {
        fail((e && e.message) || 'Invalid email or password.');
      }
    };
    document.getElementById('ttBrokerPass').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('ttBrokerSubmit').click();
    });
  }

  function requireBrokerLoginThen(go) {
    clearBrokerSession();
    if (cloudReady()) {
      TruckitCloud.getSession().then(function (session) {
        if (session && session.user) {
          refreshSessionFromAuth().then(function (info) {
            if (info && info.profile && (info.profile.role === 'broker' || info.profile.role === 'admin')) {
              if (typeof go === 'function') go();
              return;
            }
            showBrokerLogin(go);
          });
          return;
        }
        showBrokerLogin(go);
      }).catch(function () { showBrokerLogin(go); });
      return;
    }
    showBrokerLogin(go);
  }

  function guardBrokerPage() {
    refreshSessionFromAuth().then(function (info) {
      if (!info || !info.session) {
        window.location.href = truckitAppUrl('index.html');
      }
    }).catch(function () {
      if (!getBrokerSession()) window.location.href = truckitAppUrl('index.html');
    });
  }

  function isHomeLanding() {
    const path = (location.pathname || '').replace(/\/+$/, '');
    const file = path.split('/').pop() || '';
    if (file && file !== 'index.html' && file !== 'TruckitTools' && file !== '') return false;
    const params = new URLSearchParams(location.search);
    if (params.get('role') === 'carrier' || params.get('role') === 'broker') return false;
    const roleSelect = document.getElementById('roleSelect');
    if (roleSelect && roleSelect.classList.contains('hidden')) return false;
    return true;
  }

  function injectAdminButton() {
    const existing = document.getElementById('ttAdminToolsBtn');
    if (!isHomeLanding()) {
      if (existing && existing.tagName === 'BUTTON') existing.remove();
      return;
    }
    if (existing) return;
    const header = document.querySelector('header');
    if (!header) return;
    const a = document.createElement('a');
    a.href = truckitAppUrl('admin.html');
    a.id = 'ttAdminToolsBtn';
    a.className = 'tt-admin-btn admin-tools-btn';
    a.textContent = 'Admin Tools';
    header.appendChild(a);
  }

  function showAdminLogin() {
    window.location.href = truckitAppUrl('admin.html');
  }

  global.truckitAppUrl = truckitAppUrl;
  global.TruckitBrokerAuth = {
    USERS_KEY: USERS_KEY,
    LEGACY_USERS_KEY: LEGACY_USERS_KEY,
    SESSION_KEY: SESSION_KEY,
    MAX_BROKERS: MAX_BROKERS,
    openAdminTools: showAdminLogin,
    requireBrokerLoginThen: requireBrokerLoginThen,
    isBrokerLoggedIn: isBrokerLoggedIn,
    clearBrokerSession: clearBrokerSession,
    getBrokerSession: getBrokerSession,
    pullUsersFromCloud: pullProfiles,
    pullProfiles: pullProfiles,
    getProfiles: getProfiles,
    saveProfiles: saveProfiles,
    upsertProfile: upsertProfile,
    findProfileByEmail: findProfileByEmail,
    findProfileById: findProfileById,
    refreshSessionFromAuth: refreshSessionFromAuth,
    setMirrorSession: setMirrorSession,
    injectAdminButton: injectAdminButton,
    guardBrokerPage: guardBrokerPage,
    truckitAppUrl: truckitAppUrl
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      injectAdminButton();
      refreshSessionFromAuth();
    });
  } else {
    injectAdminButton();
    refreshSessionFromAuth();
  }
})(typeof window !== 'undefined' ? window : globalThis);
