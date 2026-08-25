
const USERS_KEY = 'truckit_auth_profiles';
const COMPANY_KEY = 'truckit_company_profile';
const ADMIN_SESSION = 'truckit_admin_session';
const MAX_BROKERS = 10;

const OFFICES_KEY = 'truckit_offices';

function getOffices() {
  try {
    const arr = JSON.parse(localStorage.getItem(OFFICES_KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

function saveOffices(list) {
  localStorage.setItem(OFFICES_KEY, JSON.stringify(list));
  if (window.TruckitCloud && TruckitCloud.pushKeyFromLocal) TruckitCloud.pushKeyFromLocal(OFFICES_KEY);
}

function officeNameById(id) {
  if (!id) return '—';
  const o = getOffices().find(function (x) { return x.id === id; });
  return o ? o.name : '—';
}

function renderOffices() {
  const el = document.getElementById('officeList');
  if (!el) return;
  const list = getOffices();
  const profiles = getProfiles();
  if (!list.length) {
    el.innerHTML = '<p class="muted">No offices yet. Add one above.</p>';
    return;
  }
  el.innerHTML = list.map(function (o) {
    const members = profiles.filter(function (p) { return p.officeId === o.id; });
    const owner = members.find(function (m) { return m.officeRole === 'owner'; });
    const emps = members.filter(function (m) { return m.officeRole === 'employee'; });
    return '<div class="user-row"><h4>' + escapeHtml(o.name) + '</h4>' +
      '<p>' + escapeHtml(o.phone || '') + (o.address ? ' · ' + escapeHtml(o.address) : '') + '</p>' +
      '<p><strong>Owner:</strong> ' + escapeHtml(owner ? (owner.email || [owner.firstName, owner.lastName].filter(Boolean).join(' ')) : 'Not assigned') + '</p>' +
      '<p><strong>Employees:</strong> ' + (emps.length ? emps.map(function (e) { return escapeHtml(e.email || e.firstName || e.id); }).join(', ') : 'None') + '</p>' +
      '<button type="button" class="cancel" onclick="deleteOffice(\'' + o.id + '\')">Delete office</button></div>';
  }).join('');
}

function saveNewOffice() {
  const err = document.getElementById('officeErr');
  const ok = document.getElementById('officeOk');
  err.classList.add('hidden'); ok.classList.add('hidden');
  const name = (document.getElementById('officeName').value || '').trim();
  if (!name) { err.textContent = 'Office name required.'; err.classList.remove('hidden'); return; }
  const list = getOffices();
  list.push({
    id: 'off_' + Date.now().toString(36),
    name: name,
    phone: (document.getElementById('officePhone').value || '').trim(),
    address: (document.getElementById('officeAddress').value || '').trim(),
    createdAt: new Date().toISOString()
  });
  saveOffices(list);
  document.getElementById('officeName').value = '';
  document.getElementById('officePhone').value = '';
  document.getElementById('officeAddress').value = '';
  ok.textContent = 'Office saved.';
  ok.classList.remove('hidden');
  renderOffices();
  fillOfficeSelect();
}

function deleteOffice(id) {
  if (!confirm('Delete this office? Users keep their accounts but lose office assignment.')) return;
  saveOffices(getOffices().filter(function (o) { return o.id !== id; }));
  const profiles = getProfiles().map(function (p) {
    if (p.officeId === id) { p.officeId = ''; p.officeRole = ''; }
    return p;
  });
  saveProfiles(profiles);
  renderOffices();
  renderUsers();
  fillOfficeSelect();
}

function fillOfficeSelect() {
  let sel = document.getElementById('userOffice');
  if (!sel) return;
  const cur = sel.value;
  const offices = getOffices();
  sel.innerHTML = '<option value="">— No office —</option>' +
    offices.map(function (o) {
      return '<option value="' + o.id + '">' + escapeHtml(o.name) + '</option>';
    }).join('');
  if (cur) sel.value = cur;
}


const DEFAULT_COMPANY = {
  name: 'TruckitTools', address: '23 Winnard Rd.', city: 'Hampton', state: 'VA', zip: '23669',
  phone: '804-577-7423', email: '', logoUrl: ''
};

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function cloudReady() {
  return window.TruckitCloud && TruckitCloud.isConfigured && TruckitCloud.isConfigured() && typeof supabase !== 'undefined';
}

function getProfiles() {
  if (window.TruckitBrokerAuth && TruckitBrokerAuth.getProfiles) return TruckitBrokerAuth.getProfiles();
  try {
    const arr = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

function saveProfiles(list) {
  if (window.TruckitBrokerAuth && TruckitBrokerAuth.saveProfiles) {
    TruckitBrokerAuth.saveProfiles(list);
    return;
  }
  localStorage.setItem(USERS_KEY, JSON.stringify(list));
  if (window.TruckitCloud && TruckitCloud.pushKeyFromLocal) TruckitCloud.pushKeyFromLocal(USERS_KEY);
}

function upsertProfile(p) {
  if (window.TruckitBrokerAuth && TruckitBrokerAuth.upsertProfile) return TruckitBrokerAuth.upsertProfile(p);
  const list = getProfiles();
  const idx = list.findIndex(function (x) { return x.id === p.id || String(x.email).toLowerCase() === String(p.email).toLowerCase(); });
  if (idx >= 0) list[idx] = Object.assign({}, list[idx], p);
  else list.push(p);
  saveProfiles(list);
}

function brokerCount() {
  return getProfiles().filter(function (p) { return p.role === 'broker'; }).length;
}

function adminCount() {
  return getProfiles().filter(function (p) { return p.role === 'admin'; }).length;
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

async function pullAllAuthData() {
  if (window.TruckitCloud && TruckitCloud.pullKey && cloudReady()) {
    try {
      await TruckitCloud.pullKey(USERS_KEY);
      await TruckitCloud.pullKey(COMPANY_KEY);
      await TruckitCloud.pullKey(OFFICES_KEY);
    } catch (e) { console.warn(e); }
  }
}

function setAdminUiSession(on) {
  if (on) sessionStorage.setItem(ADMIN_SESSION, JSON.stringify({ at: Date.now() }));
  else sessionStorage.removeItem(ADMIN_SESSION);
}

async function adminPageLogin() {
  const err = document.getElementById('adminLoginErr');
  err.classList.add('hidden');
  if (!cloudReady()) {
    err.textContent = 'Supabase is not configured. Add project URL + anon key in cloud-sync.js.';
    err.classList.remove('hidden');
    return;
  }
  const email = (document.getElementById('adminUser').value || '').trim();
  const password = document.getElementById('adminPass').value || '';
  if (!email || !password) {
    err.textContent = 'Email and password required.';
    err.classList.remove('hidden');
    return;
  }
  try {
    await TruckitCloud.signIn(email, password);
    await pullAllAuthData();
    const user = await TruckitCloud.getUser();
    let profile = getProfiles().find(function (p) {
      return p.id === user.id || String(p.email || '').toLowerCase() === String(user.email || '').toLowerCase();
    });
    const metaRole = user.user_metadata && user.user_metadata.role;
    if (!profile) {
      // Bootstrap: first admin if no admins exist
      if (adminCount() === 0) {
        profile = {
          id: user.id, email: user.email, role: 'admin',
          firstName: '', lastName: '', createdAt: new Date().toISOString()
        };
        upsertProfile(profile);
      } else if (metaRole === 'admin') {
        profile = {
          id: user.id, email: user.email, role: 'admin',
          firstName: (user.user_metadata && user.user_metadata.firstName) || '',
          lastName: (user.user_metadata && user.user_metadata.lastName) || '',
          createdAt: new Date().toISOString()
        };
        upsertProfile(profile);
      } else {
        await TruckitCloud.signOut();
        err.textContent = 'Not an admin account. Create the first admin below, or use an admin email.';
        err.classList.remove('hidden');
        return;
      }
    }
    if (profile.role !== 'admin') {
      await TruckitCloud.signOut();
      err.textContent = 'This account is not an admin.';
      err.classList.remove('hidden');
      return;
    }
    setAdminUiSession(true);
    showApp();
  } catch (e) {
    err.textContent = (e && e.message) || 'Login failed.';
    err.classList.remove('hidden');
  }
}

async function bootstrapAdmin() {
  const err = document.getElementById('adminLoginErr');
  err.classList.add('hidden');
  if (!cloudReady()) {
    err.textContent = 'Supabase is not configured.';
    err.classList.remove('hidden');
    return;
  }
  if (adminCount() > 0) {
    err.textContent = 'An admin already exists. Sign in with that email.';
    err.classList.remove('hidden');
    return;
  }
  const email = (document.getElementById('adminUser').value || '').trim();
  const password = document.getElementById('adminPass').value || '';
  if (!email || !password || password.length < 6) {
    err.textContent = 'Use a real email and password (6+ characters) to create the first admin.';
    err.classList.remove('hidden');
    return;
  }
  try {
    const data = await TruckitCloud.signUp(email, password, { role: 'admin' });
    const user = data.user || (await TruckitCloud.getUser());
    if (!user) {
      err.textContent = 'Sign-up did not return a user. Check Supabase email confirmation settings.';
      err.classList.remove('hidden');
      return;
    }
    upsertProfile({
      id: user.id, email: user.email || email, role: 'admin',
      firstName: '', lastName: '', createdAt: new Date().toISOString()
    });
    setAdminUiSession(true);
    showApp();
  } catch (e) {
    err.textContent = (e && e.message) || 'Could not create admin.';
    err.classList.remove('hidden');
  }
}

function showApp() {
  document.getElementById('adminLoginCard').classList.add('hidden');
  document.getElementById('adminApp').classList.remove('hidden');
  cancelForm();
  renderUsers();
  renderOffices();
  fillOfficeSelect();
  fillCompanyForm();
  refreshCloudStatus();
  showTab('users');
}

function showTab(name) {
  const tabs = ['users','offices','company','backup','security','cloud','purge'];
  tabs.forEach(function (t) {
    const el = document.getElementById('tab-' + t);
    if (!el) return;
    if (t === name) el.classList.remove('hidden');
    else el.classList.add('hidden');
  });
  document.querySelectorAll('#adminTabs button').forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === name);
  });
  if (name === 'cloud') refreshCloudStatus();
  if (name === 'offices') {
    try { renderOffices(); } catch (e) { console.error(e); }
  }
  if (name === 'users') {
    try { fillOfficeSelect(); } catch (e) {}
  }
}

function cancelForm() {
  document.getElementById('userFormCard').classList.add('hidden');
  document.getElementById('passwordCard').classList.add('hidden');
  document.getElementById('adminApp').classList.remove('hidden');
}

function renderUsers() {
  const list = getProfiles();
  document.getElementById('userCountLine').textContent =
    brokerCount() + ' / ' + MAX_BROKERS + ' brokers · ' + adminCount() + ' admin(s)';
  const el = document.getElementById('userList');
  if (!list.length) {
    el.innerHTML = '<p style="color:#64748b;font-size:13px;">No users yet. Tap + New User (broker) or bootstrap admin on the login screen.</p>';
    return;
  }
  el.innerHTML = list.map(function (u) {
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || '—';
    return '<div class="user-row"><h4>' + escapeHtml(u.email || u.username || '—') +
      ' <span style="font-size:11px;color:#94a3b8;">(' + escapeHtml(u.role || 'broker') + (u.officeRole ? ' · ' + u.officeRole : '') + ')</span></h4>' +
      '<p><strong>Name:</strong> ' + escapeHtml(name) + '</p>' +
      '<p><strong>Office:</strong> ' + escapeHtml(officeNameById(u.officeId)) + '</p>' +
      '<p><strong>Phone:</strong> ' + escapeHtml(u.phone || '—') + '</p>' +
      '<p><strong>Address:</strong> ' + escapeHtml(u.address || '—') + '</p>' +
      '<div><button type="button" class="secondary" onclick="editUser(\'' + u.id + '\')">Edit profile</button>' +
      (u.role === 'broker' ? '<button type="button" class="cancel" onclick="deleteUser(\'' + u.id + '\')">Remove profile</button>' : '') +
      '</div></div>';
  }).join('');
}

function clearForm() {
  document.getElementById('editId').value = '';
  ['firstName','lastName','dob','phone','phone2','address','username','password'].forEach(function (id) {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('formErr').classList.add('hidden');
}


function ensureOfficeFieldsOnForm() {
  fillOfficeSelect();
}

function showCreateForm() {
  ensureOfficeFieldsOnForm();
  fillOfficeSelect();
  if (brokerCount() >= MAX_BROKERS) {
    alert('Maximum of ' + MAX_BROKERS + ' broker users reached.');
    return;
  }
  clearForm();
  document.getElementById('formTitle').textContent = 'New Broker User (email + password)';
  document.getElementById('passwordCreateWrap').classList.remove('hidden');
  const userLabel = document.querySelector('#userFormCard .field-label');
  // username field is email
  document.getElementById('username').placeholder = 'email@example.com';
  document.getElementById('adminApp').classList.add('hidden');
  document.getElementById('passwordCard').classList.add('hidden');
  document.getElementById('userFormCard').classList.remove('hidden');
}

function editUser(id) {
  ensureOfficeFieldsOnForm();
  fillOfficeSelect();
  const u = getProfiles().find(function (x) { return x.id === id; });
  if (!u) return;
  document.getElementById('editId').value = u.id;
  document.getElementById('firstName').value = u.firstName || '';
  document.getElementById('lastName').value = u.lastName || '';
  document.getElementById('dob').value = u.dob || '';
  document.getElementById('phone').value = u.phone || '';
  document.getElementById('phone2').value = u.phone2 || '';
  document.getElementById('address').value = u.address || '';
  document.getElementById('username').value = u.email || u.username || '';
  document.getElementById('password').value = '';
  if (document.getElementById('userOffice')) document.getElementById('userOffice').value = u.officeId || '';
  if (document.getElementById('userOfficeRole')) document.getElementById('userOfficeRole').value = u.officeRole || 'employee';
  document.getElementById('passwordCreateWrap').classList.add('hidden');
  document.getElementById('formTitle').textContent = 'Edit Profile';
  document.getElementById('formErr').classList.add('hidden');
  document.getElementById('adminApp').classList.add('hidden');
  document.getElementById('passwordCard').classList.add('hidden');
  document.getElementById('userFormCard').classList.remove('hidden');
}

async function saveUserForm() {
  const err = document.getElementById('formErr');
  err.classList.add('hidden');
  const editId = document.getElementById('editId').value;
  const email = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const firstName = document.getElementById('firstName').value.trim();
  const lastName = document.getElementById('lastName').value.trim();
  const dob = document.getElementById('dob').value;
  const phone = document.getElementById('phone').value.trim();
  const phone2 = document.getElementById('phone2').value.trim();
  const address = document.getElementById('address').value.trim();

  if (!email) { err.textContent = 'Email is required.'; err.classList.remove('hidden'); return; }

  if (editId) {
    const list = getProfiles();
    const u = list.find(function (x) { return x.id === editId; });
    if (!u) return;
    Object.assign(u, { firstName: firstName, lastName: lastName, dob: dob, phone: phone, phone2: phone2, address: address, email: email, officeId: (document.getElementById('userOffice') && document.getElementById('userOffice').value) || '', officeRole: (document.getElementById('userOfficeRole') && document.getElementById('userOfficeRole').value) || '', updatedAt: new Date().toISOString() });
    saveProfiles(list);
    showApp();
    return;
  }

  // Create new broker via Supabase Auth signUp
  if (!cloudReady()) { err.textContent = 'Supabase not configured.'; err.classList.remove('hidden'); return; }
  if (!password || password.length < 6) { err.textContent = 'Password must be at least 6 characters.'; err.classList.remove('hidden'); return; }
  if (brokerCount() >= MAX_BROKERS) { err.textContent = 'Broker seat limit reached.'; err.classList.remove('hidden'); return; }

  try {
    const signUpFn = TruckitCloud.signUpIsolated || TruckitCloud.signUp;
    const data = await signUpFn(email, password, {
      role: 'broker', firstName: firstName, lastName: lastName
    });
    const user = data.user;
    // user may be null when email confirmation is required; profile still saved
    upsertProfile({
      id: (user && user.id) || ('pending_' + Date.now()),
      email: email,
      role: 'broker',
      officeId: (document.getElementById('userOffice') && document.getElementById('userOffice').value) || '',
      officeRole: (document.getElementById('userOfficeRole') && document.getElementById('userOfficeRole').value) || 'employee',
      firstName: firstName, lastName: lastName, dob: dob, phone: phone, phone2: phone2, address: address,
      createdAt: new Date().toISOString()
    });

    setAdminUiSession(true);
    document.getElementById('userFormCard').classList.add('hidden');
    document.getElementById('adminLoginCard').classList.add('hidden');
    document.getElementById('adminApp').classList.remove('hidden');
    showApp();
    alert(user
      ? 'Broker user created. You are still signed in as admin.'
      : 'Profile saved. If email confirmation is ON in Supabase, the user must confirm before login works.');
} catch (e) {
    err.textContent = (e && e.message) || 'Could not create user.';
    err.classList.remove('hidden');
  }
}

function deleteUser(id) {
  const u = getProfiles().find(function (x) { return x.id === id; });
  if (!u) return;
  if (!confirm('Remove profile for “' + (u.email || id) + '”? (Does not delete the Auth user in Supabase Dashboard — remove there too if needed.)')) return;
  saveProfiles(getProfiles().filter(function (x) { return x.id !== id; }));
  renderUsers();
}

function changePassword(id) {
  alert('Password changes: Supabase Dashboard → Authentication → Users → user → Reset password,\nor the user uses “Forgot password” once you enable email recovery.');
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
  const keys = ['truckit_loads','truckit_customers','truckit_carriers',USERS_KEY,COMPANY_KEY];
  const data = { exportedAt: new Date().toISOString(), version: 2, keys: {}, sessions: {} };
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
  err.textContent = 'Admin password is managed by Supabase Auth. Use Dashboard → Authentication → Users, or Account recovery email once enabled.';
  err.classList.remove('hidden');
}

function refreshCloudStatus() {
  const el = document.getElementById('cloudStatus');
  const configured = cloudReady();
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
    '<div class="status-row"><strong>Auth:</strong> Supabase email/password</div>' +
    (cfg && cfg.url ? '<div class="status-row"><strong>Project URL:</strong> ' + escapeHtml(cfg.url) + '</div>' : '') +
    '<div class="status-row"><strong>Storage bucket:</strong> truckit-docs</div>' +
    '<div class="status-row"><strong>Local:</strong> ' + loads + ' loads · ' + customers + ' customers · ' +
      carriers + ' carriers · ' + getProfiles().length + ' profiles · ' + sessions + ' TR sessions</div>';
}

async function testCloudWrite() {
  const ok = document.getElementById('cloudOk');
  const err = document.getElementById('cloudErr');
  ok.classList.add('hidden'); err.classList.add('hidden');
  if (!cloudReady()) { err.textContent = 'Cloud is not configured.'; err.classList.remove('hidden'); return; }
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
  const skip = ['truckit_loads','truckit_customers','truckit_carriers',USERS_KEY,COMPANY_KEY,'truckit_supabase_config','truckit_broker_session'];
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
  // Login card labels: email not username
  try {
    const labels = document.querySelectorAll('#adminLoginCard .field-label');
    if (labels[0]) labels[0].textContent = 'Admin email';
    if (labels[1]) labels[1].textContent = 'Password';
    const u = document.getElementById('adminUser');
    if (u) { u.type = 'email'; u.value = ''; u.placeholder = 'you@company.com'; }
    
  } catch (e) {}

  if (window.TruckitCloud && TruckitCloud.syncOnBoot) {
    try { await TruckitCloud.syncOnBoot(); } catch (e) {}
  }
  await pullAllAuthData();

  // If already signed in as admin, enter app
  try {
    if (cloudReady()) {
      const session = await TruckitCloud.getSession();
      if (session && session.user) {
        const profile = getProfiles().find(function (p) {
          return p.id === session.user.id || String(p.email || '').toLowerCase() === String(session.user.email || '').toLowerCase();
        });
        if (profile && profile.role === 'admin') {
          setAdminUiSession(true);
          showApp();
          return;
        }
      }
    }
  } catch (e) {}
})();
