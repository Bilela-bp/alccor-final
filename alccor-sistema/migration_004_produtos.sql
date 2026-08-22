-- =========================================================
-- MIGRAÇÃO 004:
--  1) remove "preço de venda" de produtos (não é mais usado no sistema)
--  2) preço de custo, estoque atual e estoque mínimo passam a ter padrão 0,
--     já que agora não são mais obrigatórios no cadastro de um produto novo
--     (o custo e o estoque passam a ser definidos pela nota fiscal, evitando
--     o "custo chutado" que estava distorcendo a média ponderada)
-- Rode isso no SQL Editor do Supabase, depois das migrações anteriores.
-- =========================================================

alter table produtos drop column if exists preco_venda;

alter table produtos alter column preco_custo set default 0;
alter table produtos alter column quantidade_atual set default 0;
alter table produtos alter column estoque_minimo set default 0;
