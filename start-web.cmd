@echo off
setlocal EnableExtensions
title HSUSA TMS - Web Version (local)
rem ---------------------------------------------------------------------
rem  Double-click to run the WEB version of HSUSA TMS on this computer and
rem  open it in your browser (web roadmap phase 2, owner 2026-11-24).
rem  Use a copy of the project on the finch/web branch. Steps: latest code,
rem  packages if they changed, database, build the screens, start the
rem  server. Close this window to stop it. Safe to run again at any time.
rem ---------------------------------------------------------------------
rem git pull may update this file while it runs, so a temporary copy runs it.
if /I not "%~1"=="--from-copy" (
    copy /Y "%~f0" "%TEMP%\hsusa-tms-start-web.cmd" >nul
    call "%TEMP%\hsusa-tms-start-web.cmd" --from-copy "%~dp0"
    exit /b
)
cd /d "%~2"

echo.
echo  HSUSA TMS - Web Version (local)
echo  ===============================
echo.

call :port_in_use 8080
if not errorlevel 1 (
    echo  Something is already using port 8080, probably the web version
    echo  from an earlier run. Close that window, then run this again.
    goto :stop
)

if not exist ".env" (
    echo  Creating .env from .env.example ...
    copy /Y ".env.example" ".env" >nul || goto :failed
)

set "BEFORE="
set "AFTER="
if exist ".git" (
    echo  [1/6] Getting the latest code ...
    git diff --quiet -- package-lock.json || git checkout -- package-lock.json
    for /f %%h in ('git rev-parse HEAD') do set "BEFORE=%%h"
    git pull --ff-only
    if errorlevel 1 (
        echo.
        echo  git pull did not work. Tell Finch which files it names.
        goto :stop
    )
    for /f %%h in ('git rev-parse HEAD') do set "AFTER=%%h"
) else (
    echo  [1/6] Not a git copy ^(ZIP download^), using the files as they are.
)

set "NEED_INSTALL="
if not exist "node_modules\.bin\vite.cmd" set "NEED_INSTALL=1"
if defined BEFORE if not "%BEFORE%"=="%AFTER%" (
    git diff --name-only %BEFORE% %AFTER% -- package.json package-lock.json | findstr /R "." >nul && set "NEED_INSTALL=1"
)
if defined NEED_INSTALL (
    echo  [2/6] Installing packages. This can take a few minutes ...
    call npm ci
    if errorlevel 1 (
        echo.
        echo  npm ci did not finish. If it says EPERM, close anything using
        echo  this folder, wait a minute, and try again.
        goto :stop
    )
) else (
    echo  [2/6] Packages unchanged, skipping install.
)

echo  [3/6] Updating the database ...
call npx prisma generate || goto :failed
call npx prisma migrate deploy || goto :failed
echo  [4/6] Adding any new starting data ...
call npx prisma db seed || goto :failed
echo  [5/6] Building the screens ...
call npm run web:build || goto :failed

echo  [6/6] Starting the web server ...
echo.
echo  Open http://localhost:8080 in your browser (it should open by itself).
echo  Keep this window open while you use it. Close it to stop.
echo.
start "" /min cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:8080"
call npm run web:start
goto :end

:failed
echo.
echo  A step failed. Leave this window open and show the message above to Finch.
:stop
echo.
pause
:end
endlocal
exit /b

rem Sets errorlevel 0 if something is listening on the given port, else 1.
:port_in_use
netstat -ano | findstr /R /C:":%~1 .*LISTENING" >nul
exit /b %errorlevel%
