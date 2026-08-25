-- Rode isso no SQL Editor do Supabase para conferir se não existe
-- mais de um gatilho fazendo a mesma coisa (o que causaria duplicação
-- nos cálculos de estoque). O esperado é UMA linha por combinação de
-- tabela + evento.

select
  event_object_table as tabela,
  trigger_name as gatilho,
  event_manipulation as evento
from information_schema.triggers
where event_object_table in ('notas_fiscais_itens', 'movimentacoes_caixa', 'movimentacoes_estoque')
order by event_object_table, event_manipulation, trigger_name;
