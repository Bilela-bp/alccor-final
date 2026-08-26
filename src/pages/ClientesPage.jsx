import React from 'react';
import { Users } from 'lucide-react';
import EntityPage from '../components/EntityPage';

export default function ClientesPage() {
  return (
    <EntityPage table="clientes" title="Clientes" Icon={Users} fields={[
      { key: 'nome', label: 'Nome', required: true },
      { key: 'documento', label: 'CPF / CNPJ', type: 'documento', tipoKey: 'tipo_documento', required: true },
      { key: 'telefone', label: 'Telefone', type: 'phone', required: true },
      { key: 'email', label: 'E-mail', type: 'email' },
      { key: 'endereco', label: 'Endereço' },
    ]} />
  );
}
