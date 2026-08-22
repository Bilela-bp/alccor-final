import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import logoAlccor from './assets/logo-alccor.png';
import {
  LayoutDashboard, Package, FileText, Users, Truck, ArrowUpCircle, ArrowDownCircle,
  Wallet, UserCog, CalendarCheck, ShieldCheck, Plus, Pencil, Trash2, X, Search,
  AlertTriangle, LogOut, ChevronRight, ChevronDown, Lock, Unlock, Check, Sun, Moon,
  ClipboardList, BarChart3, History, CalendarDays, RefreshCw
} from 'lucide-react';

// =========================================================================
// SUPABASE CONFIG (lido de variáveis de ambiente — ver .env)
// =========================================================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SESSION_STORAGE_KEY = 'alccor_session';

let currentSession = loadSession();

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveSession(session) {
  currentSession = session;
  if (session) localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_STORAGE_KEY);
}

// Faz login com e-mail e senha via Supabase Auth
async function signIn(email, password) {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password }),
    });

    const text = await res.text();

    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Resposta inválida do servidor: ${text || 'resposta vazia'}`);
    }

    if (!res.ok) {
      throw new Error(
        data.error_description ||
        data.msg ||
        data.message ||
        `Erro de autenticação (${res.status})`
      );
    }

    saveSession(data);
    return data;

  } catch (error) {
    console.error('Erro no login:', error);
    throw error;
  }
}

// Cria uma nova conta de login (usada pelo admin para cadastrar outros usuários).
// Usa só a chave anon/publishable — nunca a service_role — e NÃO mexe na sessão
// de quem está logado no momento (o admin continua logado normalmente).
async function signUpUser(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || data.error || 'Não foi possível criar a conta.');
  if (!data.id && !data.user) throw new Error('Resposta inesperada ao criar a conta.');
  return data.id ? data : data.user; // formatos variam conforme a versão do Supabase
}

async function signOut() {
  try {
    if (currentSession?.access_token) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${currentSession.access_token}` },
      });
    }
  } catch (e) {}
  saveSession(null);
}

// Tenta renovar a sessão usando o refresh_token guardado
async function refreshSession() {
  if (!currentSession?.refresh_token) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: currentSession.refresh_token }),
    });
   const text = await res.text();
const data = text ? JSON.parse(text) : {};
    return false;
  }
}

async function sb(path, options = {}, retry = true) {
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
    if (ok) return sb(path, options, false);
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = j.message || j.hint || msg;
    } catch (e) {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const get = (table, query = '') => sb(`${table}?select=*${query}`);
const insertRow = (table, data) => sb(table, { method: 'POST', body: JSON.stringify(data) });
const insertRows = (table, rows) => sb(table, { method: 'POST', body: JSON.stringify(rows) });
const updateRow = (table, id, data) => sb(`${table}?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(data) });
const deleteRow = (table, id) => sb(`${table}?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });

// =========================================================================
// HELPERS
// =========================================================================
const fmtCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
const fmtDate = (d) => (d ? new Date(d + (d.length <= 10 ? 'T00:00:00' : '')).toLocaleDateString('pt-BR') : '—');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('pt-BR') : '—');
const todayISO = () => new Date().toISOString().slice(0, 10);
const monthISO = () => new Date().toISOString().slice(0, 7) + '-01';

// Aplica a máscara 000.000.000-00 enquanto o usuário digita
const maskCPF = (value) => {
  const digits = (value || '').replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

// Valida os dígitos verificadores do CPF (algoritmo oficial)
const isValidCPF = (value) => {
  const cpf = (value || '').replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let check1 = (sum * 10) % 11;
  if (check1 === 10) check1 = 0;
  if (check1 !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  let check2 = (sum * 10) % 11;
  if (check2 === 10) check2 = 0;
  return check2 === Number(cpf[10]);
};

// Aplica a máscara 00.000.000/0000-00 enquanto o usuário digita
const maskCNPJ = (value) => {
  const digits = (value || '').replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

// Valida os dígitos verificadores do CNPJ (algoritmo oficial)
const isValidCNPJ = (value) => {
  const cnpj = (value || '').replace(/\D/g, '');
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calcDigit = (base) => {
    const weights = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = base.split('').reduce((s, d, i) => s + Number(d) * weights[i], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const d1 = calcDigit(cnpj.slice(0, 12));
  if (d1 !== Number(cnpj[12])) return false;
  const d2 = calcDigit(cnpj.slice(0, 13));
  return d2 === Number(cnpj[13]);
};

// Aplica a máscara (00) 00000-0000 (ou (00) 0000-0000 para fixo) enquanto digita
const maskPhone = (value) => {
  const digits = (value || '').replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
};

// Validação de formato de e-mail (exige @ e um domínio com ponto).
// Uma verificação real de "o e-mail existe de verdade" exigiria enviar um
// e-mail de confirmação ou consultar um serviço externo — não é algo confiável
// de se fazer só no navegador. Para os usuários do sistema (login), o Supabase
// Auth já impede e-mails duplicados/mal-formados na hora de criar a conta.
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((value || '').trim());

const WOOD = {
  sidebarBg: '#2E3235',
  sidebarBorder: '#40454A',
  accent: '#C08A3E',
  accentDark: '#9C6F2E',
};

function FontStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');
      .font-display { font-family: 'Fraunces', serif; }
      .font-body { font-family: 'Inter', sans-serif; }
    `}</style>
  );
}

function Badge({ children, tone = 'gray' }) {
  const tones = {
    gray: 'bg-stone-100 text-stone-700 border-stone-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Stat({ label, value, tone = 'default', sub }) {
  const toneColor = {
    default: '#292B2D',
    red: '#B23A2E',
    green: '#3F6B3F',
    amber: '#C08A3E',
  }[tone];
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 flex-1" style={{ minWidth: 160 }}>
      <p className="text-xs font-medium text-stone-500 mb-1">{label}</p>
      <p className="text-2xl font-display font-semibold" style={{ color: toneColor }}>{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-1">{sub}</p>}
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(36,24,15,0.45)' }}>
      <div
        className={`bg-white rounded-2xl shadow-xl w-full ${wide ? 'max-w-3xl' : 'max-w-md'} overflow-y-auto overflow-x-hidden`}
        style={{ maxHeight: '90vh' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 sticky top-0 bg-white rounded-t-2xl">
          <h3 className="font-display text-lg font-semibold text-stone-900">{title}</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, required, hint }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium text-stone-700 mb-1">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-stone-400 mt-1">{hint}</span>}
    </label>
  );
}

const inputCls = 'w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-700/40 focus:border-amber-700';

function ImageLightbox({ src, alt, className = '' }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`cursor-zoom-in ${className}`} aria-label={`Ampliar ${alt}`}>
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6" onClick={() => setOpen(false)}>
          <button type="button" onClick={() => setOpen(false)} className="absolute top-5 right-5 rounded-lg p-2 text-white hover:bg-white/15" aria-label="Fechar imagem">
            <X size={24} />
          </button>
          <img src={src} alt={alt} className="max-h-[90vh] max-w-[90vw] object-contain" onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </>
  );
}

// Campo de seleção com busca (por nome e, quando houver, por grupo/categoria),
// para substituir <select> grandes por uma lista curta e filtrável.
function ComboSelect({ options, value, onChange, placeholder = 'Buscar…', extraAction, allowClear }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQuery(''); }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const selected = options.find((o) => o.id === value);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => `${o.label} ${o.sublabel || ''}`.toLowerCase().includes(q))
    : options;

  return (
    <div className="relative" ref={ref}>
      <input
        type="text"
        className={inputCls}
        placeholder={placeholder}
        value={open ? query : (selected ? selected.label : '')}
        onFocus={() => setQuery('')}
        onClick={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
      />
      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-stone-200 rounded-lg shadow-lg">
          {allowClear && value && (
            <button type="button" onClick={() => { onChange(''); setOpen(false); setQuery(''); }} className="w-full text-left px-3 py-2 text-sm text-stone-400 hover:bg-stone-50 border-b border-stone-100">
              Limpar seleção
            </button>
          )}
          {extraAction && extraAction(() => { setOpen(false); setQuery(''); })}
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-stone-400">Nenhum resultado.</div>
          ) : filtered.map((o) => (
            <button
              type="button"
              key={o.id}
              onClick={() => { onChange(o.id); setOpen(false); setQuery(''); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-stone-50 flex items-center justify-between gap-2"
            >
              <span className="text-stone-800">{o.label}</span>
              {o.sublabel && <span className="text-xs text-stone-400 shrink-0">{o.sublabel}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PrimaryButton({ children, onClick, type = 'button', disabled, full }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 ${full ? 'w-full' : ''}`}
      style={{ backgroundColor: WOOD.accent }}
      onMouseEnter={(e) => !disabled && (e.currentTarget.style.backgroundColor = WOOD.accentDark)}
      onMouseLeave={(e) => !disabled && (e.currentTarget.style.backgroundColor = WOOD.accent)}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, type = 'button', danger }) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border ${
        danger ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-stone-300 text-stone-700 hover:bg-stone-50'
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-stone-400">
      <Icon size={32} className="mb-2" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

function LoadingRows() {
  return <div className="py-12 text-center text-sm text-stone-400">Carregando…</div>;
}

// =========================================================================
// GENERIC CRUD ENTITY PAGE
// =========================================================================
function EntityPage({ table, title, Icon, fields, subtitle, onChanged, afterSave }) {
  const submittingRef = useRef(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [lookups, setLookups] = useState({});
  const [novoGrupoFor, setNovoGrupoFor] = useState(null); // key do campo que está criando grupo novo
  const [novoGrupoNome, setNovoGrupoNome] = useState('');
  const [criandoGrupo, setCriandoGrupo] = useState(false);

  const refFields = useMemo(() => fields.filter((f) => f.refTable || f.type === 'grupo'), [fields]);

  const loadLookups = useCallback(async () => {
    const results = {};
    for (const f of refFields) {
      const lookupTable = f.type === 'grupo' ? 'grupos_produtos' : f.refTable;
      const labelField = f.type === 'grupo' ? 'nome' : f.refLabel;
      try {
        const data = await get(lookupTable, `&order=${labelField}.asc`);
        // Para "grupo", o produto guarda o NOME do grupo direto (texto), não um id —
        // então tanto id quanto label do option usam o nome.
        results[f.key] = f.type === 'grupo'
          ? (data || []).map((d) => ({ id: d[labelField], label: d[labelField] }))
          : (data || []).map((d) => ({ id: d.id, label: d[labelField] }));
      } catch (e) {
        results[f.key] = [];
      }
    }
    setLookups(results);
  }, [refFields]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await get(table, `&order=${fields[0].key}.asc`);
      setRows(data || []);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [table, fields]);

  useEffect(() => {
    load();
    loadLookups();
  }, [load, loadLookups]);

  function labelFor(field, id) {
    if (!id) return '—';
    const opt = (lookups[field.key] || []).find((o) => o.id === id);
    return opt ? opt.label : '—';
  }

  function openNew() {
    const init = {};
    fields.forEach((f) => {
      if (f.type === 'boolean') init[f.key] = true;
      else if (f.type === 'documento') { init[f.key] = ''; init[f.tipoKey] = 'cpf'; }
      else init[f.key] = '';
    });
    setFormData(init);
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(row) {
    setFormData({ ...row });
    setEditing(row);
    setModalOpen(true);
  }

  async function handleDelete(row) {
    if (!window.confirm('Excluir este registro? Essa ação não pode ser desfeita.')) return;
    try {
      await deleteRow(table, row.id);
      load();
      onChanged && onChanged();
    } catch (e) {
      const isForeignKeyError = /foreign key constraint|violates foreign key/i.test(e.message);
      const hasAtivo = fields.some((f) => f.key === 'ativo');
      if (isForeignKeyError && hasAtivo) {
        const desativar = window.confirm(
          'Esse registro já tem lançamentos vinculados (notas, movimentações, contas, etc.) e não pode ser excluído sem perder esse histórico.\n\nDeseja desativá-lo em vez disso? Ele deixa de aparecer nas listas de seleção, mas o histórico continua intacto.'
        );
        if (desativar) {
          try {
            await updateRow(table, row.id, { ativo: false });
            await load();
            onChanged && onChanged();
          } catch (e2) {
            window.alert('Erro ao desativar: ' + e2.message);
          }
        }
      } else if (isForeignKeyError) {
        window.alert('Esse registro já tem lançamentos vinculados (notas, movimentações, contas, etc.) e não pode ser excluído sem perder esse histórico.');
      } else {
        window.alert('Erro ao excluir: ' + e.message);
      }
    }
  }

  async function handleCriarGrupo(e) {
    e.preventDefault();
    if (criandoGrupo) return;
    const nome = novoGrupoNome.trim();
    if (!nome) { window.alert('Digite um nome para o grupo.'); return; }
    setCriandoGrupo(true);
    try {
      await insertRow('grupos_produtos', { nome });
      setLookups((prev) => {
        const atual = prev[novoGrupoFor] || [];
        const jaExiste = atual.some((o) => o.label.toLowerCase() === nome.toLowerCase());
        const novaLista = jaExiste ? atual : [...atual, { id: nome, label: nome }].sort((a, b) => a.label.localeCompare(b.label));
        return { ...prev, [novoGrupoFor]: novaLista };
      });
      setFormData((prev) => ({ ...prev, [novoGrupoFor]: nome }));
      setNovoGrupoFor(null);
      setNovoGrupoNome('');
    } catch (e) {
      const msg = /duplicate key|already exists|unique constraint/i.test(e.message)
        ? 'Já existe um grupo com esse nome.'
        : e.message;
      window.alert('Erro ao criar grupo: ' + msg);
    }
    setCriandoGrupo(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (submittingRef.current) return; // evita lançamento duplicado (duplo clique / Enter + clique)

    for (const f of fields) {
      const v = formData[f.key];
      if (f.type === 'cpf' && v && v.replace(/\D/g, '').length > 0 && !isValidCPF(v)) {
        window.alert('CPF inválido. Confira os números antes de salvar.');
        return;
      }
      if (f.type === 'cnpj') {
        const digits = (v || '').replace(/\D/g, '');
        if (f.required && digits.length === 0) { window.alert(`Informe o CNPJ em "${f.label}".`); return; }
        if (digits.length > 0 && !isValidCNPJ(v)) { window.alert('CNPJ inválido. Confira os números antes de salvar.'); return; }
      }
      if (f.type === 'email' && v && !isValidEmail(v)) {
        window.alert(`E-mail inválido em "${f.label}". Confira se digitou o @ e o domínio corretamente (ex: nome@empresa.com).`);
        return;
      }
      if (f.type === 'phone' && f.required && (!v || v.replace(/\D/g, '').length < 10)) {
        window.alert(`Informe um telefone válido (com DDD) em "${f.label}".`);
        return;
      }
      if (f.type === 'documento') {
        const tipo = formData[f.tipoKey] || 'cpf';
        const digits = (v || '').replace(/\D/g, '');
        if (digits.length === 0) {
          if (f.required) { window.alert('Informe o CPF ou CNPJ do cliente.'); return; }
        } else {
          const valido = tipo === 'cnpj' ? isValidCNPJ(v) : isValidCPF(v);
          if (!valido) { window.alert(`${tipo.toUpperCase()} inválido. Confira os números antes de salvar.`); return; }
        }
      }
    }

    submittingRef.current = true;
    setSaving(true);
    try {
      const payload = {};
      fields.forEach((f) => {
        let v = formData[f.key];
        if (f.type === 'number') v = v === '' || v === null || v === undefined ? null : Number(v);
        if (f.type === 'select' && v === '') v = null;
        if (f.type === 'date' && v === '') v = null;
        // campo numérico opcional deixado em branco vira 0 (ex: produto novo sem custo/estoque definidos ainda)
        if (f.type === 'number' && v === null && !f.required) v = 0;
        payload[f.key] = v;
        if (f.type === 'documento') payload[f.tipoKey] = formData[f.tipoKey] || 'cpf';
      });
      const editingBefore = editing;
      const result = editingBefore ? await updateRow(table, editingBefore.id, payload) : await insertRow(table, payload);
      const savedRow = Array.isArray(result) ? result[0] : result;
      setModalOpen(false);
      await load();
      onChanged && onChanged();
      if (afterSave && savedRow) await afterSave(savedRow, editingBefore);
    } catch (e) {
      const msg = /duplicate key|already exists|unique constraint/i.test(e.message)
        ? 'Já existe um registro com esse mesmo valor (verifique campos que precisam ser únicos, como número da nota).'
        : e.message;
      window.alert('Erro ao salvar: ' + msg);
    }
    setSaving(false);
    submittingRef.current = false;
  }

  const filteredRows = rows.filter((r) => !search || JSON.stringify(r).toLowerCase().includes(search.toLowerCase()));
  const listFields = fields.filter((f) => f.showInList !== false).slice(0, 6);

  return (
    <div>
      <PageHeader Icon={Icon} title={title} subtitle={subtitle}>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-2.5 top-2.5 text-stone-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar…"
              className="pl-8 pr-3 py-1.5 text-sm border border-stone-300 rounded-lg w-40 focus:outline-none focus:ring-2 focus:ring-amber-700/30"
            />
          </div>
          <PrimaryButton onClick={openNew}><Plus size={16} /> Novo</PrimaryButton>
        </div>
      </PageHeader>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        {loading ? (
          <LoadingRows />
        ) : filteredRows.length === 0 ? (
          <EmptyState icon={Icon} text="Nenhum registro encontrado." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  {listFields.map((f) => (
                    <th key={f.key} className="text-left px-4 py-2.5 font-medium text-stone-500 whitespace-nowrap">{f.label}</th>
                  ))}
                  <th className="px-4 py-2.5 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                    {listFields.map((f) => (
                      <td key={f.key} className="px-4 py-2.5 text-stone-800 whitespace-nowrap">
                        {f.render ? f.render(row[f.key], row) : f.refTable ? labelFor(f, row[f.key]) : f.type === 'boolean' ? (
                          row[f.key] ? <Badge tone="green">Ativo</Badge> : <Badge tone="gray">Inativo</Badge>
                        ) : f.type === 'date' ? fmtDate(row[f.key]) : f.type === 'number' && f.currency ? fmtCurrency(row[f.key]) : (row[f.key] ?? '—')}
                      </td>
                    ))}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(row)} className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => handleDelete(row)} className="p-1.5 rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-600">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <Modal title={editing ? `Editar ${title}` : `Novo em ${title}`} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }}>
            {fields.map((f) => {
              if (f.hidden || f.type === 'docTipo') return null;
              return (
              <Field key={f.key} label={f.label} required={f.required} hint={f.hint}>
                {f.type === 'select' && f.options ? (
                  <select
                    className={inputCls}
                    required={f.required}
                    value={formData[f.key] ?? ''}
                    onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                  >
                    <option value="">Selecione…</option>
                    {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : f.refTable ? (
                  <ComboSelect
                    options={lookups[f.key] || []}
                    value={formData[f.key] || ''}
                    onChange={(id) => setFormData({ ...formData, [f.key]: id })}
                    placeholder="Buscar por nome…"
                    allowClear={!f.required}
                  />
                ) : f.type === 'grupo' ? (
                  <ComboSelect
                    options={lookups[f.key] || []}
                    value={formData[f.key] || ''}
                    onChange={(nome) => setFormData({ ...formData, [f.key]: nome })}
                    placeholder="Buscar grupo…"
                    allowClear={!f.required}
                    extraAction={(closeList) => (
                      <button
                        type="button"
                        onClick={() => { closeList(); setNovoGrupoNome(''); setNovoGrupoFor(f.key); }}
                        className="w-full text-left px-3 py-2 text-sm font-medium border-b border-stone-100"
                        style={{ color: WOOD.accentDark }}
                      >
                        + Criar novo grupo…
                      </button>
                    )}
                  />
                ) : f.type === 'boolean' ? (
                  <select
                    className={inputCls}
                    value={formData[f.key] ? 'true' : 'false'}
                    onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value === 'true' })}
                  >
                    <option value="true">Sim</option>
                    <option value="false">Não</option>
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea
                    className={inputCls}
                    rows={3}
                    value={formData[f.key] ?? ''}
                    onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                  />
                ) : f.type === 'cpf' ? (
                  <>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      maxLength={14}
                      className={inputCls}
                      required={f.required}
                      value={formData[f.key] ?? ''}
                      onChange={(e) => setFormData({ ...formData, [f.key]: maskCPF(e.target.value) })}
                    />
                    {formData[f.key] && formData[f.key].replace(/\D/g, '').length === 11 && !isValidCPF(formData[f.key]) && (
                      <span className="text-xs text-red-600 mt-1 block">CPF inválido — confira os números.</span>
                    )}
                  </>
                ) : f.type === 'cnpj' ? (
                  <>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                      className={inputCls}
                      required={f.required}
                      value={formData[f.key] ?? ''}
                      onChange={(e) => setFormData({ ...formData, [f.key]: maskCNPJ(e.target.value) })}
                    />
                    {formData[f.key] && formData[f.key].replace(/\D/g, '').length === 14 && !isValidCNPJ(formData[f.key]) && (
                      <span className="text-xs text-red-600 mt-1 block">CNPJ inválido — confira os números.</span>
                    )}
                  </>
                ) : f.type === 'email' ? (
                  <>
                    <input
                      type="email"
                      placeholder="nome@empresa.com"
                      className={inputCls}
                      required={f.required}
                      value={formData[f.key] ?? ''}
                      onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                    />
                    {formData[f.key] && !isValidEmail(formData[f.key]) && (
                      <span className="text-xs text-red-600 mt-1 block">E-mail inválido — precisa ter @ e um domínio (ex: nome@empresa.com).</span>
                    )}
                  </>
                ) : f.type === 'phone' ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="(00) 00000-0000"
                    maxLength={16}
                    className={inputCls}
                    required={f.required}
                    value={formData[f.key] ?? ''}
                    onChange={(e) => setFormData({ ...formData, [f.key]: maskPhone(e.target.value) })}
                  />
                ) : f.type === 'documento' ? (
                  <>
                    <div className="flex gap-2 mb-2">
                      {['cpf', 'cnpj'].map((tipo) => (
                        <button
                          key={tipo}
                          type="button"
                          onClick={() => setFormData({ ...formData, [f.tipoKey]: tipo, [f.key]: '' })}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                          style={(formData[f.tipoKey] || 'cpf') === tipo
                            ? { backgroundColor: WOOD.accent, color: '#fff', borderColor: WOOD.accent }
                            : { borderColor: '#D6D3D1', color: '#57534E' }}
                        >
                          {tipo.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder={(formData[f.tipoKey] || 'cpf') === 'cnpj' ? '00.000.000/0000-00' : '000.000.000-00'}
                      maxLength={18}
                      className={inputCls}
                      required={f.required}
                      value={formData[f.key] ?? ''}
                      onChange={(e) => {
                        const tipo = formData[f.tipoKey] || 'cpf';
                        const masked = tipo === 'cnpj' ? maskCNPJ(e.target.value) : maskCPF(e.target.value);
                        setFormData({ ...formData, [f.key]: masked });
                      }}
                    />
                    {(() => {
                      const tipo = formData[f.tipoKey] || 'cpf';
                      const digits = (formData[f.key] || '').replace(/\D/g, '');
                      const complete = tipo === 'cnpj' ? digits.length === 14 : digits.length === 11;
                      const valido = tipo === 'cnpj' ? isValidCNPJ(formData[f.key]) : isValidCPF(formData[f.key]);
                      return complete && !valido ? (
                        <span className="text-xs text-red-600 mt-1 block">{tipo.toUpperCase()} inválido — confira os números.</span>
                      ) : null;
                    })()}
                  </>
                ) : (
                  <input
                    type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                    step={f.type === 'number' ? 'any' : undefined}
                    className={inputCls}
                    required={f.required}
                    disabled={f.readOnly}
                    value={formData[f.key] ?? ''}
                    onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                  />
                )}
              </Field>
              );
            })}
            <div className="flex gap-2 justify-end mt-2">
              <SecondaryButton onClick={() => setModalOpen(false)}>Cancelar</SecondaryButton>
              <PrimaryButton type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</PrimaryButton>
            </div>
          </form>
        </Modal>
      )}

      {novoGrupoFor !== null && (
        <Modal title="Criar novo grupo" onClose={() => setNovoGrupoFor(null)}>
          <form onSubmit={handleCriarGrupo} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }}>
            <Field label="Nome do grupo" required>
              <input className={inputCls} required autoFocus value={novoGrupoNome} onChange={(e) => setNovoGrupoNome(e.target.value)} placeholder="Ex: Madeiras, Ferragens, Tecidos…" />
            </Field>
            <div className="flex gap-2 justify-end">
              <SecondaryButton onClick={() => setNovoGrupoFor(null)}>Cancelar</SecondaryButton>
              <PrimaryButton type="submit" disabled={criandoGrupo}>{criandoGrupo ? 'Criando…' : 'Criar e usar'}</PrimaryButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function PageHeader({ Icon, title, subtitle, children }) {
  return (
    <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#E7E5E3', color: WOOD.accentDark }}>
          <Icon size={20} />
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold text-stone-900">{title}</h2>
          {subtitle && <p className="text-sm text-stone-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

// =========================================================================
// DASHBOARD
// =========================================================================
function Dashboard({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [produtos, contasPagar, contasReceber, caixaAberto] = await Promise.all([
        get('produtos', '&ativo=eq.true&order=nome.asc'),
        get('contas_pagar', '&status=eq.pendente&order=data_vencimento.asc'),
        get('contas_receber', '&status=eq.pendente&order=data_vencimento.asc'),
        get('caixa', '&status=eq.aberto'),
      ]);
      setData({ produtos, contasPagar, contasReceber, caixaAberto });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !data) return <LoadingRows />;

  const baixoEstoque = data.produtos.filter((p) => Number(p.quantidade_atual) <= Number(p.estoque_minimo));
  const totalPagar = data.contasPagar.reduce((s, c) => s + Number(c.valor), 0);
  const totalReceber = data.contasReceber.reduce((s, c) => s + Number(c.valor), 0);
  const hoje = todayISO();
  const vencidasPagar = data.contasPagar.filter((c) => c.data_vencimento < hoje).length;
  const vencidasReceber = data.contasReceber.filter((c) => c.data_vencimento < hoje).length;
  const saldoCaixa = data.caixaAberto.reduce((s, c) => s + Number(c.valor_abertura), 0);

  return (
    <div>
      <PageHeader Icon={LayoutDashboard} title={`Olá, ${user.nome.split(' ')[0]}`} subtitle="Visão geral da Alccor hoje" />

      <div className="flex flex-wrap gap-3 mb-6">
        <Stat label="Contas a pagar (em aberto)" value={fmtCurrency(totalPagar)} tone={vencidasPagar ? 'red' : 'default'} sub={vencidasPagar ? `${vencidasPagar} vencida(s)` : `${data.contasPagar.length} pendente(s)`} />
        <Stat label="Contas a receber (em aberto)" value={fmtCurrency(totalReceber)} tone={vencidasReceber ? 'amber' : 'default'} sub={vencidasReceber ? `${vencidasReceber} vencida(s)` : `${data.contasReceber.length} pendente(s)`} />
        <Stat label="Caixa(s) aberto(s)" value={data.caixaAberto.length} tone="green" sub={data.caixaAberto.length ? `Abertura total ${fmtCurrency(saldoCaixa)}` : 'Nenhum caixa aberto'} />
        <Stat label="Produtos com estoque baixo" value={baixoEstoque.length} tone={baixoEstoque.length ? 'red' : 'green'} sub={`de ${data.produtos.length} produtos ativos`} />
      </div>

      {baixoEstoque.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-xl p-4 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-red-500" />
            <h3 className="font-medium text-stone-800 text-sm">Produtos abaixo do estoque mínimo</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {baixoEstoque.slice(0, 8).map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm border border-stone-100 rounded-lg px-3 py-2 bg-stone-50">
                <span className="text-stone-700">{p.nome}</span>
                <Badge tone="red">{p.quantidade_atual}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <h3 className="font-medium text-stone-800 text-sm mb-3">Próximos vencimentos — a pagar</h3>
          {data.contasPagar.slice(0, 5).length === 0 ? (
            <p className="text-sm text-stone-400">Nada pendente.</p>
          ) : (
            <div className="space-y-2">
              {data.contasPagar.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span className="text-stone-600">{c.descricao}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-stone-800 font-medium">{fmtCurrency(c.valor)}</span>
                    <Badge tone={c.data_vencimento < hoje ? 'red' : 'gray'}>{fmtDate(c.data_vencimento)}</Badge>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <h3 className="font-medium text-stone-800 text-sm mb-3">Próximos vencimentos — a receber</h3>
          {data.contasReceber.slice(0, 5).length === 0 ? (
            <p className="text-sm text-stone-400">Nada pendente.</p>
          ) : (
            <div className="space-y-2">
              {data.contasReceber.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span className="text-stone-600">{c.descricao}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-stone-800 font-medium">{fmtCurrency(c.valor)}</span>
                    <Badge tone={c.data_vencimento < hoje ? 'amber' : 'gray'}>{fmtDate(c.data_vencimento)}</Badge>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// NOTAS FISCAIS (com baixa automática de estoque via trigger no banco)
// =========================================================================
function NotasFiscaisPage({ user }) {
  const submittingRef = useRef(false);
  const [notas, setNotas] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewingItens, setViewingItens] = useState(null);
  const [saving, setSaving] = useState(false);

  const [header, setHeader] = useState({ numero: '', fornecedor_id: '', data_emissao: todayISO(), observacao: '' });
  const [itens, setItens] = useState([{ produto_id: '', quantidade: '', preco_unitario: '' }]);
  const [novoProdutoFor, setNovoProdutoFor] = useState(null); // índice do item que está cadastrando produto novo
  const [novoProdutoForm, setNovoProdutoForm] = useState({ nome: '', categoria: '' });
  const [grupos, setGrupos] = useState([]);
  const [novoGrupoModal, setNovoGrupoModal] = useState(false);
  const [novoGrupoNome, setNovoGrupoNome] = useState('');
  const [criandoGrupo, setCriandoGrupo] = useState(false);
  const [criandoProduto, setCriandoProduto] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [n, f, p, g] = await Promise.all([
        get('notas_fiscais', '&order=data_emissao.desc,criado_em.desc'),
        get('fornecedores', '&order=nome.asc'),
        get('produtos', '&order=nome.asc'),
        get('grupos_produtos', '&order=nome.asc'),
      ]);
      setNotas(n || []);
      setFornecedores(f || []);
      setProdutos(p || []);
      setGrupos(g || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadItens(nota) {
    const data = await get('notas_fiscais_itens', `&nota_fiscal_id=eq.${nota.id}&order=criado_em.asc`);
    setViewingItens({ nota, itens: data || [] });
  }

  function openNovoProduto(index) {
    setNovoProdutoForm({ nome: '', categoria: '' });
    setNovoProdutoFor(index);
  }

  async function handleCriarGrupoNota(e) {
    e.preventDefault();
    if (criandoGrupo) return;
    const nome = novoGrupoNome.trim();
    if (!nome) { window.alert('Digite um nome para o grupo.'); return; }
    setCriandoGrupo(true);
    try {
      const criado = await insertRow('grupos_produtos', { nome });
      const novo = criado[0];
      setGrupos((prev) => [...prev, novo].sort((a, b) => a.nome.localeCompare(b.nome)));
      setNovoProdutoForm((prev) => ({ ...prev, categoria: novo.nome }));
      setNovoGrupoModal(false);
      setNovoGrupoNome('');
    } catch (e) {
      const msg = /duplicate key|already exists|unique constraint/i.test(e.message)
        ? 'Já existe um grupo com esse nome.'
        : e.message;
      window.alert('Erro ao criar grupo: ' + msg);
    }
    setCriandoGrupo(false);
  }

  async function handleCriarProduto(e) {
    e.preventDefault();
    if (criandoProduto) return;
    if (!novoProdutoForm.nome.trim()) { window.alert('Informe o nome do produto.'); return; }
    setCriandoProduto(true);
    try {
      const criado = await insertRow('produtos', {
        nome: novoProdutoForm.nome.trim(),
        categoria: novoProdutoForm.categoria.trim() || null,
        ativo: true,
        // quantidade_atual, preco_custo e estoque_mínimo começam em 0 (padrão do banco) —
        // o custo é definido automaticamente pela primeira entrada desta nota fiscal.
      });
      const novo = criado[0];
      setProdutos((prev) => [...prev, novo].sort((a, b) => a.nome.localeCompare(b.nome)));
      updateItem(novoProdutoFor, 'produto_id', novo.id);
      setNovoProdutoFor(null);
    } catch (e) {
      window.alert('Erro ao cadastrar produto: ' + e.message);
    }
    setCriandoProduto(false);
  }

  function openNew() {
    setHeader({ numero: '', fornecedor_id: '', data_emissao: todayISO(), observacao: '' });
    setItens([{ produto_id: '', quantidade: '', preco_unitario: '' }]);
    setModalOpen(true);
  }

  function updateItem(i, key, value) {
    const copy = [...itens];
    copy[i] = { ...copy[i], [key]: value };
    setItens(copy);
  }
  function addItemRow() { setItens([...itens, { produto_id: '', quantidade: '', preco_unitario: '' }]); }
  function removeItemRow(i) { setItens(itens.filter((_, idx) => idx !== i)); }

  const total = itens.reduce((s, it) => s + (Number(it.quantidade) || 0) * (Number(it.preco_unitario) || 0), 0);

  async function handleSave(e) {
    e.preventDefault();
    if (submittingRef.current) return; // trava contra lançamento duplicado (Enter + clique, duplo clique)
    const validItens = itens.filter((it) => it.produto_id && Number(it.quantidade) > 0);
    if (!header.numero || !header.fornecedor_id) { window.alert('Preencha número e fornecedor da nota.'); return; }
    if (validItens.length === 0) { window.alert('Adicione ao menos um item válido.'); return; }
    try {
      const existentes = await get('notas_fiscais', `&numero=eq.${encodeURIComponent(header.numero.trim())}`);
      if (existentes && existentes.length > 0) {
        window.alert(`Já existe uma nota número "${header.numero}" cadastrada. Cada número só pode ser usado uma vez.`);
        return;
      }
    } catch (e) { /* se a checagem falhar, segue e deixa o banco garantir a unicidade */ }
    submittingRef.current = true;
    setSaving(true);
    try {
      const nota = await insertRow('notas_fiscais', {
        numero: header.numero,
        fornecedor_id: header.fornecedor_id,
        data_emissao: header.data_emissao,
        observacao: header.observacao || null,
        valor_total: total,
        usuario_id: user.id,
      });
      const notaId = nota[0].id;
      const rows = validItens.map((it) => ({
        nota_fiscal_id: notaId,
        produto_id: it.produto_id,
        quantidade: Number(it.quantidade),
        preco_unitario: Number(it.preco_unitario),
      }));
      await insertRows('notas_fiscais_itens', rows);
      setModalOpen(false);
      await load();
    } catch (e) {
      const msg = /duplicate key|already exists|unique constraint/i.test(e.message)
        ? `Já existe uma nota número "${header.numero}" cadastrada. Confira o número antes de lançar novamente.`
        : e.message;
      window.alert('Erro ao lançar nota: ' + msg);
    }
    setSaving(false);
    submittingRef.current = false;
  }

  async function handleDeleteNota(nota) {
    if (!window.confirm('Excluir esta nota fiscal? O estoque dos itens será estornado automaticamente.')) return;
    try {
      await deleteRow('notas_fiscais', nota.id);
      await load();
    } catch (e) {
      window.alert('Erro ao excluir: ' + e.message);
    }
  }

  const fornecedorNome = (id) => fornecedores.find((f) => f.id === id)?.nome || '—';
  const produtoNome = (id) => produtos.find((p) => p.id === id)?.nome || '—';

  return (
    <div>
      <PageHeader Icon={FileText} title="Notas fiscais" subtitle="Entrada de mercadoria — atualiza o estoque automaticamente">
        <PrimaryButton onClick={openNew}><Plus size={16} /> Nova nota fiscal</PrimaryButton>
      </PageHeader>

      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        {loading ? <LoadingRows /> : notas.length === 0 ? (
          <EmptyState icon={FileText} text="Nenhuma nota fiscal lançada ainda." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Número</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Fornecedor</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Emissão</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Valor total</th>
                <th className="px-4 py-2.5 w-28"></th>
              </tr>
            </thead>
            <tbody>
              {notas.map((n) => (
                <tr key={n.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                  <td className="px-4 py-2.5 text-stone-800 font-medium">{n.numero}</td>
                  <td className="px-4 py-2.5 text-stone-700">{fornecedorNome(n.fornecedor_id)}</td>
                  <td className="px-4 py-2.5 text-stone-700">{fmtDate(n.data_emissao)}</td>
                  <td className="px-4 py-2.5 text-stone-800">{fmtCurrency(n.valor_total)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => loadItens(n)} className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800" title="Ver itens">
                        <ChevronRight size={15} />
                      </button>
                      <button onClick={() => handleDeleteNota(n)} className="p-1.5 rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-600">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <Modal title="Nova nota fiscal" onClose={() => setModalOpen(false)} wide>
          <form onSubmit={handleSave} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Número da nota" required>
                <input className={inputCls} required value={header.numero} onChange={(e) => setHeader({ ...header, numero: e.target.value })} />
              </Field>
              <Field label="Fornecedor" required>
                <ComboSelect
                  options={fornecedores.map((f) => ({ id: f.id, label: f.nome }))}
                  value={header.fornecedor_id}
                  onChange={(id) => setHeader({ ...header, fornecedor_id: id })}
                  placeholder="Buscar fornecedor…"
                />
              </Field>
              <Field label="Data de emissão" required>
                <input type="date" className={inputCls} required value={header.data_emissao} onChange={(e) => setHeader({ ...header, data_emissao: e.target.value })} />
              </Field>
              <Field label="Observação">
                <input className={inputCls} value={header.observacao} onChange={(e) => setHeader({ ...header, observacao: e.target.value })} />
              </Field>
            </div>

            <p className="text-sm font-medium text-stone-700 mt-2 mb-2">Itens da nota</p>
            <div className="space-y-2 mb-2">
              {itens.map((it, i) => (
                <div key={i} className="flex flex-wrap gap-2 items-start bg-stone-50 border border-stone-200 rounded-lg p-2">
                  <div style={{ flex: '2 1 0%', minWidth: '12rem' }}>
                    <ComboSelect
                      options={produtos.filter((p) => p.ativo !== false).map((p) => ({ id: p.id, label: p.nome, sublabel: p.categoria || '' }))}
                      value={it.produto_id}
                      onChange={(id) => updateItem(i, 'produto_id', id)}
                      placeholder="Buscar produto por nome ou grupo…"
                      extraAction={(closeList) => (
                        <button
                          type="button"
                          onClick={() => { closeList(); openNovoProduto(i); }}
                          className="w-full text-left px-3 py-2 text-sm font-medium border-b border-stone-100"
                          style={{ color: WOOD.accentDark }}
                        >
                          + Cadastrar novo produto…
                        </button>
                      )}
                    />
                  </div>
                  <input type="number" step="any" placeholder="Qtd" className={inputCls} style={{ width: '5.5rem', flexShrink: 0 }} value={it.quantidade} onChange={(e) => updateItem(i, 'quantidade', e.target.value)} />
                  <input type="number" step="any" placeholder="Preço unit." className={inputCls} style={{ width: '7rem', flexShrink: 0 }} value={it.preco_unitario} onChange={(e) => updateItem(i, 'preco_unitario', e.target.value)} />
                  <button type="button" onClick={() => removeItemRow(i)} className="p-2 text-stone-400 hover:text-red-600"><X size={16} /></button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addItemRow} className="text-sm font-medium mb-4" style={{ color: WOOD.accentDark }}>+ adicionar item</button>

            <div className="flex items-center justify-between border-t border-stone-200 pt-3 mb-4">
              <span className="text-sm text-stone-500">Valor total da nota</span>
              <span className="font-display text-lg font-semibold text-stone-900">{fmtCurrency(total)}</span>
            </div>

            <div className="flex gap-2 justify-end">
              <SecondaryButton onClick={() => setModalOpen(false)}>Cancelar</SecondaryButton>
              <PrimaryButton type="submit" disabled={saving}>{saving ? 'Lançando…' : 'Lançar nota e atualizar estoque'}</PrimaryButton>
            </div>
          </form>
        </Modal>
      )}

      {viewingItens && (
        <Modal title={`Itens da nota ${viewingItens.nota.numero}`} onClose={() => setViewingItens(null)}>
          {viewingItens.itens.length === 0 ? (
            <p className="text-sm text-stone-400">Sem itens.</p>
          ) : (
            <div className="space-y-2">
              {viewingItens.itens.map((it) => (
                <div key={it.id} className="flex items-center justify-between text-sm border-b border-stone-100 pb-2">
                  <span className="text-stone-700">{produtoNome(it.produto_id)}</span>
                  <span className="text-stone-500">{it.quantidade} × {fmtCurrency(it.preco_unitario)}</span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {novoProdutoFor !== null && (
        <Modal title="Cadastrar novo produto" onClose={() => setNovoProdutoFor(null)}>
          <form onSubmit={handleCriarProduto} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }}>
            <Field label="Nome" required>
              <input className={inputCls} required autoFocus value={novoProdutoForm.nome} onChange={(e) => setNovoProdutoForm({ ...novoProdutoForm, nome: e.target.value })} />
            </Field>
            <Field label="Grupo / categoria">
              <ComboSelect
                options={grupos.map((g) => ({ id: g.nome, label: g.nome }))}
                value={novoProdutoForm.categoria}
                onChange={(nome) => setNovoProdutoForm({ ...novoProdutoForm, categoria: nome })}
                placeholder="Buscar grupo…"
                allowClear
                extraAction={(closeList) => (
                  <button
                    type="button"
                    onClick={() => { closeList(); setNovoGrupoNome(''); setNovoGrupoModal(true); }}
                    className="w-full text-left px-3 py-2 text-sm font-medium border-b border-stone-100"
                    style={{ color: WOOD.accentDark }}
                  >
                    + Criar novo grupo…
                  </button>
                )}
              />
            </Field>
            <p className="text-xs text-stone-400 mb-4">
              Sem chute de custo ou estoque inicial: o produto entra com estoque zerado e o preço de custo é
              calculado automaticamente pelo preço unitário que você lançar nesta nota.
            </p>
            <div className="flex gap-2 justify-end">
              <SecondaryButton onClick={() => setNovoProdutoFor(null)}>Cancelar</SecondaryButton>
              <PrimaryButton type="submit" disabled={criandoProduto}>{criandoProduto ? 'Cadastrando…' : 'Cadastrar e usar nesta nota'}</PrimaryButton>
            </div>
          </form>
        </Modal>
      )}

      {novoGrupoModal && (
        <Modal title="Criar novo grupo" onClose={() => setNovoGrupoModal(false)}>
          <form onSubmit={handleCriarGrupoNota} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }}>
            <Field label="Nome do grupo" required>
              <input className={inputCls} required autoFocus value={novoGrupoNome} onChange={(e) => setNovoGrupoNome(e.target.value)} placeholder="Ex: Madeiras, Ferragens, Tecidos…" />
            </Field>
            <div className="flex gap-2 justify-end">
              <SecondaryButton onClick={() => setNovoGrupoModal(false)}>Cancelar</SecondaryButton>
              <PrimaryButton type="submit" disabled={criandoGrupo}>{criandoGrupo ? 'Criando…' : 'Criar e usar'}</PrimaryButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// =========================================================================
// CAIXA (abertura/fechamento + movimentações)
// =========================================================================
function CaixaPage({ user }) {
  const abrirRef = useRef(false);
  const movRef = useRef(false);
  const fecharRef = useRef(false);
  const [caixas, setCaixas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [valorAbertura, setValorAbertura] = useState('');
  const [detail, setDetail] = useState(null);
  const [movs, setMovs] = useState([]);
  const [movModal, setMovModal] = useState(false);
  const [movForm, setMovForm] = useState({ tipo: 'entrada', valor: '', forma_pagamento: 'dinheiro', categoria: '', descricao: '', cliente_id: '', fornecedor_id: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, cl, fo] = await Promise.all([
        get('caixa', '&order=data_abertura.desc'),
        get('clientes', '&order=nome.asc'),
        get('fornecedores', '&order=nome.asc'),
      ]);
      setCaixas(c || []);
      setClientes(cl || []);
      setFornecedores(fo || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function abrirCaixa(e) {
    e.preventDefault();
    if (abrirRef.current) return;
    abrirRef.current = true;
    try {
      await insertRow('caixa', {
        data_abertura: new Date().toISOString(),
        valor_abertura: Number(valorAbertura) || 0,
        status: 'aberto',
        usuario_id: user.id,
      });
      setOpenModal(false);
      setValorAbertura('');
      await load();
    } catch (e) { window.alert('Erro ao abrir caixa: ' + e.message); }
    abrirRef.current = false;
  }

  async function openDetail(caixa) {
    const data = await get('movimentacoes_caixa', `&caixa_id=eq.${caixa.id}&order=data.desc`);
    setMovs(data || []);
    setDetail(caixa);
  }

  async function addMov(e) {
    e.preventDefault();
    if (movRef.current) return; // trava contra lançamento duplicado — causa raiz do fechamento errado
    if (!movForm.valor || Number(movForm.valor) <= 0) { window.alert('Informe um valor válido.'); return; }
    movRef.current = true;
    try {
      await insertRow('movimentacoes_caixa', {
        caixa_id: detail.id,
        tipo: movForm.tipo,
        valor: Number(movForm.valor),
        forma_pagamento: movForm.forma_pagamento,
        categoria: movForm.categoria || null,
        descricao: movForm.descricao || null,
        cliente_id: movForm.cliente_id || null,
        fornecedor_id: movForm.fornecedor_id || null,
        usuario_id: user.id,
        data: new Date().toISOString(),
      });
      setMovModal(false);
      setMovForm({ tipo: 'entrada', valor: '', forma_pagamento: 'dinheiro', categoria: '', descricao: '', cliente_id: '', fornecedor_id: '' });
      const data = await get('movimentacoes_caixa', `&caixa_id=eq.${detail.id}&order=data.desc`);
      setMovs(data || []);
    } catch (e) { window.alert('Erro ao lançar movimentação: ' + e.message); }
    movRef.current = false;
  }

  async function fecharCaixa() {
    if (fecharRef.current) return;
    const entradas = movs.filter((m) => m.tipo === 'entrada').reduce((s, m) => s + Number(m.valor), 0);
    const saidas = movs.filter((m) => m.tipo === 'saida').reduce((s, m) => s + Number(m.valor), 0);
    const valorFechamento = Number(detail.valor_abertura) + entradas - saidas;
    if (!window.confirm(`Fechar caixa com saldo de ${fmtCurrency(valorFechamento)}?`)) return;
    fecharRef.current = true;
    try {
      await updateRow('caixa', detail.id, { status: 'fechado', data_fechamento: new Date().toISOString(), valor_fechamento: valorFechamento });
      setDetail(null);
      await load();
    } catch (e) { window.alert('Erro ao fechar caixa: ' + e.message); }
    fecharRef.current = false;
  }

  const nomeCliente = (id) => clientes.find((c) => c.id === id)?.nome;
  const nomeFornecedor = (id) => fornecedores.find((c) => c.id === id)?.nome;

  return (
    <div>
      <PageHeader Icon={Wallet} title="Caixa" subtitle="Abertura, movimentações e fechamento">
        <PrimaryButton onClick={() => setOpenModal(true)}><Unlock size={16} /> Abrir caixa</PrimaryButton>
      </PageHeader>

      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        {loading ? <LoadingRows /> : caixas.length === 0 ? (
          <EmptyState icon={Wallet} text="Nenhum caixa aberto ainda." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Abertura</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Valor abertura</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Fechamento</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Valor fechamento</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Status</th>
                <th className="px-4 py-2.5 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {caixas.map((c) => (
                <tr key={c.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50 cursor-pointer" onClick={() => openDetail(c)}>
                  <td className="px-4 py-2.5 text-stone-800">{fmtDateTime(c.data_abertura)}</td>
                  <td className="px-4 py-2.5 text-stone-700">{fmtCurrency(c.valor_abertura)}</td>
                  <td className="px-4 py-2.5 text-stone-700">{c.data_fechamento ? fmtDateTime(c.data_fechamento) : '—'}</td>
                  <td className="px-4 py-2.5 text-stone-700">{c.valor_fechamento != null ? fmtCurrency(c.valor_fechamento) : '—'}</td>
                  <td className="px-4 py-2.5"><Badge tone={c.status === 'aberto' ? 'green' : 'gray'}>{c.status}</Badge></td>
                  <td className="px-4 py-2.5 text-right"><ChevronRight size={15} className="text-stone-400" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {openModal && (
        <Modal title="Abrir caixa" onClose={() => setOpenModal(false)}>
          <form onSubmit={abrirCaixa} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }}>
            <Field label="Valor de abertura" required>
              <input type="number" step="any" className={inputCls} required value={valorAbertura} onChange={(e) => setValorAbertura(e.target.value)} />
            </Field>
            <div className="flex gap-2 justify-end">
              <SecondaryButton onClick={() => setOpenModal(false)}>Cancelar</SecondaryButton>
              <PrimaryButton type="submit">Abrir</PrimaryButton>
            </div>
          </form>
        </Modal>
      )}

      {detail && (
        <Modal title={`Caixa de ${fmtDateTime(detail.data_abertura)}`} onClose={() => setDetail(null)} wide>
          <div className="flex items-center justify-between mb-4">
            <Badge tone={detail.status === 'aberto' ? 'green' : 'gray'}>{detail.status}</Badge>
            {detail.status === 'aberto' && (
              <div className="flex gap-2">
                <SecondaryButton onClick={() => setMovModal(true)}><Plus size={14} /> Movimentação</SecondaryButton>
                <PrimaryButton onClick={fecharCaixa}><Lock size={14} /> Fechar caixa</PrimaryButton>
              </div>
            )}
          </div>
          {movs.length === 0 ? (
            <p className="text-sm text-stone-400">Nenhuma movimentação lançada.</p>
          ) : (
            <div className="space-y-1">
              {movs.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-sm border-b border-stone-100 py-2">
                  <div>
                    <p className="text-stone-800">{m.descricao || m.categoria || (m.tipo === 'entrada' ? 'Entrada' : 'Saída')}</p>
                    <p className="text-xs text-stone-400">{fmtDateTime(m.data)} · {m.forma_pagamento}{nomeCliente(m.cliente_id) ? ` · ${nomeCliente(m.cliente_id)}` : ''}{nomeFornecedor(m.fornecedor_id) ? ` · ${nomeFornecedor(m.fornecedor_id)}` : ''}</p>
                  </div>
                  <span className={`font-medium ${m.tipo === 'entrada' ? 'text-green-700' : 'text-red-600'}`}>
                    {m.tipo === 'entrada' ? '+' : '-'} {fmtCurrency(m.valor)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {movModal && (
        <Modal title="Nova movimentação de caixa" onClose={() => setMovModal(false)}>
          <form onSubmit={addMov} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }}>
            <Field label="Tipo" required>
              <select className={inputCls} value={movForm.tipo} onChange={(e) => setMovForm({ ...movForm, tipo: e.target.value })}>
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
              </select>
            </Field>
            <Field label="Valor" required>
              <input type="number" step="any" className={inputCls} required value={movForm.valor} onChange={(e) => setMovForm({ ...movForm, valor: e.target.value })} />
            </Field>
            <Field label="Forma de pagamento">
              <select className={inputCls} value={movForm.forma_pagamento} onChange={(e) => setMovForm({ ...movForm, forma_pagamento: e.target.value })}>
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">Pix</option>
                <option value="cartao_credito">Cartão de crédito</option>
                <option value="cartao_debito">Cartão de débito</option>
                <option value="boleto">Boleto</option>
                <option value="transferencia">Transferência</option>
              </select>
            </Field>
            <Field label="Categoria">
              <input className={inputCls} value={movForm.categoria} onChange={(e) => setMovForm({ ...movForm, categoria: e.target.value })} placeholder="Ex: Venda, Despesa, Frete…" />
            </Field>
            <Field label="Descrição">
              <input className={inputCls} value={movForm.descricao} onChange={(e) => setMovForm({ ...movForm, descricao: e.target.value })} />
            </Field>
            {movForm.tipo === 'entrada' && (
              <Field label="Cliente (opcional)">
                <ComboSelect
                  options={clientes.map((c) => ({ id: c.id, label: c.nome }))}
                  value={movForm.cliente_id}
                  onChange={(id) => setMovForm({ ...movForm, cliente_id: id })}
                  placeholder="Buscar cliente…"
                  allowClear
                />
              </Field>
            )}
            {movForm.tipo === 'saida' && (
              <Field label="Fornecedor (opcional)">
                <ComboSelect
                  options={fornecedores.map((c) => ({ id: c.id, label: c.nome }))}
                  value={movForm.fornecedor_id}
                  onChange={(id) => setMovForm({ ...movForm, fornecedor_id: id })}
                  placeholder="Buscar fornecedor…"
                  allowClear
                />
              </Field>
            )}
            <div className="flex gap-2 justify-end mt-2">
              <SecondaryButton onClick={() => setMovModal(false)}>Cancelar</SecondaryButton>
              <PrimaryButton type="submit">Lançar</PrimaryButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// =========================================================================
// FOLHA DE PAGAMENTO
// =========================================================================
function FolhaPage() {
  const gerarRef = useRef(false);
  const editRef = useRef(false);
  const [folhas, setFolhas] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mesGerar, setMesGerar] = useState(monthISO());
  const [gerando, setGerando] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ bonus: 0, descontos: 0, status: 'aberta', data_pagamento: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [f, fu] = await Promise.all([
        get('folha_pagamento', '&order=mes_referencia.desc'),
        get('funcionarios', '&order=nome.asc'),
      ]);
      setFolhas(f || []);
      setFuncionarios(fu || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const nomeFunc = (id) => funcionarios.find((f) => f.id === id)?.nome || '—';

  async function gerarFolha() {
    if (gerarRef.current) return;
    gerarRef.current = true;
    setGerando(true);
    const ativos = funcionarios.filter((f) => f.ativo);
    let criados = 0, existentes = 0;
    for (const f of ativos) {
      try {
        await insertRow('folha_pagamento', {
          funcionario_id: f.id,
          mes_referencia: mesGerar,
          salario_base: f.salario_base,
          bonus: 0,
          descontos: 0,
          status: 'aberta',
        });
        criados++;
      } catch (e) {
        existentes++;
      }
    }
    setGerando(false);
    gerarRef.current = false;
    await load();
    window.alert(`Folha gerada: ${criados} novo(s) lançamento(s). ${existentes} já existiam para esse mês.`);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({ bonus: row.bonus, descontos: row.descontos, status: row.status, data_pagamento: row.data_pagamento || '' });
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (editRef.current) return;
    editRef.current = true;
    try {
      await updateRow('folha_pagamento', editing.id, {
        bonus: Number(form.bonus) || 0,
        descontos: Number(form.descontos) || 0,
        status: form.status,
        data_pagamento: form.status === 'paga' ? (form.data_pagamento || todayISO()) : (form.data_pagamento || null),
      });
      setEditing(null);
      await load();
    } catch (e) { window.alert('Erro ao salvar: ' + e.message); }
    editRef.current = false;
  }

  const statusTone = { aberta: 'amber', fechada: 'blue', paga: 'green' };

  return (
    <div>
      <PageHeader Icon={CalendarCheck} title="Folha de pagamento" subtitle="Fechamento mensal por funcionário">
        <div className="flex items-center gap-2">
          <input type="month" className={inputCls} value={mesGerar.slice(0, 7)} onChange={(e) => setMesGerar(e.target.value + '-01')} />
          <PrimaryButton onClick={gerarFolha} disabled={gerando}>{gerando ? 'Gerando…' : 'Gerar folha do mês'}</PrimaryButton>
        </div>
      </PageHeader>

      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        {loading ? <LoadingRows /> : folhas.length === 0 ? (
          <EmptyState icon={CalendarCheck} text="Nenhuma folha gerada ainda." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Funcionário</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Mês</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Salário base</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Bônus</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Descontos</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Líquido</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Status</th>
                <th className="px-4 py-2.5 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {folhas.map((f) => (
                <tr key={f.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                  <td className="px-4 py-2.5 text-stone-800 font-medium">{nomeFunc(f.funcionario_id)}</td>
                  <td className="px-4 py-2.5 text-stone-700">{new Date(f.mes_referencia + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</td>
                  <td className="px-4 py-2.5 text-stone-700">{fmtCurrency(f.salario_base)}</td>
                  <td className="px-4 py-2.5 text-green-700">{fmtCurrency(f.bonus)}</td>
                  <td className="px-4 py-2.5 text-red-600">{fmtCurrency(f.descontos)}</td>
                  <td className="px-4 py-2.5 text-stone-900 font-semibold">{fmtCurrency(f.salario_liquido)}</td>
                  <td className="px-4 py-2.5"><Badge tone={statusTone[f.status]}>{f.status}</Badge></td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => openEdit(f)} className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"><Pencil size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <Modal title={`Editar folha — ${nomeFunc(editing.funcionario_id)}`} onClose={() => setEditing(null)}>
          <form onSubmit={saveEdit} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }}>
            <Field label="Bônus">
              <input type="number" step="any" className={inputCls} value={form.bonus} onChange={(e) => setForm({ ...form, bonus: e.target.value })} />
            </Field>
            <Field label="Descontos">
              <input type="number" step="any" className={inputCls} value={form.descontos} onChange={(e) => setForm({ ...form, descontos: e.target.value })} />
            </Field>
            <Field label="Status">
              <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="aberta">Aberta</option>
                <option value="fechada">Fechada</option>
                <option value="paga">Paga</option>
              </select>
            </Field>
            {form.status === 'paga' && (
              <Field label="Data de pagamento">
                <input type="date" className={inputCls} value={form.data_pagamento} onChange={(e) => setForm({ ...form, data_pagamento: e.target.value })} />
              </Field>
            )}
            <div className="flex gap-2 justify-end mt-2">
              <SecondaryButton onClick={() => setEditing(null)}>Cancelar</SecondaryButton>
              <PrimaryButton type="submit">Salvar</PrimaryButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}


// =========================================================================
// CONTAS A RECEBER (com parcelamento automático)
// =========================================================================
function addDaysISO(dateISO, days) {
  const d = new Date(`${dateISO}T12:00:00`);
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

function makeUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function ContasReceberPage({ user }) {
  const [rows, setRows] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    descricao: '', cliente_id: '', valor: '', data_vencimento: todayISO(),
    data_recebimento: '', status: 'pendente', parcelas: 1, intervalo_dias: 30
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [r, c] = await Promise.all([
        get('contas_receber', '&order=data_vencimento.asc'),
        get('clientes', '&order=nome.asc'),
      ]);
      setRows(r || []);
      setClientes(c || []);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditing(null);
    setForm({
      descricao: '', cliente_id: '', valor: '', data_vencimento: todayISO(),
      data_recebimento: '', status: 'pendente', parcelas: 1, intervalo_dias: 30
    });
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({
      descricao: row.descricao || '',
      cliente_id: row.cliente_id || '',
      valor: row.valor ?? '',
      data_vencimento: row.data_vencimento || todayISO(),
      data_recebimento: row.data_recebimento || '',
      status: row.status || 'pendente',
      parcelas: 1,
      intervalo_dias: row.intervalo_dias || 30
    });
    setModalOpen(true);
  }

  async function registrarRecebimentoNoCaixa(savedRow, oldRow) {
    if (savedRow.status !== 'recebido' || (oldRow && oldRow.status === 'recebido')) return;
    const abertos = await get('caixa', '&status=eq.aberto&order=data_abertura.desc');
    if (!abertos?.length) {
      window.alert('Conta marcada como recebida. Não há caixa aberto agora; lance essa entrada manualmente no Caixa.');
      return;
    }
    await insertRow('movimentacoes_caixa', {
      caixa_id: abertos[0].id,
      tipo: 'entrada',
      valor: Number(savedRow.valor),
      forma_pagamento: 'transferencia',
      categoria: 'Conta a receber',
      descricao: savedRow.descricao,
      cliente_id: savedRow.cliente_id || null,
      usuario_id: user.id,
      data: new Date().toISOString(),
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    if (saving) return;
    const total = Number(form.valor);
    const parcelas = Math.max(1, Math.floor(Number(form.parcelas) || 1));
    const intervalo = Math.max(1, Math.floor(Number(form.intervalo_dias) || 30));
    if (!form.descricao.trim()) return window.alert('Informe a descrição.');
    if (!form.data_vencimento) return window.alert('Informe o vencimento.');
    if (!(total > 0)) return window.alert('Informe um valor maior que zero.');

    setSaving(true);
    try {
      if (editing) {
        const payload = {
          descricao: form.descricao.trim(),
          cliente_id: form.cliente_id || null,
          valor: total,
          data_vencimento: form.data_vencimento,
          data_recebimento: form.status === 'recebido' ? (form.data_recebimento || todayISO()) : null,
          status: form.status,
          usuario_id: user.id,
        };
        const result = await updateRow('contas_receber', editing.id, payload);
        const saved = Array.isArray(result) ? result[0] : result;
        await registrarRecebimentoNoCaixa(saved || { ...editing, ...payload }, editing);
      } else {
        const grupo = makeUuid();
        const base = Math.floor((total / parcelas) * 100) / 100;
        const rowsToInsert = Array.from({ length: parcelas }, (_, i) => {
          const valorParcela = i === parcelas - 1
            ? Math.round((total - base * (parcelas - 1)) * 100) / 100
            : base;
          const dataVencimento = addDaysISO(form.data_vencimento, i * intervalo);
          const recebido = parcelas === 1 && form.status === 'recebido';
          return {
            descricao: parcelas > 1 ? `${form.descricao.trim()} - Parcela ${i + 1}/${parcelas}` : form.descricao.trim(),
            cliente_id: form.cliente_id || null,
            valor: valorParcela,
            data_vencimento: dataVencimento,
            data_recebimento: recebido ? (form.data_recebimento || todayISO()) : null,
            status: recebido ? 'recebido' : 'pendente',
            grupo_parcelamento_id: grupo,
            numero_parcela: i + 1,
            total_parcelas: parcelas,
            intervalo_dias: intervalo,
            usuario_id: user.id,
          };
        });
        const created = await insertRows('contas_receber', rowsToInsert);
        if (form.status === 'recebido') {
          const recebidas = Array.isArray(created) ? created : rowsToInsert;
          for (const r of recebidas) await registrarRecebimentoNoCaixa(r, null);
        }
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      window.alert('Erro ao salvar conta a receber: ' + e.message);
    }
    setSaving(false);
  }

  async function handleDelete(row) {
    if (!window.confirm('Excluir esta conta? Essa ação não pode ser desfeita.')) return;
    try {
      await deleteRow('contas_receber', row.id);
      await load();
    } catch (e) {
      window.alert('Erro ao excluir: ' + e.message);
    }
  }

  const clienteNome = (id) => clientes.find(c => c.id === id)?.nome || '—';
  const hoje = todayISO();
  const filtered = rows.filter(r => !search || JSON.stringify(r).toLowerCase().includes(search.toLowerCase()));
  const totalPendente = rows.filter(r => r.status === 'pendente').reduce((s, r) => s + Number(r.valor || 0), 0);
  const totalVencido = rows.filter(r => r.status === 'pendente' && r.data_vencimento < hoje).reduce((s, r) => s + Number(r.valor || 0), 0);

  return (
    <div>
      <PageHeader Icon={ArrowDownCircle} title="Contas a receber" subtitle="Controle de recebimentos e parcelamentos automáticos">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-2.5 top-2.5 text-stone-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar…" className="pl-8 pr-3 py-1.5 text-sm border border-stone-300 rounded-lg w-40" />
          </div>
          <PrimaryButton onClick={openNew}><Plus size={16} /> Nova conta</PrimaryButton>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <Stat label="Pendente" value={fmtCurrency(totalPendente)} tone="amber" sub={`${rows.filter(r => r.status === 'pendente').length} lançamento(s)`} />
        <Stat label="Vencido" value={fmtCurrency(totalVencido)} tone="red" sub="Pendências em atraso" />
        <Stat label="Recebido" value={fmtCurrency(rows.filter(r => r.status === 'recebido').reduce((s,r)=>s+Number(r.valor||0),0))} tone="green" sub="Total já recebido" />
      </div>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        {loading ? <LoadingRows /> : filtered.length === 0 ? <EmptyState icon={ArrowDownCircle} text="Nenhuma conta encontrada." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-stone-200 bg-stone-50">
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Descrição</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Cliente</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Parcela</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Vencimento</th>
                <th className="text-right px-4 py-2.5 font-medium text-stone-500">Valor</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Status</th>
                <th className="px-4 py-2.5 w-20"></th>
              </tr></thead>
              <tbody>{filtered.map(r => (
                <tr key={r.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                  <td className="px-4 py-2.5 font-medium text-stone-800">{r.descricao}</td>
                  <td className="px-4 py-2.5 text-stone-700">{clienteNome(r.cliente_id)}</td>
                  <td className="px-4 py-2.5 text-stone-500">{r.total_parcelas > 1 ? `${r.numero_parcela}/${r.total_parcelas}` : 'À vista'}</td>
                  <td className="px-4 py-2.5 text-stone-700">{fmtDate(r.data_vencimento)}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-stone-800">{fmtCurrency(r.valor)}</td>
                  <td className="px-4 py-2.5">
                    {r.status === 'recebido' ? <Badge tone="green">Recebido</Badge> : r.data_vencimento < hoje ? <Badge tone="red">Vencido</Badge> : <Badge tone="amber">Pendente</Badge>}
                  </td>
                  <td className="px-4 py-2.5"><div className="flex justify-end gap-1">
                    <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100"><Pencil size={15}/></button>
                    <button onClick={() => handleDelete(r)} className="p-1.5 rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={15}/></button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && <Modal title={editing ? 'Editar conta a receber' : 'Nova conta a receber'} onClose={() => setModalOpen(false)} wide>
        <form onSubmit={handleSave}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Descrição" required><input className={inputCls} required value={form.descricao} onChange={e=>setForm({...form,descricao:e.target.value})}/></Field>
            <Field label="Cliente"><ComboSelect options={clientes.map(c=>({id:c.id,label:c.nome}))} value={form.cliente_id} onChange={id=>setForm({...form,cliente_id:id})} placeholder="Buscar cliente…"/></Field>
            <Field label="Valor total (R$)" required><input type="number" step="0.01" min="0.01" className={inputCls} required value={form.valor} onChange={e=>setForm({...form,valor:e.target.value})}/></Field>
            <Field label="Primeiro vencimento" required><input type="date" className={inputCls} required value={form.data_vencimento} onChange={e=>setForm({...form,data_vencimento:e.target.value})}/></Field>
            {!editing && <Field label="Quantidade de parcelas" hint="O sistema cria todas as parcelas automaticamente."><input type="number" min="1" max="120" className={inputCls} value={form.parcelas} onChange={e=>setForm({...form,parcelas:e.target.value})}/></Field>}
            {!editing && <Field label="Intervalo entre parcelas (dias)"><input type="number" min="1" className={inputCls} value={form.intervalo_dias} onChange={e=>setForm({...form,intervalo_dias:e.target.value})}/></Field>}
            <Field label="Status" required><select className={inputCls} value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="pendente">Pendente</option><option value="recebido">Recebido</option></select></Field>
            {form.status === 'recebido' && <Field label="Data de recebimento"><input type="date" className={inputCls} value={form.data_recebimento} onChange={e=>setForm({...form,data_recebimento:e.target.value})}/></Field>}
          </div>
          {!editing && Number(form.parcelas) > 1 && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
              Serão criadas <strong>{form.parcelas}</strong> parcelas de aproximadamente <strong>{fmtCurrency(Number(form.valor || 0) / Number(form.parcelas || 1))}</strong>, com vencimentos a cada <strong>{form.intervalo_dias} dias</strong>.
            </div>
          )}
          <div className="flex justify-end gap-2 mt-5"><SecondaryButton onClick={()=>setModalOpen(false)}>Cancelar</SecondaryButton><PrimaryButton type="submit" disabled={saving}>{saving?'Salvando…':'Salvar'}</PrimaryButton></div>
        </form>
      </Modal>}
    </div>
  );
}

// =========================================================================
// RELATÓRIOS FINANCEIROS
// =========================================================================
function RelatoriosPage() {
  const [tab, setTab] = useState('receber');
  const [receber, setReceber] = useState([]);
  const [pagar, setPagar] = useState([]);
  const [movs, setMovs] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inicio, setInicio] = useState(monthISO());
  const [fim, setFim] = useState(todayISO());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, p, m, c, f] = await Promise.all([
        get('contas_receber', '&order=data_vencimento.asc'),
        get('contas_pagar', '&order=data_vencimento.asc'),
        get('movimentacoes_caixa', '&order=data.asc'),
        get('clientes', '&order=nome.asc'),
        get('fornecedores', '&order=nome.asc'),
      ]);
      setReceber(r || []); setPagar(p || []); setMovs(m || []);
      setClientes(c || []); setFornecedores(f || []);
    } catch (e) { window.alert('Erro ao carregar relatórios: ' + e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const inRange = (d) => {
    if (!d) return false;
    const day = String(d).slice(0, 10);
    return day >= inicio && day <= fim;
  };
  const cr = receber.filter(r => inRange(r.data_vencimento));
  const cp = pagar.filter(r => inRange(r.data_vencimento));
  const fluxo = movs.filter(m => inRange(m.data));
  const nomeCliente = id => clientes.find(c=>c.id===id)?.nome || '—';
  const nomeFornecedor = id => fornecedores.find(f=>f.id===id)?.nome || '—';
  const total = arr => arr.reduce((s,r)=>s+Number(r.valor||0),0);
  const entradas = fluxo.filter(m=>m.tipo==='entrada');
  const saidas = fluxo.filter(m=>m.tipo==='saida');

  function exportarCSV() {
    let data = [];
    if (tab === 'receber') data = cr.map(r => [r.descricao, nomeCliente(r.cliente_id), r.data_vencimento, r.valor, r.status]);
    else if (tab === 'pagar') data = cp.map(r => [r.descricao, nomeFornecedor(r.fornecedor_id), r.data_vencimento, r.valor, r.status]);
    else data = fluxo.map(r => [r.data, r.tipo, r.categoria || '', r.descricao || '', r.valor]);
    const csv = data.map(row => row.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `relatorio-${tab}-${inicio}-${fim}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  if (loading) return <LoadingRows />;

  return <div>
    <PageHeader Icon={BarChart3} title="Relatórios financeiros" subtitle="Contas a receber, contas a pagar e fluxo de caixa">
      <div className="flex gap-2"><SecondaryButton onClick={load}><RefreshCw size={15}/> Atualizar</SecondaryButton><SecondaryButton onClick={exportarCSV}>Exportar CSV</SecondaryButton></div>
    </PageHeader>
    <div className="bg-white border border-stone-200 rounded-xl p-4 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <Field label="Data inicial"><input type="date" className={inputCls} value={inicio} onChange={e=>setInicio(e.target.value)}/></Field>
        <Field label="Data final"><input type="date" className={inputCls} value={fim} onChange={e=>setFim(e.target.value)}/></Field>
        <div className="flex gap-1">
          {['receber','pagar','fluxo'].map(t=><button key={t} onClick={()=>setTab(t)} className={`px-3 py-2 rounded-lg text-sm font-medium ${tab===t?'bg-stone-800 text-white':'bg-stone-100 text-stone-600'}`}>{t==='receber'?'Contas a receber':t==='pagar'?'Contas a pagar':'Fluxo de caixa'}</button>)}
        </div>
      </div>
    </div>

    {tab==='receber' && <ReportTable title="Relatório de contas a receber" rows={cr} nameFor={nomeCliente} dateKey="data_vencimento" statusLabels={{pendente:'Pendente',recebido:'Recebido'}} total={total(cr)} />}
    {tab==='pagar' && <ReportTable title="Relatório de contas a pagar" rows={cp} nameFor={nomeFornecedor} dateKey="data_vencimento" statusLabels={{pendente:'Pendente',pago:'Pago'}} total={total(cp)} />}
    {tab==='fluxo' && <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <Stat label="Entradas" value={fmtCurrency(total(entradas))} tone="green" sub={`${entradas.length} movimentação(ões)`}/>
        <Stat label="Saídas" value={fmtCurrency(total(saidas))} tone="red" sub={`${saidas.length} movimentação(ões)`}/>
        <Stat label="Saldo do período" value={fmtCurrency(total(entradas)-total(saidas))} tone={total(entradas)-total(saidas)>=0?'green':'red'} sub={`${inicio} a ${fim}`}/>
      </div>
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm"><thead><tr className="bg-stone-50 border-b border-stone-200">
          <th className="text-left px-4 py-2.5">Data</th><th className="text-left px-4 py-2.5">Tipo</th><th className="text-left px-4 py-2.5">Categoria</th><th className="text-left px-4 py-2.5">Descrição</th><th className="text-right px-4 py-2.5">Valor</th>
        </tr></thead><tbody>{fluxo.map(m=><tr key={m.id} className="border-b border-stone-100">
          <td className="px-4 py-2.5">{fmtDateTime(m.data)}</td><td className="px-4 py-2.5">{m.tipo==='entrada'?<Badge tone="green">Entrada</Badge>:<Badge tone="red">Saída</Badge>}</td><td className="px-4 py-2.5">{m.categoria||'—'}</td><td className="px-4 py-2.5">{m.descricao||'—'}</td><td className="px-4 py-2.5 text-right font-medium">{fmtCurrency(m.valor)}</td>
        </tr>)}</tbody></table>
        {fluxo.length===0 && <EmptyState icon={Wallet} text="Nenhuma movimentação no período."/>}
      </div>
    </div>}
  </div>;
}

function ReportTable({ title, rows, nameFor, dateKey, statusLabels, total }) {
  return <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
    <div className="px-4 py-3 border-b border-stone-200 flex justify-between items-center"><h3 className="font-semibold text-stone-800">{title}</h3><span className="font-semibold text-stone-800">{fmtCurrency(total)}</span></div>
    {rows.length===0 ? <EmptyState icon={FileText} text="Nenhum lançamento no período."/> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-stone-50 border-b border-stone-200">
      <th className="text-left px-4 py-2.5">Descrição</th><th className="text-left px-4 py-2.5">Favorecido</th><th className="text-left px-4 py-2.5">Vencimento</th><th className="text-right px-4 py-2.5">Valor</th><th className="text-left px-4 py-2.5">Status</th>
    </tr></thead><tbody>{rows.map(r=><tr key={r.id} className="border-b border-stone-100">
      <td className="px-4 py-2.5">{r.descricao}</td><td className="px-4 py-2.5">{nameFor(r.cliente_id || r.fornecedor_id)}</td><td className="px-4 py-2.5">{fmtDate(r[dateKey])}</td><td className="px-4 py-2.5 text-right">{fmtCurrency(r.valor)}</td><td className="px-4 py-2.5">{r.status==='recebido'||r.status==='pago'?<Badge tone="green">{statusLabels[r.status]}</Badge>:<Badge tone="amber">{statusLabels[r.status]||r.status}</Badge>}</td>
    </tr>)}</tbody></table></div>}
  </div>;
}

// =========================================================================
// HISTÓRICO DE ALTERAÇÕES
// =========================================================================
function HistoricoPage() {
  const [rows, setRows] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [filtroTabela, setFiltroTabela] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [h, u] = await Promise.all([
        get('historico_alteracoes', '&order=created_at.desc'),
        get('usuarios', '&order=nome.asc'),
      ]);
      setRows(h || []); setUsuarios(u || []);
    } catch (e) { window.alert('Erro ao carregar histórico: ' + e.message); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const userName = id => usuarios.find(u=>u.id===id)?.nome || 'Usuário removido';
  const tableLabel = t => ({
    contas_receber:'Contas a receber', contas_pagar:'Contas a pagar', movimentacoes_caixa:'Movimentações de caixa',
    caixa:'Caixa', clientes:'Clientes', fornecedores:'Fornecedores', produtos:'Produtos',
    notas_fiscais:'Notas fiscais', notas_fiscais_itens:'Itens de notas', funcionarios:'Funcionários',
    folha_pagamento:'Folha de pagamento', usuarios:'Usuários'
  }[t] || t);
  const filtered = rows.filter(r => (!filtroUsuario || r.usuario_id===filtroUsuario) && (!filtroTabela || r.tabela===filtroTabela));

  function resumo(r) {
    if (r.acao==='INSERT') return 'Criou registro';
    if (r.acao==='UPDATE') return 'Alterou registro';
    if (r.acao==='DELETE') return 'Excluiu registro';
    return r.acao;
  }

  return <div>
    <PageHeader Icon={History} title="Histórico de alterações" subtitle="Quem alterou, o que foi alterado e quando">
      <SecondaryButton onClick={load}><RefreshCw size={15}/> Atualizar</SecondaryButton>
    </PageHeader>
    <div className="bg-white border border-stone-200 rounded-xl p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
      <Field label="Usuário"><select className={inputCls} value={filtroUsuario} onChange={e=>setFiltroUsuario(e.target.value)}><option value="">Todos</option>{usuarios.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}</select></Field>
      <Field label="Tabela / módulo"><select className={inputCls} value={filtroTabela} onChange={e=>setFiltroTabela(e.target.value)}><option value="">Todos</option>{[...new Set(rows.map(r=>r.tabela))].map(t=><option key={t} value={t}>{tableLabel(t)}</option>)}</select></Field>
      <div className="flex items-end"><div className="text-sm text-stone-500 pb-2">{filtered.length} alteração(ões) encontrada(s)</div></div>
    </div>
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      {loading ? <LoadingRows/> : filtered.length===0 ? <EmptyState icon={History} text="Nenhuma alteração encontrada."/> :
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-stone-50 border-b border-stone-200">
        <th className="text-left px-4 py-2.5">Data</th><th className="text-left px-4 py-2.5">Usuário</th><th className="text-left px-4 py-2.5">Módulo</th><th className="text-left px-4 py-2.5">Ação</th><th className="text-left px-4 py-2.5">Registro</th><th className="text-left px-4 py-2.5">Detalhes</th>
      </tr></thead><tbody>{filtered.map(r=><tr key={r.id} className="border-b border-stone-100 align-top">
        <td className="px-4 py-2.5 whitespace-nowrap">{fmtDateTime(r.created_at)}</td><td className="px-4 py-2.5">{userName(r.usuario_id)}</td><td className="px-4 py-2.5">{tableLabel(r.tabela)}</td><td className="px-4 py-2.5"><Badge tone={r.acao==='DELETE'?'red':r.acao==='INSERT'?'green':'amber'}>{resumo(r)}</Badge></td><td className="px-4 py-2.5 font-mono text-xs">{r.registro_id || '—'}</td>
        <td className="px-4 py-2.5 max-w-md text-xs text-stone-500"><details><summary className="cursor-pointer">Ver dados</summary><pre className="mt-2 whitespace-pre-wrap break-all">{JSON.stringify({antes:r.dados_anteriores,depois:r.dados_novos},null,2)}</pre></details></td>
      </tr>)}</tbody></table></div>}
    </div>
  </div>;
}

// =========================================================================
// USUÁRIOS (cria conta de login + perfil, sem precisar mexer no banco)
// =========================================================================
const CARGOS_USUARIO = [
  { value: 'admin', label: 'Admin' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'vendedor', label: 'Vendedor' },
];

function UsuariosPage() {
  const submittingRef = useRef(false);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newModal, setNewModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [newForm, setNewForm] = useState({ nome: '', email: '', cargo: 'vendedor', senha: '', confirmarSenha: '', ativo: true });
  const [editForm, setEditForm] = useState({ nome: '', cargo: 'vendedor', ativo: true });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await get('usuarios', '&order=nome.asc');
      setUsuarios(data || []);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setNewForm({ nome: '', email: '', cargo: 'vendedor', senha: '', confirmarSenha: '', ativo: true });
    setNewModal(true);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!isValidEmail(newForm.email)) { window.alert('E-mail inválido. Confira se digitou o @ e o domínio corretamente (ex: nome@empresa.com).'); return; }
    if (newForm.senha.length < 6) { window.alert('A senha precisa ter pelo menos 6 caracteres.'); return; }
    if (newForm.senha !== newForm.confirmarSenha) { window.alert('As senhas não conferem.'); return; }
    submittingRef.current = true;
    setSaving(true);
    try {
      const authUser = await signUpUser(newForm.email.trim(), newForm.senha);
      await insertRow('usuarios', {
        id: authUser.id,
        nome: newForm.nome,
        email: newForm.email.trim(),
        cargo: newForm.cargo,
        ativo: newForm.ativo,
      });
      setNewModal(false);
      await load();
      window.alert(`Usuário criado! Repasse a senha combinada para ${newForm.nome} entrar no sistema. Se o Supabase estiver com confirmação de e-mail ativada, a pessoa vai precisar confirmar o e-mail antes do primeiro login (confira em Authentication → Providers → Email).`);
    } catch (e) {
      window.alert('Erro ao criar usuário: ' + e.message);
    }
    setSaving(false);
    submittingRef.current = false;
  }

  function openEdit(row) {
    setEditForm({ nome: row.nome, cargo: row.cargo, ativo: row.ativo });
    setEditing(row);
  }

  async function handleEditSave(e) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    try {
      await updateRow('usuarios', editing.id, editForm);
      setEditing(null);
      await load();
    } catch (e) {
      window.alert('Erro ao salvar: ' + e.message);
    }
    setSaving(false);
    submittingRef.current = false;
  }

  async function handleDeactivate(row) {
    if (!window.confirm(`Desativar o acesso de "${row.nome}"? A pessoa não vai mais conseguir entrar no sistema, mas o histórico dela é mantido.`)) return;
    try {
      await updateRow('usuarios', row.id, { ativo: false });
      await load();
    } catch (e) {
      window.alert('Erro ao desativar: ' + e.message);
    }
  }

  return (
    <div>
      <PageHeader Icon={ShieldCheck} title="Usuários" subtitle="Quem tem acesso ao sistema">
        <PrimaryButton onClick={openNew}><Plus size={16} /> Novo usuário</PrimaryButton>
      </PageHeader>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        {loading ? <LoadingRows /> : usuarios.length === 0 ? (
          <EmptyState icon={ShieldCheck} text="Nenhum usuário cadastrado ainda." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Nome</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">E-mail</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Cargo</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Status</th>
                <th className="px-4 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                  <td className="px-4 py-2.5 text-stone-800 font-medium">{u.nome}</td>
                  <td className="px-4 py-2.5 text-stone-700">{u.email}</td>
                  <td className="px-4 py-2.5 text-stone-700 capitalize">{u.cargo}</td>
                  <td className="px-4 py-2.5">{u.ativo ? <Badge tone="green">Ativo</Badge> : <Badge tone="gray">Inativo</Badge>}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800">
                        <Pencil size={15} />
                      </button>
                      {u.ativo && (
                        <button onClick={() => handleDeactivate(u)} className="p-1.5 rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-600" title="Desativar acesso">
                          <Lock size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {newModal && (
        <Modal title="Novo usuário" onClose={() => setNewModal(false)}>
          <form onSubmit={handleCreate} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }}>
            <Field label="Nome" required>
              <input className={inputCls} required value={newForm.nome} onChange={(e) => setNewForm({ ...newForm, nome: e.target.value })} />
            </Field>
            <Field label="E-mail" required>
              <input type="email" className={inputCls} required value={newForm.email} onChange={(e) => setNewForm({ ...newForm, email: e.target.value })} />
            </Field>
            <Field label="Cargo" required>
              <select className={inputCls} value={newForm.cargo} onChange={(e) => setNewForm({ ...newForm, cargo: e.target.value })}>
                {CARGOS_USUARIO.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Senha provisória" required>
              <input type="password" className={inputCls} required minLength={6} value={newForm.senha} onChange={(e) => setNewForm({ ...newForm, senha: e.target.value })} />
            </Field>
            <Field label="Confirmar senha" required>
              <input type="password" className={inputCls} required minLength={6} value={newForm.confirmarSenha} onChange={(e) => setNewForm({ ...newForm, confirmarSenha: e.target.value })} />
            </Field>
            <p className="text-xs text-stone-400 mb-4">Combine essa senha com a pessoa — ela pode trocar depois pelo próprio Supabase, se você quiser habilitar isso futuramente.</p>
            <div className="flex gap-2 justify-end">
              <SecondaryButton onClick={() => setNewModal(false)}>Cancelar</SecondaryButton>
              <PrimaryButton type="submit" disabled={saving}>{saving ? 'Criando…' : 'Criar usuário'}</PrimaryButton>
            </div>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal title={`Editar ${editing.nome}`} onClose={() => setEditing(null)}>
          <form onSubmit={handleEditSave} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }}>
            <Field label="Nome" required>
              <input className={inputCls} required value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} />
            </Field>
            <Field label="Cargo" required>
              <select className={inputCls} value={editForm.cargo} onChange={(e) => setEditForm({ ...editForm, cargo: e.target.value })}>
                {CARGOS_USUARIO.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Ativo">
              <select className={inputCls} value={editForm.ativo ? 'true' : 'false'} onChange={(e) => setEditForm({ ...editForm, ativo: e.target.value === 'true' })}>
                <option value="true">Sim</option>
                <option value="false">Não</option>
              </select>
            </Field>
            <p className="text-xs text-stone-400 mb-4">E-mail e senha não são editáveis por aqui. Para redefinir a senha de alguém, use Authentication → Users → ... → Reset password no painel do Supabase.</p>
            <div className="flex gap-2 justify-end">
              <SecondaryButton onClick={() => setEditing(null)}>Cancelar</SecondaryButton>
              <PrimaryButton type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</PrimaryButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// =========================================================================
// LOGIN (e-mail e senha via Supabase Auth)
// =========================================================================
function LoginScreen({ onLogin, dark, toggleDark }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const session = await signIn(email.trim(), password);
      const authId = session.user.id;
      const rows = await get('usuarios', `&id=eq.${authId}`);
      const perfil = rows && rows[0];
      if (!perfil) {
        await signOut();
        setError('Login válido, mas não existe um cadastro correspondente na tabela "usuarios". Peça para um administrador te cadastrar.');
        setLoading(false);
        return;
      }
      if (!perfil.ativo) {
        await signOut();
        setError('Seu usuário está inativo. Fale com um administrador.');
        setLoading(false);
        return;
      }
      onLogin(perfil);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  return (
    <div className="relative flex items-center justify-center bg-stone-50 p-6" style={{ fontFamily: 'Inter, sans-serif', minHeight: '100vh' }}>
      <FontStyles />
      <button
        onClick={toggleDark}
        className="absolute top-5 right-5 p-2 rounded-lg border border-stone-300 text-stone-500 hover:bg-stone-100"
        title={dark ? 'Modo claro' : 'Modo escuro'}
      >
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      <div className="w-full max-w-sm bg-white border border-stone-200 rounded-2xl p-8 text-center">
        <ImageLightbox src={logoAlccor} alt="ALCCOR" className="w-16 h-16 rounded-xl mx-auto mb-4 overflow-hidden" />
        <h1 className="font-display text-xl font-semibold text-stone-900 mb-1">ALCCOR</h1>
        <p className="text-sm text-stone-500 mb-6">Entre com seu e-mail e senha</p>

        <form onSubmit={handleSubmit} className="text-left">
          <Field label="E-mail" required>
            <input type="email" required autoComplete="username" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" />
          </Field>
          <Field label="Senha" required>
            <input type="password" required autoComplete="current-password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </Field>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">{error}</p>}
          <PrimaryButton type="submit" full disabled={loading}>{loading ? 'Entrando…' : 'Entrar'}</PrimaryButton>
        </form>
      </div>
    </div>
  );
}

// =========================================================================
// APP SHELL
// =========================================================================
const NAV = [
  { key: 'dashboard', label: 'Painel', Icon: LayoutDashboard },
  { key: 'produtos', label: 'Estoque', Icon: Package },
  { key: 'notas', label: 'Notas fiscais', Icon: FileText },
  { key: 'clientes', label: 'Clientes', Icon: Users },
  { key: 'fornecedores', label: 'Fornecedores', Icon: Truck },
  { key: 'contas_pagar', label: 'Contas a pagar', Icon: ArrowUpCircle },
  { key: 'contas_receber', label: 'Contas a receber', Icon: ArrowDownCircle },
  { key: 'relatorios', label: 'Relatórios financeiros', Icon: BarChart3 },
  { key: 'caixa', label: 'Caixa', Icon: Wallet },
  { key: 'funcionarios', label: 'Funcionários', Icon: UserCog },
  { key: 'folha', label: 'Folha de pagamento', Icon: CalendarCheck },
  { key: 'usuarios', label: 'Usuários', Icon: ShieldCheck, adminOnly: true },
  { key: 'historico', label: 'Histórico de alterações', Icon: History, adminOnly: true },
];

function AcessoRestrito() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-stone-400">
      <ShieldCheck size={32} className="mb-2" />
      <p className="text-sm">Essa área é restrita a usuários com cargo "admin".</p>
    </div>
  );
}

const THEME_STORAGE_KEY = 'alccor_theme';

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [page, setPage] = useState('dashboard');
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem(THEME_STORAGE_KEY) === 'dark'; } catch (e) { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(THEME_STORAGE_KEY, dark ? 'dark' : 'light'); } catch (e) {}
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [dark]);

  const toggleDark = () => setDark((d) => !d);

  useEffect(() => {
    (async () => {
      if (currentSession?.access_token) {
        try {
          const rows = await get('usuarios', `&id=eq.${currentSession.user.id}`);
          const perfil = rows && rows[0];
          if (perfil && perfil.ativo) setUser(perfil);
          else await signOut();
        } catch (e) {
          // sessão inválida/expirada — volta para o login
        }
      }
      setCheckingSession(false);
    })();
  }, []);

  async function handleLogout() {
    await signOut();
    setUser(null);
  }

  if (checkingSession) {
    return (
      <div className="flex items-center justify-center text-sm text-stone-400" style={{ minHeight: '100vh' }}>
        Carregando…
      </div>
    );
  }

  if (!user) return <LoginScreen onLogin={setUser} dark={dark} toggleDark={toggleDark} />;

  const pageContent = () => {
    switch (page) {
      case 'dashboard': return <Dashboard user={user} />;
      case 'produtos': return (
        <EntityPage table="produtos" title="Estoque" Icon={Package} subtitle="Produtos e níveis de estoque" fields={[
          { key: 'nome', label: 'Nome', required: true },
          { key: 'categoria', label: 'Grupo', type: 'grupo' },
          { key: 'preco_custo', label: 'Preço de custo (R$)', type: 'number', currency: true, hint: 'Definido automaticamente pela média ponderada a cada nota fiscal lançada (fica 0 até a primeira entrada). Edite manualmente só se precisar corrigir.' },
          { key: 'quantidade_atual', label: 'Estoque atual', type: 'number', hint: 'Some via nota fiscal — normalmente não precisa preencher na hora do cadastro.' },
          { key: 'estoque_minimo', label: 'Avisar quando o estoque chegar em', type: 'number', hint: 'Quando a quantidade em estoque cair para esse valor (ou menos), o produto aparece em um alerta no Painel.' },
          { key: 'ativo', label: 'Ativo', type: 'boolean' },
          { key: 'descricao', label: 'Descrição', type: 'textarea', showInList: false },
        ]} />
      );
      case 'notas': return <NotasFiscaisPage user={user} />;
      case 'clientes': return (
        <EntityPage table="clientes" title="Clientes" Icon={Users} fields={[
          { key: 'nome', label: 'Nome', required: true },
          { key: 'telefone', label: 'Telefone', type: 'phone', required: true },
          { key: 'documento', label: 'CPF / CNPJ', type: 'documento', tipoKey: 'tipo_documento', required: true, render: (v, row) => v ? `${(row.tipo_documento || 'cpf').toUpperCase()} ${v}` : '—' },
          { key: 'email', label: 'E-mail', type: 'email' },
          { key: 'endereco', label: 'Endereço' },
        ]} />
      );
      case 'fornecedores': return (
        <EntityPage table="fornecedores" title="Fornecedores" Icon={Truck} fields={[
          { key: 'nome', label: 'Nome', required: true },
          { key: 'cnpj', label: 'CNPJ', type: 'cnpj', required: true },
          { key: 'telefone', label: 'Telefone', type: 'phone' },
          { key: 'email', label: 'E-mail', type: 'email' },
          { key: 'endereco', label: 'Endereço' },
        ]} />
      );
      case 'contas_pagar': return (
        <EntityPage table="contas_pagar" title="Contas a pagar" Icon={ArrowUpCircle} fields={[
          { key: 'descricao', label: 'Descrição', required: true },
          { key: 'fornecedor_id', label: 'Fornecedor', refTable: 'fornecedores', refLabel: 'nome' },
          { key: 'valor', label: 'Valor (R$)', type: 'number', required: true, currency: true },
          { key: 'data_vencimento', label: 'Vencimento', type: 'date', required: true },
          { key: 'data_pagamento', label: 'Data de pagamento', type: 'date' },
          { key: 'status', label: 'Status', type: 'select', required: true, options: [{ value: 'pendente', label: 'Pendente' }, { value: 'pago', label: 'Pago' }] },
        ]} />
      );
      case 'contas_receber': return <ContasReceberPage user={user} />;
      case 'caixa': return <CaixaPage user={user} />;
      case 'funcionarios': return (
        <EntityPage table="funcionarios" title="Funcionários" Icon={UserCog} fields={[
          { key: 'nome', label: 'Nome', required: true },
          { key: 'cpf', label: 'CPF', type: 'cpf' },
          { key: 'cargo', label: 'Cargo', required: true },
          { key: 'salario_base', label: 'Salário base (R$)', type: 'number', required: true, currency: true },
          { key: 'data_admissao', label: 'Data de admissão', type: 'date', required: true },
          { key: 'ativo', label: 'Ativo', type: 'boolean' },
        ]} />
      );
      case 'folha': return <FolhaPage />;
      case 'relatorios': return <RelatoriosPage />;
      case 'usuarios': return user.cargo === 'admin' ? <UsuariosPage /> : <AcessoRestrito />;
      case 'historico': return user.cargo === 'admin' ? <HistoricoPage /> : <AcessoRestrito />;
      default: return null;
    }
  };

  return (
    <div className="flex w-full bg-stone-50" style={{ fontFamily: 'Inter, sans-serif', minHeight: '100vh' }}>
      <FontStyles />
      <aside className="w-60 shrink-0 flex flex-col" style={{ backgroundColor: WOOD.sidebarBg }}>
        <div className="px-5 py-5 flex items-center gap-2 border-b" style={{ borderColor: WOOD.sidebarBorder }}>
          <img src={logoAlccor} alt="ALCCOR" className="w-9 h-9 rounded-lg object-cover" />
          <span className="font-display text-white font-semibold text-sm leading-tight">ALCCOR<br /><span className="text-stone-400 font-normal text-xs font-body">movelaria — sistema de gestão</span></span>
        </div>
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {NAV.filter((item) => !item.adminOnly || user.cargo === 'admin').map((item) => (
            <button
              key={item.key}
              onClick={() => setPage(item.key)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors"
              style={page === item.key ? { backgroundColor: WOOD.accent, color: '#fff' } : { color: '#ADB2B7' }}
              onMouseEnter={(e) => { if (page !== item.key) e.currentTarget.style.backgroundColor = WOOD.sidebarBorder; }}
              onMouseLeave={(e) => { if (page !== item.key) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <item.Icon size={16} />
              {item.label}
            </button>
          ))}
          <button
            onClick={toggleDark}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors mt-2"
            style={{ color: '#ADB2B7' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = WOOD.sidebarBorder)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
            {dark ? 'Modo claro' : 'Modo escuro'}
          </button>
        </nav>
        <div className="px-4 py-4 border-t flex items-center justify-between" style={{ borderColor: WOOD.sidebarBorder }}>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{user.nome}</p>
            <p className="text-xs truncate" style={{ color: '#8B9198' }}>{user.cargo}</p>
          </div>
          <button onClick={handleLogout} className="p-1.5 rounded-lg" style={{ color: '#ADB2B7' }} title="Sair">
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-y-auto">
        {pageContent()}
      </main>
    </div>
  );
}
