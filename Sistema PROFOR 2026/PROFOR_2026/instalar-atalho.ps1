# Cria o atalho "PROFOR 2026" na Area de Trabalho, apontando para
# "INICIAR SISTEMA.cmd", com o icone assets\profor.ico. Sem administrador.
$ErrorActionPreference = 'Stop'
$appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$alvo   = Join-Path $appDir 'inicia-servidor.vbs'
$icone  = Join-Path $appDir 'assets\profor.ico'
$destino = [Environment]::GetFolderPath('Desktop')

if (-not (Test-Path $alvo)) { Write-Host "ERRO: nao encontrei $alvo"; exit 1 }

$atalho = Join-Path $destino 'PROFOR 2026.lnk'
$sh = New-Object -ComObject WScript.Shell
$lnk = $sh.CreateShortcut($atalho)
$lnk.TargetPath = (Join-Path $env:SystemRoot 'System32\wscript.exe')
$lnk.Arguments = '"' + $alvo + '"'
$lnk.WorkingDirectory = $appDir
$lnk.Description = 'PROFOR / ONASP 2026 - iniciar o sistema com o servidor local'
if (Test-Path $icone) { $lnk.IconLocation = "$icone,0" }
$lnk.Save()

Write-Host ""
if (Test-Path $atalho) {
  Write-Host "  PRONTO. Atalho criado em:" -ForegroundColor Green
  Write-Host "  $atalho"
  if (Test-Path $icone) { Write-Host "  Icone: $icone" }
} else {
  Write-Host "  Nao foi possivel criar o atalho." -ForegroundColor Red
  exit 1
}
Write-Host ""
