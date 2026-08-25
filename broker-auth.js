/**
 * TruckitTools – Admin Tools + Broker Portal users (max 10)
 * Admin login: Admin / Truckit757
 * Broker Portal requires login every browser session (sessionStorage).
 */
(function (global) {
  const USERS_KEY = 'truckit_broker_users';
  const SESSION_KEY = 'truckit_broker_session';
  const ADMIN_USER = 'Admin';
  const ADMIN_PASS = 'Truckit757';
  const MAX_USERS = 10;

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getUsers() {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveUsers(list) {
    localStorage.setItem(USERS_KEY, JSON.stringify(list));
    if (global.TruckitCloud && TruckitCloud.pushKeyFromLocal) {
      TruckitCloud.pushKeyFromLocal(USERS_KEY);
    }
  }

  async function pullUsersFromCloud() {
    if (!global.TruckitCloud || !TruckitCloud.pullKey) return getUsers();
    try {
      if (TruckitCloud.isConfigured && TruckitCloud.isConfigured()) {
        await TruckitCloud.pullKey(USERS_KEY);
      }
    } catch (e) {
      console.warn('pullUsersFromCloud', e);
    }
    return getUsers();
  }

  function getBrokerSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setBrokerSession(user) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      username: user.username,
      id: user.id,
      at: Date.now()
    }));
  }

  function clearBrokerSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function isBrokerLoggedIn() {
    return !!getBrokerSession();
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
        '.tt-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px}',
        '.tt-modal{background:#020617;border:1px solid #14532d;border-radius:10px;padding:18px;width:100%;max-width:420px;color:#e5e7eb;max-height:90vh;overflow:auto}',
        '.tt-modal h3{margin:0 0 12px 0;color:#22c55e}',
        '.tt-modal label{display:block;font-size:13px;color:#94a3b8;margin:8px 0 4px}',
        '.tt-modal input{width:100%;box-sizing:border-box;padding:10px;border-radius:6px;border:1px solid #14532d;background:#000;color:#22c55e;font-size:16px}',
        '.tt-modal .tt-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}',
        '.tt-modal button{background:#16a34a;color:#000;border:none;padding:10px 14px;border-radius:6px;cursor:pointer;font-size:15px}',
        '.tt-modal button.cancel{background:#dc2626;color:#fff}',
        '.tt-modal .tt-err{color:#fca5a5;font-size:13px;margin-top:8px}',
        '.tt-modal .hidden{display:none}',
        '.tt-modal .tt-user-row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 10px;background:#022c22;border:1px solid #14532d;border-radius:6px;margin-bottom:6px;font-size:14px}',
        '.tt-admin-btn{position:absolute!important;left:12px!important;top:10px!important;transform:none!important;background:#16a34a!important;color:#000!important;font-size:13px!important;font-weight:bold!important;padding:8px 12px!important;margin:0!important;z-index:5!important;border:none!important;border-radius:6px!important;cursor:pointer!important;line-height:1.2!important;width:auto!important;height:auto!important;display:inline-block!important;box-sizing:border-box!important}',
        '@media (max-width:600px){.tt-admin-btn{left:12px!important;top:10px!important;font-size:13px!important;padding:8px 12px!important}}'
      ].join('');
      document.head.appendChild(st);
    }
    return root;
  }

  function closeModals() {
    const root = document.getElementById('ttAuthModals');
    if (root) root.innerHTML = '';
  }

  function showAdminLogin() {
    const root = ensureModalRoot();
    root.innerHTML = '<div class="tt-modal-overlay"><div class="tt-modal"><h3>Admin Tools</h3><p style="font-size:13px;color:#94a3b8;margin:0 0 10px 0;">Sign in to manage Broker Portal users.</p><label>Username</label><input type="text" id="ttAdminUser" autocomplete="username"><label>Password</label><input type="password" id="ttAdminPass" autocomplete="current-password"><div class="tt-err hidden" id="ttAdminErr"></div><div class="tt-actions"><button type="button" id="ttAdminSubmit">Sign In</button><button type="button" class="cancel" id="ttAdminCancel">Cancel</button></div></div></div>';
    const tryLogin = function () {
      const u = (document.getElementById('ttAdminUser').value || '').trim();
      const p = document.getElementById('ttAdminPass').value || '';
      if (u === ADMIN_USER && p === ADMIN_PASS) {
        closeModals();
        showAdminPanel();
      } else {
        const e = document.getElementById('ttAdminErr');
        e.textContent = 'Invalid admin credentials.';
        e.classList.remove('hidden');
      }
    };
    document.getElementById('ttAdminSubmit').onclick = tryLogin;
    document.getElementById('ttAdminCancel').onclick = closeModals;
    document.getElementById('ttAdminPass').onkeydown = function (e) { if (e.key === 'Enter') tryLogin(); };
    document.getElementById('ttAdminUser').focus();
  }

  function renderUserList(el) {
    const users = getUsers();
    if (!users.length) {
      el.innerHTML = '<p style="font-size:13px;color:#64748b;">No broker users yet. Add up to ' + MAX_USERS + '.</p>';
      return;
    }
    el.innerHTML = users.map(function (u) {
      return '<div class="tt-user-row"><span>' + escapeHtml(u.username) + '</span><button type="button" class="cancel" data-del="' + escapeHtml(u.id) + '" style="margin:0;padding:6px 10px;font-size:12px;">Delete</button></div>';
    }).join('');
    el.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.onclick = function () {
        if (!confirm('Delete this user?')) return;
        const id = btn.getAttribute('data-del');
        saveUsers(getUsers().filter(function (u) { return u.id !== id; }));
        renderUserList(el);
        const count = document.getElementById('ttUserCount');
        if (count) count.textContent = getUsers().length + ' / ' + MAX_USERS;
      };
    });
  }

  async function showAdminPanel() {
    await pullUsersFromCloud();
    const root = ensureModalRoot();
    root.innerHTML = '<div class="tt-modal-overlay"><div class="tt-modal"><h3>Broker Portal Users</h3><p style="font-size:13px;color:#94a3b8;margin:0 0 8px 0;">These accounts sign in to Broker Portal. <strong id="ttUserCount">' + getUsers().length + ' / ' + MAX_USERS + '</strong></p><div id="ttUserList"></div><hr style="border:none;border-top:1px solid #14532d;margin:14px 0;"><h3 style="font-size:16px;">Add user</h3><label>Username</label><input type="text" id="ttNewUser" autocomplete="off"><label>Password</label><input type="password" id="ttNewPass" autocomplete="new-password"><div class="tt-err hidden" id="ttAddErr"></div><div class="tt-actions"><button type="button" id="ttAddUser">Add User</button><button type="button" class="cancel" id="ttAdminClose">Close</button></div></div></div>';
    const list = document.getElementById('ttUserList');
    renderUserList(list);
    document.getElementById('ttAdminClose').onclick = closeModals;
    document.getElementById('ttAddUser').onclick = function () {
      const username = (document.getElementById('ttNewUser').value || '').trim();
      const password = document.getElementById('ttNewPass').value || '';
      const e = document.getElementById('ttAddErr');
      e.classList.add('hidden');
      if (!username || !password) {
        e.textContent = 'Username and password required.';
        e.classList.remove('hidden');
        return;
      }
      if (username.toLowerCase() === ADMIN_USER.toLowerCase()) {
        e.textContent = 'That username is reserved.';
        e.classList.remove('hidden');
        return;
      }
      const users = getUsers();
      if (users.length >= MAX_USERS) {
        e.textContent = 'Maximum of ' + MAX_USERS + ' users reached.';
        e.classList.remove('hidden');
        return;
      }
      if (users.some(function (u) { return u.username.toLowerCase() === username.toLowerCase(); })) {
        e.textContent = 'Username already exists.';
        e.classList.remove('hidden');
        return;
      }
      users.push({
        id: 'bu_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        username: username,
        password: password,
        createdAt: new Date().toISOString()
      });
      saveUsers(users);
      document.getElementById('ttNewUser').value = '';
      document.getElementById('ttNewPass').value = '';
      document.getElementById('ttUserCount').textContent = users.length + ' / ' + MAX_USERS;
      renderUserList(list);
    };
  }

  function showBrokerLogin(onSuccess) {
    const root = ensureModalRoot();
    root.innerHTML = '<div class="tt-modal-overlay"><div class="tt-modal"><h3>Broker Portal Login</h3><p style="font-size:13px;color:#94a3b8;margin:0 0 10px 0;">Sign in with your broker account.</p><label>Username</label><input type="text" id="ttBrokerUser" autocomplete="username"><label>Password</label><input type="password" id="ttBrokerPass" autocomplete="current-password"><div class="tt-err hidden" id="ttBrokerErr"></div><div class="tt-actions"><button type="button" id="ttBrokerSubmit">Sign In</button><button type="button" class="cancel" id="ttBrokerCancel">Cancel</button></div></div></div>';
    const tryLogin = async function () {
      await pullUsersFromCloud();
      const u = (document.getElementById('ttBrokerUser').value || '').trim();
      const p = document.getElementById('ttBrokerPass').value || '';
      const e = document.getElementById('ttBrokerErr');
      const users = getUsers();
      if (!users.length) {
        e.textContent = 'No broker users yet. Use Admin Tools to create accounts.';
        e.classList.remove('hidden');
        return;
      }
      const match = users.find(function (x) { return x.username === u && x.password === p; });
      if (!match) {
        e.textContent = 'Invalid username or password.';
        e.classList.remove('hidden');
        return;
      }
      setBrokerSession(match);
      closeModals();
      if (typeof onSuccess === 'function') onSuccess(match);
    };
    document.getElementById('ttBrokerSubmit').onclick = tryLogin;
    document.getElementById('ttBrokerCancel').onclick = closeModals;
    document.getElementById('ttBrokerPass').onkeydown = function (ev) { if (ev.key === 'Enter') tryLogin(); };
    document.getElementById('ttBrokerUser').focus();
  }

  function requireBrokerLoginThen(go) {
    clearBrokerSession();
    showBrokerLogin(function () {
      if (typeof go === 'function') go();
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
      if (existing) existing.remove();
      return;
    }
    const header = document.querySelector('header');
    if (!header || existing) return;
    const btn = document.createElement('button');
    btn.id = 'ttAdminToolsBtn';
    btn.type = 'button';
    btn.className = 'tt-admin-btn';
    btn.textContent = 'Admin Tools';
    btn.onclick = function () { window.location.href = 'admin.html'; };
    header.appendChild(btn);
  }

  function guardBrokerPage() {
    try {
      if (!sessionStorage.getItem(SESSION_KEY)) {
        window.location.href = 'index.html';
      }
    } catch (e) {}
  }

  global.TruckitBrokerAuth = {
    USERS_KEY: USERS_KEY,
    SESSION_KEY: SESSION_KEY,
    openAdminTools: showAdminLogin,
    requireBrokerLoginThen: requireBrokerLoginThen,
    isBrokerLoggedIn: isBrokerLoggedIn,
    clearBrokerSession: clearBrokerSession,
    getBrokerSession: getBrokerSession,
    pullUsersFromCloud: pullUsersFromCloud,
    injectAdminButton: injectAdminButton,
    guardBrokerPage: guardBrokerPage
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectAdminButton);
  } else {
    injectAdminButton();
  }
})(typeof window !== 'undefined' ? window : globalThis);
