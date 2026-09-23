@echo off
rem ---------------------------------------------------------------------------
rem  PROFOR / ONASP 2026 - desfaz a configuracao do protocolo profor://.
rem  Nao apaga nenhum dado do sistema; remove apenas o registro em HKCU.
rem ---------------------------------------------------------------------------
setlocal
echo Removendo o protocolo profor:// deste usuario...
reg delete "HKCU\Software\Classes\profor" /f >nul 2>&1
if errorlevel 1 (
  echo   Nada a remover, ou o registro nao pode ser alterado.
) else (
  echo   Protocolo removido. O atalho "INICIAR SISTEMA.cmd" continua funcionando.
)
echo.
pause
exit /b 0
