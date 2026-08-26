-- =========================================================
-- MIGRAÇÃO 010: anexo do projeto (zip) e status "Projeto concluído"
-- Rode isso no SQL Editor do Supabase (depois das migrações anteriores)
-- =========================================================

-- 1) Colunas para guardar o arquivo do projeto anexado ao orçamento
alter table orcamentos add column if not exists arquivo_projeto_path text;
alter table orcamentos add column if not exists arquivo_projeto_nome text;
alter table orcamentos add column if not exists arquivo_projeto_tamanho bigint;

-- 2) Libera o status "concluido" (caso exista uma restrição antiga limitando os valores)
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'orcamentos' and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table orcamentos drop constraint %I', c.conname);
  end loop;
end $$;

alter table orcamentos add constraint orcamentos_status_check
  check (status in ('orcamento', 'em_andamento', 'concluido'));

-- 3) Bucket de armazenamento para os arquivos .zip dos projetos
insert into storage.buckets (id, name, public)
values ('orcamentos-projetos', 'orcamentos-projetos', true)
on conflict (id) do nothing;

-- 4) Políticas de acesso ao bucket (mesmo modelo permissivo usado nas tabelas do sistema:
-- qualquer pessoa com a chave anon/publishable do projeto pode ler, enviar e remover arquivos)
drop policy if exists "orcamentos_projetos_select" on storage.objects;
create policy "orcamentos_projetos_select" on storage.objects
  for select using (bucket_id = 'orcamentos-projetos');

drop policy if exists "orcamentos_projetos_insert" on storage.objects;
create policy "orcamentos_projetos_insert" on storage.objects
  for insert with check (bucket_id = 'orcamentos-projetos');

drop policy if exists "orcamentos_projetos_update" on storage.objects;
create policy "orcamentos_projetos_update" on storage.objects
  for update using (bucket_id = 'orcamentos-projetos');

drop policy if exists "orcamentos_projetos_delete" on storage.objects;
create policy "orcamentos_projetos_delete" on storage.objects
  for delete using (bucket_id = 'orcamentos-projetos');

-- Observação: a tabela "orcamentos_itens" deixou de ser usada pela tela de Orçamentos
-- (agora o valor é digitado diretamente), mas não foi removida para não perder histórico
-- de dados já cadastrados.
