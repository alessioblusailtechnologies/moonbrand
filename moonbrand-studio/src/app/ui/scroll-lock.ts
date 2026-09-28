import { DOCUMENT, effect, inject } from '@angular/core';

// Le finestre aperte in questo momento e il punto della pagina da ritrovare quando si chiude l'ultima.
let open = 0;
let savedY = 0;

// Da chiamare nel costruttore di una finestra modale: finché è aperta, la pagina sotto non scorre.
// Senza argomento vale finché il componente esiste; con when, finché when() è vero.
// overflow: hidden sulla pagina non ferma la rotella in tutti i casi: il body si fissa dov'era, poi si torna lì.
export function lockPageScroll(when: () => boolean = () => true): void {
  const document = inject(DOCUMENT);
  const body = document.body;
  effect((onCleanup) => {
    if (!when()) return;
    if (open++ === 0) {
      savedY = document.defaultView?.scrollY ?? 0;
      Object.assign(body.style, { position: 'fixed', top: `-${savedY}px`, left: '0', right: '0' });
    }
    onCleanup(() => {
      if (--open > 0) return;
      Object.assign(body.style, { position: '', top: '', left: '', right: '' });
      document.defaultView?.scrollTo(0, savedY);
    });
  });
}
