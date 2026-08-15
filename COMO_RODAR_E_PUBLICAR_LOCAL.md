# Odonto Excellence - uso local

Este projeto agora tem dois atalhos para Windows.

## Rodar local

Execute:

```bat
RODAR_LOCAL.bat
```

O script instala as dependencias, abre o navegador em `http://localhost:5173` e roda o portal local conectado a API publicada em producao.

## Publicar alteracoes

Depois de mexer no projeto local, execute:

```bat
PUBLICAR_GITHUB.bat
```

O script instala as dependencias, valida o build, cria um commit com a mensagem escolhida e envia para `origin/main`. O deploy em producao e iniciado automaticamente pelo Render depois do push.

## Observacao

Arquivos pesados de diagnostico, exports, screenshots e anexos antigos nao devem ser versionados. Os assets oficiais usados pelo portal ficam em `artifacts/odonto-excellence/public`.
