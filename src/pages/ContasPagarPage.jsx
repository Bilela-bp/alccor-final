import React from 'react';
import { ArrowUpCircle } from 'lucide-react';
import EntityPage from '../components/EntityPage';

export default function ContasPagarPage() {
  return (
    <EntityPage table="contas_pagar" title="Contas a pagar" Icon={ArrowUpCircle} fields={[
      { key: 'descricao', label: 'Descrição', required: true },
      { key: 'fornecedor_id', label: 'Fornecedor', refTable: 'fornecedores', refLabel: 'nome' },
      { key: 'valor', label: 'Valor (R$)', type: 'number', required: true, currency: true },
      { key: 'data_vencimento', label: 'Vencimento', type: 'date', required: true },
      { key: 'data_pagamento', label: 'Data de pagamento', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', required: true, options: [{ value: 'pendente', label: 'Pendente' }, { value: 'pago', label: 'Pago' }] },
    ]} />
  );
}
