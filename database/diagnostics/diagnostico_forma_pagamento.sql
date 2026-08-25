select conname, pg_get_constraintdef(oid)
from pg_constraint
where conname = 'movimentacoes_caixa_forma_pagamento_check';
