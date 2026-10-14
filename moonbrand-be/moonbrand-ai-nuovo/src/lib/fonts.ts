import type { BrandFonts } from '@moonbrand/shared/domain/brand';

// I font del brand sono famiglie di Google Fonts (visual.fonts). Il link si prova prima con tutti i pesi, poi con quelli
// comuni, poi senza pesi: Google risponde 400 se si chiede un peso che la famiglia non ha. Una famiglia che non esiste
// non dà link, e nel layout resta il font del template.

const WEIGHTS = ['300;400;500;600;700;800;900', '400;700', ''];
const checked = new Map<string, string | null>();

function cssUrl(family: string, weights: string): string {
  const name = family.trim().replace(/ +/g, '+');
  return `https://fonts.googleapis.com/css2?family=${name}${weights ? `:wght@${weights}` : ''}&display=swap`;
}

async function familyUrl(family: string): Promise<string | null> {
  if (checked.has(family)) return checked.get(family) ?? null;
  let found: string | null = null;
  for (const weights of WEIGHTS) {
    const url = cssUrl(family, weights);
    const ok = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } }).then(
      (response) => response.ok,
      () => false,
    );
    if (ok) {
      found = url;
      break;
    }
  }
  checked.set(family, found);
  return found;
}

export interface FontLinks {
  // I <link> da mettere nelle pagine, uno per famiglia che esiste.
  links: string[];
  // Le famiglie che esistono davvero (null se non c'è), per titoli e testi.
  titles: string | null;
  text: string | null;
}

export async function fontLinks(fonts: BrandFonts | null | undefined): Promise<FontLinks | null> {
  if (!fonts) return null;
  const families = [...new Set([fonts.titles, fonts.text].map((family) => family.trim()).filter(Boolean))];
  const urls = new Map(await Promise.all(families.map(async (family) => [family, await familyUrl(family)] as const)));
  const titles = urls.get(fonts.titles.trim()) ? fonts.titles.trim() : null;
  const text = urls.get(fonts.text.trim()) ? fonts.text.trim() : null;
  if (!titles && !text) return null;
  const links = [...new Set([...urls.values()].filter((url): url is string => Boolean(url)))].map((url) => `<link rel="stylesheet" href="${url}">`);
  return { links, titles, text };
}

// La riga del CLAUDE.md e dei prompt: quali font usa il brand e come si caricano.
export function fontsLine(fonts: BrandFonts | null | undefined): string | null {
  if (!fonts) return null;
  const found = fonts.found ? ` (il sito usa ${fonts.found}: questi sono i più simili di qualità, usa questi)` : '';
  return `I font del brand sono ${fonts.titles} per i titoli e ${fonts.text} per i testi${found}, da Google Fonts. Usali in ogni grafica al posto di altri font; un font diverso solo per un dettaglio decorativo che il template ha già.`;
}
