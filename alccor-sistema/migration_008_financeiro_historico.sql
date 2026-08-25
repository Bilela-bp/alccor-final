-- =========================================================
-- MIGRAÇÃO 008: Parcelamento de contas a receber + relatórios
--               + histórico de alterações por usuário
-- =========================================================

-- ---------- PARCELAMENTO ----------
alter table if exists contas_receber
  add column if not exists grupo_parcelamento_id uuid,
  add column if not exists numero_parcela integer,
  add column if not exists total_parcelas integer,
  add column if not exists intervalo_dias integer,
  add column if not exists usuario_id uuid references usuarios(id);

create index if not exists idx_contas_receber_grupo_parcelamento
  on contas_receber(grupo_parcelamento_id);

create index if not exists idx_contas_receber_vencimento_status
  on contas_receber(data_vencimento, status);

-- ---------- HISTÓRICO ----------
create table if not exists historico_alteracoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id) on delete set null,
  tabela text not null,
  registro_id text,
  acao text not null check (acao in ('INSERT','UPDATE','DELETE')),
  dados_anteriores jsonb,
  dados_novos jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_historico_usuario
  on historico_alteracoes(usuario_id, created_at desc);

create index if not exists idx_historico_tabela
  on historico_alteracoes(tabela, created_at desc);

-- A função usa o UID do Supabase Auth da sessão que fez a alteração.
create or replace function fn_registrar_historico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
  v_id text;
begin
  v_usuario_id := auth.uid();

  if tg_op = 'INSERT' then
    v_id := to_jsonb(new)->>'id';
    insert into historico_alteracoes
      (usuario_id, tabela, registro_id, acao, dados_anteriores, dados_novos)
    values
      (v_usuario_id, tg_table_name, v_id, 'INSERT', null, to_jsonb(new));
    return new;

  elsif tg_op = 'UPDATE' then
    v_id := to_jsonb(new)->>'id';
    insert into historico_alteracoes
      (usuario_id, tabela, registro_id, acao, dados_anteriores, dados_novos)
    values
      (v_usuario_id, tg_table_name, v_id, 'UPDATE', to_jsonb(old), to_jsonb(new));
    return new;

  elsif tg_op = 'DELETE' then
    v_id := to_jsonb(old)->>'id';
    insert into historico_alteracoes
      (usuario_id, tabela, registro_id, acao, dados_anteriores, dados_novos)
    values
      (v_usuario_id, tg_table_name, v_id, 'DELETE', to_jsonb(old), null);
    return old;
  end if;

  return null;
end;
$$;

-- Remove/recria os triggers para a migração ser idempotente.
do $$
declare
  t text;
begin
  foreach t in array array[
    'contas_receber',
    'contas_pagar',
    'movimentacoes_caixa',
    'caixa',
    'clientes',
    'fornecedores',
    'produtos',
    'notas_fiscais',
    'notas_fiscais_itens',
    'funcionarios',
    'folha_pagamento',
    'usuarios'
  ]
  loop
    execute format('drop trigger if exists trg_historico_%I on %I;', t, t);
    execute format(
      'create trigger trg_historico_%I
       after insert or update or delete on %I
       for each row execute function fn_registrar_historico();',
      t, t
    );
  end loop;
end $$;

-- ---------- RLS ----------
alter table historico_alteracoes enable row level security;

drop policy if exists "app_read_historico" on historico_alteracoes;
drop policy if exists "app_insert_historico" on historico_alteracoes;

create policy "app_read_historico"
  on historico_alteracoes for select
  to authenticated
  using (true);

-- O trigger SECURITY DEFINER registra o histórico; esta política evita
-- bloqueios caso alguma rotina do aplicativo precise inserir diretamente.
create policy "app_insert_historico"
  on historico_alteracoes for insert
  to authenticated
  with check (true);
