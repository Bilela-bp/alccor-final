-- HISTÓRICO DE ORÇAMENTOS
-- Registra alterações em orçamentos e seus itens, caso as tabelas existam.
do $$
begin
  if to_regclass('public.orcamentos') is not null then
    execute 'drop trigger if exists trg_historico_orcamentos on orcamentos;';
    execute 'create trigger trg_historico_orcamentos after insert or update or delete on orcamentos for each row execute function fn_registrar_historico();';
  end if;
  if to_regclass('public.orcamentos_itens') is not null then
    execute 'drop trigger if exists trg_historico_orcamentos_itens on orcamentos_itens;';
    execute 'create trigger trg_historico_orcamentos_itens after insert or update or delete on orcamentos_itens for each row execute function fn_registrar_historico();';
  end if;
end $$;
