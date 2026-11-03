# Ferma e rimuove il servizio MoonbrandCollaudo (i processi figli vengono chiusi dal servizio stesso).
sc.exe stop MoonbrandCollaudo | Out-Null
Start-Sleep -Seconds 5
sc.exe delete MoonbrandCollaudo
