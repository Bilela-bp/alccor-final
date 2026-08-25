import React, { useState, useEffect, useCallback } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { get } from '../lib/supabase';
import { fmtDateTime } from '../lib/helpers';
import { Badge, EmptyState, Field, LoadingRows, PageHeader, SecondaryButton, Pagination, inputCls } from '../components/ui';

const PAGE_SIZE = 12;

export default function HistoricoPage() {
  const [rows, setRows] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [filtroTabela, setFiltroTabela] = useState('');
  const [filtroData, setFiltroData] = useState('');
  const [pagina, setPagina] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [h, u] = await Promise.all([
        get('historico_alteracoes', '&order=created_at.desc'),
        get('usuarios', '&order=nome.asc'),
      ]);
      setRows(h || []); setUsuarios(u || []); setPagina(1);
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
  const filtered = rows.filter(r => {
    if (filtroUsuario && r.usuario_id !== filtroUsuario) return false;
    if (filtroTabela && r.tabela !== filtroTabela) return false;
    if (filtroData) {
      const diaLocal = new Date(r.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      if (diaLocal !== filtroData) return false;
    }
    return true;
  });
  const totalPaginas = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const paginated = filtered.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE);

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
    <div className="bg-white border border-stone-200 rounded-xl p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
      <Field label="Usuário"><select className={inputCls} value={filtroUsuario} onChange={e=>{setFiltroUsuario(e.target.value);setPagina(1)}}><option value="">Todos</option>{usuarios.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}</select></Field>
      <Field label="Tabela / módulo"><select className={inputCls} value={filtroTabela} onChange={e=>{setFiltroTabela(e.target.value);setPagina(1)}}><option value="">Todos</option>{[...new Set(rows.map(r=>r.tabela))].map(t=><option key={t} value={t}>{tableLabel(t)}</option>)}</select></Field>
      <Field label="Dia"><input type="date" className={inputCls} value={filtroData} onChange={e=>{setFiltroData(e.target.value);setPagina(1)}} /></Field>
      <div className="flex items-end"><div className="text-sm text-stone-500 pb-2">{filtered.length} alteração(ões) encontrada(s)</div></div>
    </div>
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      {loading ? <LoadingRows/> : filtered.length===0 ? <EmptyState icon={History} text="Nenhuma alteração encontrada."/> :
      <>
        <div className="overflow-x-auto"><table className="w-full text-sm table-fixed"><thead><tr className="bg-stone-50 border-b border-stone-200">
          <th className="text-left px-4 py-2.5 w-44">Data</th><th className="text-left px-4 py-2.5 w-48">Usuário</th><th className="text-left px-4 py-2.5 w-52">Onde foi feito</th><th className="text-left px-4 py-2.5">O que foi feito</th>
        </tr></thead><tbody>{paginated.map(r=><tr key={r.id} className="border-b border-stone-100 align-top">
          <td className="px-4 py-2.5 break-words">{fmtDateTime(r.created_at)}</td><td className="px-4 py-2.5 break-words">{userName(r.usuario_id)}</td><td className="px-4 py-2.5 break-words">{tableLabel(r.tabela)}</td><td className="px-4 py-2.5 break-words"><Badge tone={r.acao==='DELETE'?'red':r.acao==='INSERT'?'green':'amber'}>{resumo(r)}</Badge></td>
        </tr>)}</tbody></table></div>
        <Pagination page={paginaAtual} totalPages={totalPaginas} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPagina} />
      </>}
    </div>
  </div>;
}
