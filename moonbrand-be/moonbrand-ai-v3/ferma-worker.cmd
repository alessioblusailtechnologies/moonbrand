@rem Ferma il worker del collaudo, v2, v3 o AE: i processi node che girano dalla cartella di uno dei moduli (npm e cmd sopra
@rem di loro si chiudono da soli).
@powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"name='node.exe'\" | Where-Object { $_.CommandLine -match 'moonbrand-ai-(v2|v3|ae)[\/]' } | ForEach-Object { taskkill /F /T /PID $_.ProcessId }"
