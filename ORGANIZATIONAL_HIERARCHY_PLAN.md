# Hierarquia organizacional e perfis vinculados

## Objetivo

Evoluir o Portal Odonto Excellence para uma hierarquia de autorização explícita e auditável:

`Creator > Supervisor > Gerente > Membro`

Contas `individual` permanecem fora da árvore operacional.

## Princípios

1. **Admin é exclusivo do Creator.** Não basta esconder a aba: toda rota `/odonto-portal/admin/*` deve recusar qualquer outro papel no servidor.
2. **Supervisor não é um gerente mais forte.** A relação Supervisor -> Gerente é persistida separadamente e cada gerente pertence a no máximo um supervisor.
3. **Escopo é calculado no backend.** IDs enviados pelo navegador nunca concedem acesso.
4. **Pessoa e Login são conceitos diferentes.** Uma pessoa pode possuir mais de um login/perfil sem herdar privilégios entre eles.
5. **Dados pessoais são compartilhados; privilégios e workspaces não.** Nome/e-mail de perfis vinculados permanecem sincronizados. Função, equipe, sessões, notificações e workspace permanecem isolados por login.
6. **Mudanças críticas invalidam sessões e geram auditoria.**

## Modelo

### Pessoa

Tabela `odonto_portal_people` representa a identidade humana. Contas existentes recebem automaticamente uma pessoa própria. Duas contas podem ser vinculadas pelo Creator.

Exemplo:

- Pessoa Daniel
  - `daniel-admin`: creator, acesso global
  - `daniel-gerente`: manager, subordinado a uma supervisora e limitado à própria equipe

Os dois logins compartilham `display_name` e e-mail por `person_id`, mas mantêm senhas, sessões, account_type, manager_id e workspace_owner_id independentes.

### Supervisor

Tabela `odonto_portal_supervisor_managers` liga Supervisor a Gerentes.

- Supervisor vê somente gerentes explicitamente vinculados.
- Supervisor vê os membros cujo `manager_id` pertence aos gerentes vinculados.
- Supervisor pode administrar operacionalmente esses membros e gerentes dentro de limites definidos.
- Supervisor não acessa `/admin`, não cria/promove Supervisor/Creator e não move gerente entre supervisores.

### Auditoria

Tabela `odonto_portal_audit_log` registra operações sensíveis com ator, alvo, tipo de ação, contexto e timestamp.

## Matriz de autorização

| Operação | Creator | Supervisor | Gerente | Membro | Individual |
| --- | --- | --- | --- | --- | --- |
| Admin global | sim | não | não | não | não |
| Criar/promover Supervisor | sim | não | não | não | não |
| Vincular Gerente a Supervisor | sim | não | não | não | não |
| Ver gerentes supervisionados | todos | próprios | não | não | não |
| Ver membros de gerente | todos | descendentes | próprios | não | não |
| Criar membro | sim | em gerente descendente | própria equipe | não | não |
| Suspender/redefinir senha de membro | sim | descendentes | própria equipe | não | não |
| Alterar Creator | apenas o próprio fluxo protegido | nunca | nunca | nunca | nunca |

## Rotas novas

- `GET /odonto-portal/hierarchy/me`
- `GET /odonto-portal/hierarchy/team`
- `POST /odonto-portal/hierarchy/team/users`
- `PATCH /odonto-portal/hierarchy/team/users/:id`
- `PUT /odonto-portal/hierarchy/team/users/:id/password`
- `GET /odonto-portal/hierarchy/admin/overview` (Creator)
- `PATCH /odonto-portal/hierarchy/admin/users/:id/account-type` (Creator)
- `PUT /odonto-portal/hierarchy/admin/supervisors/:supervisorId/managers/:managerId` (Creator)
- `DELETE /odonto-portal/hierarchy/admin/supervisors/:supervisorId/managers/:managerId` (Creator)
- `POST /odonto-portal/hierarchy/admin/link-person` (Creator)
- `POST /odonto-portal/hierarchy/admin/unlink-person` (Creator)

## Segurança negativa obrigatória

- Supervisor A acessa gerente de Supervisor B -> 403/404 sem revelar existência.
- Supervisor chama qualquer `/admin/*` -> 403.
- Gerente acessa membro de outro gerente -> 404.
- Supervisor tenta promover conta -> 403.
- Alteração crítica de papel invalida sessões do alvo.
- Vinculação de identidade não copia `account_type`, `manager_id` nem `workspace_owner_id`.

## Frontend

- Creator mantém a aba Admin e recebe uma seção de Estrutura Organizacional.
- Supervisor recebe `Supervisão`, com cards consolidados e gerentes/equipes subordinadas.
- Gerente recebe `Minha equipe`, sem acesso visual nem técnico ao Admin global.
- A UI nunca decide permissão; apenas reflete `accountType` e os endpoints autorizados.

## Deploy

1. Implementar em branch isolada.
2. Typecheck workspace.
3. Build API.
4. Build Portal.
5. Quality Gate em PR.
6. Merge somente com CI verde.
7. Acompanhar API e Portal no Render no mesmo SHA.
8. Confirmar health check e logs de autorização/migração.
