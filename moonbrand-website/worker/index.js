// Davanti alle pagine statiche: gli indirizzi senza / finale vanno a quello con la / con un 301 (Cloudflare da solo
// fa un 307, che per Google è temporaneo), e ogni risposta prende la cache e le intestazioni di sicurezza.
const YEAR = 'public, max-age=31536000, immutable';
const DAY = 'public, max-age=86400';

function cacheFor(pathname) {
  // In /_astro i file hanno l'impronta nel nome: se cambiano, cambia l'indirizzo. I font non cambiano mai.
  if (pathname.startsWith('/_astro/') || pathname.startsWith('/fonts/')) return YEAR;
  if (pathname.startsWith('/og/') || /^\/(favicon|apple-touch-icon|icon-)/.test(pathname)) return DAY;
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const last = url.pathname.split('/').pop();
    if (last && !last.includes('.')) {
      url.pathname += '/';
      return Response.redirect(url.href, 301);
    }

    const asset = await env.ASSETS.fetch(request);
    const response = new Response(asset.body, asset);
    const cache = asset.ok && cacheFor(url.pathname);
    if (cache) response.headers.set('Cache-Control', cache);
    response.headers.set('Strict-Transport-Security', 'max-age=31536000');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    return response;
  },
};
