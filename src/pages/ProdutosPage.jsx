import React from "react";
import { Package } from "lucide-react";
import EntityPage from "../components/EntityPage";

export default function ProdutosPage() {
  return (
    <EntityPage
      table="produtos"
      title="Estoque"
      Icon={Package}
      subtitle="Produtos e níveis de estoque"
      fields={[
        { key: "nome", label: "Nome", required: true },
        { key: "categoria", label: "Grupo", type: "grupo" },
        {
          key: "preco_custo",
          label: "Preço de custo (R$)",
          type: "number",
          currency: true,
          hint: "Definido automaticamente pela média ponderada a cada nota fiscal lançada (fica 0 até a primeira entrada). Edite manualmente só se precisar corrigir.",
        },
        {
          key: "quantidade_atual",
          label: "Estoque atual",
          type: "number",
          hint: "Some via nota fiscal — normalmente não precisa preencher na hora do cadastro.",
        },
        {
          key: "estoque_minimo",
          label: "Avisar quando o estoque chegar em",
          type: "number",
          hint: "Quando a quantidade em estoque cair para esse valor (ou menos), o produto aparece em um alerta no Painel.",
        },
        { key: "ativo", label: "Ativo", type: "boolean" },
        {
          key: "descricao",
          label: "Descrição",
          type: "textarea",
          showInList: false,
        },
      ]}
    />
  );
}
