-- =========================================================
-- MIGRAÇÃO 002: exige telefone e CPF/CNPJ no cadastro de clientes
-- Rode isso no SQL Editor do Supabase (depois do migration.sql original)
-- =========================================================

-- Tipo de documento (cpf ou cnpj) + o próprio documento
alter table clientes add column if not exists tipo_documento text not null default 'cpf'
  check (tipo_documento in ('cpf', 'cnpj'));
alter table clientes add column if not exists documento text;

-- Se já existirem clientes cadastrados sem telefone/documento, preenche com um
-- valor temporário para não travar o "not null" — depois é só corrigir na tela.
update clientes set telefone = 'PENDENTE' where telefone is null or telefone = '';
update clientes set documento = '00000000000' where documento is null or documento = '';

alter table clientes alter column telefone set not null;
alter table clientes alter column documento set not null;
