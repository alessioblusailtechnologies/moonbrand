# Compila e installa (o reinstalla) il servizio MoonbrandCollaudo, avvio automatico ritardato e riavvio se cade.
# Da PowerShell come amministratore:  powershell -ExecutionPolicy Bypass -File installa.ps1
$ErrorActionPreference = 'Stop'
$nome = 'MoonbrandCollaudo'
$exe = Join-Path $PSScriptRoot 'MoonbrandCollaudo.exe'

if (Get-Service $nome -ErrorAction SilentlyContinue) {
    sc.exe stop $nome | Out-Null
    Start-Sleep -Seconds 5
    sc.exe delete $nome | Out-Null
    Start-Sleep -Seconds 2
}

$csc = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $csc /nologo /target:exe /out:$exe /reference:System.ServiceProcess.dll (Join-Path $PSScriptRoot 'MoonbrandCollaudo.cs')
if ($LASTEXITCODE -ne 0) { throw 'compilazione fallita' }

sc.exe create $nome binPath= "`"$exe`"" start= delayed-auto DisplayName= 'Moonbrand collaudo (API, studio, worker)' | Out-Null
sc.exe description $nome 'Tiene su il collaudo: API 3012, studio https://45.14.185.228:4200, worker. Processi in processi.conf, log in log\' | Out-Null
sc.exe failure $nome reset= 86400 actions= restart/10000/restart/30000/restart/60000 | Out-Null
sc.exe start $nome | Out-Null
Get-Service $nome
