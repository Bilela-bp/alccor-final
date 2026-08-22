-- =========================================================
-- MIGRAÇÃO 007: notas únicas, grupos de produtos e alertas
-- Rode este arquivo no SQL Editor do Supabase.
-- =========================================================

-- 1) O número da nota é único em todo o sistema, independente do fornecedor.
-- lower + btrim impedem variações como " 123 " e "123" ou "NF-1"/"nf-1".
alter table notas_fiscais drop constraint if exists notas_fiscais_fornecedor_numero_key;
drop index if exists notas_fiscais_numero_unico_idx;
create unique index notas_fiscais_numero_unico_idx
  on notas_fiscais (lower(btrim(numero)));

-- 2) Grupos são registros próprios, para poder escolher um existente ou criar
-- outro durante o cadastro de um produto.
create table if not exists grupos_produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  criado_em timestamptz not null default now()
);

create unique index if not exists grupos_produtos_nome_unico_idx
  on grupos_produtos (lower(btrim(nome)));

alter table produtos add column if not exists grupo_id uuid references grupos_produtos(id) on delete set null;

-- Preserva as categorias que já existiam, transformando cada uma em grupo.
insert into grupos_produtos (nome)
select distinct btrim(categoria)
from produtos
where nullif(btrim(categoria), '') is not null
on conflict do nothing;

update produtos p
set grupo_id = g.id
from grupos_produtos g
where p.grupo_id is null
  and lower(btrim(p.categoria)) = lower(btrim(g.nome));

-- 3) O limite de alerta já é armazenado em produtos. Garante valores válidos.
alter table produtos alter column estoque_minimo set default 0;
update produtos set estoque_minimo = 0 where estoque_minimo is null or estoque_minimo < 0;
alter table produtos drop constraint if exists produtos_estoque_minimo_nao_negativo;
alter table produtos add constraint produtos_estoque_minimo_nao_negativo check (estoque_minimo >= 0);

-- Libera o acesso à nova tabela para os usuários autenticados do aplicativo.
alter table grupos_produtos enable row level security;
drop policy if exists "app_full_access" on grupos_produtos;
create policy "app_full_access" on grupos_produtos
  for all to anon, authenticated using (true) with check (true);
