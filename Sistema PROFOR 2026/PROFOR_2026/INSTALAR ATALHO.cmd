@echo off
rem ---------------------------------------------------------------------------
rem  PROFOR / ONASP 2026 - INSTALAR ATALHO (executar uma vez).
rem
rem  Cria o atalho "PROFOR 2026" na Area de Trabalho apontando para
rem  INICIAR SISTEMA.cmd, com o icone assets\profor.ico.
rem  Nao exige administrador. Para desfazer, apague o atalho da Area de Trabalho.
rem ---------------------------------------------------------------------------
setlocal
set "APPDIR=%~dp0"
set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"

if not exist "%APPDIR%INICIAR SISTEMA.cmd" (
  echo   ERRO: INICIAR SISTEMA.cmd nao encontrado em %APPDIR%
  pause
  exit /b 1
)

"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%APPDIR%instalar-atalho.ps1"
pause
exit /b %errorlevel%
