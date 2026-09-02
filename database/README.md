# Estrutura de Banco de Dados

Este diretório contém todos os scripts SQL necessários para configurar e manter o banco de dados do Sistema ALCCOR.

## 📁 Organização

### `/migrations/`
Contém todas as migrações do banco de dados em ordem sequencial. Execute na seguinte ordem:

1. **`migration.sql`** - Criação de tabelas base (notas fiscais, funcionários, folha de pagamento)
2. **`migration_002_clientes.sql`** - Adiciona CPF/CNPJ ao cadastro de clientes
3. **`migration_003_custo_medio.sql`** - Ajusta custo de produtos (média ponderada)
4. **`migration_003_custo_medio_e_ajustes.sql`** - Ajustes adicionais de custo
5. **`migration_004_produtos.sql`** - Remove coluna "unidade" de produtos
6. **`migration_005_nf_unica_e_gatilhos.sql`** - Garante número único de nota fiscal
7. **`migration_006_corrige_duplicacao_estoque.sql`** - Corrige duplicação de estoque
8. **`migration_007_grupos_e_nf_unica.sql`** - Número NF único e tabela de grupos
9. **`migration_007_notas_grupos_alertas.sql`** - Adiciona sistema de alertas
10. **`migration_008_financeiro_historico.sql`** - Parcelamento automático e histórico
11. **`migration_009_orcamentos_historico.sql`** - Orçamentos no histórico
12. **`migration_010_orcamentos_anexo_status.sql`** - Status "Projeto concluído" e anexos
13. **`migration_011_cliente_temporario.sql`** - Cliente sem cadastro em orçamentos

### `/diagnostics/`
Scripts de diagnóstico para verificar o estado do banco de dados:

- `diagnostico_forma_pagamento.sql` - Verifica dados de formas de pagamento
- `diagnostico_funcao_trg_atualizar_estoque.sql` - Testa função de atualização de estoque
- `diagnostico_gatilhos.sql` - Lista todos os gatilhos do banco
- `diagnostico_gatilhos_produtos.sql` - Verifica gatilhos de produtos
- `verificar-gatilhos-duplicados.sql` - Identifica triggers duplicadas

## 🚀 Como Usar

### Primeira Execução
1. Abra o **SQL Editor** do Supabase
2. Execute os scripts de migration **em ordem numérica**
3. Cada arquivo contém instruções específicas no cabeçalho

### Diagnósticos
Para verificar o estado do banco de dados:
1. Abra o **SQL Editor** do Supabase
2. Execute o script diagnóstico desejado
3. Analise os resultados

## ⚠️ Importante

- **Nunca execute as migrações fora de ordem**
- **Não delete dados de migrações já executadas**
- Faça backup do banco antes de executar novas migrações
- Se encontrar erros, consulte a seção "Diagnósticos"

## 📝 Estrutura de Tabelas Principais

- `usuarios` - Usuários do sistema
- `clientes` - Cadastro de clientes
- `fornecedores` - Cadastro de fornecedores
- `produtos` - Catálogo de produtos com estoque
- `movimentacoes_estoque` - Histórico de movimentações
- `notas_fiscais` - Notas fiscais de entrada
- `contas_pagar` - Contas a pagar com parcelamento
- `contas_receber` - Contas a receber com parcelamento
- `caixa` - Operações de caixa
- `movimentacoes_caixa` - Histórico de movimentações
- `funcionarios` - Cadastro de funcionários
- `folha_pagamento` - Folha de pagamento
- `orcamentos` - Orçamentos e propostas com cliente temporário
- `grupos_produtos` - Agrupamento de produtos
- `historico_alteracoes` - Auditoria de alterações
