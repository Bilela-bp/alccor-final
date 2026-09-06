-- Migration 013: identifica movimentos de caixa gerados por outros módulos

alter table movimentacoes_caixa
  add column if not exists origem_tabela text,
  add column if not exists origem_id uuid;

create unique index if not exists uq_movimentacoes_caixa_origem
  on movimentacoes_caixa(origem_tabela, origem_id)
  where origem_tabela is not null and origem_id is not null;