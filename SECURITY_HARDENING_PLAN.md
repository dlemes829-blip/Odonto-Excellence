# Plano de hardening — Portal Odonto Excellence

Este documento organiza a evolução do portal por risco. A regra é: segurança e integridade antes de conveniência visual.

## P0 — Controle de acesso e superfície pública

- [x] Remover a escolha de Gerente/Individual do cadastro público.
- [x] Ignorar `accountType` enviado pelo cliente no cadastro.
- [x] Criar solicitações públicas como pendentes, inativas e neutras.
- [x] Exigir que o criador atribua Gerente ou Individual antes da ativação.
- [x] Não exibir toasts/notificações operacionais antes da autenticação.
- [x] Adicionar headers HTTP defensivos e limites de body.
- [x] Preparar allowlist de origens e validação de Origin para operações mutáveis.
- [ ] Configurar `PORTAL_ORIGIN`/`PORTAL_ORIGINS` no ambiente público e tornar a ausência fatal em produção.

## P1 — Autenticação e autorização

- [ ] Exigir simultaneamente `isActive=true` e `accountStatus=active` em toda sessão válida.
- [ ] Centralizar política RBAC (creator, manager, member, individual) e eliminar decisões de permissão espalhadas por UI/rotas.
- [ ] Garantir autorização por recurso/workspace em toda leitura e escrita.
- [ ] Invalidar sessões em suspensão, troca de senha, alteração crítica de papel e remoção.
- [ ] Migrar rate limit de login/cadastro para armazenamento compartilhado e adicionar limpeza/TTL.
- [ ] Limitar sessões simultâneas e registrar último uso/expiração.
- [ ] Adicionar trilha de auditoria para aprovação, suspensão, mudança de perfil, senha e operações administrativas.

## P2 — Persistência e integridade dos dados

- [x] O estado remoto já possui revisão otimista para reduzir sobrescrita concorrente.
- [ ] Validar o schema do estado no servidor; não aceitar JSON arbitrário como dado clínico/operacional.
- [ ] Separar o blob de estado em entidades (colaboradores, agenda, atividades, treinamento e preferências).
- [ ] Criar constraints/foreign keys para ownership e relações de equipe.
- [ ] Definir política de retenção e exclusão.
- [ ] Criar estratégia documentada de backup/restore e migrações versionadas.

## P3 — Arquitetura backend

- [ ] Retirar DDL/migrações de `bootstrapAdmin`; migrations devem ocorrer no deploy, não em request/startup de autenticação.
- [ ] Separar autenticação, usuários, aprovação, notificações e workspace em módulos/services próprios.
- [ ] Centralizar validação de entrada com schemas Zod.
- [ ] Padronizar erros, IDs de requisição e logs sem dados sensíveis.
- [ ] Criar health/readiness checks que validem dependências essenciais.

## P4 — Arquitetura frontend

- [ ] Decompor o `App.tsx` monolítico em rotas, features, hooks e componentes.
- [ ] Criar `AuthProvider` e guards declarativos para rotas privadas/admin.
- [ ] Remover regras de segurança baseadas em CSS; UI deve refletir a autorização real retornada pelo servidor.
- [ ] Separar estado remoto de estado visual/local.
- [ ] Padronizar loading/error/empty states e tratamento de conflito 409.
- [ ] Melhorar acessibilidade: foco, labels, navegação por teclado, aria-live e contraste.

## P5 — Qualidade, CI e operação

- [ ] Testes de integração para cadastro, login, aprovação, suspensão e isolamento de workspace.
- [ ] Testes de autorização negativa (IDOR/escalada de privilégio).
- [ ] Testes frontend dos fluxos críticos.
- [ ] CI obrigatório: typecheck, build e testes antes de merge.
- [ ] Dependabot/auditoria de dependências e atualização controlada.
- [ ] Monitoramento de erros e alertas operacionais sem PII.
- [ ] Documentar variáveis de ambiente, deploy, rollback e resposta a incidente.

## Critério de conclusão

O hardening só é considerado concluído quando um usuário não autenticado não vê dados/notificações internas, um solicitante não consegue escolher ou forjar privilégios, usuários só acessam recursos do workspace autorizado, mudanças administrativas são auditáveis e os fluxos críticos possuem testes automatizados executados no CI.
