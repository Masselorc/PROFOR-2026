@echo off
chcp 65001 >nul
title Atualizar Publicacao GitHub Pages — PROFOR 2026

echo ========================================================
echo   ATUALIZAR PUBLICACAO GITHUB PAGES (PROFOR-2026)
echo   Processo SEI: 08016.010062/2026-18
echo ========================================================
echo.

node "%~dp0tools\build_public_docs.cjs"
if %errorlevel% neq 0 (
  echo.
  echo [ERRO] Falha ao gerar os arquivos em docs/.
  pause
  exit /b %errorlevel%
)

echo.
echo ========================================================
echo   Concluído com sucesso!
echo   Para enviar as atualizações ao GitHub, execute:
echo     git add docs/
echo     git commit -m "Atualiza dados públicos da publicação estática"
echo     git push
echo ========================================================
echo.
pause
