// L'immagine di anteprima del sito (og:image), quella che si vede quando il link viene condiviso, e le icone.
// Stessi colori e caratteri del sito; a destra tre post di esempio della home.
import { loadFont } from '@remotion/fonts';
import { AbsoluteFill, staticFile } from 'remotion';

import { LibreriaSlide, FormaSlide, SolcoPost } from './Post';
import { TESTI, type Lingua } from './testi';

const INK = '#0B1324';
const ACCENT = '#F29A2E';

// Archivo variabile: largo, stretto e pesante come i titoli del sito (font-stretch 68%).
for (const file of ['archivo-latin', 'archivo-latin-ext']) {
  loadFont({ family: 'Archivo', url: staticFile(`fonts/${file}.woff2`), weight: '700 900', stretch: '62% 125%' });
}
for (const file of ['geist-latin', 'geist-latin-ext']) {
  loadFont({ family: 'Geist', url: staticFile(`fonts/${file}.woff2`), weight: '100 900' });
}

/**
 * Il marchio, Transito: l'anello e la falce arancio che lo abbraccia, staccata da un filo vuoto. Come in Logo.astro del sito.
 * `anello` e `falce` cambiano i colori (l'icona monocromatica di Android li vuole bianchi tutti e due).
 */
const Marchio: React.FC<{ size: number; anello?: string; falce?: string }> = ({ size, anello = '#fff', falce = ACCENT }) => (
  <svg width={size} height={size} viewBox="10 10 80 80">
    <circle cx={38.5} cy={50} r={24} fill="none" stroke={anello} strokeWidth={6} />
    <path d="M54.46 75.4A26.5 26.5 0 1 0 54.46 24.6A30 30 0 0 1 54.46 75.4Z" fill={falce} />
  </svg>
);

/** Un post di esempio rimpicciolito, con la sua misura vera. */
const Carta: React.FC<{ w: number; h: number; scala: number; style: React.CSSProperties; children: React.ReactNode }> = ({ w, h, scala, style, children }) => (
  <div style={{ position: 'absolute', width: w * scala, height: h * scala, borderRadius: 18, overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.45)', ...style }}>
    <div style={{ position: 'relative', width: w, height: h, transform: `scale(${scala})`, transformOrigin: 'top left' }}>{children}</div>
  </div>
);

export const Anteprima: React.FC<{ lingua?: Lingua }> = ({ lingua = 'it' }) => {
  const t = TESTI[lingua];
  // I titoli lunghi (il francese) scendono un po' per stare in tre righe senza toccare il resto.
  const lungo = t.anteprima.join(' ').length > 45;
  return (
    <AbsoluteFill style={{ background: INK, color: '#fff', fontFamily: 'Geist', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 72, top: 64, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Marchio size={56} />
        <span style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.02em' }}>Moonbrand</span>
      </div>
      <div style={{ position: 'absolute', left: 72, top: lungo ? 170 : 190, width: 620, display: 'flex', flexDirection: 'column', gap: 28 }}>
        <h1 style={{ margin: 0, fontFamily: 'Archivo', fontStretch: '68%', fontWeight: 800, fontSize: lungo ? 74 : 84, lineHeight: 0.95, letterSpacing: '-0.02em' }}>
          {t.anteprima[0]} <span style={{ color: ACCENT }}>{t.anteprima[1]}</span>
        </h1>
        <p style={{ margin: 0, fontSize: 26, lineHeight: 1.4, color: '#A9B3C6' }}>{t.anteprimaSub}</p>
      </div>
      <div style={{ position: 'absolute', left: 72, bottom: 56, fontSize: 22, color: '#7E8AA3', letterSpacing: '0.02em' }}>moonbrand.app</div>
      <Carta w={1080} h={1080} scala={0.22} style={{ left: 742, top: 352, transform: 'rotate(-7deg)' }}>
        <FormaSlide lingua={lingua} />
      </Carta>
      <Carta w={1080} h={1350} scala={0.24} style={{ left: 928, top: 262, transform: 'rotate(6deg)' }}>
        <LibreriaSlide lingua={lingua} />
      </Carta>
      <Carta w={1080} h={1350} scala={0.27} style={{ left: 806, top: 44, transform: 'rotate(-2deg)' }}>
        <SolcoPost lingua={lingua} />
      </Carta>
    </AbsoluteFill>
  );
};

/** L'icona quadrata piena (apple-touch-icon, logo per Google, icona dell'app): gli angoli li arrotonda chi la mostra. */
export const Icona: React.FC = () => (
  <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', background: INK }}>
    <Marchio size={320} />
  </AbsoluteFill>
);

/**
 * Il marchio su fondo trasparente, per l'app: il primo piano dell'icona adattiva di Android (il fondo blu lo mette app.json),
 * la sua versione monocromatica e l'immagine dello splash. Il primo piano sta nel cerchio sicuro, il 61% centrale.
 */
export const MarchioApp: React.FC<{ size: number; mono?: boolean }> = ({ size, mono = false }) => (
  <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
    <Marchio size={size} falce={mono ? '#fff' : ACCENT} />
  </AbsoluteFill>
);

/** Il favicon in PNG, per favicon.ico: gli spessori delle misure piccole, come in public/favicon.svg, su fondo trasparente. */
export const Favicon: React.FC = () => (
  <svg width="100%" height="100%" viewBox="10 10 80 80">
    <circle cx={38.5} cy={50} r={23.5} fill="none" stroke={INK} strokeWidth={8} />
    <path d="M56.44 75.28A26 26 0 1 0 56.44 24.72A31 31 0 0 1 56.44 75.28Z" fill={ACCENT} />
  </svg>
);

/**
 * Le copertine dei profili social. Facebook (820×312, esportata al doppio): su telefono si vede solo il centro, quindi
 * marchio e titolo stanno in mezzo e i post di esempio ai lati, dove il taglio non fa danni.
 */
export const CopertinaFacebook: React.FC<{ lingua?: Lingua }> = ({ lingua = 'it' }) => {
  const t = TESTI[lingua];
  return (
    <AbsoluteFill style={{ background: INK, color: '#fff', fontFamily: 'Geist', overflow: 'hidden' }}>
      <Carta w={1080} h={1350} scala={0.17} style={{ left: 34, top: 40, transform: 'rotate(-6deg)' }}>
        <SolcoPost lingua={lingua} />
      </Carta>
      <Carta w={1080} h={1080} scala={0.15} style={{ left: 618, top: 30, transform: 'rotate(5deg)' }}>
        <FormaSlide lingua={lingua} />
      </Carta>
      <Carta w={1080} h={1350} scala={0.13} style={{ left: 668, top: 168, transform: 'rotate(-4deg)' }}>
        <LibreriaSlide lingua={lingua} />
      </Carta>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 16, paddingBottom: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Marchio size={34} />
          <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>Moonbrand</span>
        </div>
        <h1 style={{ margin: 0, textAlign: 'center', fontFamily: 'Archivo', fontStretch: '68%', fontWeight: 800, fontSize: 46, lineHeight: 0.95, letterSpacing: '-0.02em' }}>
          {t.anteprima[0]}
          <br />
          <span style={{ color: ACCENT }}>{t.anteprima[1]}</span>
        </h1>
        <div style={{ fontSize: 13, color: '#7E8AA3', letterSpacing: '0.02em' }}>moonbrand.app</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** La copertina della pagina LinkedIn (6:1, esportata a 4200×700 come chiede LinkedIn): a sinistra c'è il logo della pagina, il testo sta a destra. */
export const CopertinaLinkedin: React.FC<{ lingua?: Lingua }> = ({ lingua = 'it' }) => {
  const t = TESTI[lingua];
  return (
    <AbsoluteFill style={{ background: INK, color: '#fff', fontFamily: 'Geist', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 320, top: 0, bottom: 0, width: 600, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
        <h1 style={{ margin: 0, fontFamily: 'Archivo', fontStretch: '68%', fontWeight: 800, fontSize: 34, lineHeight: 0.95, letterSpacing: '-0.02em' }}>
          {t.anteprima[0]}
          <br />
          <span style={{ color: ACCENT }}>{t.anteprima[1]}</span>
        </h1>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.4, color: '#A9B3C6' }}>
          {t.anteprimaSub} <span style={{ color: '#7E8AA3' }}>moonbrand.app</span>
        </p>
      </div>
      <Carta w={1080} h={1080} scala={0.12} style={{ left: 960, top: 42, transform: 'rotate(-6deg)' }}>
        <FormaSlide lingua={lingua} />
      </Carta>
      <Carta w={1080} h={1350} scala={0.11} style={{ left: 1060, top: 26, transform: 'rotate(4deg)' }}>
        <SolcoPost lingua={lingua} />
      </Carta>
    </AbsoluteFill>
  );
};

/** La copertina del profilo personale LinkedIn (1584×396): la foto profilo copre il basso a sinistra, il testo sta a destra. */
export const CopertinaLinkedinProfilo: React.FC<{ lingua?: Lingua }> = ({ lingua = 'it' }) => {
  const t = TESTI[lingua];
  return (
    <AbsoluteFill style={{ background: INK, color: '#fff', fontFamily: 'Geist', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 520, top: 0, bottom: 0, width: 660, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Marchio size={40} />
          <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>Moonbrand</span>
        </div>
        <h1 style={{ margin: 0, fontFamily: 'Archivo', fontStretch: '68%', fontWeight: 800, fontSize: 64, lineHeight: 0.95, letterSpacing: '-0.02em' }}>
          {t.anteprima[0]}
          <br />
          <span style={{ color: ACCENT }}>{t.anteprima[1]}</span>
        </h1>
        <p style={{ margin: 0, fontSize: 20, lineHeight: 1.4, color: '#A9B3C6' }}>
          {t.anteprimaSub} <span style={{ color: '#7E8AA3' }}>moonbrand.app</span>
        </p>
      </div>
      <Carta w={1080} h={1080} scala={0.24} style={{ left: 1230, top: 92, transform: 'rotate(-6deg)' }}>
        <FormaSlide lingua={lingua} />
      </Carta>
      <Carta w={1080} h={1350} scala={0.22} style={{ left: 1370, top: 40, transform: 'rotate(4deg)' }}>
        <SolcoPost lingua={lingua} />
      </Carta>
    </AbsoluteFill>
  );
};
