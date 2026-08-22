-- =========================================================
-- MIGRAÇÃO 007:
--  1) número de nota fiscal único em TODO o sistema (não só por fornecedor)
--  2) tabela de "grupos" de produtos, para usar como lista de opções
--     (com possibilidade de criar novos grupos direto no cadastro)
-- Rode isso no SQL Editor do Supabase, depois das migrações anteriores.
-- =========================================================

-- ---------- 1) número de nota único globalmente ----------
-- Se você já tiver notas com o mesmo número em fornecedores diferentes,
-- o comando abaixo vai falhar. Rode esta consulta antes para conferir:
--   select numero, count(*) from notas_fiscais group by numero having count(*) > 1;
-- Se aparecer algum resultado, renomeie o número de uma das notas antes de continuar.
alter table notas_fiscais drop constraint if exists notas_fiscais_fornecedor_numero_key;
alter table notas_fiscais drop constraint if exists notas_fiscais_numero_key;
alter table notas_fiscais add constraint notas_fiscais_numero_key unique (numero);

-- ---------- 2) grupos de produtos ----------
create table if not exists grupos_produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  criado_em timestamptz not null default now()
);

alter table grupos_produtos enable row level security;
drop policy if exists "app_full_access" on grupos_produtos;
create policy "app_full_access" on grupos_produtos for all to anon, authenticated using (true) with check (true);

-- migra os grupos que já existiam como texto livre em produtos.categoria
insert into grupos_produtos (nome)
select distinct trim(categoria) from produtos
where categoria is not null and trim(categoria) <> ''
on conflict (nome) do nothing;
