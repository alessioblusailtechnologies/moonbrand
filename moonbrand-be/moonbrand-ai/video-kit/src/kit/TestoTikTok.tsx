import { loadFont } from '@remotion/google-fonts/TikTokSans';
import { Easing, interpolate, useCurrentFrame } from 'remotion';

const tiktokSans = loadFont('normal', { weights: ['700'], subsets: ['latin'] });

type Stile = 'riquadro' | 'contorno';

// Il testo a schermo come lo scrive l'app di TikTok, in TikTok Sans: «riquadro» mette ogni riga su un suo riquadro
// arrotondato (di solito bianco, testo nero), «contorno» è testo bianco con il bordo nero. Una riga per elemento di righe,
// centrate. Entra con un piccolo scatto, come i testi nativi dell'app, dopo `ritardo` fotogrammi.
export const TestoTikTok: React.FC<{
  righe: string[];
  stile?: Stile;
  dimensione?: number;
  sfondo?: string;
  colore?: string;
  ritardo?: number;
  style?: React.CSSProperties;
}> = ({ righe, stile = 'riquadro', dimensione = 56, sfondo = '#FFFFFF', colore, ritardo = 0, style }) => {
  const frame = useCurrentFrame();
  const opzioni = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
  const scala = interpolate(frame, [ritardo, ritardo + 6], [0.85, 1], { ...opzioni, easing: Easing.out(Easing.back(2)) });
  const opacita = interpolate(frame, [ritardo, ritardo + 3], [0, 1], opzioni);
  const bordo = Math.max(2, Math.round(dimensione * 0.07));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', scale: String(scala), opacity: opacita, ...style }}>
      {righe.map((riga, i) => (
        <div
          key={i}
          style={{
            fontFamily: tiktokSans.fontFamily,
            fontWeight: 700,
            fontSize: dimensione,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            ...(stile === 'riquadro'
              ? {
                  color: colore ?? '#000000',
                  background: sfondo,
                  borderRadius: dimensione * 0.22,
                  padding: `${dimensione * 0.1}px ${dimensione * 0.3}px`,
                  marginTop: i === 0 ? 0 : -dimensione * 0.04,
                }
              : {
                  color: colore ?? '#FFFFFF',
                  WebkitTextStroke: `${bordo * 2}px #000000`,
                  paintOrder: 'stroke fill',
                }),
          }}
        >
          {riga}
        </div>
      ))}
    </div>
  );
};
