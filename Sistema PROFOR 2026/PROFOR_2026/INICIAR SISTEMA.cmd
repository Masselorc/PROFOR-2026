@echo off
rem ---------------------------------------------------------------------------
rem  PROFOR / ONASP 2026 - INICIAR SISTEMA
rem
rem  Um duplo clique: liga o servidor local (sem janela visivel) e abre o
rem  sistema no navegador, ja com os dados carregados. Se o servidor ja estiver
rem  no ar, apenas abre a pagina.
rem
rem  O atalho na Area de Trabalho aponta para este arquivo.
rem ---------------------------------------------------------------------------
setlocal
set "APPDIR=%~dp0"
set "VBS=%APPDIR%inicia-servidor.vbs"

if not exist "%VBS%" (
  echo.
  echo   ERRO: inicia-servidor.vbs nao encontrado na pasta:
  echo   %APPDIR%
  echo.
  pause
  exit /b 1
)

wscript.exe "%VBS%"
exit /b %errorlevel%
