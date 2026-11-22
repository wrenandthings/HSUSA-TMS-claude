@echo off
setlocal EnableExtensions
title HSUSA TMS - Build the installer
rem ---------------------------------------------------------------------
rem  Double-click to build the Windows installer for testers (owner
rem  decision 2026-11-21: built on this laptop, unsigned for testing).
rem  Result: release\HSUSA-TMS-Setup-<version>.exe
rem  The first build downloads Electron and the installer tools (internet
rem  needed once). Safe to run again at any time.
rem ---------------------------------------------------------------------
rem Windows reads a .cmd file while it runs, and git pull may update this
rem one, so the work is done by a temporary copy.
if /I not "%~1"=="--from-copy" (
    copy /Y "%~f0" "%TEMP%\hsusa-tms-build-installer.cmd" >nul
    call "%TEMP%\hsusa-tms-build-installer.cmd" --from-copy "%~dp0"
    exit /b
)
cd /d "%~2"

echo.
echo  HSUSA TMS - Build the installer
echo  ===============================
echo.

rem 1. The app and Vite must be closed, or Windows will not let files change.
tasklist /FI "IMAGENAME eq electron.exe" 2>nul | find /I "electron.exe" >nul
if not errorlevel 1 (
    echo  The HSUSA TMS app is still open. Close it and the "HSUSA TMS - Vite"
    echo  window, then run this again.
    goto :stop
)

rem 2. Latest code and packages.
echo  [1/4] Getting the latest code ...
git diff --quiet -- package-lock.json || git checkout -- package-lock.json
git pull --ff-only
if errorlevel 1 (
    echo.
    echo  git pull did not work. Tell Finch which files it names.
    goto :stop
)
echo  [2/4] Installing packages. This can take a few minutes ...
call npm ci
if errorlevel 1 (
    echo.
    echo  npm ci did not finish. If it says EPERM, close the app and Vite,
    echo  wait a minute and run this again.
    goto :stop
)

rem 3. Database code for Windows, then the installer.
echo  [3/4] Preparing the database code ...
call npx prisma generate || goto :failed
echo  [4/4] Building the installer. This takes a few minutes ...
call npm run dist || goto :failed

echo.
echo  Done. The installer is in the "release" folder, which opens now:
echo  HSUSA-TMS-Setup-*.exe
echo.
echo  It is not signed, so Windows may say "Windows protected your PC".
echo  Click "More info", then "Run anyway".
start "" explorer "%CD%\release"
goto :stop

:failed
echo.
echo  A step failed. Leave this window open and show the message above to Finch.
:stop
echo.
pause
endlocal
exit /b
