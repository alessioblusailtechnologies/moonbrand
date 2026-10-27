# Rimette sul collaudo il worker del v2, staccato dalla shell come avvia-collaudo.ps1 (dopo aver fermato quello AE).
# Il log va in %TEMP%\moonbrand-worker-v2.log.
Start-Process -WindowStyle Hidden -WorkingDirectory (Join-Path $PSScriptRoot '..\moonbrand-ai-v2') cmd -ArgumentList '/c npm run worker > "%TEMP%\moonbrand-worker-v2.log" 2>&1'
