import React, { useState, useEffect } from 'react';
import { LogOut, Sun, Moon } from 'lucide-react';
import logoAlccor from './assets/logo-alccor.png';

import { getCurrentSession, get, signOut } from './lib/supabase';
import { WOOD } from './lib/theme';
import { FontStyles } from './components/ui';
import { NAV, THEME_STORAGE_KEY } from './config/nav';

import Dashboard from './pages/Dashboard';
import ProdutosPage from './pages/ProdutosPage';
import NotasFiscaisPage from './pages/NotasFiscaisPage';
import ClientesPage from './pages/ClientesPage';
import OrcamentosPage from './pages/OrcamentosPage';
import FornecedoresPage from './pages/FornecedoresPage';
import ContasPagarPage from './pages/ContasPagarPage';
import ContasReceberPage from './pages/ContasReceberPage';
import RelatoriosPage from './pages/RelatoriosPage';
import CaixaPage from './pages/CaixaPage';
import FuncionariosPage from './pages/FuncionariosPage';
import FolhaPage from './pages/FolhaPage';
import UsuariosPage from './pages/UsuariosPage';
import HistoricoPage from './pages/HistoricoPage';
import LoginScreen from './pages/LoginScreen';
import AcessoRestrito from './pages/AcessoRestrito';

// =========================================================================
// APP SHELL
// =========================================================================
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
      if (getCurrentSession()?.access_token) {
        try {
          const rows = await get('usuarios', `&id=eq.${getCurrentSession().user.id}`);
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
      case 'produtos': return <ProdutosPage />;
      case 'notas': return <NotasFiscaisPage user={user} />;
      case 'clientes': return <ClientesPage />;
      case 'orcamentos': return <OrcamentosPage user={user} />;
      case 'fornecedores': return <FornecedoresPage />;
      case 'contas_pagar': return <ContasPagarPage />;
      case 'contas_receber': return <ContasReceberPage user={user} />;
      case 'caixa': return <CaixaPage user={user} />;
      case 'funcionarios': return <FuncionariosPage />;
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
