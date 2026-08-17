# Como acompanhar o deploy direto no terminal

O `PUBLICAR_GITHUB.bat` agora consegue mostrar o progresso do deploy no Render
em tempo real, direto na mesma janela onde você publica. Isso é opcional — se
você não configurar nada, o script continua funcionando exatamente como antes
(só abre o site no navegador no final).

## Configuração (feita uma única vez)

Na primeira vez que o script chegar nessa etapa, ele vai pedir duas coisas:

### 1. Sua API key do Render
Gere uma em: https://dashboard.render.com/u/settings#api-keys
Cole quando o script pedir. Ela fica salva como variável de ambiente do
Windows (não vai para nenhum arquivo do projeto, e nunca é enviada ao GitHub).

### 2. Os IDs dos dois serviços
No painel do Render, abra cada serviço e copie o ID que aparece na URL
(começa com `srv-`), por exemplo:
`https://dashboard.render.com/web/srv-abc123xyz` → o ID é `srv-abc123xyz`

Você vai colar o ID de:
- `odonto-excellence-api` (o backend)
- `odonto-excellence-portal` (o frontend)

Esses IDs ficam salvos em `render-config.json`, na pasta do projeto — esse
arquivo **não vai para o GitHub** (já está no `.gitignore`).

## O que você vai ver depois de configurado

Depois de cada `git push` bem-sucedido, o terminal mostra o status de cada
serviço em tempo real, por exemplo:

```
Acompanhando o deploy no Render (isso pode levar alguns minutos)...

  [API] na fila
  [API] construindo (build)
  [API] publicando
  [API] no ar
  [API] Concluido.
  [Portal] construindo (build)
  [Portal] no ar
  [Portal] Concluido.

Deploy concluido nos dois servicos.
```

Se algo der errado no deploy (falha de build, por exemplo), o script avisa
com destaque em vermelho, para você já saber que precisa checar os logs no
painel do Render antes de considerar a publicação concluída.

## Se você pular a configuração

Se, na hora do pedido, você só apertar Enter sem colar nada, o script pula o
acompanhamento automático e volta ao comportamento de sempre: só abre o site
no navegador. Você pode configurar depois, rodando o publicar de novo.
