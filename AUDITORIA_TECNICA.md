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

## 🟢 Rodada seguinte — bug do campo de busca e tom do aviso do chat

### 12. Campo de busca "travado" com autofill do navegador
- **Onde**: campo de busca no painel Admin (lista de contas).
- **Problema relatado**: o campo de busca aparecia com "daniel" já digitado, destacado, e não dava para
  apagar. Isso era o navegador (Chrome/Edge) sugerindo autofill — o campo não tinha `autoComplete="off"`
  e o texto ao redor ("nome ou usuário") faz o navegador associar o campo a dados de perfil salvos.
- **Correção**: adicionado `autoComplete="off"` e atributos equivalentes, além de um **botão de limpar
  (X)** que sempre funciona, independente do comportamento do navegador. Também adicionei uma mensagem
  clara quando a busca não encontra nada — porque, como sua própria conta de administrador nunca aparece
  nessa lista, buscar pelo seu próprio nome sempre resultará em "nenhum resultado", o que antes parecia
  um erro (lista em branco) e agora é explicado na tela.

### 13. Indicador de carregamento na lista de contas
- Adicionado um estado de carregamento visível ("Carregando contas...") na primeira busca da lista, e um
  ícone girando no botão "Atualizar" enquanto a atualização está em andamento.

### 14. Aviso do chat: tom mais sério e direto
- Reescrevi o aviso de "Em breve" do chat para ser mais direto e profissional: chip vermelho
  "Indisponível" no lugar do chip amarelo "Em breve", e um alerta de destaque (ícone de cadeado,
  variação `destructive`) explicando sem rodeios que o recurso está em desenvolvimento e que nada
  enviado ali é entregue ou salvo de verdade. Removido o tom mais "de marketing" que comparava com
  WhatsApp.

### Validação final
Rodei `pnpm install`, `pnpm run typecheck` (4 workspaces) e `pnpm run build` (mockup-sandbox, api-server,
odonto-excellence) mais uma vez após essas mudanças — tudo passou limpo, sem erros.

## 🟢 Rodada seguinte — presença real no chat + indicador de sincronização em todo o app

### 15. Chat: presença online/offline e "visto por último" (dados reais)
- Novo endpoint `GET /odonto-portal/team/presence`, disponível para qualquer usuário logado (não só
  admin), retornando quem da própria equipe está online agora e quando foi visto pela última vez.
- **Isso reaproveita uma infraestrutura que já existia e já funcionava de verdade**: o app já envia um
  "heartbeat" ao servidor a cada 45 segundos, e o painel Admin já calculava "online" como
  `lastSeenAt` nos últimos 90 segundos. Só faltava expor esse dado pra tela de chat — não é mock, é
  presença real, com o mesmo mecanismo que já gera "ficar offline sozinho quando sai do sistema" (o
  heartbeat para de ser enviado e, passados 90s, a pessoa aparece como offline automaticamente).
- Bolinha verde/cinza no avatar de cada contato + texto "Visto por último hoje às HH:MM" / "ontem às
  HH:MM" / "DD/MM às HH:MM", com uma função de formatação própria (`formatLastSeen`).
- Isso também aparece no cabeçalho da conversa ativa.

### 16. Chat: indicador de digitação e confirmação de leitura (ilustrativos, claramente identificados)
- Como o envio de mensagens continua bloqueado (nenhuma infraestrutura de mensagens de verdade existe
  ainda), adicionei esses dois elementos **apenas como demonstração visual do que vai existir quando o
  recurso for liberado** — com identificação explícita na tela ("exemplo: indicador de digitação",
  "Mensagens abaixo: pré-visualização de layout, nada é enviado de fato"). A tela agora deixa muito claro
  o que é real (presença) e o que é ilustrativo (digitação, confirmação de leitura nas mensagens de
  exemplo), para não passar a impressão de que o chat já funciona de ponta a ponta.

### 17. Indicador de sincronização em todo o sistema
- Novo indicador no cabeçalho, visível em **todas as telas** (Painel, Meu dia, Histórico, Treinamento,
  Chat, Configurações, Admin): mostra "Sincronizado às HH:MM" quando tudo está em dia, "Sincronizando..."
  durante o salvamento, ou um aviso "Sem conexão" (com ícone de alerta) se a última tentativa de
  sincronizar com o servidor falhou.
- Implementado com um novo Context (`SyncStatusContext`), seguindo o mesmo padrão que o app já usa para
  autenticação e notificações — não precisou alterar a assinatura de nenhuma das 7 telas que usam o
  layout principal (`AppShell`).
- Antes, se a sincronização falhasse silenciosamente (ex: instabilidade de rede), o usuário não tinha
  como saber se os dados estavam realmente salvos no servidor ou só localmente no navegador. Agora fica
  visível.

### Validação final (2ª rodada)
`pnpm install`, `pnpm run typecheck` e `pnpm run build` completos rodados de novo após essas mudanças —
tudo passou limpo, sem erros, incluindo o novo Context de sincronização.

## 🟢 Rodada seguinte — correção definitiva da busca, contatos reais do chat por hierarquia, textos enxutos e scripts blindados

### 18. Campo de busca: correção definitiva
- A tentativa anterior (`autoComplete="off"` + botão limpar) não foi suficiente — alguns navegadores
  ignoram `autoComplete="off"` para campos que parecem "nome" por heurística própria do Chrome/Edge.
- **Correção mais robusta**: campo alterado para `type="search"` (navegadores não aplicam heurística de
  autofill de perfil em campos de busca) combinado com `autoComplete="new-password"` — um truque
  amplamente usado e testado para desativar de vez sugestões de autofill em campos que não são senha.
  Também escondido o "x" nativo do navegador (que apareceria duplicado com o nosso botão de limpar).

### 19. Chat: contatos reais por hierarquia de conta (controle de acesso de verdade, não só visual)
- Novo endpoint `GET /odonto-portal/team/chat-contacts`, com regras aplicadas **no servidor** (a pessoa
  não consegue ver quem não deveria, nem manipulando a tela):
  - **Criador (desenvolvedor)**: vê todos os usuários ativos do sistema.
  - **Gerente**: vê sua própria equipe (contas com `managerId` apontando pra ele) + o desenvolvedor.
  - **Membro de equipe**: vê seu gerente + o desenvolvedor.
  - **Individual**: vê somente o desenvolvedor.
- O desenvolvedor aparece com uma etiqueta "Dev" na lista de contatos e no cabeçalho da conversa.
- A tela de chat parou de usar a equipe local de agenda (`store.collaborators`, que são registros de
  atendimento, não contas de usuário) e passou a usar contas de portal de verdade.

### 20. Textos do chat: bem mais enxutos, como pedido
- O aviso grande foi reduzido para o essencial: "Em desenvolvimento. Disponível em breve."
- Removidas as legendas extras dentro da conversa ("dados reais" vs "pré-visualização"); ficou só um
  chip discreto "Em breve".
- O indicador de digitação ilustrativo agora é só os três pontinhos (estilo Instagram) — sem nomear
  ninguém e sem texto explicativo por cima.

### 21. Scripts `.bat` blindados contra os erros já enfrentados
Reescrevi o `PUBLICAR_GITHUB.bat` e o `RODAR_LOCAL.bat` para se recuperar sozinhos dos três problemas
reais que apareceram durante o uso:
- **Identidade do Git ausente** ("Author identity unknown"): o script agora detecta isso *antes* de
  tentar commitar, pede seu nome e e-mail uma única vez, e configura sozinho.
- **Scripts de build bloqueados pelo pnpm** (erro `ERR_PNPM_IGNORED_BUILDS`, que travava o `esbuild`):
  o script agora aprova isso automaticamente (`pnpm approve-builds --all`) logo após instalar.
- **Push rejeitado por histórico divergente** (exatamente o que aconteceu com o commit do ChatGPT): antes
  de tentar enviar, o script busca o que há de novo no GitHub. Se detectar que o remoto tem commits que
  você não tem localmente, **ele para e avisa com clareza**, em vez de simplesmente falhar com uma
  mensagem técnica — e propositalmente **não força o envio sozinho**, para não apagar nenhum trabalho
  remoto sem você (ou eu) revisar primeiro.
- Instalação agora usa `--no-frozen-lockfile`, evitando falhas por pequenas diferenças de lockfile entre
  máquinas.

### Validação final (3ª rodada)
`pnpm run typecheck` e `pnpm run build` rodados novamente após o redesenho do chat — passaram limpos
(exit code 0 confirmado em ambos).

## 🔴 Bug crítico encontrado e corrigido — o .bat abria e fechava na hora

### 22. Causa raiz: quebra de linha errada no arquivo
- Ao reescrever o `PUBLICAR_GITHUB.bat` e o `RODAR_LOCAL.bat` na rodada anterior, o arquivo foi salvo
  usando quebra de linha estilo Unix (`LF`), sem o `CR` que o Windows exige para arquivos `.bat`. O
  `cmd.exe` do Windows falha ao interpretar isso — o script abre e fecha instantaneamente, sem nem
  mostrar mensagem de erro (a janela fecha rápido demais para ler).
- Além disso, os comentários usavam travessões decorativos Unicode ("──"), que embora não devessem
  quebrar nada com `chcp 65001`, foram removidos por segurança e trocados por traços ASCII simples —
  igual ao estilo do script original, que nunca usou nenhum caractere especial.

### 23. Correção aplicada e verificada byte a byte
- Os dois arquivos foram normalizados para `CRLF` correto (confirmado programaticamente: zero
  quebras de linha soltas/inconsistentes, zero bytes fora do ASCII).
- A lógica de detecção de divergência do Git (adicionada na rodada anterior) foi simplificada, trocando
  um método baseado em arquivos temporários por um padrão mais direto já usado com sucesso em outra
  parte do mesmo script — reduzindo pontos de falha.
- Parênteses balanceados confirmados nos dois arquivos (20/20 e 5/5).

### Validação final (4ª rodada)
`pnpm run typecheck` (exit code 0) e `pnpm run build` (exit code 0) rodados mais uma vez, do zero, após
a correção dos scripts `.bat` — confirmando que a correção não afetou nada do código do app.

## 🟢 Nova funcionalidade — acompanhar o deploy do Render direto no terminal

### 24. `verificar-deploy.ps1`: acompanhamento real do deploy
- A chave de API do Render que você quis usar antes não podia ser usada por mim (meu ambiente de
  sandbox não tem acesso à internet do Render) — mas o `.bat` roda na **sua** máquina, que tem acesso
  total. Implementei isso ali.
- Novo script `verificar-deploy.ps1`, chamado automaticamente pelo `PUBLICAR_GITHUB.bat` depois de um
  push bem-sucedido. Ele consulta a API oficial do Render
  (`GET /v1/services/{serviceId}/deploys`, documentação confirmada em api-docs.render.com) e mostra o
  progresso do deploy em tempo real no terminal — para a API e para o Portal, separadamente.
- **Configuração é opcional e feita uma única vez**: na primeira vez, o script pede sua API key do
  Render (salva como variável de ambiente do Windows, nunca em arquivo do projeto) e os IDs dos dois
  serviços (salvos em `render-config.json`, adicionado ao `.gitignore` — nunca vai para o GitHub). Se
  você pular essa configuração, o script continua funcionando do jeito antigo, sem travar nada.
- O script tenta identificar o deploy do commit que você acabou de enviar (comparando o hash), em vez de
  simplesmente mostrar o status de um deploy anterior que já tivesse terminado — para não te dar uma
  informação enganosa logo após o push.
- **Bug de compatibilidade encontrado e corrigido antes de entregar**: quando a API do Render retorna
  exatamente 1 deploy, o PowerShell 5.1 (o que vem por padrão no Windows) não embrulha isso numa lista,
  e o código quebraria ao tentar contar itens. Corrigido forçando o formato de lista sempre.
- Passo a passo completo de configuração em `COMO_ACOMPANHAR_DEPLOY.md`.

### Validação final (5ª rodada)
`pnpm run typecheck` (exit code 0) e `pnpm run build` (exit code 0) confirmados novamente após adicionar
o script de acompanhamento de deploy.

## 🔴 Segunda ocorrência do bug crítico — blindagem em camadas

### 25. O .bat voltou a fechar sozinho, sem mostrar erro
- Mesmo depois da correção de codificação (CRLF), o `PUBLICAR_GITHUB.bat` fechou sozinho de novo, sem
  mostrar nenhuma mensagem. Como não dá para garantir 100% que não existe algum problema sutil de
  parsing que eu não previu, mudei de estratégia: em vez de só corrigir o arquivo, redesenhei a
  estrutura para ser **à prova de falhas por design**.

### 26. Blindagem em camadas: um arquivo "wrapper" quase impossível de quebrar
- `PUBLICAR_GITHUB.bat` agora é um arquivo mínimo (17 linhas), com a única função de chamar a lógica
  real (`_publicar-interno.bat`) e **garantir que a janela sempre mostre alguma mensagem antes de
  fechar**, não importa o que aconteça dentro da lógica real.
- Toda a lógica de validação, git, build e push foi movida para `_publicar-interno.bat` — se esse
  arquivo tiver qualquer problema (incluindo um erro de sintaxe fatal), o `call` a partir do wrapper
  ainda devolve o controle para o wrapper, que sempre chega até o `pause` final.
- Também removi o `chcp 65001` (não era mais necessário, já que os dois arquivos são 100% ASCII) —
  um fator a menos que poderia causar comportamento inesperado no console do Windows.
- Se o processo terminar com erro, o wrapper agora mostra explicitamente o código de saída e pede para
  você copiar a tela e mandar pra mim junto com o arquivo `_publicar-interno.bat`.

### Validação final (6ª rodada)
`pnpm run typecheck` (exit code 0) e `pnpm run build` (exit code 0) confirmados mais uma vez. Todos os
4 arquivos do Windows (`PUBLICAR_GITHUB.bat`, `_publicar-interno.bat`, `RODAR_LOCAL.bat`,
`verificar-deploy.ps1`) verificados byte a byte: zero caracteres fora do ASCII, zero quebras de linha
inconsistentes, parênteses balanceados.

## ⚠️ Nota importante sobre os prints enviados

Os prints mostrando a busca ainda travada e o texto grande do chat eram de uma versão **anterior** às
correções já feitas — muito provavelmente porque o `PUBLICAR_GITHUB.bat` estava travando antes de você
conseguir publicar com sucesso. Já confirmei no código-fonte: as duas correções (busca com
`type="search"` + `autoComplete="new-password"`, e o texto do chat reduzido para "Em desenvolvimento.
Disponível em breve.") já estavam presentes. Com o `.bat` blindado desta vez, a publicação deve
finalmente refletir tudo isso no site.

## 🟢 Nova funcionalidade — modo claro/escuro

### 27. Alternância de tema, com persistência real
- Novo campo `theme: "light" | "dark"` em `PortalPreferences`, sincronizado igual as outras
  preferências (autoRefresh, modo compacto, etc.) — ou seja, a escolha de tema é salva no servidor e
  volta a aparecer mesmo trocando de dispositivo.
- **Botão de acesso rápido** (ícone sol/lua) no cabeçalho, visível em todas as telas do sistema.
- **Seletor explícito** também na tela de Configurações, com os dois botões "Claro" e "Escuro" lado a
  lado (mais claro que um simples checkbox, já que são duas opções, não liga/desliga).
- Implementado com um novo Context (`ThemeContext`), seguindo o mesmo padrão já usado no app — sem
  precisar alterar a assinatura das 7 telas que usam o layout principal.
- A paleta escura mantém a identidade visual da marca (vermelho), só invertendo fundos/textos para tons
  escuros, com contraste ajustado para leitura confortável.

### Validação final (7ª rodada)
`pnpm run typecheck` (exit code 0) e `pnpm run build` (exit code 0) confirmados após a implementação do
tema.

