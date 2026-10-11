# Barberia

**Carattere**: barberia da uomo vintage e ruvida: carta stropicciata sui fondi, titoli enormi in maiuscolo sopra le foto, fasce e ovali. L'impaginazione è del template; colori, font e logo del brand.

**Tipografia**: titoli e numeri grandi in `var(--font-titoli)`, maiuscolo, interlinea 1, 62-72 px su una riga, 110-116 px se protagonista; testi, etichette, firme e listini in `var(--font-testo)` maiuscolo, 24-42 px.

**Griglia**: margini di 34-90 px, foto grandi tagliate nette, anche fuori bordo; titolo a sinistra o centrato in basso, testo in colonna stretta in alto a destra, firma a tre righe in basso a sinistra.

**Origine**: moonbrand-examples/parrucchieri/16/, «Barbershop V.4» di Azruca (https://creativemarket.com/Azruca/5280346-Barbershop-V.4-Instagram-Templates).

**Colori**: accento sui titoli di copertina e servizio, sulla parola dell'offerta, sulle fasce, sull'ovale del consiglio, sulla cornice della bottega, sul fondo dell'annuncio. Secondario sui fondi di copertina, recensione e consiglio, sotto nella bottega, sopra nel barbiere, sulle colonne dell'offerta, sugli asterischi. Principale per i titoli su sfondo e i fili dell'annuncio. Testi bianchi o neri automatici sui fondi colorati.

**Grafica ricorrente**: la carta (div .carta); foto con il fondo a U; fasce diagonali a 30° col nome della bottega; il titolo che scavalca la foto; fondi in due colori o a colonne; «X // X / X» su tre righe; l'ovale a filo doppio con due asterischi; la cornice spessa; l'ovale dietro le foto. Tienili. Il nome della bottega come firma ha la classe `logo`.

**Layout**:
- `copertina`: titolo di 4-6 parole sopra la foto grande, 15-22 parole, firma a tre righe.
- `servizio`: due foto nella U, titolo di 2-3 parole, 20-28 parole, firma con prezzo e durata.
- `offerta`: una parola grande sulla foto, parola ripetuta, offerta in 4-7 parole su due righe.
- `barbiere`: nome diviso nelle due fasce, due etichette, foto a U, titolo di 2-4 parole.
- `recensione`: frase del cliente in 4-8 parole tra virgolette sulla foto a U, 25-40 parole col nome.
- `consiglio`: titolo di 4-7 parole, 45-60 parole, due foto orizzontali.
- `bottega`: una frase spezzata sopra e sotto la foto incorniciata, 2-4 parole per parte.
- `annuncio`: orari e aperture; 3 parole brevi nell'ovale, 25-35 parole, striscia di foto.

**Da non fare**: titoli in minuscolo; colori o font scritti al posto delle variabili; foto con angoli arrotondati, ombre, sfumature; togliere la texture.
