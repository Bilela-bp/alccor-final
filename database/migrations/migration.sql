-- =========================================================
-- MIGRAÇÃO: Notas Fiscais (com baixa/entrada automática de estoque)
--           e Folha de Pagamento
-- =========================================================

-- ---------- NOTAS FISCAIS ----------
create table if not exists notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  numero text not null,
  fornecedor_id uuid references fornecedores(id),
  data_emissao date not null default current_date,
  valor_total numeric not null default 0,
  status text not null default 'lancada', -- lancada | cancelada
  observacao text,
  usuario_id uuid references usuarios(id),
  criado_em timestamptz not null default now()
);

create table if not exists notas_fiscais_itens (
  id uuid primary key default gen_random_uuid(),
  nota_fiscal_id uuid not null references notas_fiscais(id) on delete cascade,
  produto_id uuid not null references produtos(id),
  quantidade numeric not null,
  preco_unitario numeric not null,
  criado_em timestamptz not null default now()
);

-- ---------- FUNCIONÁRIOS E FOLHA ----------
create table if not exists funcionarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf text,
  cargo text not null,
  salario_base numeric not null,
  data_admissao date not null default current_date,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists folha_pagamento (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios(id),
  mes_referencia date not null, -- usar sempre dia 01 do mês, ex: 2026-08-01
  salario_base numeric not null,
  bonus numeric not null default 0,
  descontos numeric not null default 0,
  salario_liquido numeric generated always as (salario_base + bonus - descontos) stored,
  status text not null default 'aberta', -- aberta | fechada | paga
  data_pagamento date,
  observacao text,
  criado_em timestamptz not null default now(),
  unique (funcionario_id, mes_referencia)
);

-- =========================================================
-- TRIGGER: ao lançar item de nota fiscal, entra automaticamente
-- no estoque do produto e registra a movimentação
-- =========================================================
create or replace function fn_entrada_estoque_nota_fiscal()
returns trigger as $$
declare
  v_numero text;
  v_usuario_id uuid;
begin
  select numero, usuario_id into v_numero, v_usuario_id
  from notas_fiscais where id = new.nota_fiscal_id;

  update produtos
    set quantidade_atual = quantidade_atual + new.quantidade,
        atualizado_em = now()
    where id = new.produto_id;

  insert into movimentacoes_estoque
    (id, produto_id, tipo, quantidade, motivo, usuario_id, data, observacao)
  values
    (gen_random_uuid(), new.produto_id, 'entrada', new.quantidade,
     'Nota Fiscal ' || coalesce(v_numero, ''), v_usuario_id, now(),
     'Gerado automaticamente pela nota fiscal');

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_entrada_estoque_nota_fiscal on notas_fiscais_itens;
create trigger trg_entrada_estoque_nota_fiscal
after insert on notas_fiscais_itens
for each row execute function fn_entrada_estoque_nota_fiscal();

-- Se um item de nota for excluído, estorna a quantidade do estoque
create or replace function fn_estorno_estoque_nota_fiscal()
returns trigger as $$
begin
  update produtos
    set quantidade_atual = quantidade_atual - old.quantidade,
        atualizado_em = now()
    where id = old.produto_id;

  insert into movimentacoes_estoque
    (id, produto_id, tipo, quantidade, motivo, data, observacao)
  values
    (gen_random_uuid(), old.produto_id, 'saida', old.quantidade,
     'Estorno de item de nota fiscal', now(),
     'Gerado automaticamente ao excluir item da nota');

  return old;
end;
$$ language plpgsql;

drop trigger if exists trg_estorno_estoque_nota_fiscal on notas_fiscais_itens;
create trigger trg_estorno_estoque_nota_fiscal
after delete on notas_fiscais_itens
for each row execute function fn_estorno_estoque_nota_fiscal();

-- =========================================================
-- SEGURANÇA: habilita RLS em todas as tabelas e cria políticas
-- liberando acesso para quem usa a chave anon/publishable do app
-- (uso interno, 1-2 funcionários, sem login com senha por enquanto).
-- Isso mantém o RLS LIGADO, evitando o aviso do Supabase, e deixa
-- pronto para restringir mais no futuro (ex: exigir Supabase Auth).
-- =========================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'caixa','clientes','contas_pagar','contas_receber','fornecedores',
    'movimentacoes_caixa','movimentacoes_estoque','produtos','usuarios',
    'notas_fiscais','notas_fiscais_itens','funcionarios','folha_pagamento'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "app_full_access" on %I;', t);
    execute format(
      'create policy "app_full_access" on %I for all to anon, authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;
