@echo off
rem ---------------------------------------------------------------------------
rem  PROFOR / ONASP 2026 - sobe o servidor local e mantem o processo vivo.
rem
rem  Este arquivo e chamado OCULTO por inicia-servidor.vbs (via wscript), por isso
rem  ele nao deve ser executado a mao no uso normal: para abrir o sistema, use
rem  "INICIAR SISTEMA.cmd".
rem
rem  Fica aqui, e nao em um script temporario, para que a linha de comando fique
rem  visivel e auditavel: e apenas o servidor local do proprio sistema.
rem ---------------------------------------------------------------------------
setlocal
cd /d "%~dp0"
set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node.exe"
"%NODE_EXE%" server.cjs
