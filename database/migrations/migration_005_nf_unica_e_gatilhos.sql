-- =========================================================
-- MIGRAÇÃO 005:
--  1) impede número de nota fiscal repetido para o mesmo fornecedor
--  2) recria os gatilhos de estoque do zero, eliminando qualquer
--     gatilho duplicado que possa estar causando a duplicação de
--     quantidade ao lançar nota fiscal
-- Rode isso no SQL Editor do Supabase, depois das migrações anteriores.
-- =========================================================

-- ---------- 1) número de nota único por fornecedor ----------
-- (duas notas com o mesmo número podem coexistir se forem de
-- fornecedores diferentes, mas não do mesmo fornecedor)
alter table notas_fiscais drop constraint if exists notas_fiscais_fornecedor_numero_key;
alter table notas_fiscais add constraint notas_fiscais_fornecedor_numero_key unique (fornecedor_id, numero);

-- ---------- diagnóstico: confira se havia gatilho duplicado ----------
-- Rode esta consulta ANTES de continuar e me envie o resultado se aparecer
-- mais de uma linha por evento — isso confirmaria a causa da duplicação:
--
-- select trigger_name, event_manipulation
-- from information_schema.triggers
-- where event_object_table = 'notas_fiscais_itens';

-- ---------- 2) recria os gatilhos do zero (remove duplicados, se houver) ----------
drop trigger if exists trg_entrada_estoque_nota_fiscal on notas_fiscais_itens;
drop trigger if exists trg_estorno_estoque_nota_fiscal on notas_fiscais_itens;

create trigger trg_entrada_estoque_nota_fiscal
after insert on notas_fiscais_itens
for each row execute function fn_entrada_estoque_nota_fiscal();

create trigger trg_estorno_estoque_nota_fiscal
after delete on notas_fiscais_itens
for each row execute function fn_estorno_estoque_nota_fiscal();
