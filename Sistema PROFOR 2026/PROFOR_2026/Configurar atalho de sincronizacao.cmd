@echo off
rem ---------------------------------------------------------------------------
rem  PROFOR / ONASP 2026 - CONFIGURACAO UNICA (executar uma vez).
rem
rem  Registra o protocolo "profor://" neste usuario, permitindo que o botao
rem  "Sincronizar agora" da pagina aberta por arquivo (file://) ligue o servidor
rem  local e abra a sincronizacao sozinho.
rem
rem  Nao exige privilegio de administrador: grava apenas em HKCU\Software\Classes
rem  (o registro do usuario atual). Para desfazer, execute Remove-protocolo.cmd.
rem ---------------------------------------------------------------------------
setlocal
set "APPDIR=%~dp0"
set "VBS=%APPDIR%inicia-servidor.vbs"
set "WSCRIPT=%SystemRoot%\System32\wscript.exe"
rem A linha de comando do protocolo e executada pelo Windows sem shell: use
rem caminho absoluto do wscript.exe para nao depender do PATH.
set "CMD=\"%WSCRIPT%\" \"%VBS%\" \"%%1\""

if not exist "%VBS%" (
  echo.
  echo   ERRO: inicia-servidor.vbs nao encontrado na pasta:
  echo   %APPDIR%
  echo.
  pause
  exit /b 1
)

echo Registrando o protocolo profor:// para este usuario...
reg add "HKCU\Software\Classes\profor" /ve /d "URL:PROFOR Sincronizacao" /f >nul
reg add "HKCU\Software\Classes\profor" /v "URL Protocol" /d "" /f >nul
reg add "HKCU\Software\Classes\profor\DefaultIcon" /ve /d "%SystemRoot%\System32\shell32.dll,13" /f >nul
reg add "HKCU\Software\Classes\profor\shell\open\command" /ve /d "%CMD%" /f >nul

if errorlevel 1 goto falhou

echo.
echo   PRONTO.
echo.
echo   A partir de agora, na pagina aberta pelo arquivo HTML, o botao
echo   "Sincronizar agora" liga o servidor e inicia a sincronizacao sozinho.
echo.
echo   Na primeira vez, o navegador pode perguntar se pode abrir o aplicativo
echo   "PROFOR Sincronizacao": marque a opcao de sempre permitir e confirme.
echo.
pause
exit /b 0

:falhou
echo.
echo   ERRO: nao foi possivel gravar o registro.
echo   Se este computador tiver restricao de politicas, peca ao suporte de TI
echo   para liberar HKCU\Software\Classes\profor.
echo.
pause
exit /b 1
