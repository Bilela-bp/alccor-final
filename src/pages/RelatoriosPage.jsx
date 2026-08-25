import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, FileText, RefreshCw, Wallet } from 'lucide-react';
import { get } from '../lib/supabase';
import { fmtCurrency, fmtDate, fmtDateTime, monthISO, todayISO } from '../lib/helpers';
import { Badge, EmptyState, Field, LoadingRows, PageHeader, SecondaryButton, Stat, inputCls } from '../components/ui';

export default function RelatoriosPage() {
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