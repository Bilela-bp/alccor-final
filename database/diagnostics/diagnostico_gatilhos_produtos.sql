select trigger_name, event_object_table, event_manipulation
from information_schema.triggers
where event_object_table in ('produtos', 'notas_fiscais_itens', 'movimentacoes_estoque')
order by event_object_table, event_manipulation;
