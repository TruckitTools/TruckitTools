/**
 * TruckitTools – Supabase cloud sync
 * Stores loads / customers / carriers in a simple key-value table.
 * localStorage remains a cache so existing sync code keeps working.
 */
(function (global) {
  const KV_TABLE = 'app_kv';
  const KEYS = {
    loads: 'truckit_loads',
    customers: 'truckit_customers',
    carriers: 'truckit_carriers'
  };

  // Set these once (Supabase → Project Settings → API)
  // You can also set them in the browser console:
  //   TruckitCloud.configure('https://XXXX.supabase.co', 'eyJhbGciOi...')
  const CONFIG_KEY = 'truckit_supabase_config';

  let client = null;
  let ready = false;
  let lastError = null;

  function getConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    // Optional hard-code after setup (anon key is safe to expose with RLS):
    if (global.TRUCKIT_SUPABASE_URL && global.TRUCKIT_SUPABASE_ANON_KEY) {
      return {
        url: global.TRUCKIT_SUPABASE_URL,
        anonKey: global.TRUCKIT_SUPABASE_ANON_KEY
      };
    }
    return null;
  }

  function configure(url, anonKey) {
    const cfg = { url: String(url || '').trim().replace(/\/$/, ''), anonKey: String(anonKey || '').trim() };
    if (!cfg.url || !cfg.anonKey) throw new Error('URL and anon key required');
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    client = null;
    ready = false;
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
    ready = true;
    return client;
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
        let value;
        if (raw == null || raw === '') {
          value = [];
        } else {
          value = JSON.parse(raw);
        }
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

  /** Call after any localStorage write of loads/customers/carriers */
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

  function wrapSave(storageKey, originalSaveFn) {
    return function () {
      const result = originalSaveFn.apply(this, arguments);
      pushKeyFromLocal(storageKey);
      return result;
    };
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
    wrapSave,
    getLastError: () => lastError,
    getConfig
  };
})(typeof window !== 'undefined' ? window : globalThis);
