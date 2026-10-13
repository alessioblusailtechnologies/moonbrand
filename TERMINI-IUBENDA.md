# Termini e privacy su iubenda per i pagamenti con Paddle

Stato al 13 ottobre 2026. I documenti sono su iubenda (ID in `moonbrand-website/src/data/iubenda.ts`); il sito li
scarica alla build, quindi dopo le modifiche serve un nuovo deploy del sito.

Cosa chiede Paddle per approvare il sito (developer.paddle.com, requisiti per i venditori):

- termini, politica di rimborso e privacy **pubblici** (senza login);
- nei termini il **nome legale** del venditore e la frase che Paddle è il rivenditore e **merchant of record**;
- una politica di rimborso con una finestra **tra 14 e 90 giorni**, mai «nessun rimborso» o «tutte le vendite sono
  definitive»;
- per l'AI generativa: uso consentito, responsabilità dell'utente per richieste e materiali caricati, diritti sui
  risultati, segnalazioni per violazioni, diritto di moderare, avviso sull'accuratezza;
- nella privacy Paddle tra i destinatari dei dati.

La politica di rimborso è già sul sito: `/rimborsi/`, `/en/refunds/`, `/fr/remboursements/` (componente
`Refunds.astro`, testi in `src/i18n/*.ts` → `refunds`), con il link nel piè di pagina e nelle domande dei prezzi.

## 1. Termini: impostazioni del generatore

Su iubenda → Termini e Condizioni → Modifica, in tutte e tre le lingue (it, en UK, fr):

- [ ] **Tipo di utenti**: da «solo utenti che non agiscono come consumatori» a **utenti commerciali e consumatori**.
  Oggi in «Da sapere a colpo d'occhio» c'è «L'utilizzo del Servizio è riservato ai soli Utenti che non agiscono come
  Consumatori»: con Paddle comprano anche i privati.
- [ ] **Diritto di recesso** per i consumatori: acceso, 14 giorni, con l'eccezione per i servizi digitali cominciati
  su richiesta del consumatore (paga la parte già fornita).
- [ ] **Pagamenti**: tra i mezzi di pagamento, gestiti da terzi (Paddle).
- [ ] **Abbonamenti**: a tempo determinato con rinnovo automatico mensile (già così); disdetta dalle impostazioni del
  brand nello studio o dal portale di Paddle, con effetto alla fine del periodo pagato.
- [ ] Controllare che il titolare sia **Blusail Technologies S.r.l.s.** con indirizzo e P.IVA (già così).

## 2. Termini: clausole da aggiungere

Come clausole personalizzate (iubenda → Termini → «Aggiungi clausola personalizzata»), nella sezione «Termini e
condizioni di vendita». Se il piano iubenda non le permette, va cambiato piano: la frase su Paddle è il motivo più
frequente per cui Paddle rifiuta un sito.

### Italiano

**Venditore e pagamenti tramite Paddle**

Il contratto per l'uso del Servizio è concluso con Blusail Technologies S.r.l.s., titolare di Moonbrand. Il nostro
processo d'ordine è gestito dal nostro rivenditore online Paddle.com. Paddle.com è il Merchant of Record per tutti i
nostri ordini: incassa i pagamenti, applica le imposte dovute ed emette le fatture, e gestisce le richieste di
assistenza sui pagamenti e i rimborsi. Agli acquisti si applicano anche i termini per l'acquirente di Paddle
(https://www.paddle.com/legal/checkout-buyer-terms). I prezzi sul sito sono indicati IVA esclusa; l'importo finale,
con le imposte del paese dell'Utente e nella sua valuta, è mostrato nel checkout prima del pagamento.

**Piani, crediti e ricariche**

Ogni brand ha il proprio abbonamento mensile, che si rinnova automaticamente fino alla disdetta. Ogni piano dà un
numero di crediti al mese, con cui si misura il lavoro dell'intelligenza artificiale. I crediti del piano valgono per
il periodo in corso e non passano al periodo successivo. I crediti acquistati con una ricarica non scadono alla fine
del periodo e si possono usare finché il brand ha un piano attivo; se il piano viene riattivato, tornano disponibili.
I crediti non hanno valore monetario, non si convertono in denaro e non si trasferiscono ad altri brand. Passando a
un piano superiore l'Utente paga subito la differenza per il resto del periodo; passando a un piano inferiore il
nuovo prezzo si applica dal rinnovo successivo e fino ad allora restano i crediti del piano in corso.

**Disdetta e rimborsi**

L'Utente può disdire in qualsiasi momento dalle impostazioni del brand o dal portale di Paddle: l'abbonamento resta
attivo fino alla fine del periodo già pagato e non ci sono altri addebiti. I rimborsi sono regolati dalla nostra
politica di rimborso (https://moonbrand.app/rimborsi/): l'Utente può chiedere il rimborso entro 14 giorni dal primo
pagamento di un abbonamento o dall'acquisto di una ricarica, eventualmente ridotto in proporzione ai crediti già
usati; i pagamenti dei rinnovi non si rimborsano, salvo quanto previsto dalla legge. Con il rimborso i crediti
dell'acquisto vengono tolti e, per un abbonamento, il piano si chiude. I rimborsi si chiedono dal link nell'email di
ricevuta di Paddle, su paddle.net o scrivendo a info@moonbrand.app.

**Contenuti generati con l'intelligenza artificiale**

Il Servizio usa modelli di intelligenza artificiale per creare testi, immagini, video e musica a partire dalle
richieste dell'Utente e dai materiali che carica (loghi, foto, video, documenti, link). L'Utente:

- garantisce di avere i diritti sui materiali che carica e sulle persone, i marchi e le opere che vi compaiono;
- è responsabile delle richieste che fa e dell'uso dei contenuti generati, compresa la loro pubblicazione sui social;
- controlla i contenuti prima di pubblicarli: i risultati dell'AI possono contenere errori, imprecisioni o somiglianze
  con contenuti di terzi, e Moonbrand non ne garantisce l'esattezza né l'idoneità a un uso particolare.

È vietato usare il Servizio per creare contenuti illeciti; contenuti sessuali che coinvolgono minori o persone senza
il loro consenso, compresi i deepfake; contenuti d'odio, molesti o diffamatori; contenuti che violano diritti d'autore,
marchi o la riservatezza di terzi, compresa la diffusione di dati personali altrui; contenuti ingannevoli, come false
recensioni o finte dichiarazioni di persone reali; spam o malware; e tentativi di aggirare i limiti di sicurezza dei
modelli.

Nei limiti della legge e dei termini dei fornitori dei modelli, i contenuti generati per l'Utente appartengono
all'Utente, che può usarli anche a fini commerciali; Blusail Technologies S.r.l.s. li tratta solo per fornire il
Servizio. Il Titolare può rimuovere contenuti o sospendere l'account in caso di violazione. Chi ritiene che un
contenuto violi i propri diritti può segnalarlo a info@moonbrand.app indicando il contenuto e il diritto violato: il
contenuto viene esaminato e, se la segnalazione è fondata, rimosso; in caso di violazioni ripetute l'account viene
chiuso.

### English (UK)

**Seller and payments through Paddle**

The contract for the use of the Service is made with Blusail Technologies S.r.l.s., owner of Moonbrand. Our order
process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders: it
collects payments, applies the applicable taxes, issues invoices and handles payment enquiries and refunds. Purchases
are also subject to Paddle's buyer terms (https://www.paddle.com/legal/checkout-buyer-terms). Prices on the website
are shown excluding VAT; the final amount, with the taxes of the User's country and in their currency, is shown in
the checkout before payment.

**Plans, credits and top-ups**

Each brand has its own monthly subscription, which renews automatically until cancelled. Each plan gives a number of
credits per month, used to measure the work of the artificial intelligence. Plan credits are valid for the current
period and do not carry over to the next one. Credits bought with a top-up do not expire at the end of the period and
can be used as long as the brand has an active plan; if the plan is reactivated, they become available again. Credits
have no monetary value, cannot be exchanged for money and cannot be transferred to other brands. When moving to a
higher plan the User pays the difference for the rest of the period straight away; when moving to a lower plan the
new price applies from the next renewal and until then the credits of the current plan remain.

**Cancellation and refunds**

The User can cancel at any time from the brand settings or from Paddle's portal: the subscription stays active until
the end of the period already paid, with no further charges. Refunds are governed by our refund policy
(https://moonbrand.app/en/refunds/): the User can ask for a refund within 14 days of the first payment of a
subscription or of buying a top-up, possibly reduced in proportion to the credits already used; renewal payments are
not refunded, except where the law requires it. With the refund, the credits of the purchase are removed and, for a
subscription, the plan ends. Refunds can be requested from the link in Paddle's receipt email, at paddle.net or by
writing to info@moonbrand.app.

**AI-generated content**

The Service uses artificial intelligence models to create text, images, video and music from the User's requests and
the materials they upload (logos, photos, videos, documents, links). The User:

- warrants that they hold the rights to the materials they upload and to the people, trademarks and works shown in
  them;
- is responsible for their requests and for the use of the generated content, including publishing it on social
  networks;
- reviews the content before publishing it: AI output may contain errors, inaccuracies or similarities to third-party
  content, and Moonbrand does not guarantee its accuracy or fitness for a particular purpose.

The Service must not be used to create unlawful content; sexual content involving minors or people without their
consent, including deepfakes; hateful, harassing or defamatory content; content that infringes third parties'
copyright, trademarks or privacy, including disclosing other people's personal data; deceptive content, such as fake
reviews or false statements attributed to real people; spam or malware; or attempts to circumvent the models' safety
limits.

Within the limits of the law and of the model providers' terms, content generated for the User belongs to the User,
who may also use it commercially; Blusail Technologies S.r.l.s. processes it only to provide the Service. The Owner
may remove content or suspend the account in case of a breach. Anyone who believes content infringes their rights can
report it to info@moonbrand.app, identifying the content and the right infringed: the content is reviewed and, if the
report is well founded, removed; repeated infringements lead to the account being closed.

### Français

**Vendeur et paiements via Paddle**

Le contrat d'utilisation du Service est conclu avec Blusail Technologies S.r.l.s., titulaire de Moonbrand. Notre
processus de commande est géré par notre revendeur en ligne Paddle.com. Paddle.com est le Merchant of Record pour
toutes nos commandes : il encaisse les paiements, applique les taxes dues, émet les factures et traite les demandes
d'assistance sur les paiements et les remboursements. Les achats sont également soumis aux conditions acheteur de
Paddle (https://www.paddle.com/legal/checkout-buyer-terms). Les prix du site sont indiqués hors TVA ; le montant final,
avec les taxes du pays de l'Utilisateur et dans sa devise, est affiché lors du paiement, avant de payer.

**Formules, crédits et recharges**

Chaque marque a son propre abonnement mensuel, renouvelé automatiquement jusqu'à la résiliation. Chaque formule donne
un nombre de crédits par mois, qui mesurent le travail de l'intelligence artificielle. Les crédits de la formule
valent pour la période en cours et ne passent pas à la suivante. Les crédits achetés avec une recharge n'expirent pas
à la fin de la période et s'utilisent tant que la marque a une formule active ; si la formule est réactivée, ils
redeviennent disponibles. Les crédits n'ont pas de valeur monétaire, ne sont pas convertibles en argent et ne se
transfèrent pas à d'autres marques. En passant à une formule supérieure, l'Utilisateur paie tout de suite la
différence pour le reste de la période ; en passant à une formule inférieure, le nouveau prix s'applique au
renouvellement suivant et d'ici là les crédits de la formule en cours restent.

**Résiliation et remboursements**

L'Utilisateur peut résilier à tout moment depuis les réglages de la marque ou depuis le portail de Paddle :
l'abonnement reste actif jusqu'à la fin de la période déjà payée, sans autre prélèvement. Les remboursements suivent
notre politique de remboursement (https://moonbrand.app/fr/remboursements/) : l'Utilisateur peut demander un
remboursement dans les 14 jours suivant le premier paiement d'un abonnement ou l'achat d'une recharge, le cas échéant
réduit en proportion des crédits déjà utilisés ; les paiements de renouvellement ne sont pas remboursés, sauf si la
loi le prévoit. Avec le remboursement, les crédits de l'achat sont retirés et, pour un abonnement, la formule prend
fin. Les remboursements se demandent depuis le lien de l'e-mail de reçu de Paddle, sur paddle.net ou en écrivant à
info@moonbrand.app.

**Contenus générés par l'intelligence artificielle**

Le Service utilise des modèles d'intelligence artificielle pour créer des textes, des images, des vidéos et de la
musique à partir des demandes de l'Utilisateur et des éléments qu'il importe (logos, photos, vidéos, documents,
liens). L'Utilisateur :

- garantit détenir les droits sur les éléments qu'il importe et sur les personnes, marques et œuvres qui y figurent ;
- est responsable de ses demandes et de l'usage des contenus générés, y compris leur publication sur les réseaux
  sociaux ;
- vérifie les contenus avant de les publier : les résultats de l'IA peuvent contenir des erreurs, des inexactitudes ou
  des ressemblances avec des contenus de tiers, et Moonbrand n'en garantit ni l'exactitude ni l'adéquation à un usage
  particulier.

Il est interdit d'utiliser le Service pour créer des contenus illicites ; des contenus sexuels impliquant des mineurs
ou des personnes sans leur consentement, y compris les deepfakes ; des contenus haineux, harcelants ou diffamatoires ;
des contenus portant atteinte aux droits d'auteur, aux marques ou à la vie privée de tiers, y compris la divulgation
de données personnelles d'autrui ; des contenus trompeurs, comme de faux avis ou de fausses déclarations attribuées à
des personnes réelles ; du spam ou des logiciels malveillants ; ou des tentatives de contourner les limites de
sécurité des modèles.

Dans les limites de la loi et des conditions des fournisseurs des modèles, les contenus générés pour l'Utilisateur
lui appartiennent et il peut les utiliser aussi à des fins commerciales ; Blusail Technologies S.r.l.s. ne les traite
que pour fournir le Service. Le Titulaire peut retirer des contenus ou suspendre le compte en cas de violation. Toute
personne estimant qu'un contenu porte atteinte à ses droits peut le signaler à info@moonbrand.app en indiquant le
contenu et le droit concerné : le contenu est examiné et, si le signalement est fondé, retiré ; en cas de violations
répétées, le compte est fermé.

## 3. Privacy

Su iubenda → Privacy e Cookie Policy → Servizi, in tutte e tre le lingue:

- [ ] Aggiungere **Paddle** (categoria «Gestione dei pagamenti»): dati di pagamento, nome, email, paese, indirizzo di
  fatturazione e partita IVA se data; Paddle.com Market Ltd, Regno Unito (decisione di adeguatezza UE).
- [ ] Controllare che ci siano già i fornitori che trattano i contenuti dei brand (Anthropic, Supabase, Hetzner,
  Zernio, Resend, AWS per i video, ElevenLabs, Atlas) e l'**email di contatto per la privacy**.
- [ ] Rigenerare e controllare che compaiano trasferimenti fuori dall'UE e diritti dell'interessato (iubenda li mette
  da sé per i titolari nell'UE).

## 4. Dopo

- [ ] Deploy del sito, poi controllare che `/termini/`, `/privacy/` e `/rimborsi/` (e le versioni en, fr) si aprano
  senza login e con i testi nuovi.
- [ ] Paddle chiede anche un recapito di assistenza: c'è `info@moonbrand.app` nella pagina Contatti; se nella verifica
  chiedono un telefono, va aggiunto lì.
- [ ] Spuntare i punti del 5 in `PAGAMENTI-PRODUZIONE.md`.
