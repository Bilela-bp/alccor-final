import React, { useState, useEffect, useCallback, useRef } from "react";
import { ChevronRight, FileText, Plus, Trash2, X } from "lucide-react";
import { get, insertRow, insertRows, deleteRow } from "../lib/supabase";
import { fmtCurrency, fmtDate, todayISO } from "../lib/helpers";
import { WOOD } from "../lib/theme";
import {
  ComboSelect,
  EmptyState,
  Field,
  LoadingRows,
  Modal,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  Pagination,
  inputCls,
} from "../components/ui";

export default function NotasFiscaisPage({ user }) {
  const submittingRef = useRef(false);
  const [notas, setNotas] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewingItens, setViewingItens] = useState(null);
  const [pagina, setPagina] = useState(1);
  const PAGE_SIZE = 12;
  const [saving, setSaving] = useState(false);

  const [header, setHeader] = useState({
    numero: "",
    fornecedor_id: "",
    data_emissao: todayISO(),
    observacao: "",
  });
  const [itens, setItens] = useState([
    { produto_id: "", quantidade: "", preco_unitario: "" },
  ]);
  const [novoProdutoFor, setNovoProdutoFor] = useState(null); // índice do item que está cadastrando produto novo
  const [novoProdutoForm, setNovoProdutoForm] = useState({
    nome: "",
    categoria: "",
  });
  const [grupos, setGrupos] = useState([]);
  const [novoGrupoModal, setNovoGrupoModal] = useState(false);
  const [novoGrupoNome, setNovoGrupoNome] = useState("");
  const [criandoGrupo, setCriandoGrupo] = useState(false);
  const [criandoProduto, setCriandoProduto] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [n, f, p, g] = await Promise.all([
        get("notas_fiscais", "&order=data_emissao.desc,criado_em.desc"),
        get("fornecedores", "&order=nome.asc"),
        get("produtos", "&order=nome.asc"),
        get("grupos_produtos", "&order=nome.asc"),
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

  useEffect(() => {
    load();
  }, [load]);

  async function loadItens(nota) {
    const data = await get(
      "notas_fiscais_itens",
      `&nota_fiscal_id=eq.${nota.id}&order=criado_em.asc`,
    );
    setViewingItens({ nota, itens: data || [] });
  }

  function openNovoProduto(index) {
    setNovoProdutoForm({ nome: "", categoria: "" });
    setNovoProdutoFor(index);
  }

  async function handleCriarGrupoNota(e) {
    e.preventDefault();
    if (criandoGrupo) return;
    const nome = novoGrupoNome.trim();
    if (!nome) {
      window.alert("Digite um nome para o grupo.");
      return;
    }
    setCriandoGrupo(true);
    try {
      const criado = await insertRow("grupos_produtos", { nome });
      const novo = criado[0];
      setGrupos((prev) =>
        [...prev, novo].sort((a, b) => a.nome.localeCompare(b.nome)),
      );
      setNovoProdutoForm((prev) => ({ ...prev, categoria: novo.nome }));
      setNovoGrupoModal(false);
      setNovoGrupoNome("");
    } catch (e) {
      const msg = /duplicate key|already exists|unique constraint/i.test(
        e.message,
      )
        ? "Já existe um grupo com esse nome."
        : e.message;
      window.alert("Erro ao criar grupo: " + msg);
    }
    setCriandoGrupo(false);
  }

  async function handleCriarProduto(e) {
    e.preventDefault();
    if (criandoProduto) return;
    if (!novoProdutoForm.nome.trim()) {
      window.alert("Informe o nome do produto.");
      return;
    }
    setCriandoProduto(true);
    try {
      const criado = await insertRow("produtos", {
        nome: novoProdutoForm.nome.trim(),
        categoria: novoProdutoForm.categoria.trim() || null,
        ativo: true,
        // quantidade_atual, preco_custo e estoque_mínimo começam em 0 (padrão do banco) —
        // o custo é definido automaticamente pela primeira entrada desta nota fiscal.
      });
      const novo = criado[0];
      setProdutos((prev) =>
        [...prev, novo].sort((a, b) => a.nome.localeCompare(b.nome)),
      );
      updateItem(novoProdutoFor, "produto_id", novo.id);
      setNovoProdutoFor(null);
    } catch (e) {
      window.alert("Erro ao cadastrar produto: " + e.message);
    }
    setCriandoProduto(false);
  }

  function openNew() {
    setHeader({
      numero: "",
      fornecedor_id: "",
      data_emissao: todayISO(),
      observacao: "",
    });
    setItens([{ produto_id: "", quantidade: "", preco_unitario: "" }]);
    setModalOpen(true);
  }

  function updateItem(i, key, value) {
    const copy = [...itens];
    copy[i] = { ...copy[i], [key]: value };
    setItens(copy);
  }
  function addItemRow() {
    setItens([
      ...itens,
      { produto_id: "", quantidade: "", preco_unitario: "" },
    ]);
  }
  function removeItemRow(i) {
    setItens(itens.filter((_, idx) => idx !== i));
  }

  const total = itens.reduce(
    (s, it) =>
      s + (Number(it.quantidade) || 0) * (Number(it.preco_unitario) || 0),
    0,
  );

  async function handleSave(e) {
    e.preventDefault();
    if (submittingRef.current) return; // trava contra lançamento duplicado (Enter + clique, duplo clique)
    const validItens = itens.filter(
      (it) => it.produto_id && Number(it.quantidade) > 0,
    );
    if (!header.numero || !header.fornecedor_id) {
      window.alert("Preencha número e fornecedor da nota.");
      return;
    }
    if (validItens.length === 0) {
      window.alert("Adicione ao menos um item válido.");
      return;
    }
    try {
      const existentes = await get(
        "notas_fiscais",
        `&numero=eq.${encodeURIComponent(header.numero.trim())}`,
      );
      if (existentes && existentes.length > 0) {
        window.alert(
          `Já existe uma nota número "${header.numero}" cadastrada. Cada número só pode ser usado uma vez.`,
        );
        return;
      }
    } catch (e) {
      /* se a checagem falhar, segue e deixa o banco garantir a unicidade */
    }
    submittingRef.current = true;
    setSaving(true);
    try {
      const nota = await insertRow("notas_fiscais", {
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
      await insertRows("notas_fiscais_itens", rows);
      setModalOpen(false);
      await load();
    } catch (e) {
      const msg = /duplicate key|already exists|unique constraint/i.test(
        e.message,
      )
        ? `Já existe uma nota número "${header.numero}" cadastrada. Confira o número antes de lançar novamente.`
        : e.message;
      window.alert("Erro ao lançar nota: " + msg);
    }
    setSaving(false);
    submittingRef.current = false;
  }

  async function handleDeleteNota(nota) {
    if (
      !window.confirm(
        "Excluir esta nota fiscal? O estoque dos itens será estornado automaticamente.",
      )
    )
      return;
    try {
      await deleteRow("notas_fiscais", nota.id);
      await load();
    } catch (e) {
      window.alert("Erro ao excluir: " + e.message);
    }
  }

  const fornecedorNome = (id) =>
    fornecedores.find((f) => f.id === id)?.nome || "—";
  const produtoNome = (id) => produtos.find((p) => p.id === id)?.nome || "—";
  const totalPaginas = Math.max(1, Math.ceil(notas.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const paginatedNotas = notas.slice(
    (paginaAtual - 1) * PAGE_SIZE,
    paginaAtual * PAGE_SIZE,
  );

  return (
    <div>
      <PageHeader
        Icon={FileText}
        title="Notas fiscais"
        subtitle="Entrada de mercadoria — atualiza o estoque automaticamente"
      >
        <PrimaryButton onClick={openNew}>
          <Plus size={16} /> Nova nota fiscal
        </PrimaryButton>
      </PageHeader>

      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        {loading ? (
          <LoadingRows />
        ) : notas.length === 0 ? (
          <EmptyState
            icon={FileText}
            text="Nenhuma nota fiscal lançada ainda."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">
                  Número
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">
                  Fornecedor
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">
                  Emissão
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">
                  Valor total
                </th>
                <th className="px-4 py-2.5 w-28"></th>
              </tr>
            </thead>
            <tbody>
              {paginatedNotas.map((n) => (
                <tr
                  key={n.id}
                  className="border-b border-stone-100 last:border-0 hover:bg-stone-50"
                >
                  <td className="px-4 py-2.5 text-stone-800 font-medium">
                    {n.numero}
                  </td>
                  <td className="px-4 py-2.5 text-stone-700">
                    {fornecedorNome(n.fornecedor_id)}
                  </td>
                  <td className="px-4 py-2.5 text-stone-700">
                    {fmtDate(n.data_emissao)}
                  </td>
                  <td className="px-4 py-2.5 text-stone-800">
                    {fmtCurrency(n.valor_total)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => loadItens(n)}
                        className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                        title="Ver itens"
                      >
                        <ChevronRight size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteNota(n)}
                        className="p-1.5 rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && notas.length > 0 && (
          <Pagination
            page={paginaAtual}
            totalPages={totalPaginas}
            totalItems={notas.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPagina}
          />
        )}
      </div>

      {modalOpen && (
        <Modal
          title="Nova nota fiscal"
          onClose={() => setModalOpen(false)}
          wide
        >
          <form
            onSubmit={handleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.target.tagName !== "TEXTAREA")
                e.preventDefault();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Número da nota" required>
                <input
                  className={inputCls}
                  required
                  value={header.numero}
                  onChange={(e) =>
                    setHeader({ ...header, numero: e.target.value })
                  }
                />
              </Field>
              <Field label="Fornecedor" required>
                <ComboSelect
                  options={fornecedores.map((f) => ({
                    id: f.id,
                    label: f.nome,
                  }))}
                  value={header.fornecedor_id}
                  onChange={(id) => setHeader({ ...header, fornecedor_id: id })}
                  placeholder="Buscar fornecedor…"
                />
              </Field>
              <Field label="Data de emissão" required>
                <input
                  type="date"
                  className={inputCls}
                  required
                  value={header.data_emissao}
                  onChange={(e) =>
                    setHeader({ ...header, data_emissao: e.target.value })
                  }
                />
              </Field>
              <Field label="Observação">
                <input
                  className={inputCls}
                  value={header.observacao}
                  onChange={(e) =>
                    setHeader({ ...header, observacao: e.target.value })
                  }
                />
              </Field>
            </div>

            <p className="text-sm font-medium text-stone-700 mt-2 mb-2">
              Itens da nota
            </p>
            <div className="space-y-2 mb-2">
              {itens.map((it, i) => (
                <div
                  key={i}
                  className="flex flex-wrap gap-2 items-start bg-stone-50 border border-stone-200 rounded-lg p-2"
                >
                  <div style={{ flex: "2 1 0%", minWidth: "12rem" }}>
                    <ComboSelect
                      options={produtos
                        .filter((p) => p.ativo !== false)
                        .map((p) => ({
                          id: p.id,
                          label: p.nome,
                          sublabel: p.categoria || "",
                        }))}
                      value={it.produto_id}
                      onChange={(id) => updateItem(i, "produto_id", id)}
                      placeholder="Buscar produto por nome ou grupo…"
                      extraAction={(closeList) => (
                        <button
                          type="button"
                          onClick={() => {
                            closeList();
                            openNovoProduto(i);
                          }}
                          className="w-full text-left px-3 py-2 text-sm font-medium border-b border-stone-100"
                          style={{ color: WOOD.accentDark }}
                        >
                          + Cadastrar novo produto…
                        </button>
                      )}
                    />
                  </div>
                  <input
                    type="number"
                    step="any"
                    placeholder="Qtd"
                    className={inputCls}
                    style={{ width: "5.5rem", flexShrink: 0 }}
                    value={it.quantidade}
                    onChange={(e) =>
                      updateItem(i, "quantidade", e.target.value)
                    }
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="Preço unit."
                    className={inputCls}
                    style={{ width: "7rem", flexShrink: 0 }}
                    value={it.preco_unitario}
                    onChange={(e) =>
                      updateItem(i, "preco_unitario", e.target.value)
                    }
                  />
                  <button
                    type="button"
                    onClick={() => removeItemRow(i)}
                    className="p-2 text-stone-400 hover:text-red-600"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addItemRow}
              className="text-sm font-medium mb-4"
              style={{ color: WOOD.accentDark }}
            >
              + adicionar item
            </button>

            <div className="flex items-center justify-between border-t border-stone-200 pt-3 mb-4">
              <span className="text-sm text-stone-500">
                Valor total da nota
              </span>
              <span className="font-display text-lg font-semibold text-stone-900">
                {fmtCurrency(total)}
              </span>
            </div>

            <div className="flex gap-2 justify-end">
              <SecondaryButton onClick={() => setModalOpen(false)}>
                Cancelar
              </SecondaryButton>
              <PrimaryButton type="submit" disabled={saving}>
                {saving ? "Lançando…" : "Lançar nota e atualizar estoque"}
              </PrimaryButton>
            </div>
          </form>
        </Modal>
      )}

      {viewingItens && (
        <Modal
          title={`Itens da nota ${viewingItens.nota.numero}`}
          onClose={() => setViewingItens(null)}
        >
          {viewingItens.itens.length === 0 ? (
            <p className="text-sm text-stone-400">Sem itens.</p>
          ) : (
            <div className="space-y-2">
              {viewingItens.itens.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center justify-between text-sm border-b border-stone-100 pb-2"
                >
                  <span className="text-stone-700">
                    {produtoNome(it.produto_id)}
                  </span>
                  <span className="text-stone-500">
                    {it.quantidade} × {fmtCurrency(it.preco_unitario)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {novoProdutoFor !== null && (
        <Modal
          title="Cadastrar novo produto"
          onClose={() => setNovoProdutoFor(null)}
        >
          <form
            onSubmit={handleCriarProduto}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.target.tagName !== "TEXTAREA")
                e.preventDefault();
            }}
          >
            <Field label="Nome" required>
              <input
                className={inputCls}
                required
                autoFocus
                value={novoProdutoForm.nome}
                onChange={(e) =>
                  setNovoProdutoForm({
                    ...novoProdutoForm,
                    nome: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Grupo / categoria">
              <ComboSelect
                options={grupos.map((g) => ({ id: g.nome, label: g.nome }))}
                value={novoProdutoForm.categoria}
                onChange={(nome) =>
                  setNovoProdutoForm({ ...novoProdutoForm, categoria: nome })
                }
                placeholder="Buscar grupo…"
                allowClear
                extraAction={(closeList) => (
                  <button
                    type="button"
                    onClick={() => {
                      closeList();
                      setNovoGrupoNome("");
                      setNovoGrupoModal(true);
                    }}
                    className="w-full text-left px-3 py-2 text-sm font-medium border-b border-stone-100"
                    style={{ color: WOOD.accentDark }}
                  >
                    + Criar novo grupo…
                  </button>
                )}
              />
            </Field>
            <p className="text-xs text-stone-400 mb-4">
              Sem chute de custo ou estoque inicial: o produto entra com estoque
              zerado e o preço de custo é calculado automaticamente pelo preço
              unitário que você lançar nesta nota.
            </p>
            <div className="flex gap-2 justify-end">
              <SecondaryButton onClick={() => setNovoProdutoFor(null)}>
                Cancelar
              </SecondaryButton>
              <PrimaryButton type="submit" disabled={criandoProduto}>
                {criandoProduto
                  ? "Cadastrando…"
                  : "Cadastrar e usar nesta nota"}
              </PrimaryButton>
            </div>
          </form>
        </Modal>
      )}

      {novoGrupoModal && (
        <Modal
          title="Criar novo grupo"
          onClose={() => setNovoGrupoModal(false)}
        >
          <form
            onSubmit={handleCriarGrupoNota}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.target.tagName !== "TEXTAREA")
                e.preventDefault();
            }}
          >
            <Field label="Nome do grupo" required>
              <input
                className={inputCls}
                required
                autoFocus
                value={novoGrupoNome}
                onChange={(e) => setNovoGrupoNome(e.target.value)}
                placeholder="Ex: Madeiras, Ferragens, Tecidos…"
              />
            </Field>
            <div className="flex gap-2 justify-end">
              <SecondaryButton onClick={() => setNovoGrupoModal(false)}>
                Cancelar
              </SecondaryButton>
              <PrimaryButton type="submit" disabled={criandoGrupo}>
                {criandoGrupo ? "Criando…" : "Criar e usar"}
              </PrimaryButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
