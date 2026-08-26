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
`database/migrations/`:

1. **`migration.sql`** — cria as tabelas `notas_fiscais`, `notas_fiscais_itens`,
   `funcionarios` e `folha_pagamento`, o gatilho que atualiza o estoque
   automaticamente ao lançar uma nota fiscal, e habilita o RLS.
2. **`migration_002_clientes.sql`** — adiciona CPF/CNPJ ao cadastro de clientes.
   **A tela atual do sistema não depende desses campos**, pois o cadastro-base
   existente pode ter apenas `id`, `nome`, `telefone`, `email`, `endereco` e
   `criado_em`.
3. **`migration_003_custo_medio_e_ajustes.sql`** — ajusta o CNPJ de fornecedores,
   remove a coluna "unidade" de produtos e corrige o cálculo de custo (agora por
   **média ponderada** a cada nota fiscal lançada). A tela de fornecedores atual
   usa somente os campos do cadastro-base, evitando erro caso `cnpj` ainda não
   exista no banco.
4. **`migration_004_produtos.sql`** — remove "preço de venda" e define 0 como
   padrão para custo, estoque atual e estoque mínimo.
5. **`migration_005_nf_unica_e_gatilhos.sql`** — impede número de nota
   fiscal repetido para o mesmo fornecedor, e recria os gatilhos de estoque
   do zero.
6. **`migration_006_corrige_duplicacao_estoque.sql`** — corrige duplicação
   de estoque causada por um gatilho antigo.
7. **`migration_007_grupos_e_nf_unica.sql`** — número de nota fiscal único
   em todo o sistema, e tabela de grupos de produtos.
8. **`migration_008_financeiro_historico.sql`** — parcelamento automático em
   contas a receber, relatórios financeiros com exportação CSV, e histórico
   de alterações por usuário (menu **Histórico de alterações**, só para
   admins).
9. **`migration_009_orcamentos_historico.sql`** — inclui os orçamentos no
   histórico de alterações.
10. **`migration_010_orcamentos_anexo_status.sql`** — adiciona o status
    **"Projeto concluído"** aos orçamentos e cria o espaço de armazenamento
    (bucket `orcamentos-projetos`) usado para anexar o projeto em `.zip` de
    cada orçamento.

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
src/
  main.jsx            -> ponto de entrada do React
  App.jsx             -> shell do app: sessão, layout, sidebar e roteamento entre telas
  index.css           -> estilos base (Tailwind)
  assets/              -> imagens e arquivos estáticos
  config/
    nav.js             -> itens do menu lateral e chave de tema
  lib/
    supabase.js        -> autenticação, sessão e chamadas REST do Supabase
    helpers.js         -> máscaras, validações, datas e formatação monetária
    theme.js            -> cores e constantes visuais
  components/
    ui.jsx              -> componentes visuais reutilizáveis (botões, modal, campos, badges, PageHeader...)
    EntityPage.jsx       -> componente genérico de CRUD (listar/criar/editar/excluir), usado pelas telas simples
  pages/
    Dashboard.jsx        -> Painel inicial (indicadores, alertas de estoque)
    ProdutosPage.jsx      -> Estoque (usa EntityPage)
    NotasFiscaisPage.jsx  -> Notas fiscais (com baixa automática de estoque)
    ClientesPage.jsx       -> Clientes (usa EntityPage)
    OrcamentosPage.jsx      -> Orçamentos / propostas para clientes
    FornecedoresPage.jsx     -> Fornecedores (usa EntityPage)
    ContasPagarPage.jsx       -> Contas a pagar (usa EntityPage)
    ContasReceberPage.jsx      -> Contas a receber (com parcelamento automático)
    CaixaPage.jsx                -> Caixa (abertura/fechamento + movimentações)
    FuncionariosPage.jsx          -> Funcionários (usa EntityPage)
    FolhaPage.jsx                  -> Folha de pagamento
    RelatoriosPage.jsx              -> Relatórios financeiros (inclui ReportTable)
    UsuariosPage.jsx                 -> Usuários do sistema (admin)
    HistoricoPage.jsx                 -> Histórico de alterações (admin)
    LoginScreen.jsx                    -> Tela de login
    AcessoRestrito.jsx                  -> Aviso de acesso restrito
.env                  -> credenciais do Supabase (não versionar / não compartilhar)
database/
  migrations/          -> scripts de criação/alteração do banco, em ordem
  diagnostics/          -> scripts de diagnóstico e verificação
```

Cada tela do menu lateral corresponde a um arquivo em `src/pages/`. Telas
simples de cadastro (Produtos, Clientes, Fornecedores, Contas a pagar,
Funcionários) são só uma configuração de campos passada para o componente
genérico `EntityPage`; telas com regras específicas (Notas Fiscais, Caixa,
Folha, Contas a Receber, Orçamentos, Relatórios, Usuários, Histórico) têm
arquivo próprio.

## Observação sobre segurança

O RLS libera acesso total para quem tiver a chave anon/publishable do
projeto — adequado para uso interno com poucos funcionários de confiança.
