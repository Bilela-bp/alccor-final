select p.proname as nome_da_funcao, pg_get_functiondef(p.oid) as definicao
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where t.tgname = 'trg_atualizar_estoque';
