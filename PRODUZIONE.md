# Messa in produzione

Passo per passo, da zero: account e chiavi, Supabase, macchina, dominio, servizi, verifiche.
In produzione si parte vuoti: niente migrazione dei dati né dei file dei brand dallo sviluppo.

## Com'è fatta

```
moonbrand.app            sito vetrina (Cloudflare Worker, come oggi)
studio.moonbrand.app     studio (file statici) + /v1 → API
                         una macchina Hetzner: Caddy + API + worker
Supabase (prod)          DB, autenticazione, file dei brand (bucket presenza-brands, protocollo S3)
AWS                      solo Remotion Lambda (export dei video)
```

Lo studio chiama `/v1` sullo stesso dominio, quindi studio e API stanno tutti e due su `studio.moonbrand.app`:
niente CORS tra domini e cookie semplici.

Ogni brand appartiene a un worker (`presenza.brand_workers`) e i suoi file stanno sullo storage: per crescere si
aggiungono macchine worker, senza cambiare codice (vedi [Secondo worker](#13-secondo-worker)).

## 0. Prima di partire

- [ ] **App mobile**: in `moonbrand-app/src/lib/api.ts` `DEFAULT_SERVER` è ancora `http://45.14.185.228:3012`.
      Va messo `https://studio.moonbrand.app` e va rifatto l'APK.

## 1. Account e chiavi

| Servizio | Cosa fare | Dove va |
|---|---|---|
| Anthropic | API key nuova su console.anthropic.com, con credito; controllare il tier (limiti al minuto) | worker `ANTHROPIC_API_KEY` |
| Supabase | progetto nuovo, piano **Pro**, regione **eu-central-1** (Francoforte) | API e worker |
| Google Gemini | chiave di produzione, con fatturazione | worker `GEMINI_API_KEY` |
| ElevenLabs | chiave | worker `ELEVENLABS_API_KEY` |
| Atlas Cloud | chiave (clip video) | worker `ATLASCLOUD_API_KEY` |
| Mistral | chiave (dettatura) | API `MISTRAL_API_KEY` |
| Zernio | piano a pagamento, chiave | API e worker `ZERNIO_API_KEY` |
| AWS | le chiavi Remotion di oggi (`.env.lambda`) | worker `.env.lambda` |
| Hetzner Cloud | account e progetto «moonbrand» | — |

Non servono: `MUREKA_API_KEY`, `AI_PROVIDER`, `DEEPSEEK_*` (nessun codice le legge).

Su Anthropic, Gemini e Atlas Cloud imposta un limite di spesa mensile.

## 2. Supabase

1. Crea il progetto (Pro, Francoforte) con una password del DB forte.
2. Apri `moonbrand-be/moonbrand-api/schema/presenza.sql`, cambia `CAMBIA-QUESTA-PASSWORD` con una password nuova
   per `presenza_app`, e lancia il file intero dall'**SQL Editor** (crea ruoli, schema, tabelle, funzioni, RLS).
   Le migration in `moonbrand-api/migrations` fino a `20261005100000` sono già dentro: dopo si applicano solo
   quelle con data successiva.
3. `DATABASE_URL`: dal pannello *Connect*, il **pooler in session mode** (porta 5432), con utente
   `presenza_app.<id progetto>` e la password del punto 2.
4. **Storage → Settings**: limite per file almeno **2 GB** (i video caricati in chat arrivano fino a lì).
5. **Storage → New bucket**: `presenza-media`, privato. Il bucket `presenza-brands` lo crea l'API al primo avvio.
6. **Storage → S3 Connection**: crea una access key (id e secret).
7. Annota: `SUPABASE_URL`, anon key, service role key, JWT secret (Project Settings → API).

L'autenticazione non ha bisogno di email: la registrazione crea l'utente già confermato.

## 3. Macchina

1. Hetzner Cloud → **CX53** (16 vCPU condivise, 32 GB, 320 GB; circa 22–30 €/mese), **Ubuntu 24.04**,
   Falkenstein o Norimberga, con la tua chiave SSH.
   Il worker passa quasi tutto il tempo ad aspettare Claude e gli altri servizi: la CPU serve solo a picchi (bundle
   di Remotion, Chrome, ffmpeg), e le vCPU condivise bastano. Se i picchi rallentano troppo, dal pannello la macchina
   passa a una CCX (vCPU dedicate, dopo gli aumenti di giugno 2026 la CCX33 costa circa 138 €/mese) con un riavvio.
2. Firewall Hetzner: in entrata solo 22 (meglio solo dal tuo IP), 80 e 443.
3. Attiva i backup automatici della macchina.

## 4. Dominio

Il DNS di `moonbrand.app` è su Cloudflare.

1. Record **A** `studio` → IP della macchina, **proxy spento** (nuvola grigia): Caddy prende il certificato da solo e
   gli upload grandi non incontrano il limite di 100 MB del proxy Cloudflare.
2. Il sito su `moonbrand.app` resta com'è: `npm run deploy` in `moonbrand-website`.

## 5. Preparare la macchina

Da root:

```bash
adduser --disabled-password --gecos "" moonbrand
apt update && apt upgrade -y
apt install -y git curl caddy ca-certificates fonts-liberation fonts-noto-color-emoji \
  libnss3 libatk-bridge2.0-0 libgbm1 libxkbcommon0 libgtk-3-0 libasound2t64
curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && apt install -y nodejs
npm install -g pnpm
mkdir -p /srv/moonbrand/brands /srv/moonbrand/claude /srv/moonbrand/studio
chown -R moonbrand:moonbrand /srv/moonbrand
```

Le librerie servono a Chrome headless (grafica, controlli dei video); Chrome lo scarica Remotion al primo uso.
`pnpm` serve ai progetti video dei brand.

Da utente `moonbrand` (`su - moonbrand`):

```bash
git clone https://github.com/alessioblusailtechnologies/moonbrand.git ~/moonbrand
cd ~/moonbrand/moonbrand-be/moonbrand-api && npm ci && npm run build
cd ~/moonbrand/moonbrand-be/moonbrand-ai && npm ci
cd ~/moonbrand/moonbrand-studio && npm ci && npm run build
cp -r dist/moonbrand-studio/browser/* /srv/moonbrand/studio/
```

## 6. `.env` dell'API

`~/moonbrand/moonbrand-be/moonbrand-api/.env`

```
SUPABASE_URL=https://<id progetto>.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
DATABASE_URL=postgresql://presenza_app.<id progetto>:<password>@<host pooler>:5432/postgres
API_PORT=3012
LOG_LEVEL=info
CORS_ORIGINS=https://studio.moonbrand.app
STUDIO_ORIGINS=https://studio.moonbrand.app
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
FILES_SECRET=            # openssl rand -base64 48
S3_ENDPOINT=https://<id progetto>.storage.supabase.co/storage/v1/s3
S3_REGION=eu-central-1
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
MISTRAL_API_KEY=
ZERNIO_API_KEY=
```

## 7. `.env` del worker

`~/moonbrand/moonbrand-be/moonbrand-ai/.env`

```
DATABASE_URL=            # lo stesso dell'API
ANTHROPIC_API_KEY=
WORKER_ID=worker-1       # fisso per macchina: i brand restano legati a questo nome
WORKER_CONCURRENCY=6
API_URL=http://localhost:3012
BRANDS_DIR=/srv/moonbrand/brands
CLAUDE_CONFIG_DIR=/srv/moonbrand/claude
S3_ENDPOINT=             # gli stessi quattro valori S3 dell'API
S3_REGION=eu-central-1
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
GEMINI_API_KEY=
ELEVENLABS_API_KEY=
ATLASCLOUD_API_KEY=
ZERNIO_API_KEY=
```

Copia anche `.env.lambda` (`REMOTION_AWS_ACCESS_KEY_ID`, `REMOTION_AWS_SECRET_ACCESS_KEY`, `REMOTION_AWS_REGION`).

```bash
chmod 600 ~/moonbrand/moonbrand-be/moonbrand-api/.env ~/moonbrand/moonbrand-be/moonbrand-ai/.env*
```

## 8. Caddy

`/etc/caddy/Caddyfile`

```
studio.moonbrand.app {
    encode gzip
    handle /v1/* {
        reverse_proxy localhost:3012
    }
    handle {
        root * /srv/moonbrand/studio
        try_files {path} /index.html
        file_server
    }
}
```

```bash
systemctl reload caddy
```

## 9. Servizi

`/etc/systemd/system/moonbrand-api.service`

```
[Unit]
Description=moonbrand API
After=network-online.target

[Service]
User=moonbrand
WorkingDirectory=/home/moonbrand/moonbrand/moonbrand-be/moonbrand-api
ExecStart=/usr/bin/node --env-file=.env dist/server.mjs
Restart=always

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/moonbrand-worker.service`

```
[Unit]
Description=moonbrand worker
After=network-online.target

[Service]
User=moonbrand
WorkingDirectory=/home/moonbrand/moonbrand/moonbrand-be/moonbrand-ai
ExecStart=/usr/bin/npx tsx src/worker.ts
KillSignal=SIGTERM
TimeoutStopSec=30
Restart=always

[Install]
WantedBy=multi-user.target
```

Con SIGTERM il worker rimette in coda i job in corso prima di chiudersi.

```bash
systemctl daemon-reload
systemctl enable --now moonbrand-api moonbrand-worker
journalctl -u moonbrand-worker -f     # «worker worker-1 pronto: ...»
curl https://studio.moonbrand.app/v1/health    # {"ok":true}
```

## 10. Verifiche prima di aprire

- [ ] Registrazione e accesso su `https://studio.moonbrand.app`
- [ ] Onboarding di un brand con file di riferimento ed esempi grafici
- [ ] In chat, un post con immagine: l'immagine compare mentre il job lavora (lo storage risponde)
- [ ] Un video breve: export con Lambda e riproduzione nello studio
- [ ] Un video caricato dal telefono in chat
- [ ] Collegamento di un social con Zernio: si torna su `studio.moonbrand.app`
- [ ] Una pubblicazione di prova
- [ ] Su Supabase, nel bucket `presenza-brands`: la cartella del brand e `_sessions/<brand>/`
- [ ] App mobile collegata a `https://studio.moonbrand.app`

## 11. Aggiornare

```bash
su - moonbrand
cd ~/moonbrand && git pull
cd moonbrand-be/moonbrand-api && npm ci && npm run build
cd ../moonbrand-ai && npm ci
cd ~/moonbrand/moonbrand-studio && npm ci && npm run build && cp -r dist/moonbrand-studio/browser/* /srv/moonbrand/studio/
exit
systemctl restart moonbrand-api moonbrand-worker
```

Le migration nuove (data dopo `20261005100000`) si lanciano dall'SQL Editor prima del riavvio.

## 12. Controllo

- Monitor esterno (per esempio UptimeRobot) su `https://studio.moonbrand.app/v1/health`.
- Log: `journalctl -u moonbrand-api` e `journalctl -u moonbrand-worker`.
- Job fermi in coda: `select count(*) from presenza.ai_jobs where status = 'queued' and created_at < now() - interval '5 minutes'`.

## 13. Secondo worker

Stessa preparazione dei punti 3 e 5, senza Caddy, senza API e senza studio; solo il servizio `moonbrand-worker`.
Nel `.env` del worker cambiano:

```
WORKER_ID=worker-2
API_URL=https://studio.moonbrand.app
```

I brand nuovi vanno al primo worker libero; quelli esistenti restano al loro. Per spostare un brand da un worker
spento: `update presenza.brand_workers set worker_id = 'worker-2' where brand_id = '<brand>'` (i file arrivano da
soli dallo storage al primo job).
