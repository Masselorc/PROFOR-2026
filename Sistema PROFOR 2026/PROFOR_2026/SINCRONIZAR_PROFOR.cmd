@echo off
setlocal
cd /d "%~dp0"

set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node.exe"

if not exist "logs" mkdir "logs"

"%NODE_EXE%" sincronizar-profor.cjs >> "logs\sincronizacao.log" 2>&1

exit /b %errorlevel%
