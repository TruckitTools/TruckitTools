/**
 * TruckitTools – Supabase cloud sync (automatic)
 *
 * 1. Paste your Project URL and anon key below (Supabase → Project Settings → API)
 * 2. Upload this file to GitHub next to index.html
 * 3. Saves push to the cloud automatically; pages pull on load
 */
(function (global) {
  // ========== PASTE YOUR SUPABASE VALUES HERE ==========
  const DEFAULT_URL = 'https://vdnpkrraucvpihhghqiz.supabase.co';
  const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkbnBrcnJhdWN2cGloaGdocWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjMyNjcsImV4cCI6MjEwMzEzOTI2N30.f0-UfV6vZAU_w0hIMoVN4KV6rLyFT6z4VcYltIb8oyI';
  // =====================================================

  const KV_TABLE = 'app_kv';
  const KEYS = {
    loads: 'truckit_loads',
    customers: 'truckit_customers',
    carriers: 'truckit_carriers'
  };
  const CONFIG_KEY = 'truckit_supabase_config';

  let client = null;
  let lastError = null;

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
    if (!cfg) throw new Error('Supabase not configured — set DEFAULT_URL and DEFAULT_ANON_KEY in cloud-sync.js');
    if (typeof global.supabase === 'undefined' || !global.supabase.createClient) {
      throw new Error('Supabase JS library not loaded');
    }
    client = global.supabase.createClient(cfg.url, cfg.anonKey);
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
        if (raw == null || raw === '') value = [];
        else value = JSON.parse(raw);
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

  async function syncOnBoot() {
    if (!isConfigured()) {
      console.info('TruckitCloud: not configured (set DEFAULT_URL / DEFAULT_ANON_KEY in cloud-sync.js)');
      return { ok: false, reason: 'not_configured' };
    }
    const pulled = await pullAll();
    if (!pulled.ok) return pulled;

    let cloudEmpty = true;
    let localHas = false;
    for (const k of Object.values(KEYS)) {
      const cloudVal = pulled.results[k];
      if (cloudVal != null) {
        const arr = Array.isArray(cloudVal) ? cloudVal : [];
        if (arr.length) cloudEmpty = false;
      }
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
      return await pushAllFromLocal();
    }
    return pulled;
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
    syncOnBoot,
    getLastError: () => lastError,
    getConfig
  };
})(typeof window !== 'undefined' ? window : globalThis);
