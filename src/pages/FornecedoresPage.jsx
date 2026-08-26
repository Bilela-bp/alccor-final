import React from 'react';
import { Truck } from 'lucide-react';
import EntityPage from '../components/EntityPage';

export default function FornecedoresPage() {
  return (
    <EntityPage table="fornecedores" title="Fornecedores" Icon={Truck} fields={[
      { key: 'nome', label: 'Nome', required: true },
      { key: 'telefone', label: 'Telefone', type: 'phone' },
      { key: 'email', label: 'E-mail', type: 'email' },
      { key: 'endereco', label: 'Endereço' },
    ]} />
  );
}
