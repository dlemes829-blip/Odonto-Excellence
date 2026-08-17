@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"

title Odonto Excellence - Publicacao Forcada e Segura

set "REPO_URL=https://github.com/dlemes829-blip/Odonto-Excellence.git"
set "BRANCH=main"

echo.
echo ==============================================
echo  Odonto Excellence - publicar TUDO no GitHub
echo ==============================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo ERRO: Git nao encontrado.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo ERRO: Node.js nao encontrado.
  pause
  exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo pnpm nao encontrado. Tentando ativar via Corepack...
  call corepack enable
  if errorlevel 1 (
    echo ERRO: Nao foi possivel ativar o pnpm.
    pause
    exit /b 1
  )
)

if not exist "package.json" (
  echo ERRO: package.json nao encontrado.
  echo Execute este BAT na raiz do projeto.
  pause
  exit /b 1
)

if not exist "pnpm-workspace.yaml" (
  echo ERRO: pnpm-workspace.yaml nao encontrado.
  pause
  exit /b 1
)

echo.
echo [1/8] Preparando Git...

if not exist ".git" (
  git init
  if errorlevel 1 goto :git_error
)

git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 goto :git_error

git remote get-url origin >nul 2>nul
if errorlevel 1 (
  git remote add origin "%REPO_URL%"
  if errorlevel 1 goto :git_error
) else (
  git remote set-url origin "%REPO_URL%"
  if errorlevel 1 goto :git_error
)

git fetch origin main --prune
if errorlevel 1 (
  echo ERRO: Nao foi possivel consultar origin/main.
  pause
  exit /b 1
)

for /f "delims=" %%S in ('git rev-parse origin/main') do set "REMOTE_SHA=%%S"
echo Main remota atual: !REMOTE_SHA!

echo.
echo [2/8] Criando backup remoto antes de qualquer sobrescrita...

for /f %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%T"
set "BACKUP_BRANCH=backup-before-local-push-!STAMP!"

git push origin "origin/main:refs/heads/!BACKUP_BRANCH!"
if errorlevel 1 (
  echo ERRO: Nao foi possivel criar o backup remoto.
  echo Nenhuma sobrescrita sera feita.
  pause
  exit /b 1
)

echo Backup criado:
echo !BACKUP_BRANCH!

echo.
echo [3/8] Fazendo a pasta LOCAL virar a fonte da verdade...
echo Os arquivos locais NAO serao apagados.

git branch -M main >nul 2>nul

REM Ancora o historico na main remota, mas preserva totalmente o worktree.
git reset --mixed origin/main
if errorlevel 1 goto :git_error

echo.
echo [4/8] Instalando dependencias...
call pnpm install --frozen-lockfile
if errorlevel 1 (
  echo ERRO: Falha no pnpm install.
  pause
  exit /b 1
)

echo.
echo [5/8] Validando TypeScript...
call pnpm run typecheck
if errorlevel 1 (
  echo ERRO: Typecheck falhou. Nada sera enviado.
  pause
  exit /b 1
)

echo.
echo [6/8] Validando builds usados pelo Render...

set "PORT=5173"
set "BASE_PATH=/"
set "VITE_ODONTO_API_URL=https://odonto-excellence-api.onrender.com/api"

call pnpm --filter @workspace/api-server run build
if errorlevel 1 (
  echo ERRO: Build da API falhou. Nada sera enviado.
  pause
  exit /b 1
)

call pnpm --filter @workspace/odonto-excellence run build
if errorlevel 1 (
  echo ERRO: Build do Portal falhou. Nada sera enviado.
  pause
  exit /b 1
)

echo.
echo [7/8] Preparando TODOS os arquivos versionaveis...

git add -A
if errorlevel 1 goto :git_error

git diff --cached --quiet
if not errorlevel 1 (
  echo.
  echo Nao existem diferencas entre esta pasta e origin/main.
  echo Nada precisa ser publicado.
  echo.
  echo Backup criado mesmo assim:
  echo !BACKUP_BRANCH!
  pause
  exit /b 0
)

echo.
echo ==============================================
echo ARQUIVOS QUE SERAO ENVIADOS
echo ==============================================
git status --short
echo.
git diff --cached --stat
echo.

set "COMMIT_MSG="
set /p "COMMIT_MSG=Mensagem da versao (Enter para padrao): "
if "!COMMIT_MSG!"=="" set "COMMIT_MSG=deploy: publicar versao local completa"

echo.
echo Criando commit...
git commit -m "!COMMIT_MSG!"
if errorlevel 1 (
  echo ERRO: Falha ao criar commit.
  pause
  exit /b 1
)

for /f "delims=" %%S in ('git rev-parse HEAD') do set "LOCAL_SHA=%%S"

echo.
echo [8/8] Publicando a pasta local como nova main...
echo.
echo ATENCAO: sera usado --force-with-lease.
echo A main anterior esta salva em:
echo !BACKUP_BRANCH!
echo.

REM Revalida a main para que --force-with-lease proteja contra alteracao concorrente.
git fetch origin main --prune
if errorlevel 1 (
  echo ERRO: Nao foi possivel revalidar origin/main.
  pause
  exit /b 1
)

for /f "delims=" %%S in ('git rev-parse origin/main') do set "REMOTE_NOW=%%S"

if /I not "!REMOTE_NOW!"=="!REMOTE_SHA!" (
  echo.
  echo ERRO: A main mudou no GitHub enquanto o script validava o projeto.
  echo Antes: !REMOTE_SHA!
  echo Agora: !REMOTE_NOW!
  echo.
  echo O push forcado foi CANCELADO para nao apagar trabalho novo.
  echo Backup criado: !BACKUP_BRANCH!
  pause
  exit /b 1
)

git push --force-with-lease=refs/heads/main:!REMOTE_SHA! origin HEAD:main
if errorlevel 1 (
  echo.
  echo ERRO: O GitHub recusou o push.
  echo A main antiga continua protegida no backup:
  echo !BACKUP_BRANCH!
  pause
  exit /b 1
)

echo.
echo Confirmando SHA no GitHub...
set "PUBLISHED_SHA="
for /f "tokens=1" %%S in ('git ls-remote origin refs/heads/main') do set "PUBLISHED_SHA=%%S"

if /I not "!PUBLISHED_SHA!"=="!LOCAL_SHA!" (
  echo.
  echo ERRO: SHA remoto nao corresponde ao commit local.
  echo Local : !LOCAL_SHA!
  echo Remoto: !PUBLISHED_SHA!
  echo Backup: !BACKUP_BRANCH!
  pause
  exit /b 1
)

echo.
echo ==============================================
echo  PUBLICACAO CONCLUIDA E CONFIRMADA
echo ==============================================
echo.
echo Nova main:
echo !LOCAL_SHA!
echo.
echo Backup da main anterior:
echo !BACKUP_BRANCH!
echo.
echo O Render deve iniciar o deploy automaticamente.
echo.

start "" "https://github.com/dlemes829-blip/Odonto-Excellence"
start "" "https://dashboard.render.com/"
pause
exit /b 0

:git_error
echo.
echo ERRO: Falha em um comando Git.
echo Nenhum push forcado foi executado nesta etapa.
pause
exit /b 1
