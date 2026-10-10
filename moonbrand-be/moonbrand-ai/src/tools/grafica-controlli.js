// I controlli di renderizza: gira dentro la pagina appena fotografata e restituisce i problemi, già scritti per Claude:
// fix sono errori veri, check cose da valutare che possono anche essere scelte.
// È JavaScript semplice, letto come testo e passato a Chrome: niente import e niente tipi. Le soglie sono in proporzione
// alla larghezza, per valere in tutti i formati. vertical: il 9:16, dove l'interfaccia di Reel e TikTok copre alto e basso.
(vertical) => {
  const width = innerWidth;
  const height = innerHeight;
  const fix = [];
  const check = [];
  const small = [];
  const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'emoji', 'math', 'fangsong', 'ui-sans-serif', 'ui-serif']);
  const SYSTEM = new Set(['arial', 'helvetica', 'georgia', 'times new roman', 'times', 'verdana', 'impact', 'courier new', 'tahoma', 'trebuchet ms', 'segoe ui']);
  const minSize = width * 0.022;
  const margin = width * 0.03;
  const quote = (text) => `«${text.length > 40 ? `${text.slice(0, 39)}…` : text}»`;
  const unquote = (family) => family.trim().replace(/^["']|["']$/g, '');

  // I testi visibili, uno per elemento, con il riquadro che occupano davvero (non quello del blocco che li contiene).
  const blocks = [];
  const byElement = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent.replace(/\s+/g, ' ').trim();
    const element = node.parentElement;
    if (!text || !element) continue;
    const style = getComputedStyle(element);
    if (style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    // Il riquadro di una riga comprende salita e discesa del font, più alte delle lettere: con un'interlinea stretta due
    // righe si toccano anche se le lettere no. Di ogni riga si tiene la fascia centrale, alta 0,8 del corpo.
    const size = parseFloat(style.fontSize);
    const lines = [...range.getClientRects()].filter((line) => line.width > 0 && line.height > 0);
    if (lines.length === 0) continue;
    const box = lines
      .map((line) => {
        const inset = Math.max(0, (line.height - size * 0.8) / 2);
        return { left: line.left, right: line.right, top: line.top + inset, bottom: line.bottom - inset };
      })
      .reduce((a, b) => ({ left: Math.min(a.left, b.left), right: Math.max(a.right, b.right), top: Math.min(a.top, b.top), bottom: Math.max(a.bottom, b.bottom) }));
    const known = byElement.get(element);
    if (known) {
      known.text = `${known.text} ${text}`;
      known.rect = {
        left: Math.min(known.rect.left, box.left),
        top: Math.min(known.rect.top, box.top),
        right: Math.max(known.rect.right, box.right),
        bottom: Math.max(known.rect.bottom, box.bottom),
      };
    } else {
      const block = { element, text, rect: { left: box.left, top: box.top, right: box.right, bottom: box.bottom } };
      byElement.set(element, block);
      blocks.push(block);
    }
  }

  const missingFonts = new Set();
  for (const { element, text, rect } of blocks) {
    const style = getComputedStyle(element);
    const name = quote(text);
    // Tagliato da un contenitore che nasconde quello che sborda.
    for (let parent = element; parent && parent !== document.body; parent = parent.parentElement) {
      const parentStyle = getComputedStyle(parent);
      if (parentStyle.overflowX === 'visible' && parentStyle.overflowY === 'visible') continue;
      const box = parent.getBoundingClientRect();
      if (rect.left < box.left - 1 || rect.right > box.right + 1 || rect.top < box.top - 1 || rect.bottom > box.bottom + 1) {
        fix.push(`${name} è tagliato dal suo riquadro`);
        break;
      }
    }
    if (style.textOverflow === 'ellipsis' && element.scrollWidth > element.clientWidth + 1) fix.push(`${name} finisce con i puntini`);
    // Fuori dall'immagine o attaccato al bordo.
    const out = [rect.left < 0 && 'sinistro', rect.right > width && 'destro', rect.top < 0 && 'alto', rect.bottom > height && 'basso'].filter(Boolean);
    if (out.length > 0) fix.push(`${name} esce dal bordo ${out.join(' e ')}`);
    else if (rect.left < margin || rect.right > width - margin || rect.top < margin || rect.bottom > height - margin) {
      check.push(`${name} è a meno di ${Math.round(margin)} px dal bordo`);
    }
    const size = parseFloat(style.fontSize);
    if (size < minSize) small.push(`${name} ${Math.round(size)} px`);
    if (vertical && (rect.top < height * 0.12 || rect.bottom > height * 0.8)) check.push(`${name} sta dove l'interfaccia di Reel e TikTok lo copre (in alto o in basso)`);
    const family = unquote(style.fontFamily.split(',')[0]);
    const lower = family.toLowerCase();
    const loaded = [...document.fonts].some((face) => unquote(face.family) === family && face.status === 'loaded');
    if (!GENERIC.has(lower) && !SYSTEM.has(lower) && !loaded) missingFonts.add(family);
  }
  if (small.length > 0) check.push(`sotto i ${Math.round(minSize)} px, piccoli sul telefono: ${small.join(', ')}`);
  for (const family of missingFonts) fix.push(`il font «${family}» non si è caricato: Chrome ne ha usato un altro`);

  // Testi sovrapposti tra loro, ma non quelli annidati (uno span dentro un titolo).
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i];
      const b = blocks[j];
      if (a.element.contains(b.element) || b.element.contains(a.element)) continue;
      const w = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
      const h = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
      if (w <= 2 || h <= 2) continue;
      const area = (r) => (r.right - r.left) * (r.bottom - r.top);
      if (w * h > Math.min(area(a.rect), area(b.rect)) * 0.15) fix.push(`${quote(a.text)} e ${quote(b.text)} si sovrappongono`);
    }
  }

  for (const image of document.images) {
    if (!image.naturalWidth) fix.push(`l'immagine ${image.getAttribute('src') ?? ''} non si è caricata`);
  }

  // I segni che fanno sembrare l'immagine fatta da un'AI o da un template (plugin/skills/contenuti/mestiere.md), letti dal
  // CSS calcolato: costano niente e arrivano prima dello sguardo di Gemini. Uno per tipo, con il primo esempio.
  const signs = new Map();
  const sign = (kind, where) => {
    if (!signs.has(kind)) signs.set(kind, where);
  };
  const AI_FONTS = new Set(['inter', 'space grotesk', 'fraunces', 'instrument serif', 'geist', 'dm sans', 'manrope', 'plus jakarta sans']);
  const area = width * height;
  const label = (element) => {
    const text = element.textContent.replace(/\s+/g, ' ').trim();
    return text ? quote(text) : `<${element.tagName.toLowerCase()}${element.className ? ` class="${String(element.className).slice(0, 30)}"` : ''}>`;
  };
  const painted = (style) =>
    (style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') || style.backgroundImage !== 'none' || parseFloat(style.borderTopWidth) > 0;
  for (const element of [document.documentElement, document.body, ...document.body.querySelectorAll('*')]) {
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
    const box = element.getBoundingClientRect();
    if (box.width < 2 || box.height < 2) continue;
    const radius = parseFloat(style.borderTopLeftRadius) || 0;
    const hasText = element.textContent.trim().length > 0;
    if (painted(style) && hasText && box.height < width * 0.14 && box.width > box.height * 1.6 && radius >= box.height / 2 - 2) {
      sign('pillole o etichette arrotondate', label(element));
    }
    if (style.backgroundImage.includes('gradient')) {
      if (style.webkitBackgroundClip === 'text' || style.backgroundClip === 'text') sign('testo a sfumatura', label(element));
      else if (box.width * box.height > area * 0.2) sign('sfondo a sfumatura', label(element));
    }
    if (style.backdropFilter && style.backdropFilter !== 'none') sign('vetro smerigliato (backdrop-filter)', label(element));
    if (/blur\(/.test(style.filter) && box.width * box.height > area * 0.03 && !element.querySelector('img') && element.tagName !== 'IMG') {
      sign('macchie di colore sfocate', label(element));
    }
    if (style.boxShadow !== 'none' && radius > 0 && painted(style) && box.width * box.height > area * 0.04) sign('card con angoli arrotondati e ombra', label(element));
  }
  const numbers = blocks.filter(({ text }) => /^0\d\.?$/.test(text));
  if (numbers.length >= 2) sign('numeri d’ordine 01/02/03', numbers.map(({ text }) => text).join(' '));
  for (const { element, text } of blocks) {
    const style = getComputedStyle(element);
    if (/[✦✧✨★☆❖]/.test(text)) sign('stelline o scintille', quote(text));
    if (/[→➜➔]/.test(text)) sign('frecce nel testo', quote(text));
    const size = parseFloat(style.fontSize);
    const spacing = parseFloat(style.letterSpacing) || 0;
    const upper = style.textTransform === 'uppercase' || (text === text.toUpperCase() && /[A-Z]/.test(text));
    if (upper && spacing > size * 0.08 && size < width * 0.035 && text.length < 40) sign('etichetta in maiuscolo spaziato sopra o sotto il titolo', quote(text));
    // Una parola d'accento in corsivo o in un altro colore dentro un titolo dritto.
    const parent = element.parentElement;
    if (parent && parent !== document.body && size > width * 0.05) {
      const parentStyle = getComputedStyle(parent);
      const ownText = [...parent.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if (ownText && parentStyle.fontStyle !== 'italic' && (style.fontStyle === 'italic' || style.color !== parentStyle.color)) {
        sign('una parola del titolo in corsivo o in un colore d’accento', quote(text));
      }
    }
    const family = unquote(style.fontFamily.split(',')[0]).toLowerCase();
    if (AI_FONTS.has(family)) sign(`font tipico dell’AI (${unquote(style.fontFamily.split(',')[0])})`, quote(text));
    if (text.includes('—')) fix.push(`${quote(text)} ha un trattino lungo: riscrivi la frase senza`);
  }
  if (signs.size > 0) {
    check.push(`segni da AI o da template, da togliere se non li chiede il brand: ${[...signs].map(([kind, where]) => `${kind} (${where})`).join('; ')}`);
  }
  return { fix, check };
}
