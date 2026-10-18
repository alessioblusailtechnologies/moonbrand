# Sandbox di Bash nella chat del v2

Stato al 18/10: **spento**, anche in produzione. La chat del v2 gira come quella della v1: Bash parte come utente
`moonbrand` senza sandbox. Da riprendere.

## Perché serve

Nella chat Claude usa Bash per ffmpeg, i rendering e gli script. Senza sandbox Bash legge tutto quello che legge
`moonbrand`: il repo, i `.env` (chiave Anthropic, Gemini, Atlas, ElevenLabs, S3, database), le credenziali di Claude
in `/srv/moonbrand/claude`, le cartelle degli altri brand. Read, Grep e Glob hanno le loro regole di divieto
(`moonbrand-ai-v2/src/jobs/chat/chat.ts`). Claude Code le applica anche ai percorsi scritti nei comandi Bash (nella prova
del 18/10 `cat ~/moonbrand/deploy.sh` è stato negato), ma è un controllo sul testo del comando: un programma che apre
il file da sé (`node -e`, `python`) o un percorso costruito al momento lo scavalca.

Il rischio concreto è un prompt malevolo dentro un file del brand o un riferimento scaricato (un post, una pagina) che
fa leggere e mandare fuori le chiavi. Con il sandbox Bash scrive solo nella cartella del brand e non legge repo né home.

## Come si accende

Nel `.env` del v2 `BASH_SANDBOX=on`, poi `systemctl restart moonbrand-worker`. Senza la correzione qui sotto, con
`BASH_SANDBOX=on` Bash non parte e la chat non riesce a fare niente che passi da Bash (`failIfUnavailable`).

## Cosa lo blocca

Ubuntu 26.04 carica il profilo AppArmor `bwrap-userns-restrict`: bubblewrap può creare uno user namespace, ma
quello che ci gira dentro passa al profilo `unpriv_bwrap`, senza capability. Il sandbox dell'SDK, dentro bwrap, lancia
`apply-seccomp`, che crea un secondo namespace, e lì si ferma:

```
apply-seccomp: write /proc/self/setgroups (nested userns is capability-restricted; caller must provide CAP_SYS_ADMIN): Permission denied
```

Nel log del kernel: `apparmor="DENIED" operation="capable" profile="unpriv_bwrap" comm="bwrap" capname="sys_admin"`.

Diagnosi sul server: `kernel.apparmor_restrict_unprivileged_userns = 1`, profili `bwrap-userns-restrict` e
`unprivileged_userns` presenti; come `moonbrand` `bwrap --unshare-user --ro-bind / / true` riesce, bwrap dentro bwrap no.

È lo stesso blocco che aveva Chrome headless per la grafica, risolto con il profilo `moonbrand-ai/apparmor/moonbrand-chrome`
(PRODUZIONE.md, installazione).

## La correzione proposta (non fatta)

Al posto di `bwrap-userns-restrict`, un profilo che lascia a bwrap, e solo a lui, gli user namespace senza restrizioni.
Il resto del server resta con `kernel.apparmor_restrict_unprivileged_userns = 1`. Da root:

```bash
cat > /etc/apparmor.d/bwrap-moonbrand <<'P'
# moonbrand: bwrap può creare user namespace anche annidati (sandbox di Bash del motore v2, SANDBOX-BASH.md)
abi <abi/4.0>,
include <tunables/global>

profile bwrap-moonbrand /usr/bin/bwrap flags=(unconfined) {
  userns,
}
P
ln -sf /etc/apparmor.d/bwrap-userns-restrict /etc/apparmor.d/disable/bwrap-userns-restrict
apparmor_parser -R /etc/apparmor.d/bwrap-userns-restrict
apparmor_parser -r /etc/apparmor.d/bwrap-moonbrand
su - moonbrand -c 'bwrap --unshare-user --ro-bind / / bwrap --unshare-user --ro-bind / / true && echo ok'
```

Il link in `disable/` regge gli aggiornamenti del pacchetto AppArmor.

Cosa si perde: chi ha un accesso al server può usare bwrap per avere capability dentro un namespace suo, come prima di
Ubuntu 24.04. Sul server ci sono solo root e `moonbrand`.

Per tornare indietro:

```bash
apparmor_parser -R /etc/apparmor.d/bwrap-moonbrand
rm /etc/apparmor.d/bwrap-moonbrand /etc/apparmor.d/disable/bwrap-userns-restrict
apparmor_parser -r /etc/apparmor.d/bwrap-userns-restrict
```

Scartata: `sysctl kernel.apparmor_restrict_unprivileged_userns=0`, che toglie la protezione a tutti i programmi.

Da verificare prima: se il profilo con path `/usr/bin/bwrap` e quello disattivato non si pestano (`aa-status` deve
mostrare `bwrap-moonbrand` e non `bwrap`/`unpriv_bwrap`), e se esiste un'impostazione dell'SDK che evita il namespace
annidato senza togliere il filtro seccomp (c'è `enableWeakerNestedSandbox`, pensato per Docker: da capire cosa toglie).

## Dopo la correzione

1. `BASH_SANDBOX=on` nel `.env` del v2 e riavvio del worker.
2. La prova di PRODUZIONE.md §14, passo 5: ffmpeg e la scrittura in `lavoro/` riescono, la lettura di
   `~/moonbrand/deploy.sh` no, né con Read né con Bash (`cat`).
3. Una chat vera dallo studio con un carosello e un video: le chiamate al proxy dei servizi su 127.0.0.1 devono
   passare dal sandbox (se no `sandbox.network` in chat.ts), e lo scaricamento dei link social pure.
