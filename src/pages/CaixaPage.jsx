import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronRight, Lock, Plus, Unlock, Wallet } from 'lucide-react';
import { get, insertRow, updateRow } from '../lib/supabase';
import { fmtCurrency, fmtDateTime } from '../lib/helpers';
import { Badge, ComboSelect, EmptyState, Field, LoadingRows, Modal, PageHeader, PrimaryButton, SecondaryButton, Pagination, inputCls } from '../components/ui';

export default function CaixaPage({ user }) {
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
  const [pagina, setPagina] = useState(1);
  const PAGE_SIZE = 12;

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
  const totalPaginas = Math.max(1, Math.ceil(caixas.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const paginatedCaixas = caixas.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE);

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
              {paginatedCaixas.map((c) => (
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
        {!loading && caixas.length > 0 && <Pagination page={paginaAtual} totalPages={totalPaginas} totalItems={caixas.length} pageSize={PAGE_SIZE} onPageChange={setPagina} />}
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