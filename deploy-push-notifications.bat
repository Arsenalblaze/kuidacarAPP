@echo off
REM ========================================================
REM Deploy Script: send-push-notification (Windows)
REM ========================================================
REM Este script faz o deploy da Edge Function
REM e verifica se os secrets VAPID estão configurados
REM ========================================================

setlocal enabledelayedexpansion

cls
echo.
echo ==========================================
echo 📨 Deploy: send-push-notification
echo ==========================================
echo.

REM ========================================================
REM 1. Verificar Supabase CLI
REM ========================================================

echo [INFO] Verificando Supabase CLI...

supabase --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Supabase CLI não encontrado
    echo.
    echo Instale com:
    echo   npm install -g supabase
    echo.
    pause
    exit /b 1
)

echo [OK] Supabase CLI encontrado
echo.

REM ========================================================
REM 2. Fazer Login (se necessário)
REM ========================================================

echo [INFO] Verificando autenticação no Supabase...

supabase projects list >nul 2>&1
if errorlevel 1 (
    echo.
    echo [WARNING] Não autenticado no Supabase
    echo.
    echo Execute:
    echo   supabase login
    echo.
    pause
    exit /b 1
)

echo [OK] Autenticado no Supabase
echo.

REM ========================================================
REM 3. Verificar se a função existe
REM ========================================================

echo [INFO] Verificando estrutura da função...

if not exist "supabase\functions\send-push-notification\index.ts" (
    echo.
    echo [ERROR] Arquivo não encontrado: supabase\functions\send-push-notification\index.ts
    echo.
    pause
    exit /b 1
)

echo [OK] Arquivo da função encontrado
echo.

REM ========================================================
REM 4. Deploy
REM ========================================================

echo [INFO] Fazendo deploy da Edge Function...
echo.

call supabase functions deploy send-push-notification

echo.
echo [OK] Edge Function deployada com sucesso!
echo.

REM ========================================================
REM 5. Instruções Finais
REM ========================================================

echo ==========================================
echo ✅ Próximas Etapas
echo ==========================================
echo.

echo [STEP 1] Adicionar secrets no Supabase:
echo   • Supabase Dashboard ^> Project Settings ^> Secrets
echo   • VAPID_PUBLIC_KEY
echo   • VAPID_PRIVATE_KEY
echo.

echo [STEP 2] Verificar logs da função:
echo   supabase functions logs send-push-notification -n 100
echo.

echo [STEP 3] Testar a função manualmente:
echo   Ver exemplo em: PUSH_NOTIFICATIONS_GUIDE.md
echo.

echo [STEP 4] Monitorar em tempo real:
echo   supabase functions logs send-push-notification --tail
echo.

echo ==========================================
echo 📚 Documentação
echo ==========================================
echo.
echo   • supabase\functions\send-push-notification\README.md
echo   • PUSH_NOTIFICATIONS_GUIDE.md
echo   • setup-push-notifications.sql
echo.

echo ==========================================
echo ✨ Deploy Concluído!
echo ==========================================
echo.

pause
