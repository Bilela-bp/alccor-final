import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Check,
  ClipboardList,
  FileArchive,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
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
// ORÇAMENTOS (dados do cliente, valor final e anexo do projeto em zip)
// =========================================================================

const STATUS_LABEL = {
  orcamento: "Orçamento",
  em_andamento: "Em andamento",
  concluido: "Projeto concluído",
};

const STATUS_TONE = {
  orcamento: "amber",
  em_andamento: "green",
  concluido: "blue",
};

const PROXIMO_STATUS = {
  orcamento: "em_andamento",
  em_andamento: "concluido",
  concluido: "orcamento",
};

function formatBytes(bytes) {
  if (!bytes) return "";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export default function OrcamentosPage({ user }) {
  const submittingRef = useRef(false);
  const [orcamentos, setOrcamentos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pagina, setPagina] = useState(1);

  const [header, setHeader] = useState({
    cliente_id: "",
    data: todayISO(),
    descricao: "",
    status: "orcamento",
    valor_total: "",
    cliente_temporario_nome: "",
    cliente_temporario_telefone: "",
  });
  const [clienteSemCadastro, setClienteSemCadastro] = useState(false); // toggle para cliente sem cadastro
  const [arquivo, setArquivo] = useState(null); // novo arquivo escolhido (File) para enviar
  const [removerArquivo, setRemoverArquivo] = useState(false); // marca que o anexo existente deve ser removido
  
  // Estados para modal de migração de cliente temporário
  const [modalMigrarCliente, setModalMigrarCliente] = useState(false);
  const [orcamentoParaMigrar, setOrcamentoParaMigrar] = useState(null);
  const [tipoDocumento, setTipoDocumento] = useState("cpf");
  const [documento, setDocumento] = useState("");
  const [criandoCliente, setCriandoCliente] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, c] = await Promise.all([
        get("orcamentos", "&order=data.desc,criado_em.desc"),
        get("clientes", "&order=nome.asc"),
      ]);
      setOrcamentos(o || []);
      setClientes(c || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setEditing(null);
    setHeader({
      cliente_id: "",
      data: todayISO(),
      descricao: "",
      status: "orcamento",
      valor_total: "",
      cliente_temporario_nome: "",
      cliente_temporario_telefone: "",
    });
    setClienteSemCadastro(false);
    setArquivo(null);
    setRemoverArquivo(false);
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    const isClienteTemp = !row.cliente_id && row.cliente_temporario_nome;
    setHeader({
      cliente_id: row.cliente_id || "",
      data: row.data || todayISO(),
      descricao: row.descricao || "",
      status: row.status || "orcamento",
      valor_total: row.valor_total ?? "",
      cliente_temporario_nome: row.cliente_temporario_nome || "",
      cliente_temporario_telefone: row.cliente_temporario_telefone || "",
    });
    setClienteSemCadastro(isClienteTemp);
    setArquivo(null);
    setRemoverArquivo(false);
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (submittingRef.current) return; // evita lançamento duplicado (duplo clique / Enter + clique)
    
    // Validação de cliente
    if (!clienteSemCadastro && !header.cliente_id) {
      window.alert("Selecione o cliente ou ative 'Cliente sem cadastro'.");
      return;
    }
    
    if (clienteSemCadastro && !header.cliente_temporario_nome?.trim()) {
      window.alert("Informe o nome do cliente.");
      return;
    }
    
    if (clienteSemCadastro && !header.cliente_temporario_telefone?.trim()) {
      window.alert("Informe o telefone do cliente.");
      return;
    }
    
    if (header.valor_total === "" || Number(header.valor_total) < 0) {
      window.alert("Informe o valor final do orçamento.");
      return;
    }

    submittingRef.current = true;
    setSaving(true);
    try {
      const payload = {
        data: header.data,
        descricao: header.descricao || null,
        status: header.status,
        valor_total: Number(header.valor_total),
        usuario_id: user.id,
      };

      if (clienteSemCadastro) {
        payload.cliente_id = null;
        payload.cliente_temporario_nome = header.cliente_temporario_nome;
        payload.cliente_temporario_telefone = header.cliente_temporario_telefone;
      } else {
        payload.cliente_id = header.cliente_id;
        payload.cliente_temporario_nome = null;
        payload.cliente_temporario_telefone = null;
      }

      // Remoção do anexo existente (sem enviar um novo no lugar)
      if (removerArquivo && editing?.arquivo_projeto_path) {
        await deleteFile(editing.arquivo_projeto_path);
        payload.arquivo_projeto_path = null;
        payload.arquivo_projeto_nome = null;
        payload.arquivo_projeto_tamanho = null;
      }

      // Upload de um novo arquivo (substitui o anterior, se houver)
      if (arquivo) {
        if (editing?.arquivo_projeto_path)
          await deleteFile(editing.arquivo_projeto_path);
        const path = `${editing ? editing.id : makeUuid()}/${Date.now()}-${arquivo.name}`;
        await uploadFile(path, arquivo);
        payload.arquivo_projeto_path = path;
        payload.arquivo_projeto_nome = arquivo.name;
        payload.arquivo_projeto_tamanho = arquivo.size;
      }

      if (editing) {
        await updateRow("orcamentos", editing.id, payload);
      } else {
        await insertRow("orcamentos", payload);
      }

      setModalOpen(false);
      await load();
    } catch (e) {
      window.alert("Erro ao salvar orçamento: " + e.message);
    }
    setSaving(false);
    submittingRef.current = false;
  }

  async function handleDelete(row) {
    if (
      !window.confirm(
        "Excluir este orçamento? Essa ação não pode ser desfeita.",
      )
    )
      return;
    try {
      if (row.arquivo_projeto_path) await deleteFile(row.arquivo_projeto_path);
      await deleteRow("orcamentos", row.id);
      await load();
    } catch (e) {
      window.alert("Erro ao excluir: " + e.message);
    }
  }

  async function avancarStatus(row) {
    // Se é cliente temporário e vai para "em_andamento", precisa criar o cliente
    if (row.cliente_temporario_nome && row.status === "orcamento") {
      setOrcamentoParaMigrar(row);
      setTipoDocumento("cpf");
      setDocumento("");
      setModalMigrarCliente(true);
      return;
    }

    // Caso contrário, apenas avança o status
    try {
      await updateRow("orcamentos", row.id, {
        status: PROXIMO_STATUS[row.status] || "orcamento",
      });
      await load();
    } catch (e) {
      window.alert("Erro ao atualizar status: " + e.message);
    }
  }

  async function migraClienteTemporario() {
    if (!documento.trim()) {
      window.alert("Informe o " + (tipoDocumento === "cpf" ? "CPF" : "CNPJ") + ".");
      return;
    }

    // Validação básica de CPF/CNPJ (sem pontuação)
    const apenasNumeros = documento.replace(/\D/g, "");
    if (tipoDocumento === "cpf" && apenasNumeros.length !== 11) {
      window.alert("CPF deve ter 11 dígitos.");
      return;
    }
    if (tipoDocumento === "cnpj" && apenasNumeros.length !== 14) {
      window.alert("CNPJ deve ter 14 dígitos.");
      return;
    }

    setCriandoCliente(true);
    try {
      // 1. Criar novo cliente com dados do cliente temporário + documento
      const clientesInseridos = await insertRow("clientes", {
        nome: orcamentoParaMigrar.cliente_temporario_nome,
        telefone: orcamentoParaMigrar.cliente_temporario_telefone,
        tipo_documento: tipoDocumento,
        documento: apenasNumeros,
      });

      if (!clientesInseridos || !clientesInseridos[0] || !clientesInseridos[0].id) {
        throw new Error("Falha ao criar cliente");
      }

      const novoClienteId = clientesInseridos[0].id;

      // 2. Atualizar orçamento com o novo cliente_id e limpar campos temporários
      await updateRow("orcamentos", orcamentoParaMigrar.id, {
        cliente_id: novoClienteId,
        cliente_temporario_nome: null,
        cliente_temporario_telefone: null,
        status: "em_andamento", // Avança automaticamente para em_andamento
      });

      setModalMigrarCliente(false);
      setOrcamentoParaMigrar(null);
      await load();
    } catch (e) {
      window.alert("Erro ao migrar cliente: " + e.message);
    }
    setCriandoCliente(false);
  }

  const clienteNome = (row) => {
    if (row.cliente_temporario_nome) {
      return `${row.cliente_temporario_nome} (sem cadastro)`;
    }
    return clientes.find((c) => c.id === row.cliente_id)?.nome || "—";
  };
  const filtered = orcamentos.filter(
    (o) =>
      !search || JSON.stringify(o).toLowerCase().includes(search.toLowerCase()),
  );
  const PAGE_SIZE = 12;
  const totalPaginas = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const paginated = filtered.slice(
    (paginaAtual - 1) * PAGE_SIZE,
    paginaAtual * PAGE_SIZE,
  );

  const totalOrcamentos = orcamentos.length;
  const emAndamento = orcamentos.filter(
    (o) => o.status === "em_andamento",
  ).length;
  const concluidos = orcamentos.filter((o) => o.status === "concluido").length;
  const taxaConversao =
    totalOrcamentos > 0
      ? Math.round(((emAndamento + concluidos) / totalOrcamentos) * 100)
      : 0;
  const valorEmAndamento = orcamentos
    .filter((o) => o.status === "em_andamento")
    .reduce((s, o) => s + Number(o.valor_total || 0), 0);
  const valorConcluido = orcamentos
    .filter((o) => o.status === "concluido")
    .reduce((s, o) => s + Number(o.valor_total || 0), 0);
  const valorTotalOrcado = orcamentos.reduce(
    (s, o) => s + Number(o.valor_total || 0),
    0,
  );

  return (
    <div>
      <PageHeader
        Icon={ClipboardList}
        title="Orçamentos"
        subtitle="Propostas para clientes e acompanhamento de conversão"
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
            <Plus size={16} /> Novo orçamento
          </PrimaryButton>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
        <Stat
          label="Orçamentos criados"
          value={totalOrcamentos}
          sub={fmtCurrency(valorTotalOrcado)}
        />
        <Stat
          label="Em andamento"
          value={emAndamento}
          tone="amber"
          sub={fmtCurrency(valorEmAndamento)}
        />
        <Stat
          label="Projetos concluídos"
          value={concluidos}
          tone="green"
          sub={fmtCurrency(valorConcluido)}
        />
        <Stat
          label="Taxa de conversão"
          value={`${taxaConversao}%`}
          sub="Orçamentos que viraram projeto"
        />
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-5 mb-4">
        <h3 className="font-display text-base font-semibold text-stone-900 mb-4">
          Comparativo: orçamentos × projetos iniciados
        </h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs text-stone-500 mb-1">
              <span>Orçamentos criados</span>
              <span>{totalOrcamentos}</span>
            </div>
            <div className="h-3 rounded-full bg-stone-100 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: "100%", backgroundColor: "#D6D3D1" }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-stone-500 mb-1">
              <span>Em andamento ou concluídos</span>
              <span>{emAndamento + concluidos}</span>
            </div>
            <div className="h-3 rounded-full bg-stone-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${taxaConversao}%`,
                  backgroundColor: WOOD.accent,
                }}
              />
            </div>
          </div>
        </div>
        <p className="text-xs text-stone-400 mt-3">
          {totalOrcamentos === 0
            ? "Nenhum orçamento lançado ainda."
            : `${emAndamento + concluidos} de ${totalOrcamentos} orçamento(s) viraram projeto — taxa de conversão de ${taxaConversao}%.`}
        </p>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        {loading ? (
          <LoadingRows />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            text="Nenhum orçamento encontrado."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  <th className="text-left px-4 py-2.5 font-medium text-stone-500">
                    Cliente
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-stone-500">
                    Descrição
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-stone-500">
                    Data
                  </th>
                  <th className="text-right px-4 py-2.5 font-medium text-stone-500">
                    Valor
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-stone-500">
                    Status
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-stone-500">
                    Projeto
                  </th>
                  <th className="px-4 py-2.5 w-32"></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-stone-100 last:border-0 hover:bg-stone-50"
                  >
                    <td className="px-4 py-2.5 font-medium text-stone-800">
                      {clienteNome(o)}
                    </td>
                    <td className="px-4 py-2.5 text-stone-700 align-top whitespace-normal break-words max-w-[220px]">
                      {o.descricao || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-stone-700">
                      {fmtDate(o.data)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-stone-800">
                      {fmtCurrency(o.valor_total)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={STATUS_TONE[o.status] || "gray"}>
                        {STATUS_LABEL[o.status] || o.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      {o.arquivo_projeto_path ? (
                        <a
                          href={getFilePublicUrl(o.arquivo_projeto_path)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
                          style={{ color: WOOD.accentDark }}
                          title={o.arquivo_projeto_nome}
                        >
                          <FileArchive size={14} />{" "}
                          {formatBytes(o.arquivo_projeto_tamanho) || "baixar"}
                        </a>
                      ) : (
                        <span className="text-xs text-stone-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => avancarStatus(o)}
                          title={`Marcar como "${STATUS_LABEL[PROXIMO_STATUS[o.status] || "orcamento"]}"`}
                          className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                        >
                          {o.status === "concluido" ? (
                            <RefreshCw size={15} />
                          ) : (
                            <Check size={15} />
                          )}
                        </button>
                        <button
                          onClick={() => openEdit(o)}
                          className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(o)}
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
          </div>
        )}
        {!loading && filtered.length > 0 && (
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
        <Modal
          title={editing ? "Editar orçamento" : "Novo orçamento"}
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={handleSave}>
            <div className="mb-4 p-3 bg-stone-50 rounded-lg border border-stone-200">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="clienteSemCadastro"
                  checked={clienteSemCadastro}
                  onChange={(e) => {
                    setClienteSemCadastro(e.target.checked);
                    setHeader({
                      ...header,
                      cliente_id: e.target.checked ? "" : header.cliente_id,
                      cliente_temporario_nome: "",
                      cliente_temporario_telefone: "",
                    });
                  }}
                  className="w-4 h-4 cursor-pointer"
                />
                <label htmlFor="clienteSemCadastro" className="text-sm font-medium text-stone-700 cursor-pointer">
                  Cliente sem cadastro no sistema
                </label>
              </div>
              <p className="text-xs text-stone-500 mt-1.5 ml-7">
                Ative esta opção para criar orçamentos com clientes que ainda não estão cadastrados no sistema.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {clienteSemCadastro ? (
                <>
                  <Field label="Nome do cliente" required>
                    <input
                      type="text"
                      className={inputCls}
                      required
                      placeholder="Nome completo"
                      value={header.cliente_temporario_nome}
                      onChange={(e) =>
                        setHeader({ ...header, cliente_temporario_nome: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Telefone" required>
                    <input
                      type="tel"
                      className={inputCls}
                      required
                      placeholder="(11) 99999-9999"
                      value={header.cliente_temporario_telefone}
                      onChange={(e) =>
                        setHeader({ ...header, cliente_temporario_telefone: e.target.value })
                      }
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Cliente" required>
                    <ComboSelect
                      options={clientes.map((c) => ({ id: c.id, label: c.nome }))}
                      value={header.cliente_id}
                      onChange={(id) => setHeader({ ...header, cliente_id: id })}
                      placeholder="Buscar cliente…"
                    />
                  </Field>
                </>
              )}
              <Field label="Data" required>
                <input
                  type="date"
                  className={inputCls}
                  required
                  value={header.data}
                  onChange={(e) =>
                    setHeader({ ...header, data: e.target.value })
                  }
                />
              </Field>
              <Field
                label="Descrição"
                hint="Ex: Reforma cozinha, Móvel planejado sala…"
              >
                <input
                  className={inputCls}
                  value={header.descricao}
                  onChange={(e) =>
                    setHeader({ ...header, descricao: e.target.value })
                  }
                />
              </Field>
              <Field label="Status" required>
                <select
                  className={inputCls}
                  value={header.status}
                  onChange={(e) =>
                    setHeader({ ...header, status: e.target.value })
                  }
                >
                  <option value="orcamento">Orçamento</option>
                  <option value="em_andamento">Em andamento</option>
                  <option value="concluido">Projeto concluído</option>
                </select>
              </Field>
              <Field
                label="Valor final (R$)"
                required
                hint="Valor total combinado com o cliente."
              >
                <input
                  type="number"
                  step="any"
                  min="0"
                  className={inputCls}
                  required
                  value={header.valor_total}
                  onChange={(e) =>
                    setHeader({ ...header, valor_total: e.target.value })
                  }
                />
              </Field>
              <Field
                label="Projeto (arquivo .zip)"
                hint="Anexe o projeto completo compactado em .zip."
              >
                {editing?.arquivo_projeto_path &&
                !removerArquivo &&
                !arquivo ? (
                  <div className="flex items-center justify-between gap-2 border border-stone-200 rounded-lg px-3 py-2 bg-stone-50">
                    <a
                      href={getFilePublicUrl(editing.arquivo_projeto_path)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline truncate"
                      style={{ color: WOOD.accentDark }}
                    >
                      <FileArchive size={15} />{" "}
                      <span className="truncate">
                        {editing.arquivo_projeto_nome}
                      </span>
                    </a>
                    <button
                      type="button"
                      onClick={() => setRemoverArquivo(true)}
                      className="text-stone-400 hover:text-red-600 shrink-0"
                      title="Remover anexo"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <label className="flex-1 flex items-center gap-2 border border-dashed border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-500 cursor-pointer hover:border-stone-400">
                      <Paperclip size={15} />
                      <span className="truncate">
                        {arquivo
                          ? arquivo.name
                          : removerArquivo
                            ? "Anexo será removido — escolher novo arquivo…"
                            : "Escolher arquivo .zip…"}
                      </span>
                      <input
                        type="file"
                        accept=".zip,application/zip,application/x-zip-compressed"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          if (!f.name.toLowerCase().endsWith(".zip")) {
                            window.alert("Selecione um arquivo .zip.");
                            return;
                          }
                          setArquivo(f);
                          setRemoverArquivo(false);
                        }}
                      />
                    </label>
                    {arquivo && (
                      <button
                        type="button"
                        onClick={() => setArquivo(null)}
                        className="text-stone-400 hover:text-red-600 shrink-0"
                        title="Cancelar seleção"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                )}
              </Field>
            </div>

            <div className="flex gap-2 justify-end mt-5">
              <SecondaryButton onClick={() => setModalOpen(false)}>
                Cancelar
              </SecondaryButton>
              <PrimaryButton type="submit" disabled={saving}>
                {saving ? "Salvando…" : "Salvar orçamento"}
              </PrimaryButton>
            </div>
          </form>
        </Modal>
      )}

      {modalMigrarCliente && orcamentoParaMigrar && (
        <Modal onClose={() => setModalMigrarCliente(false)}>
          <div className="max-w-lg">
            <h2 className="font-display text-xl font-bold text-stone-900 mb-2">
              Cadastrar cliente
            </h2>
            <p className="text-sm text-stone-600 mb-4">
              O orçamento de <strong>{orcamentoParaMigrar.cliente_temporario_nome}</strong> será convertido em projeto. Informe o CPF ou CNPJ do cliente.
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Tipo de documento" required>
                  <select
                    value={tipoDocumento}
                    onChange={(e) => setTipoDocumento(e.target.value)}
                    className={inputCls}
                  >
                    <option value="cpf">CPF</option>
                    <option value="cnpj">CNPJ</option>
                  </select>
                </Field>

                <Field label={tipoDocumento === "cpf" ? "CPF" : "CNPJ"} required>
                  <input
                    type="text"
                    value={documento}
                    onChange={(e) => setDocumento(e.target.value)}
                    placeholder={tipoDocumento === "cpf" ? "00000000000" : "00000000000000"}
                    className={inputCls}
                    maxLength={tipoDocumento === "cpf" ? 11 : 14}
                  />
                </Field>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800">
                  <strong>Atenção:</strong> Ao confirmar, o cliente será cadastrado e o orçamento avançará para "Em andamento".
                </p>
              </div>

              <div className="flex gap-2 justify-end mt-5">
                <SecondaryButton onClick={() => setModalMigrarCliente(false)}>
                  Cancelar
                </SecondaryButton>
                <PrimaryButton onClick={migraClienteTemporario} disabled={criandoCliente}>
                  {criandoCliente ? "Cadastrando…" : "Confirmar e avançar"}
                </PrimaryButton>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
