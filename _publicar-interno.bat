@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo.
echo ========================================
echo  Odonto Excellence - publicar no GitHub
echo ========================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo Git nao encontrado. Instale o Git e execute novamente.
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale o Node.js LTS e execute novamente.
  exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo pnpm nao encontrado. Tentando ativar via Corepack...
  call corepack enable
  if errorlevel 1 (
    echo Nao foi possivel ativar o pnpm automaticamente.
    exit /b 1
  )
)

REM ---- Blindagem 1: identidade do Git ----
REM Sem isso, o commit falha la na frente com "Author identity unknown".
REM Detecta e corrige automaticamente antes de chegar nessa etapa.
git config user.name >nul 2>nul
if errorlevel 1 (
  echo.
  echo O Git ainda nao esta configurado com seu nome e e-mail.
  echo Isso e feito apenas uma vez nesta maquina.
  set "GIT_NAME="
  set /p GIT_NAME=Seu nome completo: 
  set "GIT_EMAIL="
  set /p GIT_EMAIL=Seu e-mail do GitHub: 
  if "!GIT_NAME!"=="" set "GIT_NAME=Odonto Excellence"
  if "!GIT_EMAIL!"=="" set "GIT_EMAIL=odonto@local.dev"
  git config --global user.name "!GIT_NAME!"
  git config --global user.email "!GIT_EMAIL!"
  echo Identidade do Git configurada.
  echo.
)

echo Instalando/atualizando dependencias...
call pnpm install --no-frozen-lockfile
if errorlevel 1 (
  echo Falha ao instalar dependencias.
  exit /b 1
)

REM ---- Blindagem 2: scripts de build bloqueados pelo pnpm ----
REM O pnpm bloqueia por seguranca scripts de instalacao de pacotes nativos
REM (ex: esbuild). Sem isso, o typecheck/build falha silenciosamente depois.
call pnpm approve-builds --all >nul 2>nul

echo.
echo Validando projeto antes de publicar...
set "PORT=5173"
set "BASE_PATH=/"
set "VITE_ODONTO_API_URL=https://odonto-excellence-api.onrender.com/api"
call pnpm run build
if errorlevel 1 (
  echo.
  echo A validacao falhou. Corrija os erros indicados acima antes de publicar.
  echo Se precisar de ajuda, copie toda esta tela e envie para o Claude.
  exit /b 1
)

set "HAS_CHANGES="
for /f "delims=" %%i in ('git status --porcelain') do set "HAS_CHANGES=1"
if not defined HAS_CHANGES (
  echo Nao ha alteracoes para publicar.
  exit /b 0
)

set "COMMIT_MSG="
set /p COMMIT_MSG=Mensagem da versao (Enter para usar padrao): 
if "%COMMIT_MSG%"=="" set "COMMIT_MSG=chore: update odonto local version"

echo.
echo Preparando commit...
git add -A
if errorlevel 1 (
  echo Falha ao preparar arquivos.
  exit /b 1
)

git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
  echo Falha ao criar commit.
  exit /b 1
)

REM ---- Blindagem 3: push rejeitado por historico divergente ----
REM Antes de tentar enviar, busca o que ha de novo no GitHub. Se alguem (ou
REM alguma outra ferramenta/IA) publicou algo direto no repositorio sem
REM passar por aqui, evita um "push --force" as cegas: avisa com clareza e
REM deixa voce decidir, em vez de so falhar com uma mensagem tecnica.
echo.
echo Verificando se ha novidades no GitHub...
git fetch origin main >nul 2>nul

set "LOCAL_HEAD="
set "REMOTE_HEAD="
set "MERGE_BASE="
for /f "delims=" %%h in ('git rev-parse HEAD 2>nul') do set "LOCAL_HEAD=%%h"
for /f "delims=" %%h in ('git rev-parse origin/main 2>nul') do set "REMOTE_HEAD=%%h"
for /f "delims=" %%h in ('git merge-base HEAD origin/main 2>nul') do set "MERGE_BASE=%%h"

if not defined REMOTE_HEAD goto :push_ok
if "%REMOTE_HEAD%"=="%LOCAL_HEAD%" goto :push_ok
if "%MERGE_BASE%"=="%REMOTE_HEAD%" goto :push_ok

echo.
echo ========================================================
echo  ATENCAO: o GitHub tem commits que voce nao tem aqui.
echo ========================================================
echo Isso normalmente acontece quando alguem (ou alguma ferramenta,
echo como um assistente de IA com acesso ao repositorio) publicou
echo algo diretamente no GitHub sem passar por esta maquina.
echo.
echo Para nao apagar esse trabalho remoto sem voce ver o que e,
echo este script NAO vai forcar o envio sozinho.
echo.
echo Copie esta tela e peca para o Claude revisar o que ha de novo
echo no GitHub (comando: git log --oneline origin/main -10) antes
echo de decidir como prosseguir.
exit /b 1

:push_ok
echo.
echo Enviando para GitHub/main...
git push origin main
if errorlevel 1 (
  echo Falha ao enviar para o GitHub.
  exit /b 1
)

echo.
echo Publicado. O Render deve iniciar o deploy automaticamente.

set "PUSHED_SHA="
for /f "delims=" %%h in ('git rev-parse HEAD 2>nul') do set "PUSHED_SHA=%%h"

where powershell >nul 2>nul
if not errorlevel 1 (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0verificar-deploy.ps1" -CommitSha "%PUSHED_SHA%"
)

start "" "https://odonto-excellence-portal.onrender.com"
exit /b 0
