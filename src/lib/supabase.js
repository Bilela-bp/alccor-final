// Integração com Supabase Auth e REST API.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SESSION_STORAGE_KEY = 'alccor_session';

let currentSession = loadSession();

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session) {
  currentSession = session;
  if (session) localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_STORAGE_KEY);
}

export const getCurrentSession = () => currentSession;

export async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'E-mail ou senha inválidos.');
  saveSession(data);
  return data;
}

export async function signUpUser(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || data.error || 'Não foi possível criar a conta.');
  if (!data.id && !data.user) throw new Error('Resposta inesperada ao criar a conta.');
  return data.id ? data : data.user;
}

export async function signOut() {
  try {
    if (currentSession?.access_token) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${currentSession.access_token}` },
      });
    }
  } catch {}
  saveSession(null);
}

async function refreshSession() {
  if (!currentSession?.refresh_token) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: currentSession.refresh_token }),
    });
    const data = await res.json();
    if (!res.ok) return false;
    saveSession(data);
    return true;
  } catch {
    return false;
  }
}

async function request(path, options = {}, retry = true) {
  const token = currentSession?.access_token || SUPABASE_KEY;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: options.method || 'GET',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer || 'return=representation',
    },
    body: options.body,
  });

  if (res.status === 401 && retry && currentSession) {
    const ok = await refreshSession();
    if (ok) return request(path, options, false);
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      message = data.message || data.hint || message;
    } catch {}
    throw new Error(message);
  }

  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const get = (table, query = '') => request(`${table}?select=*${query}`);
export const insertRow = (table, data) => request(table, { method: 'POST', body: JSON.stringify(data) });
export const insertRows = (table, rows) => request(table, { method: 'POST', body: JSON.stringify(rows) });
export const updateRow = (table, id, data) => request(`${table}?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteRow = (table, id) => request(`${table}?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
