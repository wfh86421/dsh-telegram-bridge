@echo off
REM 47_TG-Bridge.cmd -- thin ASCII launcher for the Telegram <-> DSH bridge.
REM All Chinese text lives in run-tg-bridge.ps1 (this .cmd must stay pure ASCII
REM per the project's encoding rule: cmd reads .cmd as cp950).
REM Locate the profile root by search so the desktop copy works too.
chcp 65001 >nul
title [47] DSH Telegram bridge (two-way)
setlocal
set "PROFILE="
set "P1="
set "P2="
for %%I in ("%~dp0..") do set "P1=%%~fI"
for %%I in ("%~dp0..\..") do set "P2=%%~fI"
if exist "%P1%\tools\run-tg-bridge.ps1" set "PROFILE=%P1%"
if exist "%P2%\tools\run-tg-bridge.ps1" set "PROFILE=%P2%"
if not defined PROFILE if exist "C:\Users\User\.dsh\profiles\web\tools\run-tg-bridge.ps1" set "PROFILE=C:\Users\User\.dsh\profiles\web"

if not defined PROFILE (
  echo [ERROR] Could not locate the DSH profile ^(tools\run-tg-bridge.ps1^).
  pause
  exit /b 1
)

echo ============================================================
echo   [47] Telegram bridge (two-way)
echo.
echo   Send any text message to @DSH_Butler_bot and the DSH agent
echo   runs it here, then replies in Telegram with duration, exit
echo   code and the estimated cost.
echo.
echo   Telegram commands:  /status   /help
echo   This window IS the bridge. Keep it open; close it to stop.
echo   Only your own chat id is accepted; daily cap is 10 CNY.
echo ============================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%PROFILE%\tools\run-tg-bridge.ps1"
echo.
pause >nul
endlocal