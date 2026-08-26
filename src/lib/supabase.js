// Integração com Supabase Auth e REST API

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const SESSION_STORAGE_KEY = "alccor_session";

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

  if (session) {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

export const getCurrentSession = () => currentSession;

// ======================================================
// LOGIN
// ======================================================

export async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",

    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      email,
      password,
    }),
  });

  const text = await res.text();

  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("O servidor retornou uma resposta inválida.");
  }

  if (!res.ok) {
    throw new Error(
      data.error_description ||
        data.msg ||
        data.error ||
        data.message ||
        "E-mail ou senha inválidos.",
    );
  }

  saveSession(data);

  return data;
}

// ======================================================
// CADASTRO
// ======================================================

export async function signUpUser(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",

    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      email,
      password,
    }),
  });

  const text = await res.text();

  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("O servidor retornou uma resposta inválida.");
  }

  if (!res.ok) {
    throw new Error(
      data.error_description ||
        data.msg ||
        data.error ||
        data.message ||
        "Não foi possível criar a conta.",
    );
  }

  if (!data.id && !data.user) {
    throw new Error("Resposta inesperada ao criar a conta.");
  }

  return data.id ? data : data.user;
}

// ======================================================
// LOGOUT
// ======================================================

export async function signOut() {
  try {
    if (currentSession?.access_token) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: "POST",

        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${currentSession.access_token}`,
        },
      });
    }
  } catch {}

  saveSession(null);
}

// ======================================================
// ATUALIZAR SESSÃO
// ======================================================

async function refreshSession() {
  if (!currentSession?.refresh_token) {
    saveSession(null);
    return false;
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",

        headers: {
          apikey: SUPABASE_KEY,
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          refresh_token: currentSession.refresh_token,
        }),
      },
    );

    const text = await res.text();

    let data = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }

    if (!res.ok) {
      saveSession(null);
      return false;
    }

    if (!data?.access_token) {
      saveSession(null);
      return false;
    }

    saveSession(data);

    return true;
  } catch {
    saveSession(null);
    return false;
  }
}

// ======================================================
// REQUEST REST API
// ======================================================

async function request(path, options = {}, retry = true) {
  const token = currentSession?.access_token || SUPABASE_KEY;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: options.method || "GET",

    headers: {
      apikey: SUPABASE_KEY,

      Authorization: `Bearer ${token}`,

      "Content-Type": "application/json",

      Prefer: options.prefer || "return=representation",
    },

    body: options.body,
  });

  // --------------------------------------------------
  // TOKEN EXPIRADO
  // --------------------------------------------------

  if (res.status === 401 && retry && currentSession) {
    const ok = await refreshSession();

    if (ok) {
      return request(path, options, false);
    }
  }

  // --------------------------------------------------
  // LER RESPOSTA
  // --------------------------------------------------

  const text = await res.text();

  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  // --------------------------------------------------
  // ERRO
  // --------------------------------------------------

  if (!res.ok) {
    const message =
      data?.message ||
      data?.hint ||
      data?.error_description ||
      data?.error ||
      res.statusText ||
      "Erro ao acessar o servidor.";

    throw new Error(message);
  }

  // --------------------------------------------------
  // SEM CONTEÚDO
  // --------------------------------------------------

  if (res.status === 204) {
    return null;
  }

  return data;
}

// ======================================================
// GET
// ======================================================

export const get = (table, query = "") => request(`${table}?select=*${query}`);

// ======================================================
// INSERT
// ======================================================

export const insertRow = (table, data) =>
  request(table, {
    method: "POST",

    body: JSON.stringify(data),
  });

// ======================================================
// INSERT MULTIPLO
// ======================================================

export const insertRows = (table, rows) =>
  request(table, {
    method: "POST",

    body: JSON.stringify(rows),
  });

// ======================================================
// UPDATE
// ======================================================

export const updateRow = (table, id, data) =>
  request(`${table}?id=eq.${id}`, {
    method: "PATCH",

    body: JSON.stringify(data),
  });

// ======================================================
// DELETE
// ======================================================

export const deleteRow = (table, id) =>
  request(`${table}?id=eq.${id}`, {
    method: "DELETE",

    prefer: "return=minimal",
  });

// ======================================================
// STORAGE (upload de arquivos — ex: projeto em zip anexado ao orçamento)
// ======================================================

const STORAGE_BUCKET = "orcamentos-projetos";

export async function uploadFile(path, file) {
  const token = currentSession?.access_token || SUPABASE_KEY;
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": file.type || "application/zip",
        "x-upsert": "true",
      },
      body: file,
    },
  );
  if (!res.ok) {
    let msg = "Erro ao enviar o arquivo.";
    try {
      const data = await res.json();
      msg = data?.message || data?.error || msg;
    } catch {}
    throw new Error(msg);
  }
  return path;
}

export async function deleteFile(path) {
  const token = currentSession?.access_token || SUPABASE_KEY;
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`, {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {}
}

export function getFilePublicUrl(path) {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
}
