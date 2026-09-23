' ---------------------------------------------------------------------------
'  PROFOR / ONASP 2026 - liga o servidor local (sem janela) e abre o sistema.
'
'  Chamado pelo atalho "INICIAR SISTEMA.cmd" e pelo protocolo profor://sync.
'  Se o servidor ja estiver respondendo, nao sobe uma segunda instancia.
'  Este arquivo e mantido sem acentos de proposito: o WSH le .vbs na pagina de
'  codigo do sistema e acentos apareceriam corrompidos nas mensagens.
' ---------------------------------------------------------------------------
Option Explicit

Dim shell, fso, appDir, url, i, ready, veio, arg, hidden

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

appDir = fso.GetParentFolderName(WScript.ScriptFullName)
url = "http://127.0.0.1:8766/PROFOR_2026.html"

' Veio do protocolo profor:// (botao "Ligar o servidor e sincronizar")? Entao a
' pagina abre com ?sync=1 e a sincronizacao comeca sozinha, sem novo clique.
veio = 0
For Each arg In WScript.Arguments
  If InStr(1, arg, "sync", 1) > 0 Then
    veio = 1
    Exit For
  End If
Next
If veio = 1 Then url = url & "?sync=1"

If Not fso.FileExists(appDir & "\server.cjs") Then
  shell.Popup "Nao encontrei o arquivo server.cjs na pasta:" & vbCrLf & appDir, 12, "PROFOR - servidor local", 48
  WScript.Quit 1
End If

' Sobe o servidor por um CMD oculto. O CMD localiza o Node.js instalado para o
' usuario ou para toda a maquina e fica vinculado ao processo do servidor.
If serverUp() Then
  shell.Run """" & url & """", 1, False
  WScript.Quit 0
End If
If Not fso.FileExists(appDir & "\server.cjs") Then
  shell.Popup "Nao encontrei o arquivo server.cjs na pasta:" & vbCrLf & appDir, 12, "PROFOR - servidor local", 48
  WScript.Quit 1
End If
hidden = appDir & "\servidor-oculto.cmd"
If Not fso.FileExists(hidden) Then
  shell.Popup "Nao encontrei o arquivo servidor-oculto.cmd na pasta:" & vbCrLf & appDir, 12, "PROFOR - servidor local", 48
  WScript.Quit 1
End If
shell.Run Chr(34) & hidden & Chr(34), 0, False

ready = 1
For i = 1 To 40
  If serverUp() Then
    ready = 0
    Exit For
  End If
  WScript.Sleep 500
Next

If ready <> 0 Then
  shell.Popup "O servidor local do PROFOR nao iniciou." & vbCrLf & vbCrLf & _
             "Verifique se o Node.js esta instalado. Para ver a mensagem de erro," & vbCrLf & _
             "abra o Prompt de Comando na pasta e execute:  node server.cjs", _
             20, "PROFOR - servidor local", 48
  WScript.Quit 1
End If

shell.Run """" & url & """", 1, False
WScript.Quit 0

Function serverUp()
  Dim req, status
  serverUp = False
  On Error Resume Next
  Set req = CreateObject("WinHttp.WinHttpRequest.5.1")
  req.SetTimeouts 500, 500, 500, 500
  req.Open "GET", "http://127.0.0.1:8766/api/sync/status", False
  req.Send
  If Err.Number = 0 Then status = req.Status
  If Err.Number = 0 And status = 200 Then serverUp = True
  Err.Clear
  On Error GoTo 0
End Function
