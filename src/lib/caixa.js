import { deleteRow, get, insertRow, updateRow } from "./supabase";

async function movimentoDaOrigem(origemTabela, origemId) {
  const rows = await get(
    "movimentacoes_caixa",
    `&origem_tabela=eq.${encodeURIComponent(origemTabela)}&origem_id=eq.${encodeURIComponent(origemId)}&limit=1`,
  );
  return rows?.[0] || null;
}

export async function sincronizarMovimentoCaixa({
  origemTabela,
  origemId,
  deveLancar,
  tipo,
  valor,
  formaPagamento = "transferencia",
  categoria,
  descricao,
  clienteId = null,
  fornecedorId = null,
  usuarioId = null,
  data,
}) {
  const existente = await movimentoDaOrigem(origemTabela, origemId);

  if (!deveLancar) {
    if (existente) await deleteRow("movimentacoes_caixa", existente.id);
    return;
  }

  const payload = {
    tipo,
    valor: Number(valor),
    forma_pagamento: formaPagamento,
    categoria,
    descricao,
    cliente_id: clienteId,
    fornecedor_id: fornecedorId,
    usuario_id: usuarioId,
    data: data || new Date().toISOString(),
    origem_tabela: origemTabela,
    origem_id: origemId,
  };

  if (existente) {
    await updateRow("movimentacoes_caixa", existente.id, payload);
    return;
  }

  const abertos = await get(
    "caixa",
    "&status=eq.aberto&order=data_abertura.desc&limit=1",
  );
  if (!abertos?.length) {
    window.alert(
      "Movimentação registrada, mas não há caixa aberto agora. Abra um caixa e lance essa movimentação manualmente.",
    );
    return;
  }

  await insertRow("movimentacoes_caixa", {
    caixa_id: abertos[0].id,
    ...payload,
  });
}