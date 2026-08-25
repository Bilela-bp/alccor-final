import React, { useState, useEffect, useCallback } from 'react';
import { ArrowDownCircle, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { get, insertRow, insertRows, updateRow, deleteRow } from '../lib/supabase';
import { addDaysISO, fmtCurrency, fmtDate, makeUuid, todayISO } from '../lib/helpers';
import { Badge, ComboSelect, EmptyState, Field, LoadingRows, Modal, PageHeader, PrimaryButton, SecondaryButton, Stat, inputCls } from '../components/ui';

export default function ContasReceberPage({ user }) {
  const [rows, setRows] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [pagina, setPagina] = useState(1);
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
  const PAGE_SIZE = 12;
  const totalPaginas = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const paginated = filtered.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE);
  const totalPendente = rows.filter(r => r.status === 'pendente').reduce((s, r) => s + Number(r.valor || 0), 0);
  const totalVencido = rows.filter(r => r.status === 'pendente' && r.data_vencimento < hoje).reduce((s, r) => s + Number(r.valor || 0), 0);

  return (
    <div>
      <PageHeader Icon={ArrowDownCircle} title="Contas a receber" subtitle="Controle de recebimentos e parcelamentos automáticos">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-2.5 top-2.5 text-stone-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPagina(1); }} placeholder="Buscar…" className="pl-8 pr-3 py-1.5 text-sm border border-stone-300 rounded-lg w-40" />
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
              <tbody>{paginated.map(r => (
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
        {!loading && filtered.length > 0 && <Pagination page={paginaAtual} totalPages={totalPaginas} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPagina} />}
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