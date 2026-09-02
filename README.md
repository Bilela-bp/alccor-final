# Sistema ALCCOR

Sistema de gestão (estoque, notas fiscais, orçamentos, financeiro, contas a
pagar/receber, caixa, funcionários, folha de pagamento e usuários) conectado
ao Supabase.

## Como rodar no VS Code

1. **Instale o Node.js** (versão 18 ou superior), se ainda não tiver: https://nodejs.org

2. **Abra esta pasta no VS Code** e, no terminal integrado (Terminal > New Terminal), rode:

   ```bash
   npm install
   ```

3. **Confira o arquivo `.env`** — ele já vem com a URL e a chave do seu projeto
   Supabase preenchidas. Se precisar trocar (ex: outro projeto), edite os valores:

   ```
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=sua_chave_anon_ou_publishable
   ```

   Essas chaves ficam em Supabase → Settings → API.

4. **Rode o sistema em modo desenvolvimento:**

   ```bash
   npm run dev
   ```

   Abra o link que aparecer no terminal (normalmente `http://localhost:5173`).

5. **Para gerar uma versão de produção** (arquivos estáticos otimizados, prontos
   para hospedar em qualquer serviço como Vercel, Netlify, Cloudflare, etc.):

   ```bash
   npm run build
   ```

   Os arquivos finais ficam na pasta `dist/`. Para testar essa versão localmente:

   ```bash
   npm run preview
   ```

## Antes do primeiro uso

Execute, nesta ordem, no SQL Editor do Supabase todos os arquivos de
`database/migrations/`. Para detalhes completos sobre o banco de dados, veja 
[database/README.md](./database/README.md).

1. **`migration.sql`** — cria as tabelas `notas_fiscais`, `notas_fiscais_itens`,
   `funcionarios` e `folha_pagamento`, o gatilho que atualiza o estoque
   automaticamente ao lançar uma nota fiscal, e habilita o RLS.
2. **`migration_002_clientes.sql`** — adiciona CPF/CNPJ ao cadastro de clientes.
3. **`migration_003_custo_medio_e_ajustes.sql`** — ajusta o CNPJ de fornecedores
   e corrige o cálculo de custo (média ponderada).
4. **`migration_004_produtos.sql`** — remove "preço de venda" e define defaults.
5. **`migration_005_nf_unica_e_gatilhos.sql`** — número único de NF e gatilhos de estoque.
6. **`migration_006_corrige_duplicacao_estoque.sql`** — corrige duplicação de estoque.
7. **`migration_007_grupos_e_nf_unica.sql`** — número de NF único e grupos de produtos.
8. **`migration_008_financeiro_historico.sql`** — parcelamento automático e histórico.
9. **`migration_009_orcamentos_historico.sql`** — orçamentos no histórico.
10. **`migration_010_orcamentos_anexo_status.sql`** — status "Projeto concluído" e anexos.
11. **`migration_011_cliente_temporario.sql`** — suporte a cliente sem cadastro em orçamentos.

O login é com **e-mail e senha de verdade**, usando o Supabase Auth. Para o
primeiro usuário (você), crie a conta em Authentication → Users e depois
insira a linha em `usuarios` com o mesmo UID.

**A partir daí, os próximos usuários podem ser criados direto pela tela do
sistema** (menu Usuários, visível só para quem tem cargo `admin`). Um
detalhe: se no seu projeto Supabase estiver ativado "Confirm email"
(Authentication → Providers → Email), a pessoa criada vai precisar confirmar
o e-mail antes do primeiro login. Para uso interno, muita gente prefere
desativar essa opção para simplificar.

Funcionários (para a folha de pagamento) já podem ser cadastrados
normalmente pela tela, sem essa exigência de conta de login.

## Estrutura do projeto

```
alccor-sistema-final/
├── src/
│   ├── main.jsx            # Ponto de entrada do React
│   ├── App.jsx             # Shell do app (sessão, layout, sidebar, roteamento)
│   ├── index.css           # Estilos base (Tailwind)
│   ├── assets/             # Imagens e arquivos estáticos
│   ├── config/
│   │   └── nav.js          # Itens do menu lateral e tema
│   ├── lib/
│   │   ├── supabase.js     # Autenticação e API REST do Supabase
│   │   ├── helpers.js      # Formatação e validações
│   │   └── theme.js        # Cores e constantes visuais
│   ├── components/
│   │   ├── ui.jsx          # Componentes reutilizáveis
│   │   └── EntityPage.jsx  # CRUD genérico para telas simples
│   └── pages/
│       ├── Dashboard.jsx
│       ├── ProdutosPage.jsx
│       ├── NotasFiscaisPage.jsx
│       ├── ClientesPage.jsx
│       ├── OrcamentosPage.jsx     # Orçamentos com suporte a cliente temporário
│       ├── FornecedoresPage.jsx
│       ├── ContasPagarPage.jsx
│       ├── ContasReceberPage.jsx
│       ├── CaixaPage.jsx
│       ├── FuncionariosPage.jsx
│       ├── FolhaPage.jsx
│       ├── RelatoriosPage.jsx
│       ├── UsuariosPage.jsx
│       ├── HistoricoPage.jsx
│       ├── LoginScreen.jsx
│       └── AcessoRestrito.jsx
├── database/                # ⭐ Todos os scripts SQL
│   ├── README.md           # Guia completo do banco de dados
│   ├── migrations/         # Scripts de migração (execute em ordem)
│   │   ├── migration.sql
│   │   ├── migration_002_clientes.sql
│   │   ├── ...
│   │   └── migration_011_cliente_temporario.sql
│   └── diagnostics/        # Scripts de diagnóstico
│       ├── diagnostico_forma_pagamento.sql
│       ├── diagnostico_gatilhos.sql
│       └── verificar-gatilhos-duplicados.sql
├── .env                    # Credenciais do Supabase (não versionar)
├── .env.example           # Exemplo de variáveis de ambiente
├── .gitignore             # Arquivos ignorados pelo Git
├── package.json           # Dependências do projeto
├── vite.config.js         # Configuração do Vite
├── tailwind.config.js     # Configuração do Tailwind CSS
├── postcss.config.js      # Configuração do PostCSS
└── README.md              # Este arquivo
```

Cada tela do menu lateral corresponde a um arquivo em `src/pages/`. Telas
simples de cadastro (Produtos, Clientes, Fornecedores, Contas a pagar,
Funcionários) são só uma configuração de campos passada para o componente
genérico `EntityPage`; telas com regras específicas (Notas Fiscais, Caixa,
Folha, Contas a Receber, Orçamentos, Relatórios, Usuários, Histórico) têm
arquivo próprio.

## 🆕 Novidades Recentes

### Cliente sem Cadastro em Orçamentos (v1.11)
- ✨ **Novo recurso**: Agora é possível criar orçamentos para clientes que ainda não estão cadastrados no sistema
- 📋 Campos adicionais: Nome e Telefone do cliente
- 💾 Os dados são salvos no orçamento sem criar um registro permanente na tabela de clientes
- 🎯 Ideal para propostas que ainda não se converteram em projetos
- 📦 Requer execução de: `migration_011_cliente_temporario.sql`

### Organização Aprimorada
- 📁 Todos os scripts SQL agora estão organizados em `database/`
  - `migrations/` - Scripts de migração do banco de dados
  - `diagnostics/` - Scripts de diagnóstico e verificação
- 📖 Novo arquivo: `database/README.md` com guia completo do banco de dados

## Observação sobre segurança

O RLS libera acesso total para quem tiver a chave anon/publishable do
projeto — adequado para uso interno com poucos funcionários de confiança.
