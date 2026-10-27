# Avvia il worker After Effects sul collaudo, staccato dalla shell: lanciato da una shell che poi si chiude, Windows non
# avvia i processi figli del worker. Prima va fermato quello del v2. Il log va in %TEMP%\moonbrand-worker-ae.log.
Start-Process -WindowStyle Hidden -WorkingDirectory $PSScriptRoot cmd -ArgumentList '/c npm run worker > "%TEMP%\moonbrand-worker-ae.log" 2>&1'
