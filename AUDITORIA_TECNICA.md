# Auditoria Técnica — Odonto Excellence

Data: agosto de 2026
Escopo: `artifacts/api-server` (backend), `artifacts/odonto-excellence` (frontend), `lib/db` (schema).

Este documento lista tudo que foi **encontrado** e **corrigido de fato** nesta rodada, e o que fica como
**recomendação para as próximas rodadas** (não foi alterado ainda, por ser um trabalho maior e arriscado
de fazer às pressas).

---

## 🔴 Corrigido — Crítico

### 1. Escolha de "Gerente/Individual" no cadastro público (o pedido original)
- **Onde**: `artifacts/odonto-excellence/src/App.tsx` (formulário de cadastro) e
  `artifacts/api-server/src/routes/odontoPortalAuth.ts` (`POST /auth/register`).
- **Problema**: apesar de uma correção anterior ter sido relatada, o campo "Tipo de acesso" ainda existia
  na tela pública, e o backend ainda lia `accountType` direto do corpo da requisição.
- **Correção**: campo removido da UI. O backend agora **ignora completamente** qualquer `accountType`
  vindo do cliente. Toda conta nova nasce neutra, inativa e `pending`. Só o criador define o tipo, e só
  no momento da aprovação.

### 2. Bootstrap do admin rodava em TODA requisição, para sempre
- **Onde**: `artifacts/api-server/src/lib/odontoPortalAuth.ts`, função `bootstrapAdmin()`.
- **Problema**: quando a variável `ODONTO_ADMIN_PASSWORD` não estava definida, a flag `bootstrapComplete`
  nunca era marcada como `true`. Resultado: **10+ comandos `ALTER TABLE`/`UPDATE` no banco em toda única
  requisição HTTP**, para sempre. Isso é uma explicação plausível para lentidão/erros no deploy do Render.
- **Correção**: a flag agora é marcada mesmo quando não há senha de admin configurada. As migrações rodam
  uma única vez por processo.

### 3. Senha do administrador era resetada sozinha
- **Onde**: mesma função `bootstrapAdmin()`.
- **Problema**: se o hash salvo no banco não batesse com `ODONTO_ADMIN_PASSWORD` (variável de ambiente),
  o sistema **sobrescrevia a senha automaticamente** e derrubava todas as sessões. Ou seja: se você (o
  criador) trocasse sua própria senha pelo app, na próxima requisição o sistema revertia a troca sozinho.
- **Correção**: o bootstrap nunca mais mexe na senha de uma conta já existente. A variável de ambiente só
  é usada para criar a conta na primeira vez.

### 4. CORS aberto para qualquer origem, com credenciais
- **Onde**: `artifacts/api-server/src/app.ts`.
- **Problema**: `origin: portalOrigin ? [portalOrigin] : true` combinado com `credentials: true`. Se a
  variável `PORTAL_ORIGIN` não estivesse configurada no Render, **qualquer site na internet** conseguia
  fazer requisições autenticadas usando o cookie de sessão de quem estivesse logado (um dos erros de CORS
  mais graves e mais comuns que existem).
- **Correção**: em produção, a lista de origens permitidas agora é obrigatória — se não estiver
  configurada, o servidor recusa requisições cross-origin em vez de aceitar de qualquer lugar. Também
  configurei `PORTAL_ORIGIN` direto no `render.yaml` com o domínio real do frontend
  (`https://odonto-excellence-portal.onrender.com`), então isso já fica resolvido sem depender de alguém
  lembrar de configurar manualmente no painel do Render.

---

## 🟠 Corrigido — Importante

### 5. Sem headers de segurança HTTP
- **Adicionado**: pacote `helmet` no backend (`app.ts` + `package.json`), habilitando proteções padrão
  contra clickjacking, sniffing de MIME type, etc.

### 6. Rate limiter de login vazava memória
- **Onde**: `loginRateLimit()` em `odontoPortalAuth.ts` (lib).
- **Problema**: o `Map` de tentativas de login só crescia, nunca era limpo — um vazamento de memória
  lento e contínuo enquanto o processo ficasse no ar.
- **Correção**: limpeza periódica de entradas expiradas.

### 7. Sem limite explícito de tamanho do corpo da requisição
- **Correção**: `express.json({ limit: "1mb" })` e `urlencoded` com o mesmo limite, em vez do padrão
  implícito do Express.

### 8. Política de senha inconsistente
- **Problema**: o cadastro público exigia só 8 caracteres; a troca de senha já logado exigia 8
  caracteres **+ letra + número**. Padronizei os dois para a mesma regra.

### 9. UX: tela em branco durante a checagem de login
- **Onde**: `App.tsx`, componente raiz.
- **Problema**: enquanto o app verificava se havia uma sessão válida, a tela ficava **completamente em
  branco** — parece travado/quebrado.
- **Correção**: adicionado um indicador de carregamento simples nesse intervalo.

### 10. UX: ações destrutivas sem confirmação
- **Onde**: exclusão de consulta (`CollaboratorWorkspace`) e suspensão/recusa de conta (`Admin`).
- **Problema**: o projeto já tinha um componente de diálogo de confirmação pronto
  (`components/ui/alert-dialog.tsx`, shadcn/radix) **mas ele nunca era importado nem usado em lugar
  nenhum do app**. Resultado prático: um único clique apagava a consulta de um paciente para sempre, ou
  suspendia/recusava o acesso de alguém, sem chance de voltar atrás.
- **Correção**: conectei o componente existente e adicionei confirmação com o nome da pessoa/paciente
  envolvido nos três pontos mais arriscados:
  - Excluir consulta de paciente
  - Suspender acesso de um usuário já ativo
  - Recusar um pedido de acesso pendente
  (Reativar uma conta continua imediato, por não ser uma ação destrutiva.)

### 11. UX: dica de senha ausente no cadastro
- Adicionado texto explicando a regra real de senha (8+ caracteres, letra e número) diretamente no
  formulário, para o usuário não descobrir a regra só depois de um erro no envio.

---

## 🟡 Verificado e já estava correto (não mexi)

- Notificações só carregam depois do login (frontend **e** backend já bloqueavam corretamente).
- Endpoint de estado do dashboard (`/odonto-portal/state`) é sempre filtrado pelo `workspaceOwnerId` da
  sessão — sem IDOR (usuário não consegue ler/escrever dado de outro workspace trocando um ID na
  requisição).
- Endpoint de marcar notificação como lida já verifica dono da notificação.
- Senha nunca é armazenada em `localStorage` no frontend; não há `dangerouslySetInnerHTML` (sem vetor de
  XSS óbvio ali).
- Hashing de senha usa `scrypt` com salt aleatório e comparação em tempo constante
  (`timingSafeEqual`) — abordagem correta.

---

## 🔵 Recomendações sérias para a próxima rodada (ainda não feitas)

Estas exigem mudanças maiores e mais arriscadas para fazer às pressas numa única passada — prefiro te
avisar com transparência em vez de mexer sem testar direito:

1. **`App.tsx` tem ~4800 linhas.** Um único arquivo concentrando login, cadastro, dashboard, admin,
   notificações, etc. Isso dificulta manutenção e aumenta o risco de um ajuste em uma tela quebrar outra
   sem ninguém perceber. Recomendo quebrar em módulos por domínio (auth/, admin/, dashboard/) com testes
   antes de cada extração.
2. **Sem testes automatizados** no backend nem no frontend. Qualquer alteração futura (inclusive as que
   fiz aqui) depende de teste manual. Vale começar por testes de integração dos endpoints de auth/admin,
   que são os mais sensíveis.
3. **Sem CI configurado** para rodar `typecheck`/testes automaticamente a cada commit (havia menção a um
   "Quality Gate" numa conversa anterior, mas não encontrei o workflow no zip enviado — vale confirmar se
   ele existe no repositório do GitHub).
4. **Rate limiting só existe no login/registro.** Endpoints de admin (criar usuário, notificações) não
   têm limite de chamadas — um gerente comprometido poderia ser abusado para spam de notificações, por
   exemplo.
5. **Sessões não têm invalidação em massa fácil** (ex: "encerrar todas as minhas sessões em outros
   dispositivos") — hoje só acontece automaticamente em troca de senha.
6. **Sem página 2FA/verificação adicional** para a conta do criador, que tem acesso total ao sistema.

## 🟢 Novidades desta rodada — Chat (pré-visualização) e mais controle no Admin

### Chat privado da equipe (`/chat`)
- Nova tela no estilo WhatsApp: lista de contatos da equipe + thread de conversa com bolhas de
  mensagem, emoji picker, botão de anexar/colar imagem e campo de texto.
- **Importante**: por pedido explícito, o chat continua **funcionalmente indisponível**. Qualquer
  tentativa real de enviar mensagem, anexar imagem, colar imagem ou usar um emoji dispara a mensagem
  "Funcionalidade ainda não liberada pelo dev." — nada é enviado, salvo ou compartilhado de verdade.
  As mensagens exibidas na thread são uma pré-visualização estática, claramente identificada como tal.
- Isso é só a casca visual (UI/UX) do recurso. Construir o chat de verdade (mensagens persistidas,
  entrega em tempo real, upload/armazenamento de imagem, criptografia/privacidade entre usuários) é um
  projeto à parte, que exige novas tabelas no banco, novos endpoints e uma camada de tempo real
  (WebSocket ou polling) — não fiz isso agora, para não prometer algo que não está pronto.

### Painel do administrador: liberação do chat
- Endpoint novo `PATCH /odonto-portal/admin/settings` (só o criador) + `GET /odonto-portal/settings`
  (qualquer usuário logado), reaproveitando uma tabela do banco (`odonto_portal_states`) que já existia
  no schema mas nunca tinha sido usada em nenhuma rota.
- Botão real no painel Admin para "Liberar chat ao vivo" — o estado é salvo de verdade no banco. A
  interface deixa claro que isso só sinaliza a intenção; o recurso de mensagens em si continua bloqueado
  para todos, como você pediu.

### Mais controles no Admin
- **Aprovação em lote**: aprova todos os pedidos pendentes de uma vez (como ambientes individuais —
  você ainda pode promover alguém a gerente depois, individualmente).
- **Exportar CSV**: baixa a lista de contas (nome, usuário, tipo, status, criado em, último acesso).
- Corrigido um efeito colateral que a aprovação em lote teria causado: a função de atualizar conta
  recarregava a lista inteira e mostrava um toast a cada chamada — adicionado um modo silencioso para
  operações em lote não spammarem notificações repetidas.

### Verificação de sintaxe e validação real
Além da checagem de sintaxe com `esbuild`, rodei o processo completo de verdade neste ambiente:
`pnpm install`, `pnpm run typecheck` (nos 4 workspaces) e `pnpm run build` (mockup-sandbox, api-server e
odonto-excellence) — os mesmos comandos que o `PUBLICAR_GITHUB.bat` executa. Tudo passou limpo.

**Bug encontrado e corrigido nessa validação**: a correção de segurança do cadastro (item 1 desta
auditoria) tinha deixado `requestedType` sempre igual a `"individual"`. O TypeScript, corretamente,
detectou que uma comparação posterior (`requestedType === "manager"`) nunca poderia ser verdadeira e
recusou compilar (erro `TS2367`). Simplifiquei o código removendo essa comparação morta — o
`teamMemberLimit` de uma conta recém-cadastrada agora é sempre `0` diretamente, já que o tipo é sempre
`"individual"` até o criador decidir o contrário na aprovação.

O `pnpm-lock.yaml` também foi atualizado para incluir a nova dependência `helmet`, evitando qualquer
inconsistência na hora de instalar em outra máquina.

