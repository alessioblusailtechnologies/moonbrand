#!/usr/bin/env bash
# Il deploy di produzione, dal PC di sviluppo: bash deploy.sh
# Sul server scarica master, compila API, worker e studio, copia lo studio e riavvia i servizi. Le migration del DB
# restano a mano (OPERAZIONI.md, «Migration del DB»), prima di lanciarlo.
set -euo pipefail

ssh moonbrand 'su - moonbrand -s /bin/bash' <<'REMOTE'
set -euo pipefail
cd ~/moonbrand
git pull -q
git log --oneline -1

cd ~/moonbrand/moonbrand-be/moonbrand-api
npm ci --no-audit --no-fund >/tmp/api-ci.log 2>&1
npm run build >/tmp/api-build.log 2>&1
echo "api ok"

cd ~/moonbrand/moonbrand-be/moonbrand-ai
npm ci --no-audit --no-fund >/tmp/ai-ci.log 2>&1
echo "worker ok"

cd ~/moonbrand/moonbrand-be/moonbrand-ai-v2
npm ci --no-audit --no-fund >/tmp/ai-v2-ci.log 2>&1
echo "worker v2 ok"

cd ~/moonbrand/moonbrand-studio
npm ci --no-audit --no-fund >/tmp/st-ci.log 2>&1
npm run build >/tmp/st-build.log 2>&1
cp -r dist/moonbrand-studio/browser/. /srv/moonbrand/studio/
find /srv/moonbrand/studio -type f -mtime +7 -delete
echo "studio ok"
REMOTE

ssh moonbrand 'systemctl restart moonbrand-api moonbrand-worker && sleep 3 && systemctl is-active moonbrand-api moonbrand-worker'
# Il worker v2 (PRODUZIONE.md, «Motore v2»), se sul server c'è già il suo servizio.
ssh moonbrand 'if systemctl cat moonbrand-worker-v2 >/dev/null 2>&1; then systemctl restart moonbrand-worker-v2 && sleep 3 && systemctl is-active moonbrand-worker-v2; fi'
curl -fsS https://studio.moonbrand.app/v1/health && echo
echo "deploy fatto. Se un passo fallisce, il log è in /tmp/*.log sul server."
