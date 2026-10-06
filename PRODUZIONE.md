# Messa in produzione

Passo per passo, da zero: account e chiavi, Supabase, macchina, dominio, servizi, verifiche.
In produzione si parte vuoti: niente migrazione dei dati né dei file dei brand dallo sviluppo.

## Com'è fatta

```
moonbrand.app            sito vetrina (Cloudflare Worker, come oggi)
studio.moonbrand.app     studio (file statici) + /v1 → API
                         un server dedicato Hetzner AX42: Caddy + API + worker
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
| Google Cloud | progetto, *OAuth consent screen* (esterno, nome Moonbrand, logo, dominio `moonbrand.app`) e un *OAuth client ID* di tipo Web | Supabase → Authentication → Providers → Google |
| Resend | account, dominio `moonbrand.app` verificato (vedi [Dominio](#4-dominio)), API key con permesso *Sending* | API `RESEND_API_KEY` |
| AWS | le chiavi Remotion di oggi (`.env.lambda`) | worker `.env.lambda` |
| Hetzner | account (lo stesso per cloud e server dedicati), con ragione sociale e partita IVA | — |

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
8. **Authentication → Providers → Google**: attivo, con client ID e secret di Google Cloud. In Google Cloud, tra gli
   *Authorized redirect URIs* del client va `https://<id progetto>.supabase.co/auth/v1/callback`.
9. **Authentication → URL Configuration**: *Site URL* `https://studio.moonbrand.app`, e tra i *Redirect URLs*
   `https://studio.moonbrand.app/accesso-google` (in sviluppo anche quello dello studio locale).

Le email dell'accesso (benvenuto con la conferma, nuova password) le manda l'API con Resend, non Supabase: in
Supabase non serve configurare SMTP né template. La registrazione crea l'utente già confermato per Supabase;
la conferma dell'email è nostra (`presenza.accounts.email_confirmed_at`).

## 3. Macchina

Un server dedicato **AX42**: AMD Ryzen 7 PRO 8700GE (8 core / 16 thread), 64 GB DDR5, 2 × 512 GB NVMe; circa
99 €/mese più 49 € di attivazione (ottobre 2026). Le macchine cloud condivise (CX, CPX) erano esaurite e quelle con
vCPU dedicate (CCX) costano di più per meno RAM; la RAM è il limite dei job in parallelo, e qui ne stanno 15–20.

1. Ordine da https://www.hetzner.com/dedicated-rootserver/ax42/ :
   - **Server type**: AX42-2-LTD se c'è (ECC, prezzo ridotto, a quantità limitata), altrimenti AX42-2.
   - **Operating system**: Ubuntu 24.04 preinstallato; i due dischi in **RAID 1** (software).
   - **Location**: Germania (Falkenstein o Norimberga), vicino a Supabase.
   - **Primary IPv4**: attivo.
   - La tua chiave SSH pubblica, se il form la chiede.
2. Arriva un'email con IP e accesso root (di solito in qualche ora). Il server si gestisce da **Robot**
   (https://robot.hetzner.com): reset, reinstallazione, fatture.
3. Al primo accesso controlla il RAID: `cat /proc/mdstat` deve mostrare gli array `md` con `[UU]` (due dischi attivi).
   Se il server è arrivato senza RAID, reinstallalo da Robot (Rescue System e `installimage`, con `SWRAID 1`).
4. Firewall sulla macchina (quello di Robot non serve):
   ```bash
   ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
   ```
5. Niente snapshot come nel cloud, e non servono: DB e file dei brand stanno su Supabase, il codice su GitHub.
   Tieni una copia dei `.env` (punti 6 e 7) in un gestore di password: con quelli si rifà la macchina da zero.

Per crescere non si prende un server più grande: se ne aggiunge un altro come worker
(vedi [Secondo worker](#13-secondo-worker)).

## 4. Dominio

Il DNS di `moonbrand.app` è su Cloudflare.

1. Record **A** `studio` → IP della macchina, **proxy spento** (nuvola grigia): Caddy prende il certificato da solo e
   gli upload grandi non incontrano il limite di 100 MB del proxy Cloudflare.
2. Il sito su `moonbrand.app` resta com'è: `npm run deploy` in `moonbrand-website`.
3. **Resend → Domains → Add domain** `moonbrand.app`: i record che chiede (SPF e DKIM, più il MX del sottodominio di
   ritorno) vanno su Cloudflare, tutti con la nuvola grigia. Finché il dominio non risulta *Verified* le email non
   partono. Utile anche un record DMARC (`_dmarc` TXT `v=DMARC1; p=none;`).

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

Da utente `moonbrand` (`su - moonbrand`). Il repo è privato: il server lo scarica con una **deploy key**, una chiave
che può solo leggere questo repo.

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519 -C "moonbrand-prod"
cat ~/.ssh/id_ed25519.pub
```

Su GitHub: repo → *Settings → Deploy keys → Add deploy key*, incolla la chiave, senza «Allow write access». Poi:

```bash
git clone git@github.com:alessioblusailtechnologies/moonbrand.git ~/moonbrand
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
RESEND_API_KEY=
EMAIL_FROM=Moonbrand <ciao@moonbrand.app>
STUDIO_URL=https://studio.moonbrand.app
EMAIL_SECRET=            # openssl rand -base64 48
```

Senza `RESEND_API_KEY` le email non partono: il testo, con il link, finisce nel log dell'API.

## 7. `.env` del worker

`~/moonbrand/moonbrand-be/moonbrand-ai/.env`

```
DATABASE_URL=            # lo stesso dell'API
ANTHROPIC_API_KEY=
WORKER_ID=worker-1       # fisso per macchina: i brand restano legati a questo nome
WORKER_CONCURRENCY=12     # AX42, 64 GB: si può salire verso 15-20 guardando la RAM (free -h) nelle ore piene
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
        # I file con l hash nel nome non cambiano mai: in cache per un anno.
        @hashed path_regexp hashed ^/(main|chunk|styles|polyfills)-[A-Za-z0-9_-]+\.(js|css)$
        header @hashed Cache-Control "public, max-age=31536000, immutable"
        # I file statici che mancano sono un 404, non la pagina dello studio (un JS che riceve HTML lascia la pagina bianca).
        @static path *.js *.css *.map *.json *.png *.jpg *.jpeg *.webp *.svg *.ico *.woff *.woff2
        handle @static {
            file_server
        }
        # Le pagine (index.html) si ricontrollano sempre: dopo un deploy puntano subito ai file nuovi.
        handle {
            header Cache-Control "no-cache"
            try_files {path} /index.html
            file_server
        }
    }
    # Un file che manca non si mette in cache: al prossimo deploy potrebbe esserci.
    handle_errors {
        header Cache-Control "no-store"
        respond "{err.status_code} {err.status_text}" {err.status_code}
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
- [ ] Arriva l'email di benvenuto (non in spam), il link conferma e il promemoria nello studio sparisce
- [ ] Continua con Google: si entra, e con la stessa email di un account con password si ritrova lo stesso account
- [ ] Password dimenticata: arriva il link, la nuova password funziona e la vecchia no
- [ ] Onboarding di un brand con file di riferimento ed esempi grafici
- [ ] In chat, un post con immagine: l'immagine compare mentre il job lavora (lo storage risponde)
- [ ] Un video breve: export con Lambda e riproduzione nello studio
- [ ] Un video caricato dal telefono in chat
- [ ] Collegamento di un social con Zernio: si torna su `studio.moonbrand.app`
- [ ] Una pubblicazione di prova
- [ ] Su Supabase, nel bucket `presenza-brands`: la cartella del brand e `_sessions/<brand>/`
- [ ] App mobile collegata a `https://studio.moonbrand.app`

## 11. Aggiornare

Il dettaglio (cosa rifare per ogni parte, migration, chiavi, controlli) è in [OPERAZIONI.md](OPERAZIONI.md).

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

Un altro AX42, con la stessa preparazione dei punti 3 e 5 (stessa deploy key o una nuova), senza Caddy, senza API e
senza studio: solo il servizio `moonbrand-worker`.
Nel `.env` del worker cambiano:

```
WORKER_ID=worker-2
API_URL=https://studio.moonbrand.app
```

I brand nuovi vanno al primo worker libero; quelli esistenti restano al loro. Per spostare un brand da un worker
spento: `update presenza.brand_workers set worker_id = 'worker-2' where brand_id = '<brand>'` (i file arrivano da
soli dallo storage al primo job).
