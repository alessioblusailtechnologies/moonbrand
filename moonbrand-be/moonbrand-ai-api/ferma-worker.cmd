@rem Ferma il worker del collaudo, qualunque dei motori (v2, AE, API): i processi node che girano dalla cartella di uno di
@rem loro (npm e cmd sopra di loro si chiudono da soli).
@powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"name='node.exe'\" | Where-Object { $_.CommandLine -match 'moonbrand-ai-(v2|ae|api)[\/]' } | ForEach-Object { taskkill /F /T /PID $_.ProcessId }"
