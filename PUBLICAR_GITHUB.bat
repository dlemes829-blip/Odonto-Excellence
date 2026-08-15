@echo off
setlocal
chcp 65001 >nul

cd /d "%~dp0"

echo.
echo ========================================
echo  Odonto Excellence - publicar no GitHub
echo ========================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo Git nao encontrado. Instale o Git e execute novamente.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale o Node.js LTS e execute novamente.
  pause
  exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo pnpm nao encontrado. Tentando ativar via Corepack...
  call corepack enable
  if errorlevel 1 (
    echo Nao foi possivel ativar o pnpm automaticamente.
    pause
    exit /b 1
  )
)

echo Instalando/atualizando dependencias...
call pnpm install
if errorlevel 1 (
  echo Falha ao instalar dependencias.
  pause
  exit /b 1
)

echo.
echo Validando projeto antes de publicar...
set "PORT=5173"
set "BASE_PATH=/"
set "VITE_ODONTO_API_URL=https://odonto-excellence-api.onrender.com/api"
call pnpm run build
if errorlevel 1 (
  echo A validacao falhou. Corrija os erros antes de publicar.
  pause
  exit /b 1
)

for /f "delims=" %%i in ('git status --porcelain') do set "HAS_CHANGES=1"
if not defined HAS_CHANGES (
  echo Nao ha alteracoes para publicar.
  pause
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
  pause
  exit /b 1
)

git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
  echo Falha ao criar commit.
  pause
  exit /b 1
)

echo.
echo Enviando para GitHub/main...
git push origin main
if errorlevel 1 (
  echo Falha ao enviar para o GitHub.
  pause
  exit /b 1
)

echo.
echo Publicado. O Render deve iniciar o deploy automaticamente.
start "" "https://odonto-excellence-portal.onrender.com"
pause
