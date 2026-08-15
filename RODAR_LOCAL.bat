@echo off
setlocal
chcp 65001 >nul

cd /d "%~dp0"

echo.
echo ========================================
echo  Odonto Excellence - ambiente local
echo ========================================
echo.

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

set "PORT=5173"
set "VITE_ODONTO_API_URL=https://odonto-excellence-api.onrender.com/api"

echo.
echo Abrindo o portal local em http://localhost:%PORT%
echo Para encerrar, feche esta janela ou pressione Ctrl+C.
echo.

start "" "http://localhost:%PORT%"
call pnpm --filter @workspace/odonto-excellence run dev

pause
