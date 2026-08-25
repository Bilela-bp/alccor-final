select trigger_name, event_manipulation
from information_schema.triggers
where event_object_table = 'notas_fiscais_itens';
