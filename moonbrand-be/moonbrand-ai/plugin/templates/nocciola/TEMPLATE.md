# Nocciola

**Carattere**: il set di un grafico per forni e pasticcerie, caldo e pulito: fondi pieni crema o marrone a tinta unita, un prodotto ritagliato in tondo o in ovale, molta aria attorno. Per chi vuole un feed ordinato, da colazione. Colori e font sono del brand (demo: marrone, nocciola, crema).

**Tipografia**: `var(--font-titoli)` cambia per layout come nell'originale: grottesco condensato nero enorme (copertina, demo Oswald), serif elegante (offerta, stagione, visione, demo Gilda Display), grottesco geometrico bold (storie, consigli, ingredienti, demo Lexend). Testi in `var(--font-testo)` 27-38 px, spesso spaziati. Corsivo calligrafico Pinyon Script per una parola sopra il titolo; serif Gilda per le righe introduttive.

**Griglia**: margini larghi (150-230 px), quasi tutto centrato in asse; foto in tondo o ovale al centro, o griglia 2×2 con 90 px di aria.

**Origine**: moonbrand-examples/bakery/12/, «Bakery Instagram Post Templates» di The Avery Shop (etsy.com/listing/4459334579).

**Grafica ricorrente**:
- fondi a tinta unita: `--sfondo` (crema) o `--secondario` (marrone), mai foto a tutto campo;
- prodotto dall'alto ritagliato in tondo sopra il titolo (copertina) o che esce dal bordo in basso (offerta); ovale verticale (stagione, ingredienti);
- parola ripetuta quattro volte, le due centrali coperte dal prodotto, in `--accento`;
- riquadri a capsula con filo `--principale` 2,5 px (etichetta, bottone, consigli); scheda chiara con filo e angoli arrotondati, nome su capsula `--secondario`, stelle `--principale`;
- frecce tratteggiate curve dalle note alla foto; titolo su arco.

**Layout**:
- copertina: una parola di 4-6 lettere ×4, un prodotto tondo.
- offerta: etichetta, sconto, parola corsiva + parola maiuscola, piatto tondo in basso.
- storie: titolo di 3-4 parole, quattro foto, bottone.
- consigli: titolo di 2 parole, riga serif, 3 consigli di 4-7 parole, profilo.
- ingredienti: 2 righe di titolo, foto ovale, 5 note di 2-4 parole con frecce.
- recensione: 35-50 parole del cliente, cinque stelle, nome.
- stagione: fondo `--secondario`, titolo di 4-6 parole su arco, ovale, 2 note.
- visione: fondo `--secondario`, parola corsiva, titolo su due righe, 55-70 parole, profilo.

**Da non fare**: foto a tutto campo, sfumature, ombre; più di un prodotto ritagliato per post; capsule piene (solo filo, tranne il nome); testi lunghi in `--accento`; colori o font dei titoli scritti fuori dalle variabili.
