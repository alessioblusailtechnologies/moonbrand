# Avvia il worker del motore DSL sul collaudo, staccato dalla shell: lanciato da una shell che poi si chiude, Windows non
# avvia i processi figli del worker. Prima va fermato quello che gira (ferma-worker.cmd). Log in %TEMP%\moonbrand-worker-dsl.log.
Start-Process -WindowStyle Hidden -WorkingDirectory $PSScriptRoot cmd -ArgumentList '/c npm run worker > "%TEMP%\moonbrand-worker-dsl.log" 2>&1'
