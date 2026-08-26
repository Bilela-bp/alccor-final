import React, { useState, useEffect, useCallback, useRef } from "react";
import { CalendarCheck, Pencil } from "lucide-react";
import { get, insertRow, updateRow } from "../lib/supabase";
import { fmtCurrency, monthISO, todayISO } from "../lib/helpers";
import {
  Badge,
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

export default function FolhaPage() {
  const gerarRef = useRef(false);
  const editRef = useRef(false);
  const [folhas, setFolhas] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mesGerar, setMesGerar] = useState(monthISO());
  const [gerando, setGerando] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    bonus: 0,
    descontos: 0,
    status: "aberta",
    data_pagamento: "",
  });
  const [pagina, setPagina] = useState(1);
  const PAGE_SIZE = 12;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [f, fu] = await Promise.all([
        get("folha_pagamento", "&order=mes_referencia.desc"),
        get("funcionarios", "&order=nome.asc"),
      ]);
      setFolhas(f || []);
      setFuncionarios(fu || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  const totalPaginas = Math.max(1, Math.ceil(folhas.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const paginatedFolhas = folhas.slice(
    (paginaAtual - 1) * PAGE_SIZE,
    paginaAtual * PAGE_SIZE,
  );

  const nomeFunc = (id) => funcionarios.find((f) => f.id === id)?.nome || "—";

  async function gerarFolha() {
    if (gerarRef.current) return;
    gerarRef.current = true;
    setGerando(true);
    const ativos = funcionarios.filter((f) => f.ativo);
    let criados = 0,
      existentes = 0;
    for (const f of ativos) {
      try {
        await insertRow("folha_pagamento", {
          funcionario_id: f.id,
          mes_referencia: mesGerar,
          salario_base: f.salario_base,
          bonus: 0,
          descontos: 0,
          status: "aberta",
        });
        criados++;
      } catch (e) {
        existentes++;
      }
    }
    setGerando(false);
    gerarRef.current = false;
    await load();
    window.alert(
      `Folha gerada: ${criados} novo(s) lançamento(s). ${existentes} já existiam para esse mês.`,
    );
  }

  function openEdit(row) {
    setEditing(row);
    setForm({
      bonus: row.bonus,
      descontos: row.descontos,
      status: row.status,
      data_pagamento: row.data_pagamento || "",
    });
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (editRef.current) return;
    editRef.current = true;
    try {
      await updateRow("folha_pagamento", editing.id, {
        bonus: Number(form.bonus) || 0,
        descontos: Number(form.descontos) || 0,
        status: form.status,
        data_pagamento:
          form.status === "paga"
            ? form.data_pagamento || todayISO()
            : form.data_pagamento || null,
      });
      setEditing(null);
      await load();
    } catch (e) {
      window.alert("Erro ao salvar: " + e.message);
    }
    editRef.current = false;
  }

  const statusTone = { aberta: "amber", fechada: "blue", paga: "green" };

  return (
    <div>
      <PageHeader
        Icon={CalendarCheck}
        title="Folha de pagamento"
        subtitle="Fechamento mensal por funcionário"
      >
        <div className="flex items-center gap-2">
          <input
            type="month"
            className={inputCls}
            value={mesGerar.slice(0, 7)}
            onChange={(e) => setMesGerar(e.target.value + "-01")}
          />
          <PrimaryButton onClick={gerarFolha} disabled={gerando}>
            {gerando ? "Gerando…" : "Gerar folha do mês"}
          </PrimaryButton>
        </div>
      </PageHeader>

      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        {loading ? (
          <LoadingRows />
        ) : folhas.length === 0 ? (
          <EmptyState icon={CalendarCheck} text="Nenhuma folha gerada ainda." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">
                  Funcionário
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">
                  Mês
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">
                  Salário base
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">
                  Bônus
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">
                  Descontos
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">
                  Líquido
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">
                  Status
                </th>
                <th className="px-4 py-2.5 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {paginatedFolhas.map((f) => (
                <tr
                  key={f.id}
                  className="border-b border-stone-100 last:border-0 hover:bg-stone-50"
                >
                  <td className="px-4 py-2.5 text-stone-800 font-medium">
                    {nomeFunc(f.funcionario_id)}
                  </td>
                  <td className="px-4 py-2.5 text-stone-700">
                    {new Date(
                      f.mes_referencia + "T00:00:00",
                    ).toLocaleDateString("pt-BR", {
                      month: "long",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-2.5 text-stone-700">
                    {fmtCurrency(f.salario_base)}
                  </td>
                  <td className="px-4 py-2.5 text-green-700">
                    {fmtCurrency(f.bonus)}
                  </td>
                  <td className="px-4 py-2.5 text-red-600">
                    {fmtCurrency(f.descontos)}
                  </td>
                  <td className="px-4 py-2.5 text-stone-900 font-semibold">
                    {fmtCurrency(f.salario_liquido)}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={statusTone[f.status]}>{f.status}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => openEdit(f)}
                      className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                    >
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && folhas.length > 0 && (
          <Pagination
            page={paginaAtual}
            totalPages={totalPaginas}
            totalItems={folhas.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPagina}
          />
        )}
      </div>

      {editing && (
        <Modal
          title={`Editar folha — ${nomeFunc(editing.funcionario_id)}`}
          onClose={() => setEditing(null)}
        >
          <form
            onSubmit={saveEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.target.tagName !== "TEXTAREA")
                e.preventDefault();
            }}
          >
            <Field label="Bônus">
              <input
                type="number"
                step="any"
                className={inputCls}
                value={form.bonus}
                onChange={(e) => setForm({ ...form, bonus: e.target.value })}
              />
            </Field>
            <Field label="Descontos">
              <input
                type="number"
                step="any"
                className={inputCls}
                value={form.descontos}
                onChange={(e) =>
                  setForm({ ...form, descontos: e.target.value })
                }
              />
            </Field>
            <Field label="Status">
              <select
                className={inputCls}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="aberta">Aberta</option>
                <option value="fechada">Fechada</option>
                <option value="paga">Paga</option>
              </select>
            </Field>
            {form.status === "paga" && (
              <Field label="Data de pagamento">
                <input
                  type="date"
                  className={inputCls}
                  value={form.data_pagamento}
                  onChange={(e) =>
                    setForm({ ...form, data_pagamento: e.target.value })
                  }
                />
              </Field>
            )}
            <div className="flex gap-2 justify-end mt-2">
              <SecondaryButton onClick={() => setEditing(null)}>
                Cancelar
              </SecondaryButton>
              <PrimaryButton type="submit">Salvar</PrimaryButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
