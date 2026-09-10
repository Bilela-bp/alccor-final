-- Migration 014: permite contas a pagar sem descricao

alter table contas_pagar
  alter column descricao drop not null;
