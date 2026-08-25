
const ADMIN_USER = 'Admin';
const DEFAULT_ADMIN_PASS = 'Truckit757';
const ADMIN_AUTH_KEY = 'truckit_admin_auth';
const USERS_KEY = 'truckit_broker_users';
const COMPANY_KEY = 'truckit_company_profile';
const MAX_USERS = 10;
const ADMIN_SESSION = 'truckit_admin_session';
const DEFAULT_COMPANY = {
  name: 'TruckitTools', address: '23 Winnard Rd.', city: 'Hampton', state: 'VA', zip: '23669',
  phone: '804-577-7423', email: '', logoUrl: ''
};
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function getAdminPassword() {
  try {
    const raw = localStorage.getItem(ADMIN_AUTH_KEY);
    if (raw) { const a = JSON.parse(raw); if (a && a.password) return String(a.password); }
  } catch (e) {}
  return DEFAULT_ADMIN_PASS;
}
function setAdminPassword(pw) {
  localStorage.setItem(ADMIN_AUTH_KEY, JSON.stringify({ password: pw, updatedAt: new Date().toISOString() }));
  if (window.TruckitCloud && TruckitCloud.pushKeyFromLocal) TruckitCloud.pushKeyFromLocal(ADMIN_AUTH_KEY);
}
function getUsers() {
  try { const arr = JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); return Array.isArray(arr) ? arr : []; }
  catch (e) { return []; }
}
function saveUsers(list) {
  localStorage.setItem(USERS_KEY, JSON.stringify(list));
  if (window.TruckitCloud && TruckitCloud.pushKeyFromLocal) TruckitCloud.pushKeyFromLocal(USERS_KEY);
}
function getCompanyProfile() {
  try {
    const raw = localStorage.getItem(COMPANY_KEY);
    if (raw) return Object.assign({}, DEFAULT_COMPANY, JSON.parse(raw));
  } catch (e) {}
  return Object.assign({}, DEFAULT_COMPANY);
}
function saveCompanyToStore(profile) {
  localStorage.setItem(COMPANY_KEY, JSON.stringify(profile));
  if (window.TruckitCloud && TruckitCloud.pushKeyFromLocal) TruckitCloud.pushKeyFromLocal(COMPANY_KEY);
}
async function pullUsers() {
  if (window.TruckitCloud && TruckitCloud.pullKey && TruckitCloud.isConfigured && TruckitCloud.isConfigured()) {
    try {
      await TruckitCloud.pullKey(USERS_KEY);
      await TruckitCloud.pullKey(COMPANY_KEY);
      await TruckitCloud.pullKey(ADMIN_AUTH_KEY);
    } catch (e) { console.warn(e); }
  }
}
function adminPageLogin() {
  const u = (document.getElementById('adminUser').value || '').trim();
  const p = document.getElementById('adminPass').value || '';
  const err = document.getElementById('adminLoginErr');
  if (u === ADMIN_USER && p === getAdminPassword()) {
    sessionStorage.setItem(ADMIN_SESSION, JSON.stringify({ at: Date.now() }));
    err.classList.add('hidden');
    showApp();
  } else {
    err.textContent = 'Invalid admin credentials.';
    err.classList.remove('hidden');
  }
}
function showApp() {
  document.getElementById('adminLoginCard').classList.add('hidden');
  document.getElementById('adminApp').classList.remove('hidden');
  cancelForm();
  renderUsers();
  fillCompanyForm();
  refreshCloudStatus();
  showTab('users');
}
function showTab(name) {
  ['users','company','backup','security','cloud','purge'].forEach(function (t) {
    const el = document.getElementById('tab-' + t);
    if (el) el.classList.toggle('hidden', t !== name);
  });
  document.querySelectorAll('#adminTabs button').forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === name);
  });
  if (name === 'cloud') refreshCloudStatus();
}
function cancelForm() {
  document.getElementById('userFormCard').classList.add('hidden');
  document.getElementById('passwordCard').classList.add('hidden');
  document.getElementById('adminApp').classList.remove('hidden');
}
function renderUsers() {
  const list = getUsers();
  document.getElementById('userCountLine').textContent = list.length + ' / ' + MAX_USERS + ' users';
  const el = document.getElementById('userList');
  if (!list.length) {
    el.innerHTML = '<p style="color:#64748b;font-size:13px;">No users yet. Tap + New User.</p>';
    return;
  }
  el.innerHTML = list.map(function (u) {
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || '—';
    return '<div class="user-row"><h4>' + escapeHtml(u.username) + '</h4>' +
      '<p><strong>Name:</strong> ' + escapeHtml(name) + '</p>' +
      '<p><strong>DOB:</strong> ' + escapeHtml(u.dob || '—') + ' · <strong>Phone:</strong> ' + escapeHtml(u.phone || '—') + '</p>' +
      '<p><strong>Alt phone:</strong> ' + escapeHtml(u.phone2 || '—') + '</p>' +
      '<p><strong>Address:</strong> ' + escapeHtml(u.address || '—') + '</p>' +
      '<div><button type="button" class="secondary" onclick="editUser(\'' + u.id + '\')">Edit</button>' +
      '<button type="button" class="secondary" onclick="changePassword(\'' + u.id + '\')">Change Password</button>' +
      '<button type="button" class="cancel" onclick="deleteUser(\'' + u.id + '\')">Delete</button></div></div>';
  }).join('');
}
function clearForm() {
  document.getElementById('editId').value = '';
  ['firstName','lastName','dob','phone','phone2','address','username','password'].forEach(function (id) {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('formErr').classList.add('hidden');
}
function showCreateForm() {
  if (getUsers().length >= MAX_USERS) { alert('Maximum of ' + MAX_USERS + ' users reached.'); return; }
  clearForm();
  document.getElementById('formTitle').textContent = 'New User';
  document.getElementById('passwordCreateWrap').classList.remove('hidden');
  document.getElementById('adminApp').classList.add('hidden');
  document.getElementById('passwordCard').classList.add('hidden');
  document.getElementById('userFormCard').classList.remove('hidden');
}
function editUser(id) {
  const u = getUsers().find(function (x) { return x.id === id; });
  if (!u) return;
  document.getElementById('editId').value = u.id;
  document.getElementById('firstName').value = u.firstName || '';
  document.getElementById('lastName').value = u.lastName || '';
  document.getElementById('dob').value = u.dob || '';
  document.getElementById('phone').value = u.phone || '';
  document.getElementById('phone2').value = u.phone2 || '';
  document.getElementById('address').value = u.address || '';
  document.getElementById('username').value = u.username || '';
  document.getElementById('password').value = '';
  document.getElementById('passwordCreateWrap').classList.add('hidden');
  document.getElementById('formTitle').textContent = 'Edit User';
  document.getElementById('formErr').classList.add('hidden');
  document.getElementById('adminApp').classList.add('hidden');
  document.getElementById('passwordCard').classList.add('hidden');
  document.getElementById('userFormCard').classList.remove('hidden');
}
function saveUserForm() {
  const err = document.getElementById('formErr');
  const editId = document.getElementById('editId').value;
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const firstName = document.getElementById('firstName').value.trim();
  const lastName = document.getElementById('lastName').value.trim();
  const dob = document.getElementById('dob').value;
  const phone = document.getElementById('phone').value.trim();
  const phone2 = document.getElementById('phone2').value.trim();
  const address = document.getElementById('address').value.trim();
  if (!username) { err.textContent = 'Username is required.'; err.classList.remove('hidden'); return; }
  if (username.toLowerCase() === 'admin') { err.textContent = 'That username is reserved.'; err.classList.remove('hidden'); return; }
  const list = getUsers();
  if (!editId && list.length >= MAX_USERS) { err.textContent = 'Maximum of ' + MAX_USERS + ' users reached.'; err.classList.remove('hidden'); return; }
  if (list.some(function (u) { return u.username.toLowerCase() === username.toLowerCase() && u.id !== editId; })) {
    err.textContent = 'Username already exists.'; err.classList.remove('hidden'); return;
  }
  if (!editId && !password) { err.textContent = 'Password is required for new users.'; err.classList.remove('hidden'); return; }
  if (editId) {
    const u = list.find(function (x) { return x.id === editId; });
    if (!u) return;
    Object.assign(u, { firstName: firstName, lastName: lastName, dob: dob, phone: phone, phone2: phone2, address: address, username: username, updatedAt: new Date().toISOString() });
  } else {
    list.push({ id: 'bu_' + Date.now().toString(36), username: username, password: password, firstName: firstName, lastName: lastName, dob: dob, phone: phone, phone2: phone2, address: address, createdAt: new Date().toISOString() });
  }
  saveUsers(list);
  showApp();
}
function deleteUser(id) {
  const u = getUsers().find(function (x) { return x.id === id; });
  if (!u || !confirm('Delete user “' + u.username + '”?')) return;
  saveUsers(getUsers().filter(function (x) { return x.id !== id; }));
  renderUsers();
}
function changePassword(id) {
  const u = getUsers().find(function (x) { return x.id === id; });
  if (!u) return;
  document.getElementById('pwUserId').value = u.id;
  document.getElementById('pwUserLabel').textContent = 'User: ' + u.username;
  document.getElementById('newPassword').value = '';
  document.getElementById('newPassword2').value = '';
  document.getElementById('pwErr').classList.add('hidden');
  document.getElementById('adminApp').classList.add('hidden');
  document.getElementById('userFormCard').classList.add('hidden');
  document.getElementById('passwordCard').classList.remove('hidden');
}
function savePassword() {
  const id = document.getElementById('pwUserId').value;
  const a = document.getElementById('newPassword').value;
  const b = document.getElementById('newPassword2').value;
  const err = document.getElementById('pwErr');
  if (!a) { err.textContent = 'Enter a new password.'; err.classList.remove('hidden'); return; }
  if (a !== b) { err.textContent = 'Passwords do not match.'; err.classList.remove('hidden'); return; }
  const list = getUsers();
  const u = list.find(function (x) { return x.id === id; });
  if (!u) return;
  u.password = a; u.updatedAt = new Date().toISOString();
  saveUsers(list);
  showApp();
}
function fillCompanyForm() {
  const c = getCompanyProfile();
  document.getElementById('coName').value = c.name || '';
  document.getElementById('coAddress').value = c.address || '';
  document.getElementById('coCity').value = c.city || '';
  document.getElementById('coState').value = c.state || '';
  document.getElementById('coZip').value = c.zip || '';
  document.getElementById('coPhone').value = c.phone || '';
  document.getElementById('coEmail').value = c.email || '';
  document.getElementById('coLogoUrl').value = c.logoUrl || '';
}
function saveCompanyProfile() {
  saveCompanyToStore({
    name: document.getElementById('coName').value.trim() || DEFAULT_COMPANY.name,
    address: document.getElementById('coAddress').value.trim(),
    city: document.getElementById('coCity').value.trim(),
    state: document.getElementById('coState').value.trim(),
    zip: document.getElementById('coZip').value.trim(),
    phone: document.getElementById('coPhone').value.trim(),
    email: document.getElementById('coEmail').value.trim(),
    logoUrl: document.getElementById('coLogoUrl').value.trim(),
    updatedAt: new Date().toISOString()
  });
  const ok = document.getElementById('coOk');
  ok.textContent = 'Company profile saved.';
  ok.classList.remove('hidden');
}
function exportBackup() {
  const keys = ['truckit_loads','truckit_customers','truckit_carriers',USERS_KEY,COMPANY_KEY,ADMIN_AUTH_KEY];
  const data = { exportedAt: new Date().toISOString(), version: 1, keys: {}, sessions: {} };
  keys.forEach(function (k) {
    try { const raw = localStorage.getItem(k); data.keys[k] = raw ? JSON.parse(raw) : null; } catch (e) { data.keys[k] = null; }
  });
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith('truckit_') || keys.indexOf(k) >= 0) continue;
    if (k === 'truckit_supabase_config' || k === 'truckit_broker_session') continue;
    try { data.sessions[k] = JSON.parse(localStorage.getItem(k)); } catch (e) {}
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'truckittools-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  document.getElementById('backupOk').textContent = 'Backup downloaded.';
  document.getElementById('backupOk').classList.remove('hidden');
}
function importBackup() {
  const fileInput = document.getElementById('importFile');
  const err = document.getElementById('backupErr');
  const ok = document.getElementById('backupOk');
  err.classList.add('hidden'); ok.classList.add('hidden');
  if (!fileInput.files || !fileInput.files[0]) { err.textContent = 'Choose a backup JSON file first.'; err.classList.remove('hidden'); return; }
  const reader = new FileReader();
  reader.onload = function () {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !data.keys) throw new Error('Invalid backup format');
      if (!confirm('Import will overwrite local data (and push to cloud if configured). Continue?')) return;
      Object.keys(data.keys).forEach(function (k) {
        if (data.keys[k] == null) return;
        localStorage.setItem(k, JSON.stringify(data.keys[k]));
        if (window.TruckitCloud && TruckitCloud.pushKeyFromLocal) try { TruckitCloud.pushKeyFromLocal(k); } catch (e) {}
      });
      if (data.sessions) Object.keys(data.sessions).forEach(function (k) {
        localStorage.setItem(k, JSON.stringify(data.sessions[k]));
      });
      ok.textContent = 'Import complete.'; ok.classList.remove('hidden');
      renderUsers(); fillCompanyForm();
    } catch (e) { err.textContent = e.message || 'Import failed.'; err.classList.remove('hidden'); }
  };
  reader.readAsText(fileInput.files[0]);
}
function changeAdminPassword() {
  const err = document.getElementById('secErr');
  const ok = document.getElementById('secOk');
  err.classList.add('hidden'); ok.classList.add('hidden');
  const cur = document.getElementById('curAdminPass').value;
  const n1 = document.getElementById('newAdminPass').value;
  const n2 = document.getElementById('newAdminPass2').value;
  if (cur !== getAdminPassword()) { err.textContent = 'Current password is incorrect.'; err.classList.remove('hidden'); return; }
  if (!n1 || n1.length < 6) { err.textContent = 'New password must be at least 6 characters.'; err.classList.remove('hidden'); return; }
  if (n1 !== n2) { err.textContent = 'New passwords do not match.'; err.classList.remove('hidden'); return; }
  setAdminPassword(n1);
  document.getElementById('curAdminPass').value = '';
  document.getElementById('newAdminPass').value = '';
  document.getElementById('newAdminPass2').value = '';
  ok.textContent = 'Admin password updated.'; ok.classList.remove('hidden');
}
function refreshCloudStatus() {
  const el = document.getElementById('cloudStatus');
  const configured = window.TruckitCloud && TruckitCloud.isConfigured && TruckitCloud.isConfigured();
  let cfg = null; try { cfg = TruckitCloud.getConfig && TruckitCloud.getConfig(); } catch (e) {}
  let loads = 0, customers = 0, carriers = 0, sessions = 0;
  try { loads = (JSON.parse(localStorage.getItem('truckit_loads') || '[]') || []).length; } catch (e) {}
  try { customers = (JSON.parse(localStorage.getItem('truckit_customers') || '[]') || []).length; } catch (e) {}
  try { carriers = (JSON.parse(localStorage.getItem('truckit_carriers') || '[]') || []).length; } catch (e) {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.indexOf('truckit_TR-') === 0) sessions++;
  }
  el.innerHTML =
    '<div class="status-row"><strong>Configured:</strong> ' + (configured ? 'Yes' : 'No') + '</div>' +
    (cfg && cfg.url ? '<div class="status-row"><strong>Project URL:</strong> ' + escapeHtml(cfg.url) + '</div>' : '') +
    '<div class="status-row"><strong>Storage bucket:</strong> truckit-docs</div>' +
    '<div class="status-row"><strong>Local:</strong> ' + loads + ' loads · ' + customers + ' customers · ' +
      carriers + ' carriers · ' + getUsers().length + ' users · ' + sessions + ' TR sessions</div>';
}
async function testCloudWrite() {
  const ok = document.getElementById('cloudOk');
  const err = document.getElementById('cloudErr');
  ok.classList.add('hidden'); err.classList.add('hidden');
  if (!window.TruckitCloud || !TruckitCloud.isConfigured()) {
    err.textContent = 'Cloud is not configured.'; err.classList.remove('hidden'); return;
  }
  try {
    await TruckitCloud.pushKey('truckit_admin_ping', { at: new Date().toISOString(), ok: true });
    ok.textContent = 'Cloud write OK.'; ok.classList.remove('hidden');
  } catch (e) {
    err.textContent = (e && e.message) || 'Cloud write failed.'; err.classList.remove('hidden');
  }
}
async function purgeSessions() {
  const days = parseInt(document.getElementById('purgeDays').value, 10) || 30;
  const ok = document.getElementById('purgeOk');
  const err = document.getElementById('purgeErr');
  ok.classList.add('hidden'); err.classList.add('hidden');
  if (!confirm('Delete tracking sessions older than ' + days + ' days?')) return;
  const cutoff = Date.now() - days * 86400000;
  const skip = ['truckit_loads','truckit_customers','truckit_carriers',USERS_KEY,COMPANY_KEY,ADMIN_AUTH_KEY,'truckit_supabase_config','truckit_broker_session'];
  let removed = 0;
  const toRemove = [];
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith('truckit_') || skip.indexOf(k) >= 0) continue;
    try {
      const s = JSON.parse(localStorage.getItem(k));
      if (!s || typeof s !== 'object') continue;
      const looks = s.lat != null || s.history || s.trackingActive != null || k.indexOf('truckit_TR-') === 0;
      if (!looks) continue;
      const ts = Date.parse(s.lastGpsAt || s.updatedAt || s.createdAt || s.lastUpdate || '') || 0;
      if (ts && ts < cutoff) toRemove.push(k);
    } catch (e) {}
  }
  for (const k of toRemove) {
    localStorage.removeItem(k);
    removed++;
    if (window.TruckitCloud && TruckitCloud.deleteKey) {
      try { await TruckitCloud.deleteKey('session:' + k.replace(/^truckit_/, '')); } catch (e) {}
    }
  }
  ok.textContent = 'Removed ' + removed + ' local session(s).';
  ok.classList.remove('hidden');
  refreshCloudStatus();
}
document.getElementById('adminPass').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') adminPageLogin();
});
(async function boot() {
  if (window.TruckitCloud && TruckitCloud.syncOnBoot) {
    try { await TruckitCloud.syncOnBoot(); } catch (e) {}
  }
  await pullUsers();
  try { if (sessionStorage.getItem(ADMIN_SESSION)) showApp(); } catch (e) {}
})();
