import React, { useState, useEffect, useCallback } from "react";
import { AlertTriangle, ArrowDownCircle, LayoutDashboard } from "lucide-react";
import { get } from "../lib/supabase";
import { fmtCurrency, fmtDate, todayISO } from "../lib/helpers";
import { Badge, LoadingRows, PageHeader, Stat } from "../components/ui";

export default function Dashboard({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [produtos, contasPagar, contasReceber, caixaAberto, movimentacoes] =
        await Promise.all([
          get("produtos", "&ativo=eq.true&order=nome.asc"),
          get("contas_pagar", "&status=eq.pendente&order=data_vencimento.asc"),
          get(
            "contas_receber",
            "&status=eq.pendente&order=data_vencimento.asc",
          ),
          get("caixa", "&status=eq.aberto"),
          get("movimentacoes_caixa", "&order=data.asc"),
        ]);
      setData({
        produtos,
        contasPagar,
        contasReceber,
        caixaAberto,
        movimentacoes,
      });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !data) return <LoadingRows />;

  const baixoEstoque = data.produtos.filter(
    (p) => Number(p.quantidade_atual) <= Number(p.estoque_minimo),
  );
  const totalPagar = data.contasPagar.reduce((s, c) => s + Number(c.valor), 0);
  const totalReceber = data.contasReceber.reduce(
    (s, c) => s + Number(c.valor),
    0,
  );
  const hoje = todayISO();
  const vencidasPagar = data.contasPagar.filter(
    (c) => c.data_vencimento < hoje,
  ).length;
  const vencidasReceber = data.contasReceber.filter(
    (c) => c.data_vencimento < hoje,
  ).length;
  const saldoCaixa = data.caixaAberto.reduce(
    (s, c) => s + Number(c.valor_abertura),
    0,
  );

  const hojeDate = new Date();
  const ultimosDias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(hojeDate);
    d.setDate(hojeDate.getDate() - (6 - i));
    const iso = d.toISOString().slice(0, 10);
    return {
      iso,
      label: d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
    };
  });
  const fluxoGrafico = ultimosDias.map((d) => {
    const doDia = data.movimentacoes.filter(
      (m) => String(m.data || "").slice(0, 10) === d.iso,
    );
    return {
      ...d,
      entradas: doDia
        .filter((m) => m.tipo === "entrada")
        .reduce((s, m) => s + Number(m.valor || 0), 0),
      saidas: doDia
        .filter((m) => m.tipo === "saida")
        .reduce((s, m) => s + Number(m.valor || 0), 0),
    };
  });
  const maxFluxo = Math.max(
    1,
    ...fluxoGrafico.flatMap((d) => [d.entradas, d.saidas]),
  );

  const receberGrafico = ultimosDias.map((d) => ({
    ...d,
    total: data.contasReceber
      .filter((c) => String(c.data_vencimento || "").slice(0, 10) === d.iso)
      .reduce((s, c) => s + Number(c.valor || 0), 0),
  }));
  const maxReceber = Math.max(1, ...receberGrafico.map((d) => d.total));

  return (
    <div>
      <PageHeader
        Icon={LayoutDashboard}
        title={`Olá, ${user.nome.split(" ")[0]}`}
        subtitle="Visão geral da Alccor hoje"
      />

      <div className="flex flex-wrap gap-3 mb-6">
        <Stat
          label="Contas a pagar (em aberto)"
          value={fmtCurrency(totalPagar)}
          tone={vencidasPagar ? "red" : "default"}
          sub={
            vencidasPagar
              ? `${vencidasPagar} vencida(s)`
              : `${data.contasPagar.length} pendente(s)`
          }
        />
        <Stat
          label="Contas a receber (em aberto)"
          value={fmtCurrency(totalReceber)}
          tone={vencidasReceber ? "amber" : "default"}
          sub={
            vencidasReceber
              ? `${vencidasReceber} vencida(s)`
              : `${data.contasReceber.length} pendente(s)`
          }
        />
        <Stat
          label="Caixa(s) aberto(s)"
          value={data.caixaAberto.length}
          tone="green"
          sub={
            data.caixaAberto.length
              ? `Abertura total ${fmtCurrency(saldoCaixa)}`
              : "Nenhum caixa aberto"
          }
        />
        <Stat
          label="Produtos com estoque baixo"
          value={baixoEstoque.length}
          tone={baixoEstoque.length ? "red" : "green"}
          sub={`de ${data.produtos.length} produtos ativos`}
        />
      </div>

      {baixoEstoque.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-xl p-4 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-red-500" />
            <h3 className="font-medium text-stone-800 text-sm">
              Produtos abaixo do estoque mínimo
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {baixoEstoque.slice(0, 8).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between text-sm border border-stone-100 rounded-lg px-3 py-2 bg-stone-50"
              >
                <span className="text-stone-700">{p.nome}</span>
                <Badge tone="red">{p.quantidade_atual}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-5">
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium text-stone-800 text-sm">
                Fluxo de caixa
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">Últimos 7 dias</p>
            </div>
            <div className="flex gap-3 text-xs text-stone-500">
              <span className="flex items-center gap-1">
                <i className="w-2 h-2 rounded-full bg-green-500" />
                Entradas
              </span>
              <span className="flex items-center gap-1">
                <i className="w-2 h-2 rounded-full bg-red-500" />
                Saídas
              </span>
            </div>
          </div>
          <div className="h-44 flex items-end gap-2 border-b border-stone-200">
            {fluxoGrafico.map((d) => (
              <div
                key={d.iso}
                className="flex-1 h-full flex items-end justify-center gap-1 group"
                title={`${d.label} — Entradas ${fmtCurrency(d.entradas)} | Saídas ${fmtCurrency(d.saidas)}`}
              >
                <div
                  className="w-3 rounded-t bg-green-500/80"
                  style={{
                    height: `${Math.max(3, (d.entradas / maxFluxo) * 100)}%`,
                  }}
                />
                <div
                  className="w-3 rounded-t bg-red-500/75"
                  style={{
                    height: `${Math.max(3, (d.saidas / maxFluxo) * 100)}%`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2 mt-2 text-[10px] text-stone-400 text-center">
            {fluxoGrafico.map((d) => (
              <span key={d.iso}>{d.label}</span>
            ))}
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium text-stone-800 text-sm">
                Contas a receber
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                Vencimentos nos últimos 7 dias
              </p>
            </div>
            <ArrowDownCircle size={18} className="text-stone-400" />
          </div>
          <div className="h-44 flex items-end gap-2 border-b border-stone-200">
            {receberGrafico.map((d) => (
              <div
                key={d.iso}
                className="flex-1 h-full flex items-end justify-center"
                title={`${d.label} — ${fmtCurrency(d.total)}`}
              >
                <div
                  className="w-full max-w-8 rounded-t bg-stone-500/80"
                  style={{
                    height: `${Math.max(3, (d.total / maxReceber) * 100)}%`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2 mt-2 text-[10px] text-stone-400 text-center">
            {receberGrafico.map((d) => (
              <span key={d.iso}>{d.label}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <h3 className="font-medium text-stone-800 text-sm mb-3">
            Próximos vencimentos — a pagar
          </h3>
          {data.contasPagar.slice(0, 5).length === 0 ? (
            <p className="text-sm text-stone-400">Nada pendente.</p>
          ) : (
            <div className="space-y-2">
              {data.contasPagar.slice(0, 5).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-stone-600">{c.descricao}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-stone-800 font-medium">
                      {fmtCurrency(c.valor)}
                    </span>
                    <Badge tone={c.data_vencimento < hoje ? "red" : "gray"}>
                      {fmtDate(c.data_vencimento)}
                    </Badge>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <h3 className="font-medium text-stone-800 text-sm mb-3">
            Próximos vencimentos — a receber
          </h3>
          {data.contasReceber.slice(0, 5).length === 0 ? (
            <p className="text-sm text-stone-400">Nada pendente.</p>
          ) : (
            <div className="space-y-2">
              {data.contasReceber.slice(0, 5).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-stone-600">{c.descricao}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-stone-800 font-medium">
                      {fmtCurrency(c.valor)}
                    </span>
                    <Badge tone={c.data_vencimento < hoje ? "amber" : "gray"}>
                      {fmtDate(c.data_vencimento)}
                    </Badge>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
