# Albicocca

**Carattere**: il set di un forno-pasticceria giovane e allegro: fondo chiaro pieno, titoli enormi nel colore principale, dolci scontornati che coprono il titolo, ellissi piene come etichette, stelline a quattro punte e frecce curve a mano. Per pasticcerie, bar e forni con promozioni e prezzi.

**Tipografia**: titoli in `var(--font-titoli)`, maiuscolo. Demo: Archivo 800 (copertina, promo, sfornato, 180-240 px) e IBM Plex Mono 700 (gli altri, 100-200 px). Testi in `var(--font-testo)` (demo Arimo) 26-31 px, prezzi in grassetto 44-84 px. Etichette nelle ellissi in IBM Plex Mono corsivo (fisso, 28-38 px).

**Griglia**: margini 36-100 px. Titolo in alto (centrato o a sinistra), dolce al centro, testo e prezzo sotto, filetto orizzontale e piede su due colonne (invito a sinistra, indirizzo a destra).

**Origine**: `moonbrand-examples/bakery/09/`, «Bakery Shop Instagram Feed» (Etsy, https://www.etsy.com/listing/4531411658).

**Colori**: principale per titoli, filetti, stelline, frecce, fasce e fumetto; accento per le macchie e le ellissi piene; secondario per l'ellisse scura, i nomi in corsivo e l'offerta.

**Grafica ricorrente**:
- dolce scontornato (foto su fondo bianco in `multiply`, con la `.sagoma` dietro che ne segue il contorno) che copre una parte del titolo;
- ellisse inclinata piena (accento o secondario) o solo bordo, con 2-3 parole;
- stelline a quattro punte, frecce curve sottili, archi di linea che escono dal bordo, filetti con le stelline agli angoli.

**Layout**:
- `copertina`: 2 parole enormi, dolce inclinato, nome nell'ellisse, 12-16 parole, prezzo, piede.
- `promo`: una parola di 5 lettere ripetuta 6 volte (in `--parola`), dolce sopra, giorno e sconto nelle ellissi.
- `classifica`: titolo di 3 righe, tre schede ad arco con nome, cuori e prezzo, fondo pieno con onda, telefono.
- `ricetta`: titolo di 3 righe, due note con frecce, foto a tutta larghezza, fascia con indirizzo.
- `offerta`: titolo di 2 righe, offerta in corsivo, foto nella cornice tonda, ellisse, frase.
- `colazione`: titolo a sinistra, due prodotti scontornati sulla macchia con i nomi, prezzo, invito, piede.
- `sfornato`: 2 parole, torta grande scontornata, nome, 14-20 parole, riga del prezzo.
- `recensione`: titolo di 2 righe, dolce sulla macchia, fumetto con 5 stelle, 16-22 parole e profilo.

**Da non fare**: foto su fondo colorato al posto degli scontornati; sfumature e ombre; accento per testi lunghi; più di tre ellissi in un post.
