@echo off
setlocal EnableExtensions
title HSUSA TMS - Update and Start
rem ---------------------------------------------------------------------
rem  Double-click to update HSUSA TMS and start it (owner request,
rem  2026-11-20). Steps: get the latest code, install packages only when
rem  they changed, update the database, start Vite and the app.
rem  Safe to run again at any time.
rem ---------------------------------------------------------------------
rem Windows reads a .cmd file while it runs, and git pull may update this
rem one, so the work is done by a temporary copy.
if /I not "%~1"=="--from-copy" (
    copy /Y "%~f0" "%TEMP%\hsusa-tms-update-and-start.cmd" >nul
    call "%TEMP%\hsusa-tms-update-and-start.cmd" --from-copy "%~dp0"
    exit /b
)
cd /d "%~2"

echo.
echo  HSUSA TMS - Update and Start
echo  ============================
echo.

rem 1. The app and Vite must be closed, or Windows will not let files change.
tasklist /FI "IMAGENAME eq electron.exe" 2>nul | find /I "electron.exe" >nul
if not errorlevel 1 (
    echo  The HSUSA TMS app is still open.
    echo  Close the app window, press Ctrl+C in any window running
    echo  "npm run dev" or "npm start", then run this again.
    goto :stop
)
call :port_in_use 5173
if not errorlevel 1 (
    echo  Something is still using port 5173, probably Vite from an
    echo  earlier run. Press Ctrl+C in that window, then run this again.
    goto :stop
)

rem 2. Settings file. .env only holds the database location, not a secret.
if not exist ".env" (
    echo  Creating .env from .env.example ...
    copy /Y ".env.example" ".env" >nul || goto :failed
)

rem 3. Latest code. package-lock.json is rewritten by "npm install"; the
rem    repository's copy is the right one, so a local change to it is undone.
echo  [1/5] Getting the latest code ...
git diff --quiet -- package-lock.json || git checkout -- package-lock.json
for /f %%h in ('git rev-parse HEAD') do set "BEFORE=%%h"
git pull --ff-only
if errorlevel 1 (
    echo.
    echo  git pull did not work. If it says files would be overwritten,
    echo  tell Finch which files it names. Nothing else was changed.
    goto :stop
)
for /f %%h in ('git rev-parse HEAD') do set "AFTER=%%h"

rem 4. Packages, only when package.json or package-lock.json changed
rem    (or node_modules is missing or incomplete).
set "NEED_INSTALL="
if not exist "node_modules\.bin\electron.cmd" set "NEED_INSTALL=1"
if not exist "node_modules\.bin\vite.cmd" set "NEED_INSTALL=1"
if not "%BEFORE%"=="%AFTER%" (
    git diff --name-only %BEFORE% %AFTER% -- package.json package-lock.json | findstr /R "." >nul && set "NEED_INSTALL=1"
)
if defined NEED_INSTALL (
    echo  [2/5] Packages changed, installing. This can take a few minutes ...
    call npm ci
    if errorlevel 1 (
        echo.
        echo  npm ci did not finish. If it says EPERM, something still has
        echo  the files open: close the app and Vite, wait a minute, retry.
        goto :stop
    )
) else (
    echo  [2/5] Packages unchanged, skipping install.
)

rem 5. Database: rebuild the database code from the schema (npm ci does this
rem    too, but only runs when packages change; a schema change alone needs it,
rem    found 2026-11-21), apply new migrations, then the seed (which never
rem    overwrites existing records).
echo  [3/5] Updating the database ...
call npx prisma generate || goto :failed
call npx prisma migrate deploy || goto :failed
echo  [4/5] Adding any new starting data ...
call npx prisma db seed || goto :failed

rem 6. Start Vite in its own window, wait for it, then the app here.
echo  [5/5] Starting HSUSA TMS ...
start "HSUSA TMS - Vite (keep this open)" /min cmd /k npm run dev
set /a WAITED=0
:wait_vite
timeout /t 1 /nobreak >nul
set /a WAITED+=1
call :port_in_use 5173
if not errorlevel 1 goto :vite_ready
if %WAITED% GEQ 60 (
    echo  Vite did not start within a minute. Look at the minimized
    echo  "HSUSA TMS - Vite" window for an error.
    goto :stop
)
goto :wait_vite

:vite_ready
echo.
echo  Up to date. The app is opening.
echo  To stop: close the app window, then close the "HSUSA TMS - Vite" window.
echo.
call npm start
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
