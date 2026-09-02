-- Migration 012: Adiciona suporte a anexo de documento (PDF) em contas a pagar
-- Data: 2026-09-02
-- Descrição: Adiciona colunas para armazenar caminho, nome e tamanho do documento PDF anexado ao registro de contas a pagar

alter table contas_pagar 
  add column if not exists documento_path text,
  add column if not exists documento_nome text,
  add column if not exists documento_tamanho integer;

-- Comentários descritivos
comment on column contas_pagar.documento_path is 'Caminho do arquivo PDF no armazenamento (storage)';
comment on column contas_pagar.documento_nome is 'Nome original do arquivo PDF';
comment on column contas_pagar.documento_tamanho is 'Tamanho do arquivo em bytes';
