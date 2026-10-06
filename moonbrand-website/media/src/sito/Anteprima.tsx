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

/** Il marchio: la luna arancione mangiata dal blu, come nel favicon. */
const Marchio: React.FC<{ size: number; radius?: number }> = ({ size, radius = 0.24 }) => (
  <div style={{ position: 'relative', width: size, height: size, borderRadius: size * radius, overflow: 'hidden', background: INK }}>
    <div style={{ position: 'absolute', width: size * 0.56, height: size * 0.56, left: size * 0.22, top: size * 0.22, borderRadius: '50%', background: ACCENT }} />
    <div style={{ position: 'absolute', width: size * 0.5, height: size * 0.5, left: size * 0.13, top: size * 0.15, borderRadius: '50%', background: INK }} />
  </div>
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
        <Marchio size={52} radius={0.26} />
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

/** L'icona quadrata piena (apple-touch-icon, logo per Google): gli angoli li arrotonda chi la mostra. */
export const Icona: React.FC = () => (
  <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', background: INK }}>
    <Marchio size={512} radius={0} />
  </AbsoluteFill>
);
