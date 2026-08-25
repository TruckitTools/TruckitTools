/**
 * TruckitTools – Supabase cloud sync (loads + live tracking sessions + realtime)
 *
 * Paste Project URL + anon key below (Supabase → Project Settings → API)
 */
(function (global) {
  const DEFAULT_URL = 'https://vdnpkrraucvpihhghqiz.supabase.co';
  const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkbnBrcnJhdWN2cGloaGdocWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjMyNjcsImV4cCI6MjEwMzEzOTI2N30.f0-UfV6vZAU_w0hIMoVN4KV6rLyFT6z4VcYltIb8oyI';

  const KV_TABLE = 'app_kv';
  const KEYS = {
    loads: 'truckit_loads',
    customers: 'truckit_customers',
    carriers: 'truckit_carriers',
    brokerUsers: 'truckit_broker_users',
    companyProfile: 'truckit_company_profile',
    adminAuth: 'truckit_admin_auth'
  };
  const CONFIG_KEY = 'truckit_supabase_config';
  const SESSION_PREFIX = 'session:';
  const LOCAL_SESSION_PREFIX = 'truckit_';
  const STORAGE_BUCKET = 'truckit-docs';

  let client = null;
  let lastError = null;
  let sessionPushTimers = {};
  let realtimeChannel = null;
  const sessionListeners = new Set();
  const kvListeners = new Set(); // loads / customers / carriers / broker users

  function getConfig() {
    if (DEFAULT_URL && DEFAULT_ANON_KEY) {
      return { url: DEFAULT_URL.replace(/\/$/, ''), anonKey: DEFAULT_ANON_KEY };
    }
    if (global.TRUCKIT_SUPABASE_URL && global.TRUCKIT_SUPABASE_ANON_KEY) {
      return {
        url: String(global.TRUCKIT_SUPABASE_URL).replace(/\/$/, ''),
        anonKey: String(global.TRUCKIT_SUPABASE_ANON_KEY)
      };
    }
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  function configure(url, anonKey) {
    const cfg = {
      url: String(url || '').trim().replace(/\/$/, ''),
      anonKey: String(anonKey || '').trim()
    };
    if (!cfg.url || !cfg.anonKey) throw new Error('URL and anon key required');
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    client = null;
    return cfg;
  }

  function isConfigured() {
    const c = getConfig();
    return !!(c && c.url && c.anonKey);
  }

  async function ensureClient() {
    if (client) return client;
    const cfg = getConfig();
    if (!cfg) throw new Error('Supabase not configured');
    if (typeof global.supabase === 'undefined' || !global.supabase.createClient) {
      throw new Error('Supabase JS library not loaded');
    }
    client = global.supabase.createClient(cfg.url, cfg.anonKey);
    return client;
  }

  function sessionCloudKey(ref) {
    return SESSION_PREFIX + String(ref || '').trim().toUpperCase();
  }

  async function pullKey(storageKey) {
    const sb = await ensureClient();
    const { data, error } = await sb.from(KV_TABLE).select('value').eq('key', storageKey).maybeSingle();
    if (error) throw error;
    if (data && data.value != null) {
      const str = typeof data.value === 'string' ? data.value : JSON.stringify(data.value);
      localStorage.setItem(storageKey, str);
      return JSON.parse(str);
    }
    return null;
  }

  async function pushKey(storageKey, value) {
    const sb = await ensureClient();
    const payload = {
      key: storageKey,
      value: typeof value === 'string' ? JSON.parse(value) : value,
      updated_at: new Date().toISOString()
    };
    const { error } = await sb.from(KV_TABLE).upsert(payload, { onConflict: 'key' });
    if (error) throw error;
  }

  async function pullAll() {
    lastError = null;
    if (!isConfigured()) return { ok: false, reason: 'not_configured' };
    try {
      await ensureClient();
      const results = {};
      for (const k of Object.values(KEYS)) {
        results[k] = await pullKey(k);
      }
      return { ok: true, results };
    } catch (e) {
      lastError = e;
      console.warn('TruckitCloud.pullAll failed', e);
      return { ok: false, error: e };
    }
  }

  async function pushAllFromLocal() {
    lastError = null;
    if (!isConfigured()) return { ok: false, reason: 'not_configured' };
    try {
      await ensureClient();
      const uploaded = [];
      for (const k of Object.values(KEYS)) {
        const raw = localStorage.getItem(k);
        let value = (raw == null || raw === '') ? [] : JSON.parse(raw);
        await pushKey(k, value);
        uploaded.push(k);
      }
      return { ok: true, uploaded };
    } catch (e) {
      lastError = e;
      console.warn('TruckitCloud.pushAllFromLocal failed', e);
      return { ok: false, error: e };
    }
  }

  async function pushKeyFromLocal(storageKey) {
    if (!isConfigured()) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw == null) return;
      await pushKey(storageKey, JSON.parse(raw));
    } catch (e) {
      lastError = e;
      console.warn('TruckitCloud push failed', storageKey, e);
    }
  }

  /** Slim session for frequent GPS pushes (keep photo optional) */
  function sessionForCloud(data, includePhoto) {
    if (!data || typeof data !== 'object') return data;
    const out = {
      lat: data.lat,
      lng: data.lng,
      lastGpsAt: data.lastGpsAt,
      history: (data.history || []).slice(-40),
      messages: data.messages || [],
      driverInfo: data.driverInfo || null,
      loadDetails: data.loadDetails || null
    };
    if (includePhoto && data.truckPhoto) out.truckPhoto = data.truckPhoto;
    else if (data.truckPhoto) out.hasPhoto = true;
    return out;
  }

  async function pushSessionNow(ref, data, includePhoto) {
    if (!isConfigured()) return;
    try {
      const key = sessionCloudKey(ref);
      await pushKey(key, sessionForCloud(data, !!includePhoto));
    } catch (e) {
      lastError = e;
      console.warn('TruckitCloud pushSession failed', ref, e);
    }
  }

  /** Throttled push so GPS pings don't spam the API */
  function pushSession(ref, data, opts) {
    if (!isConfigured() || !ref) return;
    const r = String(ref).trim().toUpperCase();
    const includePhoto = !!(opts && opts.includePhoto);
    const delay = includePhoto ? 400 : 1800;
    clearTimeout(sessionPushTimers[r]);
    sessionPushTimers[r] = setTimeout(function () {
      pushSessionNow(r, data, includePhoto);
    }, delay);
  }

  async function pullSession(ref) {
    if (!isConfigured() || !ref) return null;
    try {
      const key = sessionCloudKey(ref);
      const sb = await ensureClient();
      const { data, error } = await sb.from(KV_TABLE).select('value').eq('key', key).maybeSingle();
      if (error) throw error;
      if (!data || data.value == null) return null;
      const session = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      // Mirror into localStorage under truckit_REF for existing code
      try {
        const localKey = LOCAL_SESSION_PREFIX + String(ref).trim().toUpperCase();
        const existing = localStorage.getItem(localKey);
        let merged = session;
        if (existing) {
          const prev = JSON.parse(existing);
          merged = Object.assign({}, prev, session);
          if (!session.truckPhoto && prev.truckPhoto) merged.truckPhoto = prev.truckPhoto;
        }
        localStorage.setItem(localKey, JSON.stringify(merged));
        return merged;
      } catch (e) {
        return session;
      }
    } catch (e) {
      lastError = e;
      console.warn('TruckitCloud pullSession failed', ref, e);
      return null;
    }
  }

  function notifySessionListeners(ref, session) {
    sessionListeners.forEach(function (fn) {
      try { fn(ref, session); } catch (e) { console.warn(e); }
    });
  }

  function notifyKvListeners(key, value) {
    kvListeners.forEach(function (fn) {
      try { fn(key, value); } catch (e) { console.warn(e); }
    });
  }

  const KNOWN_KV_KEYS = Object.values(KEYS);

  /** Realtime: session:* GPS keys + main data keys (loads, customers, …) */
  async function ensureRealtime() {
    if (!isConfigured()) return;
    if (realtimeChannel) return;
    try {
      const sb = await ensureClient();
      realtimeChannel = sb
        .channel('truckit_live')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: KV_TABLE },
          function (payload) {
            const row = payload.new || payload.old;
            if (!row || !row.key) return;
            const key = String(row.key);

            // Live GPS sessions
            if (key.indexOf(SESSION_PREFIX) === 0) {
              if (payload.eventType === 'DELETE') return;
              const ref = key.slice(SESSION_PREFIX.length);
              let session = row.value;
              if (typeof session === 'string') {
                try { session = JSON.parse(session); } catch (e) { return; }
              }
              try {
                const localKey = LOCAL_SESSION_PREFIX + ref;
                const existing = localStorage.getItem(localKey);
                let merged = session;
                if (existing) {
                  const prev = JSON.parse(existing);
                  merged = Object.assign({}, prev, session);
                  if (!session.truckPhoto && prev.truckPhoto) merged.truckPhoto = prev.truckPhoto;
                }
                localStorage.setItem(localKey, JSON.stringify(merged));
              } catch (e) {}
              notifySessionListeners(ref, session);
              return;
            }

            // Loads / customers / carriers / broker users
            if (KNOWN_KV_KEYS.indexOf(key) === -1) return;
            if (payload.eventType === 'DELETE') {
              try { localStorage.removeItem(key); } catch (e) {}
              notifyKvListeners(key, null);
              return;
            }
            let value = row.value;
            if (typeof value === 'string') {
              try { value = JSON.parse(value); } catch (e) { /* keep string */ }
            }
            try {
              localStorage.setItem(key, JSON.stringify(value));
            } catch (e) {
              console.warn('TruckitCloud realtime local write failed', key, e);
            }
            notifyKvListeners(key, value);
          }
        )
        .subscribe(function (status) {
          console.info('TruckitCloud realtime', status);
        });
    } catch (e) {
      console.warn('TruckitCloud realtime setup failed', e);
    }
  }

  function onSessionUpdate(fn) {
    if (typeof fn === 'function') sessionListeners.add(fn);
    ensureRealtime();
    return function () { sessionListeners.delete(fn); };
  }

  /** Subscribe to loads (and other KV) live updates. fn(key, value) */
  function onKvUpdate(fn) {
    if (typeof fn === 'function') kvListeners.add(fn);
    ensureRealtime();
    return function () { kvListeners.delete(fn); };
  }

  function onLoadsUpdate(fn) {
    return onKvUpdate(function (key, value) {
      if (key === KEYS.loads && typeof fn === 'function') fn(value);
    });
  }

  async function syncOnBoot() {
    if (!isConfigured()) {
      console.info('TruckitCloud: not configured');
      return { ok: false, reason: 'not_configured' };
    }
    const pulled = await pullAll();
    if (!pulled.ok) return pulled;

    let cloudEmpty = true;
    let localHas = false;
    for (const k of Object.values(KEYS)) {
      const cloudVal = pulled.results[k];
      if (cloudVal != null && Array.isArray(cloudVal) && cloudVal.length) cloudEmpty = false;
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length) localHas = true;
        }
      } catch (e) {}
    }
    if (cloudEmpty && localHas) {
      console.info('TruckitCloud: seeding cloud from local data…');
      await pushAllFromLocal();
    }
    await ensureRealtime();
    return pulled;
  }


  // ---------- Supabase Storage (PDFs + photos) ----------
  function storagePathSafe(s) {
    return String(s || 'x').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  }

  async function uploadBlob(path, blob, contentType) {
    const sb = await ensureClient();
    const ct = contentType || (blob && blob.type) || 'application/octet-stream';
    const { data, error } = await sb.storage.from(STORAGE_BUCKET).upload(path, blob, {
      contentType: ct,
      upsert: true,
      cacheControl: '3600'
    });
    if (error) {
      lastError = error;
      throw error;
    }
    const { data: pub } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return { path: path, publicUrl: pub && pub.publicUrl ? pub.publicUrl : null, data: data };
  }

  async function uploadDataUrl(path, dataUrl) {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return uploadBlob(path, blob, blob.type || 'image/jpeg');
  }

  /** RateCon / BOL / packet under docs/{loadId}/ */
  async function uploadLoadDocument(loadId, docType, blobOrFile, filename) {
    const id = storagePathSafe(loadId || 'unknown');
    const type = storagePathSafe(docType || 'doc');
    const name = storagePathSafe(filename || (type + '.pdf'));
    const path = 'docs/' + id + '/' + type + '/' + Date.now() + '_' + name;
    const blob = blobOrFile;
    const result = await uploadBlob(path, blob, 'application/pdf');
    return result;
  }

  /** Truck photo under photos/{trackingRef}/ */
  async function uploadTrackingPhoto(ref, dataUrl) {
    const r = storagePathSafe(String(ref || '').toUpperCase() || 'unknown');
    const path = 'photos/' + r + '/' + Date.now() + '.jpg';
    return uploadDataUrl(path, dataUrl);
  }

  async function getPublicUrl(path) {
    const sb = await ensureClient();
    const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data && data.publicUrl ? data.publicUrl : null;
  }


  async function deleteKey(storageKey) {
    const sb = await ensureClient();
    const { error } = await sb.from(KV_TABLE).delete().eq('key', storageKey);
    if (error) {
      lastError = error;
      throw error;
    }
    return { ok: true };
  }

  global.TruckitCloud = {
    KEYS,
    CONFIG_KEY,
    configure,
    isConfigured,
    pullAll,
    pullKey,
    pushKey,
    pushAllFromLocal,
    pushKeyFromLocal,
    pushSession,
    pullSession,
    onSessionUpdate,
    onKvUpdate,
    onLoadsUpdate,
    ensureRealtime,
    syncOnBoot,
    STORAGE_BUCKET,
    uploadBlob,
    uploadDataUrl,
    uploadLoadDocument,
    deleteKey,
    uploadTrackingPhoto,
    getPublicUrl,
    getLastError: function () { return lastError; },
    getConfig: getConfig
  };
})(typeof window !== 'undefined' ? window : globalThis);
