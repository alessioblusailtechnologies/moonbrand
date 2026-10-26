# Avvia il worker del v3 sul collaudo, staccato dalla shell: lanciato da una shell che poi si chiude, Windows non avvia i
# processi figli del worker. Prima va fermato l'altro (ferma-worker.cmd). Il log va in %TEMP%\moonbrand-worker-v3.log.
# Per tornare al v2: ferma-worker.cmd, poi ..\moonbrand-ai-ae\avvia-v2.ps1.
Start-Process -WindowStyle Hidden -WorkingDirectory $PSScriptRoot cmd -ArgumentList '/c npm run worker > "%TEMP%\moonbrand-worker-v3.log" 2>&1'
