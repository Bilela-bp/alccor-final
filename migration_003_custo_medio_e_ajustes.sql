-- =========================================================
-- MIGRAÇÃO 003:
--  1) CNPJ obrigatório no cadastro de fornecedores
--  2) remove a coluna "unidade" de produtos (não fazia mais sentido)
--  3) corrige o gatilho de entrada por nota fiscal para recalcular
--     o preço de custo pela MÉDIA PONDERADA (e não só somar estoque)
-- Rode isso no SQL Editor do Supabase, depois das migrações anteriores.
-- =========================================================

-- ---------- 1) CNPJ em fornecedores ----------
alter table fornecedores add column if not exists cnpj text;
update fornecedores set cnpj = '00000000000000' where cnpj is null or cnpj = '';
alter table fornecedores alter column cnpj set not null;

-- ---------- 2) remove coluna "unidade" de produtos ----------
alter table produtos drop column if exists unidade;

-- ---------- 3) gatilho de entrada com custo médio ponderado ----------
-- Exemplo: 1 unidade em estoque a R$50 de custo + compra de mais 1 a R$30
-- => novo custo = (1*50 + 1*30) / (1+1) = R$40
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

  -- trava a linha do produto para evitar condição de corrida em lançamentos simultâneos
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

  update produtos
    set quantidade_atual = v_nova_qtd,
        preco_custo = round(v_novo_custo, 2),
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

-- o gatilho em si já existe (criado no migration.sql) e continua apontando
-- para essa mesma função, então não precisa recriar o "create trigger".
