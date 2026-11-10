// Gira nella pagina aperta da leggi_pagina in modo grafica (web.ts): colori di sfondo pesati per la superficie (somma di quelle degli elementi, anche annidati), colori dei
// testi e font pesati per la lunghezza del testo, i font caricati, i candidati logo, il testo.
function probe() {
  const hex = (value) => {
    const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(value);
    if (!match || (match[4] !== undefined && Number(match[4]) < 0.5)) return null;
    return `#${[match[1], match[2], match[3]].map((part) => Number(part).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
  };
  const backgrounds = new Map();
  const texts = new Map();
  const fonts = new Map();
  for (const element of Array.from(document.querySelectorAll('body, body *'))) {
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    const background = hex(style.backgroundColor);
    if (background) backgrounds.set(background, (backgrounds.get(background) || 0) + box.width * box.height);
    const own = Array.from(element.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent || '')
      .join('')
      .trim().length;
    if (own > 0) {
      const color = hex(style.color);
      if (color) texts.set(color, (texts.get(color) || 0) + own);
      const family = style.fontFamily.split(',')[0].replace(/["']/g, '').trim();
      const entry = fonts.get(family) || { weight: 0, weights: new Set() };
      entry.weight += own;
      entry.weights.add(style.fontWeight);
      fonts.set(family, entry);
    }
  }
  const top = (map, role, total) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([value, weight]) => ({ hex: value, role, share: Math.round((weight / total) * 100) }))
      .filter((item) => item.share > 0);
  const textTotal = [...texts.values()].reduce((sum, value) => sum + value, 0) || 1;
  const fontTotal = [...fonts.values()].reduce((sum, value) => sum + value.weight, 0) || 1;
  const loaded = new Set();
  document.fonts.forEach((face) => {
    if (face.status === 'loaded') loaded.add(face.family.replace(/["']/g, ''));
  });
  const absolute = (value) => (value ? new URL(value, location.href).href : null);
  const logos = Array.from(document.querySelectorAll('img'))
    .filter((image) => /logo/i.test(`${image.src} ${image.alt} ${image.className} ${image.id} ${image.parentElement ? image.parentElement.className : ''}`))
    .map((image) => image.currentSrc || image.src)
    .concat(Array.from(document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')).map((link) => link.href))
    .filter((value, index, all) => value && all.indexOf(value) === index)
    .slice(0, 6);
  const meta = (selector) => {
    const found = document.querySelector(selector);
    return found ? found.content : null;
  };
  return {
    title: document.title,
    height: Math.max(document.documentElement.scrollHeight, window.innerHeight),
    colors: [...top(backgrounds, 'sfondo', [...backgrounds.values()].reduce((sum, value) => sum + value, 0) || 1), ...top(texts, 'testo', textTotal)],
    fonts: [...fonts.entries()]
      .sort((a, b) => b[1].weight - a[1].weight)
      .slice(0, 5)
      .map(([family, entry]) => ({ family, weights: [...entry.weights], share: Math.round((entry.weight / fontTotal) * 100) })),
    loaded: [...loaded].slice(0, 10),
    themeColor: meta('meta[name="theme-color"]'),
    logos,
    image: absolute(meta('meta[property="og:image"]')),
    text: document.body.innerText.replace(/\n{3,}/g, '\n\n').trim(),
  };
}
