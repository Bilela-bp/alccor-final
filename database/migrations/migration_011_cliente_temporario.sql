-- =========================================================
-- MIGRAÇÃO 011: Cliente temporário para orçamentos sem cadastro
-- Rode isso no SQL Editor do Supabase (depois da migration_010)
-- =========================================================

-- Adiciona colunas para armazenar dados de cliente temporário
-- Quando cliente_temporario_nome não for nulo, cliente_id deve ser nulo
alter table orcamentos add column if not exists cliente_temporario_nome text;
alter table orcamentos add column if not exists cliente_temporario_telefone text;

-- Constraint para garantir que ou tem cliente_id OU cliente_temporario_nome (mas não ambos)
alter table orcamentos add constraint orcamentos_cliente_check 
  check (
    (cliente_id is not null and cliente_temporario_nome is null) OR
    (cliente_id is null and cliente_temporario_nome is not null)
  );
