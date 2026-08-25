import React from 'react';
import { UserCog } from 'lucide-react';
import EntityPage from '../components/EntityPage';

export default function FuncionariosPage() {
  return (
    <EntityPage table="funcionarios" title="Funcionários" Icon={UserCog} fields={[
      { key: 'nome', label: 'Nome', required: true },
      { key: 'cpf', label: 'CPF', type: 'cpf' },
      { key: 'cargo', label: 'Cargo', required: true },
      { key: 'salario_base', label: 'Salário base (R$)', type: 'number', required: true, currency: true },
      { key: 'data_admissao', label: 'Data de admissão', type: 'date', required: true },
      { key: 'ativo', label: 'Ativo', type: 'boolean' },
    ]} />
  );
}
