/**
 * Leonisa Digital Signage - Unified Supabase Client & Offline-First Dual SDK Wrapper
 * Replicates firestore/auth functions to allow seamless migration and keep code clean.
 * Hooks directly into real Supabase when environment secrets are provided, 
 * or falls back to an offline-first localStorage sandbox.
 */

import { createClient } from '@supabase/supabase-js';

// Supabase environment variables containing automatic cleaning to prevent PGRST125 errors
// Debug de variables de entorno en build de producción
const metaEnv = (import.meta as any).env || {};
if (metaEnv.DEV || !metaEnv.VITE_SUPABASE_URL) {
  console.warn('[Supabase] VITE_SUPABASE_URL:', metaEnv.VITE_SUPABASE_URL ? '✅ presente' : '❌ FALTANTE');
  console.warn('[Supabase] VITE_SUPABASE_ANON_KEY:', metaEnv.VITE_SUPABASE_ANON_KEY ? '✅ presente' : '❌ FALTANTE');
}

// @ts-ignore
const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
// @ts-ignore
const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

const DEFAULT_SUPABASE_URL = 'https://hogfhasodyoixwbgusjk.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvZ2ZoYXNvZHlvaXh3Ymd1c2prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMTAyMTUsImV4cCI6MjA5NTU4NjIxNX0.beAiAfni40JmnFYqazDxbQmCULxqdBb3KXhFOte1VuM';

// Seed localStorage with default credentials if not already configured
if (typeof window !== 'undefined') {
  if (!localStorage.getItem('leonisa_supabase_url')) {
    localStorage.setItem('leonisa_supabase_url', DEFAULT_SUPABASE_URL);
  }
  if (!localStorage.getItem('leonisa_supabase_anon_key')) {
    localStorage.setItem('leonisa_supabase_anon_key', DEFAULT_SUPABASE_KEY);
  }
}

// Retrieve from localStorage if env is not found
const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('leonisa_supabase_url') || '' : '';
const storedKey = typeof window !== 'undefined' ? localStorage.getItem('leonisa_supabase_anon_key') || '' : '';

const rawSupabaseUrl = envUrl || storedUrl || DEFAULT_SUPABASE_URL;
const rawSupabaseKey = envKey || storedKey || DEFAULT_SUPABASE_KEY;

export let supabase: any = null;

export function updateSupabaseConfig(url: string, key: string) {
  const cleanUrl = url.trim().replace(/\/+$/, '');
  let sanitizedUrl = cleanUrl;
  if (sanitizedUrl.endsWith('/rest/v1')) {
    sanitizedUrl = sanitizedUrl.substring(0, sanitizedUrl.length - 8);
  }
  sanitizedUrl = sanitizedUrl.replace(/\/+$/, '');

  if (typeof window !== 'undefined') {
    localStorage.setItem('leonisa_supabase_url', sanitizedUrl);
    localStorage.setItem('leonisa_supabase_anon_key', key.trim());
  }

  if (sanitizedUrl && key.trim()) {
    try {
      supabase = createClient(sanitizedUrl, key.trim());
      console.log("🚀 Supabase Client re-initialized successfully dynamically!");
      
      // NUEVO: Notificar al Player que debe re-suscribirse
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('supabase-ready', { 
          detail: { url: sanitizedUrl, key: key.trim() } 
        }));
      }
      
      return true;
    } catch (err) {
      console.error("Failed to re-initialize Supabase:", err);
      return false;
    }
  }
  return false;
}

// Initial automatic load
const initialUrl = rawSupabaseUrl.trim();
const initialKey = rawSupabaseKey.trim();

if (initialUrl && initialKey) {
  let cleanSupabaseUrl = initialUrl.replace(/\/+$/, '');
  if (cleanSupabaseUrl.endsWith('/rest/v1')) {
    cleanSupabaseUrl = cleanSupabaseUrl.substring(0, cleanSupabaseUrl.length - 8);
  }
  cleanSupabaseUrl = cleanSupabaseUrl.replace(/\/+$/, '');

  try {
    supabase = createClient(cleanSupabaseUrl, initialKey);
    console.log("🚀 Supabase Client initialized successfully! Live synced modes enabled.");
  } catch (error) {
    console.error("Failed to initialize Supabase client:", error);
  }
} else {
  console.log("📡 Supabase configuration not yet set in environment. Running in Local Offline Mock mode.");
}

// --------------------------------------------------------------------
// LOCAL STORAGE OFF-LINE BACKUP STATE ENGINE (FALLBACK)
// --------------------------------------------------------------------
function initializeLocalData() {
  const defaults: Record<string, any[]> = {
    users: [
      {
        id: "admin_test_uid",
        email: "jhonattan.navarro@gmail.com",
        role: "admin",
        name: "Jhonattan Navarro (Demo Admin)",
        createdAt: new Date().toISOString()
      },
      {
        id: "user_test_uid",
        email: "obregonvidaljhon@gmail.com",
        role: "admin",
        name: "Jhon Obregon (Admin)",
        createdAt: new Date().toISOString()
      }
    ],
    stores: [
      {
        id: "store_1",
        name: "Leonisa CC El Tesoro",
        city: "Medellín",
        address: "Local 1420 - Planta Alta"
      },
      {
        id: "store_2",
        name: "Leonisa CC Jockey Plaza",
        city: "Lima",
        address: "Primer Nivel - Pasillos de Accesorios"
      },
      {
        id: "store_3",
        name: "Leonisa CC Andino",
        city: "Bogotá",
        address: "Local 215 - Sector Premium"
      }
    ],
    screens: [
      {
        id: "screen_1",
        storeId: "store_1",
        name: "Pantalla Vitrina Principal",
        locationInStore: "Vitrina de ingreso principal de la tienda",
        status: "online",
        lastSeen: new Date().toISOString(),
        currentPlaylistId: "playlist_1"
      },
      {
        id: "screen_2",
        storeId: "store_1",
        name: "Pantalla Probadores",
        locationInStore: "Pasillo de probadores de lencería",
        status: "offline",
        lastSeen: new Date().toISOString(),
        currentPlaylistId: "playlist_2"
      },
      {
        id: "screen_3",
        storeId: "store_2",
        name: "Pantalla Pasillo General",
        locationInStore: "Sección de fajas y vestidos de baño",
        status: "online",
        lastSeen: new Date().toISOString(),
        currentPlaylistId: "playlist_1"
      }
    ],
    contents: [
      {
        id: "content_1",
        name: "Campaña Activewear - Colección 2026",
        type: "video",
        url: "https://assets.mixkit.co/videos/preview/mixkit-running-in-the-forest-43187-large.mp4",
        duration: 15,
        createdAt: new Date().toISOString()
      },
      {
        id: "content_2",
        name: "Lencería Seamless - Confort Sostenible",
        type: "image",
        url: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=640",
        duration: 10,
        createdAt: new Date().toISOString()
      },
      {
        id: "content_3",
        name: "Mensaje Corporativo - Promo 20%",
        type: "text",
        url: "Código de descuento: LEOLIVE20. Válido en toda la tienda física hoy.",
        duration: 8,
        createdAt: new Date().toISOString()
      }
    ],
    playlists: [
      {
        id: "playlist_1",
        name: "Loop General - Vitrina Lanzamientos",
        items: [
          { contentId: "content_1", name: "Campaña Activewear - Colección 2026", type: "video", duration: 15 },
          { contentId: "content_2", name: "Lencería Seamless - Confort Sostenible", type: "image", duration: 10 }
        ],
        createdAt: new Date().toISOString()
      },
      {
        id: "playlist_2",
        name: "Loop Probadores - Consejos de Estilo",
        items: [
          { contentId: "content_2", name: "Lencería Seamless - Confort Sostenible", type: "image", duration: 10 },
          { contentId: "content_3", name: "Mensaje Corporativo - Promo 20%", type: "text", duration: 8 }
        ],
        createdAt: new Date().toISOString()
      }
    ],
    schedules: [
      {
        id: "schedule_1",
        playlistId: "playlist_1",
        screenIds: ["screen_1", "screen_3"],
        name: "Campaña Seamless El Tesoro",
        active: true,
        createdAt: new Date().toISOString()
      },
      {
        id: "schedule_2",
        playlistId: "playlist_2",
        screenIds: ["screen_2"],
        name: "Consejos de Probador CC El Tesoro",
        active: true,
        createdAt: new Date().toISOString()
      }
    ],
    logs: [
      {
        id: "log_1",
        screenId: "screen_1",
        contentId: "content_1",
        playlistId: "playlist_1",
        playedAt: new Date(Date.now() - 5000).toISOString(),
        duration: 15
      },
      {
        id: "log_2",
        screenId: "screen_3",
        contentId: "content_2",
        playlistId: "playlist_1",
        playedAt: new Date(Date.now() - 10000).toISOString(),
        duration: 10
      }
    ]
  };

  for (const collectionName of Object.keys(defaults)) {
    const key = `leonisa_db_${collectionName}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify(defaults[collectionName]));
    }
  }
}

if (typeof window !== 'undefined') {
  initializeLocalData();
}

function getLocalCollection(colPath: string): any[] {
  const key = `leonisa_db_${colPath}`;
  const dataStr = localStorage.getItem(key);
  return dataStr ? JSON.parse(dataStr) : [];
}

function setLocalCollection(colPath: string, items: any[]) {
  const key = `leonisa_db_${colPath}`;
  localStorage.setItem(key, JSON.stringify(items));
}

function getLocalDoc(colPath: string, docId: string): any {
  const items = getLocalCollection(colPath);
  return items.find(item => item.id === docId) || null;
}

// Subscription Observer Pattern (Local Offline fallback)
interface Listener {
  id: string;
  type: 'collection' | 'doc' | 'query';
  path: string;
  callback: (snapshot: any) => void;
}
let listeners: Listener[] = [];

function notifyListeners(colPath: string) {
  for (const l of listeners) {
    if (l.type === 'collection' && l.path === colPath) {
      l.callback(null);
    } else if (l.type === 'query' && l.path === colPath) {
      l.callback(null);
    }
  }
}

function notifyDocListeners(colPath: string, docId: string) {
  const fullPath = `${colPath}/${docId}`;
  for (const l of listeners) {
    if (l.type === 'doc' && l.path === fullPath) {
      l.callback(null);
    }
  }
}

// HTML5 cross-tab active storage sync for local offline fallback mode
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('leonisa_db_')) {
      const colPath = e.key.replace('leonisa_db_', '');
      notifyListeners(colPath);
      // Try to notify doc listeners for each item in the collection in case a specific doc is listened to
      try {
        const itemsStr = e.newValue;
        if (itemsStr) {
          const items = JSON.parse(itemsStr);
          if (Array.isArray(items)) {
            items.forEach((item: any) => {
              if (item && item.id) {
                notifyDocListeners(colPath, item.id);
              }
            });
          }
        }
      } catch (err) {
        // Safe catch-all
      }
    }
  });
}

// --------------------------------------------------------------------
// DATABASE CASE TRANSLATION: CamelCase <-> SnakeCase 
// --------------------------------------------------------------------
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function snakeToCamel(str: string): string {
  return str.replace(/([-_][a-z])/g, group =>
    group.toUpperCase().replace('-', '').replace('_', '')
  );
}

function mapToSnakeCase(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => mapToSnakeCase(item));
  }
  if (typeof obj === 'object') {
    const n: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'items') {
        n[k] = v; // Preserve JSON schema of items
      } else {
        n[camelToSnake(k)] = mapToSnakeCase(v);
      }
    }
    return n;
  }
  return obj;
}

function mapToCamelCase(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => mapToCamelCase(item));
  }
  if (typeof obj === 'object') {
    const n: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'items') {
        n[k] = v; // Preserve JSON schema of items
      } else {
        n[snakeToCamel(k)] = mapToCamelCase(v);
      }
    }
    return n;
  }
  return obj;
}

function adjustContentItem(item: any, direction: 'toDb' | 'fromDb'): any {
  if (!item) return item;
  const lowerUrl = typeof item.url === 'string' ? item.url.toLowerCase() : '';
  const isAudioFile = lowerUrl.endsWith('.mp3') || 
                      lowerUrl.endsWith('.wav') || 
                      lowerUrl.endsWith('.m4a') || 
                      lowerUrl.endsWith('.ogg') ||
                      lowerUrl.includes('.mp3') ||
                      lowerUrl.includes('.wav') ||
                      lowerUrl.includes('.m4a') ||
                      lowerUrl.includes('/signage-contents/') ||
                      lowerUrl.includes('audio');

  if (direction === 'toDb') {
    if (item.type === 'audio' || isAudioFile) {
      return { ...item, type: 'text' };
    }
  } else {
    // Detect audio files by extension or typical patterns in URLs
    if ((item.type === 'text' || !item.type) && isAudioFile) {
      return { ...item, type: 'audio' };
    }
  }
  return item;
}

// --------------------------------------------------------------------
// MOCK ACCESSORS DEFINITIONS
// --------------------------------------------------------------------
class MockDocSnapshot {
  id: string;
  _data: any;
  constructor(id: string, data: any) {
    this.id = id;
    this._data = data;
  }
  exists() {
    return !!this._data;
  }
  data() {
    return this._data;
  }
}

class MockQuerySnapshot {
  docs: MockDocSnapshot[];
  constructor(docs: MockDocSnapshot[]) {
    this.docs = docs;
  }
}

// --- App Initializer ---
export function initializeApp() {
  return {};
}

// --- Auth Client Module with Supabase Connection ---
class MockAuth {
  currentUser: any = null;
  private authListeners: any[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      if (supabase) {
        // Setup real auth mapping
        supabase.auth.onAuthStateChange((event, session) => {
          if (session?.user) {
            const mappedUser = {
              uid: session.user.id,
              email: session.user.email,
              displayName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
              emailVerified: true
            };
            this.currentUser = mappedUser;
            localStorage.setItem('leonisa_user', JSON.stringify(mappedUser));
          } else {
            this.currentUser = null;
            localStorage.removeItem('leonisa_user');
          }
          this.notifyAuthChanged();
        });
      } else {
        const cached = localStorage.getItem('leonisa_user');
        if (cached) {
          this.currentUser = JSON.parse(cached);
        } else {
          // Default administrator demo user for quick start
          const defaultUser = {
            uid: 'admin_test_uid',
            email: 'obregonvidaljhon@gmail.com',
            displayName: 'Jhon Obregon (Demo)',
            emailVerified: true
          };
          this.currentUser = defaultUser;
          localStorage.setItem('leonisa_user', JSON.stringify(defaultUser));
        }
      }
    }
  }

  onAuthStateChanged(callback: any) {
    this.authListeners.push(callback);
    setTimeout(() => callback(this.currentUser), 0);
    return () => {
      this.authListeners = this.authListeners.filter(l => l !== callback);
    };
  }

  async signOut() {
    if (supabase) {
      await supabase.auth.signOut();
    }
    this.currentUser = null;
    localStorage.removeItem('leonisa_user');
    this.notifyAuthChanged();
  }

  async signInWithPopup(provider: any) {
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });
      if (error) throw error;
      return { user: this.currentUser };
    } else {
      const defaultUser = {
        uid: 'user_test_uid',
        email: 'obregonvidaljhon@gmail.com',
        displayName: 'Jhon Obregon (Demo)',
        emailVerified: true
      };
      this.currentUser = defaultUser;
      localStorage.setItem('leonisa_user', JSON.stringify(defaultUser));
      this.notifyAuthChanged();
      return { user: defaultUser };
    }
  }

  async signInWithEmailAndPassword(email: string, password: string) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    // Direct Login Bypass for designated admins with '123'
    if (
      (cleanEmail === 'admin' || 
       cleanEmail === 'admin@leonisa.com' || 
       cleanEmail === 'jhonattan.navarro@gmail.com' ||
       cleanEmail === 'obregonvidaljhon@gmail.com') && 
      cleanPassword === '123'
    ) {
      const adminUser = {
        uid: 'user_test_uid',
        email: cleanEmail === 'admin' ? 'admin@leonisa.com' : cleanEmail,
        displayName: 'Jhon Obregon (Admin)',
        emailVerified: true
      };
      this.currentUser = adminUser;
      localStorage.setItem('leonisa_user', JSON.stringify(adminUser));
      this.notifyAuthChanged();
      return { user: adminUser };
    }

    if (supabase) {
      // Supabase Email Authentication bridge if credentials are not the admin preset
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail.includes('@') ? cleanEmail : `${cleanEmail}@leonisa.com`,
        password: cleanPassword
      });
      if (error) throw error;

      const mappedUser = {
        uid: data.user.id,
        email: data.user.email,
        displayName: data.user.user_metadata?.full_name || data.user.email?.split('@')[0],
        emailVerified: true
      };
      this.currentUser = mappedUser;
      localStorage.setItem('leonisa_user', JSON.stringify(mappedUser));
      this.notifyAuthChanged();
      return { user: mappedUser };
    }

    throw new Error('Credenciales inválidas. Usa el usuario "obregonvidaljhon@gmail.com" o "admin" con la contraseña "123".');
  }

  private notifyAuthChanged() {
    for (const l of this.authListeners) {
      l(this.currentUser);
    }
  }
}

export const auth = new MockAuth();

export function getAuth() {
  return auth;
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
}

export function onAuthStateChanged(authInstance: any, callback: any) {
  return authInstance.onAuthStateChanged(callback);
}

export function signInWithPopup(authInstance: any, provider: any) {
  return authInstance.signInWithPopup(provider);
}

export function signInWithEmailAndPassword(authInstance: any, email: string, password: string) {
  return authInstance.signInWithEmailAndPassword(email, password);
}

export function signOut(authInstance: any) {
  return authInstance.signOut();
}

export class GoogleAuthProvider {}

// --------------------------------------------------------------------
// FIRESTORE TO SUPABASE ADAPTER
// --------------------------------------------------------------------
export const db = {};

export function getFirestore() {
  return db;
}

export function collection(dbRef: any, colPath: string) {
  return { type: 'collection', path: colPath };
}

export function doc(...args: any[]) {
  if (args.length === 3) {
    return { type: 'doc', collectionPath: args[1], docId: args[2] };
  } else {
    return { type: 'doc', collectionPath: args[0].path, docId: args[1] };
  }
}

export function query(colRef: any, ...constraints: any[]) {
  return { type: 'query', collectionRef: colRef, constraints };
}

export function where(field: string, op: string, value: any) {
  return { type: 'where', field, op, value };
}

export function orderBy(field: string, direction: string = 'asc') {
  return { type: 'orderBy', field, direction };
}

export function limit(val: number) {
  return { type: 'limit', val };
}

export function onSnapshot(ref: any, callback: any, errorCallback?: any) {
  if (!supabase) {
    // -----------------------------------------
    // LOCAL SANDBOX ONSNAPSHOT
    // -----------------------------------------
    const listenerId = Math.random().toString(36).substring(2);
    
    const trigger = () => {
      try {
        if (ref.type === 'doc') {
          const data = getLocalDoc(ref.collectionPath, ref.docId);
          callback(new MockDocSnapshot(ref.docId, data));
        } else {
          const collectionPath = ref.type === 'query' ? ref.collectionRef.path : ref.path;
          let items = getLocalCollection(collectionPath);
          
          if (ref.type === 'query') {
            const constraints = ref.constraints || [];
            for (const c of constraints) {
              if (c.type === 'where') {
                items = items.filter(item => {
                  const val = item[c.field];
                  if (c.op === '==') return val === c.value;
                  if (c.op === 'in') return Array.isArray(c.value) && c.value.includes(val);
                  return true;
                });
              }
              if (c.type === 'orderBy') {
                items = [...items].sort((a, b) => {
                  const valA = a[c.field];
                  const valB = b[c.field];
                  if (valA < valB) return c.direction === 'desc' ? 1 : -1;
                  if (valA > valB) return c.direction === 'desc' ? -1 : 1;
                  return 0;
                });
              }
              if (c.type === 'limit') {
                items = items.slice(0, c.val);
              }
            }
          }
          
          const docs = items.map(item => new MockDocSnapshot(item.id, item));
          callback(new MockQuerySnapshot(docs));
        }
      } catch (e) {
        if (errorCallback) errorCallback(e);
        else console.error("Local Sandbox Snapshot callback error:", e);
      }
    };

    listeners.push({
      id: listenerId,
      type: ref.type === 'doc' ? 'doc' : (ref.type === 'query' ? 'query' : 'collection'),
      path: ref.type === 'doc' ? `${ref.collectionPath}/${ref.docId}` : (ref.type === 'query' ? ref.collectionRef.path : ref.path),
      callback: trigger
    });

    setTimeout(trigger, 0);

    return () => {
      listeners = listeners.filter(l => l.id !== listenerId);
    };
  }

  // -----------------------------------------
  // SUPABASE LIVE REALTIME ONSNAPSHOT
  // -----------------------------------------
  let isUnsubscribed = false;
  let subChannel: any = null;

  const colPath = ref.type === 'doc' 
    ? ref.collectionPath 
    : (ref.type === 'query' ? ref.collectionRef.path : ref.path);

  const docId = ref.type === 'doc' ? ref.docId : null;

  const runQuery = async () => {
    if (isUnsubscribed) return;
    try {
      if (ref.type === 'doc') {
        const { data, error } = await supabase
          .from(colPath)
          .select('*')
          .eq('id', docId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') { // PGRST116: No rows returned
            callback(new MockDocSnapshot(docId, null));
          } else {
            throw error;
          }
        } else {
          const camel = mapToCamelCase(data);
          const finalData = colPath === 'contents' ? adjustContentItem(camel, 'fromDb') : camel;
          callback(new MockDocSnapshot(docId, finalData));
        }
      } else {
        let qBuilder = supabase.from(colPath).select('*');
        
        const constraints = ref.type === 'query' ? ref.constraints : [];
        for (const c of constraints) {
          if (c.type === 'where') {
            const field = camelToSnake(c.field);
            if (c.op === '==') {
              qBuilder = qBuilder.eq(field, c.value);
            } else if (c.op === 'in') {
              qBuilder = qBuilder.in(field, c.value);
            }
          }
          if (c.type === 'orderBy') {
            const field = camelToSnake(c.field);
            qBuilder = qBuilder.order(field, { ascending: c.direction !== 'desc' });
          }
          if (c.type === 'limit') {
            qBuilder = qBuilder.limit(c.val);
          }
        }

        const { data, error } = await qBuilder;
        if (error) throw error;
        
        const docs = (data || []).map(row => {
          const camel = mapToCamelCase(row);
          const finalData = colPath === 'contents' ? adjustContentItem(camel, 'fromDb') : camel;
          return new MockDocSnapshot(row.id, finalData);
        });
        callback(new MockQuerySnapshot(docs));
      }
    } catch (err) {
      if (errorCallback) errorCallback(err);
      else console.error("Supabase live onSnapshot failed:", err);
    }
  };

  runQuery();

  // Setup Real-time tables listening channel
  subChannel = supabase
    .channel(`rt:${colPath}:${docId || 'all'}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: colPath },
      () => {
        runQuery();
      }
    )
    .subscribe();

  // Bulletproof fallback: Polling interval in case Supabase PostgreSQL Replication is disabled on user's project settings
  const pollingInterval = setInterval(() => {
    runQuery();
  }, 4500);

  return () => {
    isUnsubscribed = true;
    clearInterval(pollingInterval);
    if (subChannel) {
      supabase.removeChannel(subChannel);
    }
  };
}

export async function addDoc(collectionRef: any, data: any) {
  const colPath = collectionRef.path;
  let resolvedData = { ...data };
  
  for (const key of Object.keys(resolvedData)) {
    if (resolvedData[key] && resolvedData[key].type === 'serverTimestamp') {
      resolvedData[key] = new Date().toISOString();
    }
  }

  if (colPath === 'contents') {
    resolvedData = adjustContentItem(resolvedData, 'toDb');
  }

  if (!supabase) {
    const id = resolvedData.id || Math.random().toString(36).substring(2, 10);
    const items = getLocalCollection(colPath);
    items.push({ ...resolvedData, id });
    setLocalCollection(colPath, items);
    notifyListeners(colPath);
    return { id };
  }

  const snakeData = mapToSnakeCase(resolvedData);
  if (!snakeData.id) {
    // Generate UUID/Random string if it is not present
    snakeData.id = Math.random().toString(36).substring(2, 15);
  }

  const { data: inserted, error } = await supabase
    .from(colPath)
    .insert([snakeData])
    .select()
    .single();

  if (error) throw error;
  return { id: inserted.id };
}

export async function updateDoc(docRef: any, data: any) {
  const colPath = docRef.collectionPath;
  const docId = docRef.docId;
  let resolvedData = { ...data };

  if (colPath === 'contents') {
    resolvedData = adjustContentItem(resolvedData, 'toDb');
  }

  if (!supabase) {
    const items = getLocalCollection(colPath);
    const index = items.findIndex(item => item.id === docId);
    if (index !== -1) {
      items[index] = { ...items[index], ...resolvedData };
      setLocalCollection(colPath, items);
      notifyListeners(colPath);
      notifyDocListeners(colPath, docId);
    } else {
      throw new Error(`Doc not found locally: ${docId}`);
    }
    return;
  }

  const snakeData = mapToSnakeCase(resolvedData);
  const { error } = await supabase
    .from(colPath)
    .update(snakeData)
    .eq('id', docId);

  if (error) throw error;
}

export async function setDoc(docRef: any, data: any) {
  const colPath = docRef.collectionPath;
  const docId = docRef.docId;
  let resolvedData = { ...data };

  if (colPath === 'contents') {
    resolvedData = adjustContentItem(resolvedData, 'toDb');
  }

  if (!supabase) {
    const items = getLocalCollection(colPath);
    const index = items.findIndex(item => item.id === docId);
    if (index !== -1) {
      items[index] = { id: docId, ...resolvedData };
    } else {
      items.push({ id: docId, ...resolvedData });
    }
    setLocalCollection(colPath, items);
    notifyListeners(colPath);
    notifyDocListeners(colPath, docId);
    return;
  }

  const snakeData = { ...mapToSnakeCase(resolvedData), id: docId };
  const { error } = await supabase
    .from(colPath)
    .upsert([snakeData]);

  if (error) throw error;
}

export async function deleteDoc(docRef: any) {
  const colPath = docRef.collectionPath;
  const docId = docRef.docId;

  if (!supabase) {
    const items = getLocalCollection(colPath);
    const filtered = items.filter(item => item.id !== docId);
    setLocalCollection(colPath, filtered);
    notifyListeners(colPath);
    notifyDocListeners(colPath, docId);
    return;
  }

  const { error } = await supabase
    .from(colPath)
    .delete()
    .eq('id', docId);

  if (error) throw error;
}

export async function getDoc(docRef: any) {
  const colPath = docRef.collectionPath;
  const docId = docRef.docId;

  if (!supabase) {
    const data = getLocalDoc(colPath, docId);
    return new MockDocSnapshot(docId, data);
  }

  const { data, error } = await supabase
    .from(colPath)
    .select('*')
    .eq('id', docId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return new MockDocSnapshot(docId, null);
    }
    throw error;
  }
  const camel = mapToCamelCase(data);
  const finalData = colPath === 'contents' ? adjustContentItem(camel, 'fromDb') : camel;
  return new MockDocSnapshot(docId, finalData);
}

export async function getDocs(ref: any) {
  const colPath = ref.type === 'query' ? ref.collectionRef.path : ref.path;

  if (!supabase) {
    let items = getLocalCollection(colPath);
    if (ref.type === 'query') {
      const constraints = ref.constraints || [];
      for (const c of constraints) {
        if (c.type === 'where') {
          items = items.filter(item => {
            const val = item[c.field];
            if (c.op === '==') return val === c.value;
            if (c.op === 'in') return Array.isArray(c.value) && c.value.includes(val);
            return true;
          });
        }
      }
    }
    const docs = items.map(item => new MockDocSnapshot(item.id, item));
    return new MockQuerySnapshot(docs);
  }

  let qBuilder = supabase.from(colPath).select('*');
  const constraints = ref.type === 'query' ? ref.constraints : [];
  for (const c of constraints) {
    if (c.type === 'where') {
      const field = camelToSnake(c.field);
      if (c.op === '==') {
        qBuilder = qBuilder.eq(field, c.value);
      } else if (c.op === 'in') {
        qBuilder = qBuilder.in(field, c.value);
      }
    }
  }

  const { data, error } = await qBuilder;
  if (error) throw error;

  const docs = (data || []).map(row => {
    const camel = mapToCamelCase(row);
    const finalData = colPath === 'contents' ? adjustContentItem(camel, 'fromDb') : camel;
    return new MockDocSnapshot(row.id, finalData);
  });
  return new MockQuerySnapshot(docs);
}

export function serverTimestamp() {
  return { type: 'serverTimestamp' };
}

// --------------------------------------------------------------------
// STORAGE TO SUPABASE BUCKET ADAPTER
// --------------------------------------------------------------------
export const storage = {};

export function getStorage() {
  return storage;
}

export function ref(storageInst: any, path: string) {
  return { path };
}

const downloadUrls: Record<string, string> = {};

class MockUploadTask {
  private file: File;
  private path: string;
  snapshot: any;

  constructor(path: string, file: File) {
    this.path = path;
    this.file = file;
    this.snapshot = { ref: this };
  }

  on(event: string, progressCallback: any, errorCallback: any, completeCallback: any) {
    if (!supabase) {
      // Offline fallback: Use Blob url
      let progress = 0;
      const interval = setInterval(() => {
        progress += 20;
        if (progress > 100) progress = 100;
        
        progressCallback({
          bytesTransferred: (progress / 100) * this.file.size,
          totalBytes: this.file.size
        });

        if (progress === 100) {
          clearInterval(interval);
          try {
            const url = URL.createObjectURL(this.file);
            downloadUrls[this.path] = url;
          } catch (e) {
            console.error("Local mock blob URL creation failed, using fallback", e);
            downloadUrls[this.path] = "https://assets.mixkit.co/videos/preview/mixkit-running-in-the-forest-43187-large.mp4";
          }
          completeCallback();
        }
      }, 100);
      return;
    }

    // Active Supabase Storage uploading to 'signage-contents' bucket
    const startRealUpload = async () => {
      try {
        const rawFilename = this.path.split('/').pop() || `${Date.now()}_${this.file.name}`;
        
        // Sanitize filename to prevent "Invalid key" errors due to spaces or Spanish accents (e.g., Ó, É, á, Ñ, etc.)
        const sanitizeFilename = (name: string): string => {
          return name
            .normalize('NFD') // Decomposes accents (e.g., Ó becomes O and combination accent)
            .replace(/[\u0300-\u036f]/g, '') // Removes actual accent marks
            .replace(/[^a-zA-Z0-9._-]/g, '_') // Replaces any non-safe character (spaces, symbols) with underscore
            .replace(/_+/g, '_'); // Avoids multiple sequential underscores
        };
        const cleanFilename = sanitizeFilename(rawFilename);
        
        // Let the client know we are starting at 10%
        progressCallback({
          bytesTransferred: 0.1 * this.file.size,
          totalBytes: this.file.size
        });

        // Try programmatically to create/update the bucket with an expanded size limit of 500MB (524288000 bytes)
        try {
          await supabase.storage.createBucket('signage-contents', {
            public: true,
            file_size_limit: 524288000,
            allowed_mime_types: ['image/*', 'video/*', 'audio/*']
          });
          console.log("🚀 Supabase Storage bucket 'signage-contents' created programmatically with 500MB limit!");
        } catch (createErr) {
          try {
            await supabase.storage.updateBucket('signage-contents', {
              public: true,
              file_size_limit: 524288000,
              allowed_mime_types: ['image/*', 'video/*', 'audio/*']
            });
            console.log("🚀 Supabase Storage bucket 'signage-contents' updated successfully to 500MB limit!");
          } catch (updateErr) {
            console.warn("[Supabase Storage] No se pudo crear/actualizar el límite del bucket desde el cliente (es normal si la anon key carece de permisos de admin):", updateErr);
          }
        }

        const { data, error } = await supabase.storage
          .from('signage-contents')
          .upload(cleanFilename, this.file, {
            cacheControl: '3600',
            upsert: true
          });

        if (error) {
          console.error("Supabase Storage error uploading", error);
          throw error;
        }

        // Simulating upload progress
        progressCallback({
          bytesTransferred: 0.7 * this.file.size,
          totalBytes: this.file.size
        });

        // Get public download url
        const { data: urlData } = supabase.storage
          .from('signage-contents')
          .getPublicUrl(cleanFilename);

        downloadUrls[this.path] = urlData.publicUrl;

        // Mark 100% finished
        progressCallback({
          bytesTransferred: this.file.size,
          totalBytes: this.file.size
        });

        completeCallback();
      } catch (err: any) {
        if (errorCallback) {
          errorCallback(err);
        } else {
          console.error("Supabase Storage Upload failed:", err);
        }
      }
    };

    startRealUpload();
  }
}

export function uploadBytesResumable(storageRef: any, file: File) {
  return new MockUploadTask(storageRef.path, file);
}

export async function getDownloadURL(taskRef: any) {
  return downloadUrls[taskRef.path] || '';
}
