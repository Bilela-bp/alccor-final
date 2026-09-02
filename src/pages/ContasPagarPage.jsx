import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowUpCircle,
  FileText,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  get,
  insertRow,
  updateRow,
  deleteRow,
  uploadFile,
  deleteFile,
  getFilePublicUrl,
} from "../lib/supabase";
import { fmtCurrency, fmtDate, todayISO, makeUuid } from "../lib/helpers";
import { WOOD } from "../lib/theme";
import {
  Badge,
  ComboSelect,
  EmptyState,
  Field,
  LoadingRows,
  Modal,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  Stat,
  Pagination,
  inputCls,
} from "../components/ui";

// =========================================================================
// CONTAS A PAGAR (valor, data de vencimento e anexo de documento PDF)
// =========================================================================

const STATUS_LABEL = {
  pendente: "Pendente",
  pago: "Pago",
};

const STATUS_TONE = {
  pendente: "red",
  pago: "green",
};

function formatBytes(bytes) {
  if (!bytes) return "";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export default function ContasPagarPage({ user }) {
  const submittingRef = useRef(false);
  const [contas, setContas] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pagina, setPagina] = useState(1);

  const [header, setHeader] = useState({
    fornecedor_id: "",
    data_vencimento: todayISO(),
    data_pagamento: "",
    descricao: "",
    valor: "",
    status: "pendente",
  });
  const [documento, setDocumento] = useState(null); // novo arquivo escolhido (File) para enviar
  const [removerDocumento, setRemoverDocumento] = useState(false); // marca que o anexo existente deve ser removido

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, f] = await Promise.all([
        get("contas_pagar", "&order=data_vencimento.desc,criado_em.desc"),
        get("fornecedores", "&order=nome.asc"),
      ]);
      setContas(c || []);
      setFornecedores(f || []);
    } catch (e) {
      console.error("Erro ao carregar:", e.message);
      window.alert("Erro ao carregar contas a pagar: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setEditing(null);
    setHeader({
      fornecedor_id: "",
      data_vencimento: todayISO(),
      data_pagamento: "",
      descricao: "",
      valor: "",
      status: "pendente",
    });
    setDocumento(null);
    setRemoverDocumento(false);
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setHeader({
      fornecedor_id: row.fornecedor_id || "",
      data_vencimento: row.data_vencimento,
      data_pagamento: row.data_pagamento || "",
      descricao: row.descricao || "",
      valor: row.valor.toString(),
      status: row.status,
    });
    setDocumento(null);
    setRemoverDocumento(false);
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (submittingRef.current) return;

    if (!header.fornecedor_id) {
      window.alert("Selecione o fornecedor.");
      return;
    }

    if (!header.descricao?.trim()) {
      window.alert("Informe a descrição.");
      return;
    }

    if (header.valor === "" || Number(header.valor) < 0) {
      window.alert("Informe o valor.");
      return;
    }

    if (!header.data_vencimento) {
      window.alert("Informe a data de vencimento.");
      return;
    }

    submittingRef.current = true;
    setSaving(true);
    try {
      const payload = {
        fornecedor_id: header.fornecedor_id,
        data_vencimento: header.data_vencimento,
        data_pagamento: header.data_pagamento || null,
        descricao: header.descricao,
        valor: Number(header.valor),
        status: header.status,
      };

      // Remoção do documento existente (sem enviar um novo no lugar)
      if (removerDocumento && editing?.documento_path) {
        await deleteFile(editing.documento_path);
        payload.documento_path = null;
        payload.documento_nome = null;
        payload.documento_tamanho = null;
      }

      // Upload de um novo arquivo (substitui o anterior, se houver)
      if (documento) {
        if (editing?.documento_path)
          await deleteFile(editing.documento_path);
        const path = `contas-pagar/${editing ? editing.id : makeUuid()}/${Date.now()}-${documento.name}`;
        await uploadFile(path, documento);
        payload.documento_path = path;
        payload.documento_nome = documento.name;
        payload.documento_tamanho = documento.size;
      }

      if (editing) {
        await updateRow("contas_pagar", editing.id, payload);
      } else {
        await insertRow("contas_pagar", payload);
      }

      setModalOpen(false);
      await load();
    } catch (e) {
      window.alert("Erro ao salvar conta a pagar: " + e.message);
    }
    setSaving(false);
    submittingRef.current = false;
  }

  async function handleDelete(row) {
    if (
      !window.confirm(
        "Excluir esta conta a pagar? Essa ação não pode ser desfeita.",
      )
    )
      return;
    try {
      if (row.documento_path) await deleteFile(row.documento_path);
      await deleteRow("contas_pagar", row.id);
      await load();
    } catch (e) {
      window.alert("Erro ao excluir: " + e.message);
    }
  }

  const fornecedorNome = (row) => {
    return fornecedores.find((f) => f.id === row.fornecedor_id)?.nome || "—";
  };

  const filtered = contas.filter(
    (c) =>
      !search || JSON.stringify(c).toLowerCase().includes(search.toLowerCase()),
  );

  const PAGE_SIZE = 12;
  const totalPaginas = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const paginated = filtered.slice(
    (paginaAtual - 1) * PAGE_SIZE,
    paginaAtual * PAGE_SIZE,
  );

  const totalContas = contas.length;
  const pendentes = contas.filter((c) => c.status === "pendente").length;
  const pagas = contas.filter((c) => c.status === "pago").length;
  const valorPendente = contas
    .filter((c) => c.status === "pendente")
    .reduce((s, c) => s + Number(c.valor || 0), 0);
  const valorPago = contas
    .filter((c) => c.status === "pago")
    .reduce((s, c) => s + Number(c.valor || 0), 0);
  const valorTotal = contas.reduce((s, c) => s + Number(c.valor || 0), 0);

  return (
    <div>
      <PageHeader
        Icon={ArrowUpCircle}
        title="Contas a pagar"
        subtitle="Gerenciamento de obrigações financeiras"
      >
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              size={15}
              className="absolute left-2.5 top-2.5 text-stone-400"
            />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagina(1);
              }}
              placeholder="Buscar…"
              className="pl-8 pr-3 py-1.5 text-sm border border-stone-300 rounded-lg w-40"
            />
          </div>
          <PrimaryButton onClick={openNew}>
            <Plus size={16} /> Nova conta
          </PrimaryButton>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
        <Stat
          label="Total de contas"
          value={totalContas}
          sub={fmtCurrency(valorTotal)}
        />
        <Stat
          label="Pendentes"
          value={pendentes}
          tone="red"
          sub={fmtCurrency(valorPendente)}
        />
        <Stat
          label="Pagas"
          value={pagas}
          tone="green"
          sub={fmtCurrency(valorPago)}
        />
        <Stat
          label="Taxa de pagamento"
          value={totalContas > 0 ? `${Math.round((pagas / totalContas) * 100)}%` : "0%"}
          sub="Contas quitadas"
        />
      </div>

      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        {loading ? (
          <LoadingRows />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ArrowUpCircle}
            text="Nenhuma conta a pagar encontrada."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  <th className="text-left px-4 py-2.5 font-medium text-stone-500">
                    Fornecedor
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-stone-500">
                    Descrição
                  </th>
                  <th className="text-right px-4 py-2.5 font-medium text-stone-500">
                    Valor
                  </th>
                  <th className="text-center px-4 py-2.5 font-medium text-stone-500">
                    Vencimento
                  </th>
                  <th className="text-center px-4 py-2.5 font-medium text-stone-500">
                    Status
                  </th>
                  <th className="text-center px-4 py-2.5 font-medium text-stone-500">
                    Documento
                  </th>
                  <th className="text-center px-4 py-2.5 font-medium text-stone-500">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={
                      idx % 2 === 0
                        ? "bg-white"
                        : "bg-stone-50"
                    }
                  >
                    <td className="px-4 py-3 text-stone-900 font-medium truncate">
                      {fornecedorNome(row)}
                    </td>
                    <td className="px-4 py-3 text-stone-700 truncate max-w-xs">
                      {row.descricao}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {fmtCurrency(row.valor)}
                    </td>
                    <td className="px-4 py-3 text-center text-stone-600">
                      {fmtDate(row.data_vencimento)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge tone={STATUS_TONE[row.status]}>
                        {STATUS_LABEL[row.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.documento_path ? (
                        <a
                          href={getFilePublicUrl(row.documento_path)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline truncate"
                          style={{ color: WOOD.accentDark }}
                        >
                          <FileText size={15} />
                          <span className="truncate">
                            {row.documento_nome}
                          </span>
                        </a>
                      ) : (
                        <span className="text-xs text-stone-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center space-x-1.5">
                      <button
                        onClick={() => openEdit(row)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(row)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPaginas > 1 && (
          <Pagination
            page={paginaAtual}
            totalPages={totalPaginas}
            totalItems={filtered.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPagina}
          />
        )}
      </div>

      {modalOpen && (
        <Modal onClose={() => setModalOpen(false)}>
          <div className="max-w-lg">
            <h2 className="font-display text-xl font-bold text-stone-900 mb-4">
              {editing ? "Editar conta a pagar" : "Nova conta a pagar"}
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              <Field label="Fornecedor" required>
                <ComboSelect
                  value={header.fornecedor_id}
                  onChange={(v) =>
                    setHeader((p) => ({ ...p, fornecedor_id: v }))
                  }
                  options={fornecedores.map((f) => ({
                    value: f.id,
                    label: f.nome,
                  }))}
                  placeholder="Selecione o fornecedor…"
                />
              </Field>

              <Field label="Descrição" required>
                <input
                  type="text"
                  value={header.descricao}
                  onChange={(e) =>
                    setHeader((p) => ({ ...p, descricao: e.target.value }))
                  }
                  placeholder="Ex: Compra de madeira"
                  className={inputCls}
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Valor (R$)" required>
                  <input
                    type="number"
                    step="0.01"
                    value={header.valor}
                    onChange={(e) =>
                      setHeader((p) => ({ ...p, valor: e.target.value }))
                    }
                    placeholder="0,00"
                    className={inputCls}
                  />
                </Field>

                <Field label="Status" required>
                  <select
                    value={header.status}
                    onChange={(e) =>
                      setHeader((p) => ({ ...p, status: e.target.value }))
                    }
                    className={inputCls}
                  >
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Vencimento" required>
                  <input
                    type="date"
                    value={header.data_vencimento}
                    onChange={(e) =>
                      setHeader((p) => ({
                        ...p,
                        data_vencimento: e.target.value,
                      }))
                    }
                    className={inputCls}
                  />
                </Field>

                <Field label="Data de pagamento">
                  <input
                    type="date"
                    value={header.data_pagamento}
                    onChange={(e) =>
                      setHeader((p) => ({
                        ...p,
                        data_pagamento: e.target.value,
                      }))
                    }
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Documento (PDF)">
                {editing?.documento_path && !removerDocumento && !documento ? (
                  <div className="flex items-center gap-2">
                    <a
                      href={getFilePublicUrl(editing.documento_path)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline truncate"
                      style={{ color: WOOD.accentDark }}
                    >
                      <FileText size={15} />{" "}
                      <span className="truncate">
                        {editing.documento_nome}
                      </span>
                    </a>
                    <button
                      type="button"
                      onClick={() => setRemoverDocumento(true)}
                      className="text-stone-400 hover:text-red-600 shrink-0"
                      title="Remover documento"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <label className="flex-1 flex items-center gap-2 border border-dashed border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-500 cursor-pointer hover:border-stone-400">
                      <Paperclip size={15} />
                      <span className="truncate">
                        {documento
                          ? documento.name
                          : removerDocumento
                            ? "Documento será removido — escolher novo arquivo…"
                            : "Escolher arquivo PDF…"}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          if (!f.name.toLowerCase().endsWith(".pdf")) {
                            window.alert("Selecione um arquivo PDF.");
                            return;
                          }
                          setDocumento(f);
                          setRemoverDocumento(false);
                        }}
                      />
                    </label>
                    {documento && (
                      <button
                        type="button"
                        onClick={() => setDocumento(null)}
                        className="text-stone-400 hover:text-red-600 shrink-0"
                        title="Cancelar seleção"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                )}
              </Field>

              <div className="flex gap-2 justify-end mt-5">
                <SecondaryButton onClick={() => setModalOpen(false)}>
                  Cancelar
                </SecondaryButton>
                <PrimaryButton type="submit" disabled={saving}>
                  {saving ? "Salvando…" : "Salvar conta"}
                </PrimaryButton>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}
