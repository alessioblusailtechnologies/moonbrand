# Operazioni in produzione

Come si aggiorna e si controlla la produzione giorno per giorno. La messa in produzione da zero è in
[PRODUZIONE.md](PRODUZIONE.md); qui c'è quello che si fa dopo, sulla macchina che c'è.

Nessun segreto sta in questo file: chiavi e password sono nel gestore di password e nei `.env` sul server.

## La macchina di oggi

| | |
|---|---|
| Server | Hetzner Cloud **CCX33** `moonbrand-1` (8 vCPU dedicate, 32 GB, 240 GB), Falkenstein, IP `167.233.120.227` |
| Sistema | Ubuntu 26.04, Node 24, pnpm, Caddy 2.6 (quello di Ubuntu) |
| Firewall | quello di Hetzner (`moonbrand-prod`: TCP 22, 80, 443, UDP 443, ICMP) e `ufw` sulla macchina, con le stesse porte |
| Dominio | `studio.moonbrand.app`, record A su Cloudflare con la nuvola grigia; il certificato lo prende Caddy |
| DB e file | Supabase Pro `lcuegowlrxbznaobngtg`, Francoforte (`eu-central-1`); bucket `presenza-brands` e `presenza-media` |
| Worker | `WORKER_ID=worker-1`, `WORKER_CONCURRENCY=7` (circa 4 GB di RAM per job) |

È un ponte in attesa dell'AX42 (vedi [Passare a un'altra macchina](#passare-a-unaltra-macchina)).

## Accesso

Dal PC di sviluppo (Git Bash), con l'alias in `~/.ssh/config`:

```
Host moonbrand
  HostName 167.233.120.227
  User root
  IdentityFile ~/.ssh/moonbrand_prod_ed25519
  IdentitiesOnly yes
```

```bash
ssh moonbrand                      # root
ssh moonbrand 'su - moonbrand'     # l'utente che fa girare API e worker
```

L'accesso SSH è solo a chiave. Se la chiave si perde: console del pannello Hetzner (`>_`) oppure
*Rescue → Reset root password*, poi si aggiunge una chiave nuova in `/root/.ssh/authorized_keys`.

| Dove | Cosa |
|---|---|
| `/home/moonbrand/moonbrand` | il repo (deploy key in sola lettura, `~moonbrand/.ssh/id_ed25519`) |
| `…/moonbrand-be/moonbrand-api/.env` | `.env` dell'API (permessi 600) |
| `…/moonbrand-be/moonbrand-ai/.env`, `.env.lambda` | `.env` del worker e chiavi AWS di Remotion Lambda (600) |
| `/srv/moonbrand/studio` | lo studio compilato, servito da Caddy |
| `/srv/moonbrand/brands`, `/srv/moonbrand/claude` | copie di lavoro dei brand e configurazione di Claude Code del worker |
| `/etc/caddy/Caddyfile` | dominio, `/v1/*` → API su `localhost:3012`, il resto → studio (`index.html` sempre ricontrollato, file con l'hash in cache un anno, file mancanti in 404) |
| `/etc/systemd/system/moonbrand-{api,worker}.service` | i due servizi |

## Aggiornare

Si lavora e si prova in sviluppo, si fa commit e push su `master`, poi la macchina scarica e ricompila.
Si rifà solo quello che è cambiato:

| Cambiato | Da fare sul server |
|---|---|
| `moonbrand-be/moonbrand-api` | `npm ci && npm run build`, riavvio di `moonbrand-api` |
| `moonbrand-be/moonbrand-ai` | `npm ci`, riavvio di `moonbrand-worker` |
| `moonbrand-studio` | `npm ci && npm run build`, i file nuovi copiati sopra i vecchi |
| `moonbrand-shared` | tutti e tre: lo usano API, worker e studio |
| `moonbrand-be/moonbrand-api/migrations` | la migration sul DB **prima** del riavvio (vedi sotto) |

`npm ci` serve solo se è cambiato un `package-lock.json`, ma rifarlo non fa danni.

Tutto insieme, dal PC di sviluppo:

```bash
ssh moonbrand 'su - moonbrand -c "set -e
cd ~/moonbrand && git pull -q && git log --oneline -1
cd moonbrand-be/moonbrand-api && npm ci --no-audit --no-fund >/tmp/api-ci.log 2>&1 && npm run build >/tmp/api-build.log 2>&1 && echo api_ok
cd ../moonbrand-ai && npm ci --no-audit --no-fund >/tmp/ai-ci.log 2>&1 && echo worker_ok
cd ~/moonbrand/moonbrand-studio && npm ci --no-audit --no-fund >/tmp/st-ci.log 2>&1 && npm run build >/tmp/st-build.log 2>&1
cp -r dist/moonbrand-studio/browser/* /srv/moonbrand/studio/ && find /srv/moonbrand/studio -type f -mtime +7 -delete && echo studio_ok"'
ssh moonbrand 'systemctl restart moonbrand-api moonbrand-worker'
```

Se un passo fallisce, il log è in `/tmp/*.log` sul server (`ssh moonbrand 'tail -30 /tmp/st-build.log'`).

Solo lo studio (per esempio una modifica grafica) non tocca i servizi: niente riavvio, la pagina nuova arriva al
prossimo caricamento. I file nuovi si copiano sopra i vecchi senza svuotare la cartella: una scheda aperta da prima
del deploy trova ancora i pezzi della sua versione. Quelli che nessun deploy ha più ricopiato da 7 giorni si cancellano.

Il riavvio del worker manda SIGTERM: i job in corso tornano in coda e li riprende appena riparte. Durante un
riavvio dell'API (un paio di secondi) lo studio può mostrare un errore di rete e riprova da solo.

## Migration del DB

Una migration nuova è un file in `moonbrand-be/moonbrand-api/migrations` con data e ora nel nome, successiva a
quelle già lanciate (in produzione: tutte quelle fino a `20261005100000` sono nello schema iniziale, dopo sono
state lanciate `20261006100000_free_jobs.sql` e `20261006180000_account_email.sql`).

1. Si prova sul DB di sviluppo.
2. Commit e push, `git pull` sul server.
3. Si lancia sul DB di produzione **dal server**, con il `DATABASE_URL` del `.env` dell'API (la password non passa
   mai dalla riga di comando né dalla chat):

   ```bash
   ssh moonbrand 'su - moonbrand -c "cd ~/moonbrand/moonbrand-be/moonbrand-api && node -e \"
   process.loadEnvFile(\\\".env\\\");
   const { Client } = require(\\\"pg\\\");
   (async () => {
     const c = new Client({ connectionString: process.env.DATABASE_URL });
     await c.connect();
     await c.query(require(\\\"fs\\\").readFileSync(process.argv[1], \\\"utf8\\\"));
     console.log(\\\"migration applicata\\\");
     await c.end();
   })().catch((e) => { console.error(\\\"ERRORE\\\", e.message); process.exit(1); });
   \" migrations/NOME_DELLA_MIGRATION.sql"'
   ```

   In alternativa: il file nell'**SQL Editor** di Supabase, incollato e lanciato.
4. Poi la build e il riavvio, come sopra.

Una migration si lancia una volta sola: prima di rilanciarne una, controlla che non ci sia già (una colonna, una
tabella). Annota qui sopra quelle lanciate.

## Cambiare una chiave o un'impostazione

I `.env` si cambiano sul server, poi si riavvia il servizio che li legge:

```bash
ssh moonbrand
nano /home/moonbrand/moonbrand/moonbrand-be/moonbrand-ai/.env     # o moonbrand-api/.env, o .env.lambda
systemctl restart moonbrand-worker                                # o moonbrand-api
```

Per non far passare le chiavi da una chat: si scrivono in un file sul PC, fuori dal repo (per esempio
`Desktop\moonbrand-prod.env`), e si copiano con `scp` senza mostrarle; poi il file va nel gestore di password e si
cancella. Dopo una copia: `chown moonbrand:moonbrand` e `chmod 600` sui `.env`.

Quello che c'è in ciascun `.env` è elencato ai punti 6 e 7 di [PRODUZIONE.md](PRODUZIONE.md). Differenze di oggi:
`WORKER_CONCURRENCY=7` (CCX33, 32 GB), `SUPABASE_JWT_SECRET` vuoto (l'API verifica i token con le chiavi pubbliche
del progetto).

## Controllare

```bash
curl https://studio.moonbrand.app/v1/health                       # {"ok":true}
ssh moonbrand 'systemctl is-active moonbrand-api moonbrand-worker caddy'
ssh moonbrand 'journalctl -u moonbrand-worker -n 50 --no-pager'   # all'avvio: «worker worker-1 pronto: …»
ssh moonbrand 'journalctl -u moonbrand-api --since "-1h" --no-pager -o cat | grep -E "\"level\":(40|50)"'   # avvisi ed errori
ssh moonbrand 'free -h; df -h /'                                   # RAM nelle ore piene: decide WORKER_CONCURRENCY
```

Il log dell'API è JSON (pino): `level` 40 è un avviso, 50 un errore. Il worker scrive testo semplice.

Job fermi in coda da più di 5 minuti (SQL Editor di Supabase):

```sql
select count(*) from presenza.ai_jobs where status = 'queued' and created_at < now() - interval '5 minutes';
```

Se succede spesso nelle ore piene, i job in parallelo non bastano: si alza `WORKER_CONCURRENCY` guardando la RAM,
si passa a una macchina più grande (dal pannello: *Rescale*, solo CPU e RAM) o si aggiunge un worker.

## Problemi già visti

- **Certificato non preso.** Se Caddy parte prima che il record DNS esista, riprova solo dopo un po'. Con il
  record a posto: `systemctl restart caddy`, e nel log (`journalctl -u caddy -n 30`) deve comparire
  «certificate obtained successfully».
- **Un servizio che riparte all'infinito.** Di solito manca o è sbagliato un valore nel `.env`:
  `journalctl -u moonbrand-api -n 30` mostra quale.
- **Errori di Postgres all'avvio dell'API** (per esempio il giro del mattino dei saluti): il messaggio e lo stack sono
  nel campo `err` della riga con `level` 40 o 50.
- **Il browser mostra lo studio vecchio o l'icona vecchia.** È la cache: Ctrl+F5.

## Passare a un'altra macchina

La macchina non tiene dati: DB e file dei brand sono su Supabase, il codice su GitHub. Per passare all'AX42 (o a
qualunque altra):

1. Si prepara la macchina nuova con i punti 3, 5, 8 e 9 di [PRODUZIONE.md](PRODUZIONE.md), con gli stessi `.env`
   e lo **stesso `WORKER_ID=worker-1`**: i brand restano legati a quel nome e la trovano senza toccare il DB.
   `WORKER_CONCURRENCY` si adatta alla RAM (12 sull'AX42).
2. Il record A `studio` su Cloudflare passa al nuovo IP; Caddy prende il certificato da solo.
3. Sulla vecchia: `systemctl stop moonbrand-worker` quando non ha job in corso, poi la macchina si **elimina** dal
   pannello (spenta si paga lo stesso).

Per aggiungere un secondo worker invece: [PRODUZIONE.md, Secondo worker](PRODUZIONE.md#13-secondo-worker).
