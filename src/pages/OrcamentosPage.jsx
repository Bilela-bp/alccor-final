import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, ClipboardList, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { get, insertRow, insertRows, updateRow, deleteRow } from '../lib/supabase';
import { fmtCurrency, fmtDate, todayISO } from '../lib/helpers';
import { WOOD } from '../lib/theme';
import { Badge, ComboSelect, EmptyState, Field, LoadingRows, Modal, PageHeader, PrimaryButton, SecondaryButton, Stat, Pagination, inputCls } from '../components/ui';

// =========================================================================
// ORÇAMENTOS (propostas para clientes + comparativo de conversão)
// =========================================================================
export default function OrcamentosPage({ user }) {
  const submittingRef = useRef(false);
  const [orcamentos, setOrcamentos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [historicoProdutos, setHistoricoProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [oldItemIds, setOldItemIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [carregandoItens, setCarregandoItens] = useState(false);
  const [pagina, setPagina] = useState(1);

  const [header, setHeader] = useState({ cliente_id: '', data: todayISO(), descricao: '', status: 'orcamento' });
  const [itens, setItens] = useState([{ produto_id: '', quantidade: '', preco_unitario: '' }]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, c, p, h] = await Promise.all([
        get('orcamentos', '&order=data.desc,criado_em.desc'),
        get('clientes', '&order=nome.asc'),
        get('produtos', '&order=nome.asc'),
        get('historico_alteracoes', '&tabela=eq.produtos&order=created_at.desc'),
      ]);
      setOrcamentos(o || []);
      setClientes(c || []);
      setProdutos(p || []);
      setHistoricoProdutos(h || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditing(null);
    setOldItemIds([]);
    setHeader({ cliente_id: '', data: todayISO(), descricao: '', status: 'orcamento' });
    setItens([{ produto_id: '', quantidade: '', preco_unitario: '' }]);
    setModalOpen(true);
  }

  async function openEdit(row) {
    setEditing(row);
    setModalOpen(true);
    setCarregandoItens(true);
    setHeader({
      cliente_id: row.cliente_id || '',
      data: row.data || todayISO(),
      descricao: row.descricao || '',
      status: row.status || 'orcamento',
    });
    try {
      const data = await get('orcamentos_itens', `&orcamento_id=eq.${row.id}&order=criado_em.asc`);
      setOldItemIds((data || []).map((it) => it.id));
      setItens((data || []).length
        ? data.map((it) => ({ produto_id: it.produto_id, quantidade: it.quantidade, preco_unitario: it.preco_unitario }))
        : [{ produto_id: '', quantidade: '', preco_unitario: '' }]);
    } catch (e) {
      window.alert('Erro ao carregar itens do orçamento: ' + e.message);
      setItens([{ produto_id: '', quantidade: '', preco_unitario: '' }]);
    }
    setCarregandoItens(false);
  }

  // O valor do item vem diretamente do custo atual no estoque.
  // O histórico fica apenas como fallback para produtos antigos que ainda não tenham custo preenchido.
  function valorCustoProduto(produtoId) {
    const produto = produtos.find((p) => p.id === produtoId);
    if (produto && produto.preco_custo !== null && produto.preco_custo !== undefined) {
      return Number(produto.preco_custo) || 0;
    }
    const registro = historicoProdutos.find((r) => r.registro_id === produtoId && r.dados_novos?.preco_custo !== undefined && r.dados_novos?.preco_custo !== null);
    return registro ? Number(registro.dados_novos.preco_custo) || 0 : 0;
  }

  function updateItem(i, key, value) {
    const copy = [...itens];
    copy[i] = { ...copy[i], [key]: value };
    if (key === 'produto_id') copy[i].preco_unitario = valorCustoProduto(value);
    setItens(copy);
  }
  function addItemRow() { setItens([...itens, { produto_id: '', quantidade: '', preco_unitario: '' }]); }
  function removeItemRow(i) { setItens(itens.filter((_, idx) => idx !== i)); }

  const total = itens.reduce((s, it) => s + (Number(it.quantidade) || 0) * (Number(it.preco_unitario) || 0), 0);

  async function handleSave(e) {
    e.preventDefault();
    if (submittingRef.current) return; // evita lançamento duplicado (duplo clique / Enter + clique)
    const validItens = itens.filter((it) => it.produto_id && Number(it.quantidade) > 0);
    if (!header.cliente_id) { window.alert('Selecione o cliente.'); return; }
    if (validItens.length === 0) { window.alert('Adicione ao menos um item válido.'); return; }

    submittingRef.current = true;
    setSaving(true);
    try {
      const payloadHeader = {
        cliente_id: header.cliente_id,
        data: header.data,
        descricao: header.descricao || null,
        status: header.status,
        valor_total: total,
        usuario_id: user.id,
      };

      let orcamentoId;
      if (editing) {
        await updateRow('orcamentos', editing.id, payloadHeader);
        orcamentoId = editing.id;
        for (const id of oldItemIds) await deleteRow('orcamentos_itens', id);
      } else {
        const criado = await insertRow('orcamentos', payloadHeader);
        orcamentoId = criado[0].id;
      }

      const rows = validItens.map((it) => ({
        orcamento_id: orcamentoId,
        produto_id: it.produto_id,
        quantidade: Number(it.quantidade),
        preco_unitario: Number(it.preco_unitario),
      }));
      await insertRows('orcamentos_itens', rows);

      setModalOpen(false);
      await load();
    } catch (e) {
      window.alert('Erro ao salvar orçamento: ' + e.message);
    }
    setSaving(false);
    submittingRef.current = false;
  }

  async function handleDelete(row) {
    if (!window.confirm('Excluir este orçamento? Essa ação não pode ser desfeita.')) return;
    try {
      await deleteRow('orcamentos', row.id);
      await load();
    } catch (e) {
      window.alert('Erro ao excluir: ' + e.message);
    }
  }

  async function toggleStatus(row) {
    const novoStatus = row.status === 'em_andamento' ? 'orcamento' : 'em_andamento';
    try {
      await updateRow('orcamentos', row.id, { status: novoStatus });
      await load();
    } catch (e) {
      window.alert('Erro ao atualizar status: ' + e.message);
    }
  }

  const clienteNome = (id) => clientes.find((c) => c.id === id)?.nome || '—';
  const filtered = orcamentos.filter((o) => !search || JSON.stringify(o).toLowerCase().includes(search.toLowerCase()));
  const PAGE_SIZE = 12;
  const totalPaginas = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const paginated = filtered.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE);

  const totalOrcamentos = orcamentos.length;
  const emAndamento = orcamentos.filter((o) => o.status === 'em_andamento').length;
  const taxaConversao = totalOrcamentos > 0 ? Math.round((emAndamento / totalOrcamentos) * 100) : 0;
  const valorEmAndamento = orcamentos.filter((o) => o.status === 'em_andamento').reduce((s, o) => s + Number(o.valor_total || 0), 0);
  const valorTotalOrcado = orcamentos.reduce((s, o) => s + Number(o.valor_total || 0), 0);

  return (
    <div>
      <PageHeader Icon={ClipboardList} title="Orçamentos" subtitle="Propostas para clientes e acompanhamento de conversão">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-2.5 top-2.5 text-stone-400" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPagina(1); }} placeholder="Buscar…" className="pl-8 pr-3 py-1.5 text-sm border border-stone-300 rounded-lg w-40" />
          </div>
          <PrimaryButton onClick={openNew}><Plus size={16} /> Novo orçamento</PrimaryButton>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <Stat label="Orçamentos criados" value={totalOrcamentos} sub={fmtCurrency(valorTotalOrcado)} />
        <Stat label="Projetos em andamento" value={emAndamento} tone="green" sub={fmtCurrency(valorEmAndamento)} />
        <Stat label="Taxa de conversão" value={`${taxaConversao}%`} tone="amber" sub="Orçamentos que viraram projeto" />
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-5 mb-4">
        <h3 className="font-display text-base font-semibold text-stone-900 mb-4">Comparativo: orçamentos × projetos iniciados</h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs text-stone-500 mb-1">
              <span>Orçamentos criados</span>
              <span>{totalOrcamentos}</span>
            </div>
            <div className="h-3 rounded-full bg-stone-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: '100%', backgroundColor: '#D6D3D1' }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-stone-500 mb-1">
              <span>Projetos em andamento</span>
              <span>{emAndamento}</span>
            </div>
            <div className="h-3 rounded-full bg-stone-100 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${taxaConversao}%`, backgroundColor: WOOD.accent }} />
            </div>
          </div>
        </div>
        <p className="text-xs text-stone-400 mt-3">
          {totalOrcamentos === 0
            ? 'Nenhum orçamento lançado ainda.'
            : `${emAndamento} de ${totalOrcamentos} orçamento(s) viraram projeto — taxa de conversão de ${taxaConversao}%.`}
        </p>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        {loading ? <LoadingRows /> : filtered.length === 0 ? (
          <EmptyState icon={ClipboardList} text="Nenhum orçamento encontrado." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  <th className="text-left px-4 py-2.5 font-medium text-stone-500">Cliente</th>
                  <th className="text-left px-4 py-2.5 font-medium text-stone-500">Descrição</th>
                  <th className="text-left px-4 py-2.5 font-medium text-stone-500">Data</th>
                  <th className="text-right px-4 py-2.5 font-medium text-stone-500">Valor</th>
                  <th className="text-left px-4 py-2.5 font-medium text-stone-500">Status</th>
                  <th className="px-4 py-2.5 w-32"></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((o) => (
                  <tr key={o.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                    <td className="px-4 py-2.5 font-medium text-stone-800">{clienteNome(o.cliente_id)}</td>
                    <td className="px-4 py-2.5 text-stone-700">{o.descricao || '—'}</td>
                    <td className="px-4 py-2.5 text-stone-700">{fmtDate(o.data)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-stone-800">{fmtCurrency(o.valor_total)}</td>
                    <td className="px-4 py-2.5">
                      {o.status === 'em_andamento' ? <Badge tone="green">Em andamento</Badge> : <Badge tone="amber">Orçamento</Badge>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => toggleStatus(o)}
                          title={o.status === 'em_andamento' ? 'Voltar para orçamento' : 'Marcar como em andamento'}
                          className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                        >
                          {o.status === 'em_andamento' ? <RefreshCw size={15} /> : <Check size={15} />}
                        </button>
                        <button onClick={() => openEdit(o)} className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => handleDelete(o)} className="p-1.5 rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-600">
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
        {!loading && filtered.length > 0 && <Pagination page={paginaAtual} totalPages={totalPaginas} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPagina} />}
      </div>

      {modalOpen && (
        <Modal title={editing ? 'Editar orçamento' : 'Novo orçamento'} onClose={() => setModalOpen(false)} wide>
          <form onSubmit={handleSave} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cliente" required>
                <ComboSelect
                  options={clientes.map((c) => ({ id: c.id, label: c.nome }))}
                  value={header.cliente_id}
                  onChange={(id) => setHeader({ ...header, cliente_id: id })}
                  placeholder="Buscar cliente…"
                />
              </Field>
              <Field label="Data" required>
                <input type="date" className={inputCls} required value={header.data} onChange={(e) => setHeader({ ...header, data: e.target.value })} />
              </Field>
              <Field label="Descrição" hint="Ex: Reforma cozinha, Móvel planejado sala…">
                <input className={inputCls} value={header.descricao} onChange={(e) => setHeader({ ...header, descricao: e.target.value })} />
              </Field>
              <Field label="Status" required>
                <select className={inputCls} value={header.status} onChange={(e) => setHeader({ ...header, status: e.target.value })}>
                  <option value="orcamento">Orçamento criado</option>
                  <option value="em_andamento">Projeto em andamento</option>
                </select>
              </Field>
            </div>

            <p className="text-sm font-medium text-stone-700 mt-2 mb-2">Itens do orçamento</p>
            {carregandoItens ? (
              <p className="text-sm text-stone-400 mb-4">Carregando itens…</p>
            ) : (
              <>
                <div className="space-y-2 mb-2">
                  {itens.map((it, i) => (
                    <div key={i} className="flex flex-wrap gap-2 items-start bg-stone-50 border border-stone-200 rounded-lg p-2">
                      <div style={{ flex: '2 1 0%', minWidth: '12rem' }}>
                        <ComboSelect
                          options={produtos.filter((p) => p.ativo !== false).map((p) => ({ id: p.id, label: p.nome, sublabel: p.categoria || '' }))}
                          value={it.produto_id}
                          onChange={(id) => updateItem(i, 'produto_id', id)}
                          placeholder="Buscar produto por nome ou grupo…"
                        />
                      </div>
                      <input type="number" step="any" placeholder="Qtd" className={inputCls} style={{ width: '5.5rem', flexShrink: 0 }} value={it.quantidade} onChange={(e) => updateItem(i, 'quantidade', e.target.value)} />
                      <input type="number" step="any" placeholder="Valor do histórico" className={inputCls + ' bg-stone-100'} style={{ width: '9rem', flexShrink: 0 }} value={it.preco_unitario} readOnly title="Valor preenchido automaticamente pelo histórico do produto" />
                      <button type="button" onClick={() => removeItemRow(i)} className="p-2 text-stone-400 hover:text-red-600"><X size={16} /></button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addItemRow} className="text-sm font-medium mb-4" style={{ color: WOOD.accentDark }}>+ adicionar item</button>
              </>
            )}

            <div className="flex items-center justify-between border-t border-stone-200 pt-3 mb-4">
              <span className="text-sm text-stone-500">Valor total do orçamento</span>
              <span className="font-display text-lg font-semibold text-stone-900">{fmtCurrency(total)}</span>
            </div>

            <div className="flex gap-2 justify-end">
              <SecondaryButton onClick={() => setModalOpen(false)}>Cancelar</SecondaryButton>
              <PrimaryButton type="submit" disabled={saving || carregandoItens}>{saving ? 'Salvando…' : 'Salvar orçamento'}</PrimaryButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
