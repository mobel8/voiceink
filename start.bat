@echo off
chcp 65001 >nul 2>nul
title VoiceInk
cd /d "%~dp0"

echo.
echo  VoiceInk - Demarrage
echo  =====================
echo.

:: Log file
set "LOGFILE=%~dp0start.log"
echo [%date% %time%] Demarrage VoiceInk > "%LOGFILE%"

:: Kill previous instances
taskkill /F /IM electron.exe >nul 2>nul

:: ==========================================
:: STEP 1: Check Node.js
:: ==========================================
where node >nul 2>nul
if errorlevel 1 (
    echo [ERREUR] Node.js introuvable dans le PATH.
    echo          Installez Node.js depuis https://nodejs.org
    echo [ERREUR] Node.js introuvable >> "%LOGFILE%"
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do (
    echo [1/3] Node.js %%i OK
    echo [1/3] Node.js %%i >> "%LOGFILE%"
)

:: ==========================================
:: STEP 2: Check dependencies
:: ==========================================
if not exist "node_modules\.bin\electron.cmd" (
    echo [2/3] Installation des dependances...
    echo [2/3] npm install >> "%LOGFILE%"
    call npm install >> "%LOGFILE%" 2>&1
    if errorlevel 1 (
        echo [ERREUR] npm install a echoue. Voir start.log
        echo [ERREUR] npm install echoue >> "%LOGFILE%"
        pause
        exit /b 1
    )
    echo [2/3] Dependances installees
) else (
    echo [2/3] Dependances OK
)

:: ==========================================
:: STEP 3: Build if needed
:: ==========================================
if not exist "dist\main\index.js" goto :do_build
if not exist "dist\renderer\index.html" goto :do_build
if "%~1"=="--rebuild" goto :do_build
echo [3/3] Build present
echo [3/3] Build cache >> "%LOGFILE%"
goto :launch

:do_build
echo [3/3] Compilation...
echo [3/3] npm run build >> "%LOGFILE%"
call npm run build >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    echo [ERREUR] Compilation echouee. Voir start.log pour details.
    echo [ERREUR] build echoue >> "%LOGFILE%"
    pause
    exit /b 1
)
echo [3/3] Compilation OK

:: ==========================================
:: LAUNCH
:: ==========================================
:launch
echo.
echo  Lancement de VoiceInk...
echo  ^(cette fenetre peut etre fermee^)
echo.
echo [LAUNCH] %date% %time% >> "%LOGFILE%"

if exist "node_modules\.bin\electron.cmd" (
    echo  electron.cmd trouve >> "%LOGFILE%"
    "node_modules\.bin\electron.cmd" --no-sandbox dist\main\index.js
) else (
    echo  Fallback npx >> "%LOGFILE%"
    npx electron --no-sandbox dist\main\index.js
)

:: If we get here, electron exited
echo.
echo  VoiceInk ferme (code: %errorlevel%).
echo [EXIT] code %errorlevel% >> "%LOGFILE%"
pause
