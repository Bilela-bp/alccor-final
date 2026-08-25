-- =========================================================
-- MIGRAÇÃO 006: corrige a duplicação de quantidade ao lançar nota fiscal
--
-- Causa raiz: já existia no banco uma função/gatilho "atualizar_estoque()"
-- (na tabela movimentacoes_estoque) que soma/subtrai o estoque sempre que
-- um registro é inserido ali. As nossas funções de nota fiscal TAMBÉM
-- atualizavam produtos.quantidade_atual diretamente E inseriam um registro
-- em movimentacoes_estoque — o que acionava a função acima de novo,
-- contando a mesma entrada duas vezes.
--
-- Esta migração corrige isso: nossas funções deixam de mexer em
-- quantidade_atual diretamente (isso fica só por conta da função
-- atualizar_estoque(), que já existia) e continuam responsáveis apenas
-- pelo cálculo do custo médio ponderado.
-- =========================================================

create or replace function fn_entrada_estoque_nota_fiscal()
returns trigger as $$
declare
  v_numero text;
  v_usuario_id uuid;
  v_qtd_atual numeric;
  v_custo_atual numeric;
  v_nova_qtd numeric;
  v_novo_custo numeric;
begin
  select numero, usuario_id into v_numero, v_usuario_id
  from notas_fiscais where id = new.nota_fiscal_id;

  -- trava a linha do produto para ler o estoque/custo atuais com segurança
  select quantidade_atual, preco_custo into v_qtd_atual, v_custo_atual
  from produtos where id = new.produto_id
  for update;

  v_nova_qtd := coalesce(v_qtd_atual, 0) + new.quantidade;

  if v_nova_qtd > 0 then
    v_novo_custo := (
      (coalesce(v_qtd_atual, 0) * coalesce(v_custo_atual, 0)) + (new.quantidade * new.preco_unitario)
    ) / v_nova_qtd;
  else
    v_novo_custo := new.preco_unitario;
  end if;

  -- só atualiza o CUSTO aqui. A quantidade é atualizada pela função
  -- atualizar_estoque(), que dispara automaticamente pelo insert abaixo.
  update produtos
    set preco_custo = round(v_novo_custo, 2),
        atualizado_em = now()
    where id = new.produto_id;

  insert into movimentacoes_estoque
    (id, produto_id, tipo, quantidade, motivo, usuario_id, data, observacao)
  values
    (gen_random_uuid(), new.produto_id, 'entrada', new.quantidade,
     'Nota Fiscal ' || coalesce(v_numero, ''), v_usuario_id, now(),
     'Gerado automaticamente pela nota fiscal — custo atualizado para ' || round(v_novo_custo, 2));

  return new;
end;
$$ language plpgsql;

create or replace function fn_estorno_estoque_nota_fiscal()
returns trigger as $$
begin
  -- só registra a saída no log. A quantidade é ajustada pela função
  -- atualizar_estoque(), que dispara automaticamente pelo insert abaixo.
  insert into movimentacoes_estoque
    (id, produto_id, tipo, quantidade, motivo, data, observacao)
  values
    (gen_random_uuid(), old.produto_id, 'saida', old.quantidade,
     'Estorno de item de nota fiscal', now(),
     'Gerado automaticamente ao excluir item da nota');

  return old;
end;
$$ language plpgsql;
