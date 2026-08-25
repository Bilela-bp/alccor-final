-- =========================================================
-- MIGRAÇÃO 003:
--  1) CNPJ obrigatório em fornecedores
--  2) campo "unidade" deixa de ser obrigatório em produtos
--  3) preço de custo passa a ser recalculado automaticamente pela
--     média ponderada sempre que uma nota fiscal dá entrada no estoque
-- Rode isso no SQL Editor do Supabase (depois do migration.sql e do
-- migration_002_clientes.sql).
-- =========================================================

-- ---------- 1) CNPJ em fornecedores ----------
alter table fornecedores add column if not exists cnpj text;
update fornecedores set cnpj = '00000000000000' where cnpj is null or cnpj = '';
alter table fornecedores alter column cnpj set not null;

-- ---------- 2) "unidade" deixa de ser obrigatório em produtos ----------
alter table produtos alter column unidade drop not null;
alter table produtos alter column unidade set default 'un';

-- ---------- 3) custo médio ponderado na entrada de nota fiscal ----------
create or replace function fn_entrada_estoque_nota_fiscal()
returns trigger as $$
declare
  v_numero text;
  v_usuario_id uuid;
  v_estoque_atual numeric;
  v_custo_atual numeric;
  v_novo_custo numeric;
begin
  select numero, usuario_id into v_numero, v_usuario_id
  from notas_fiscais where id = new.nota_fiscal_id;

  select quantidade_atual, preco_custo into v_estoque_atual, v_custo_atual
  from produtos where id = new.produto_id
  for update; -- trava a linha para evitar condição de corrida em lançamentos simultâneos

  v_estoque_atual := coalesce(v_estoque_atual, 0);
  v_custo_atual := coalesce(v_custo_atual, 0);

  if (v_estoque_atual + new.quantidade) > 0 then
    -- média ponderada: (estoque atual x custo atual + entrada x custo da entrada) / total
    v_novo_custo := ((v_estoque_atual * v_custo_atual) + (new.quantidade * new.preco_unitario))
                     / (v_estoque_atual + new.quantidade);
  else
    v_novo_custo := new.preco_unitario;
  end if;

  update produtos
    set quantidade_atual = v_estoque_atual + new.quantidade,
        preco_custo = round(v_novo_custo, 2),
        atualizado_em = now()
    where id = new.produto_id;

  insert into movimentacoes_estoque
    (id, produto_id, tipo, quantidade, motivo, usuario_id, data, observacao)
  values
    (gen_random_uuid(), new.produto_id, 'entrada', new.quantidade,
     'Nota Fiscal ' || coalesce(v_numero, ''), v_usuario_id, now(),
     'Gerado automaticamente pela nota fiscal — custo médio recalculado');

  return new;
end;
$$ language plpgsql;

-- (o gatilho em si já existe, criado no migration.sql — só a função mudou)
