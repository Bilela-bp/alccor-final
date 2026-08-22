# Sistema ALCCOR

Sistema de gestão (estoque, notas fiscais, financeiro, contas a pagar/receber,
caixa, funcionários, folha de pagamento e usuários) conectado ao Supabase.

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
   para hospedar em qualquer serviço como Vercel, Netlify, etc.):

   ```bash
   npm run build
   ```

   Os arquivos finais ficam na pasta `dist/`. Para testar essa versão localmente:

   ```bash
   npm run preview
   ```

## Antes do primeiro uso

Certifique-se de ter rodado, nesta ordem, no SQL Editor do Supabase:

1. **`migration.sql`** — cria as tabelas `notas_fiscais`, `notas_fiscais_itens`,
   `funcionarios` e `folha_pagamento`, o gatilho que atualiza o estoque
   automaticamente ao lançar uma nota fiscal, e habilita o RLS.
2. **`migration_002_clientes.sql`** — torna telefone e CPF/CNPJ obrigatórios
   no cadastro de clientes (se você já tiver clientes cadastrados sem esses
   dados, eles recebem um valor temporário "PENDENTE" / "00000000000" — vale
   revisar e corrigir esses cadastros depois pela tela).
3. **`migration_003_custo_medio_e_ajustes.sql`** — esta é a mais importante
   do lote atual:
   - Torna o CNPJ obrigatório no cadastro de fornecedores.
   - Remove a coluna "unidade" de produtos (não fazia mais sentido no seu caso).
   - **Corrige o cálculo de custo**: agora, toda vez que uma nota fiscal é
     lançada, o preço de custo do produto é recalculado pela **média
     ponderada** entre o estoque existente e a nova entrada — em vez de só
     somar a quantidade. Exemplo: 1 unidade em estoque a R$ 50 de custo +
     compra de mais 1 unidade a R$ 30 → novo custo médio = R$ 40.
4. **`migration_004_produtos.sql`** — remove o campo "preço de venda" (não é
   mais usado) e define 0 como padrão para custo, estoque atual e estoque
   mínimo, já que agora um produto pode ser cadastrado sem esses dados (o
   custo passa a vir só da nota fiscal — isso evita o problema de cadastrar
   um produto com um custo "chutado" que distorcia a média depois).
5. **`migration_005_nf_unica_e_gatilhos.sql`** — impede número de nota fiscal
   repetido para o mesmo fornecedor, e recria os gatilhos de estoque do zero
   (elimina qualquer gatilho duplicado que pudesse estar causando duplicação
   de quantidade ao lançar nota fiscal).
3. **`migration_003_custo_medio.sql`** — torna o CNPJ obrigatório em
   fornecedores (mesmo esquema de valor temporário para cadastros já
   existentes), deixa "unidade" opcional em produtos, e faz o preço de custo
   ser recalculado automaticamente pela **média ponderada** sempre que uma
   nota fiscal der entrada no estoque (ex: 5 un a R$ 50 + 1 un a R$ 30 vira
   custo médio de R$ 46,67).

O login é com **e-mail e senha de verdade**, usando o Supabase Auth. Para o
primeiro usuário (você), siga o passo a passo que já fizemos: crie a conta em
Authentication → Users e depois insira a linha em `usuarios` com o mesmo UID.

**A partir daí, os próximos usuários podem ser criados direto pela tela do
sistema** (menu Usuários, visível só para quem tem cargo `admin`) — não
precisa mais mexer no banco. Um detalhe: se no seu projeto Supabase estiver
ativado "Confirm email" (Authentication → Providers → Email), a pessoa criada
vai precisar confirmar o e-mail antes do primeiro login. Para uso interno,
muita gente prefere desativar essa opção para simplificar.

Funcionários (para a folha de pagamento) já podem ser cadastrados
normalmente pela tela, sem essa exigência de conta de login.

Duas migrações adicionais foram feitas depois, direto no banco (sem gerar
zip novo na hora, pois eram só SQL): `migration_006_corrige_duplicacao_estoque.sql`
(corrige a duplicação de estoque causada por um gatilho que já existia no
banco) e `migration_007_grupos_e_nf_unica.sql` (número de nota fiscal único
em todo o sistema, e a tabela de grupos de produtos usada no cadastro de
produto). Se ainda não rodou esses dois, rode agora, nessa ordem.

## Estrutura do projeto

```
src/
  App.jsx       -> todo o sistema (telas, componentes, integração com Supabase)
  main.jsx      -> ponto de entrada do React
  index.css     -> estilos base (Tailwind)
.env            -> credenciais do Supabase (não versionar / não compartilhar)
```

## Observação sobre segurança

O login atual é uma seleção simples de usuário (sem senha), e o RLS libera
acesso total para quem tiver a chave anon/publishable do projeto — adequado
para uso interno com poucos funcionários de confiança. Se quiser autenticação
real (senha, sessão por usuário), isso pode ser adicionado depois com o
Supabase Auth.


## Recursos financeiros adicionados

A migração `migration_008_financeiro_historico.sql` adiciona:

- Parcelamento automático em **Contas a receber**: informe valor total, quantidade de parcelas, primeiro vencimento e intervalo em dias; o sistema cria todas as parcelas automaticamente e ajusta os centavos na última parcela.
- **Relatórios financeiros** com contas a receber, contas a pagar e fluxo de caixa, com filtro por período e exportação CSV.
- **Histórico de alterações por usuário**, registrando inclusão, alteração e exclusão com usuário, data, módulo e dados antes/depois.
- O histórico fica disponível para administradores no menu **Histórico de alterações**.

Execute `migration_008_financeiro_historico.sql` no SQL Editor do Supabase depois das migrações anteriores.
