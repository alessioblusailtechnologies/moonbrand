import { ChangeDetectionStrategy, Component } from '@angular/core';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Logo } from '../../ui/logo';

// I post di esempio del sito, in tre colonne sfalsate: ognuna è ripetuta due volte, così scorre senza stacchi.
const COLUMNS = [
  ['solco-buds', 'osteria-pescato', 'forma-slide'],
  ['aurora-torta', 'solco-colori', 'libreria-libri'],
  ['forma-stacco', 'aurora-laboratorio', 'solco-buds'],
].map((column) => [...column, ...column].map((name) => `showcase/${name}.jpg`));

@Component({
  selector: 'mb-auth-side',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Logo, TranslatePipe],
  template: `
    <mb-logo />
    <div class="claim-block">
      <p class="claim">{{ 'auth.side.claim' | t }}</p>
      <p class="note">{{ 'auth.side.note' | t }}</p>
    </div>
    <div class="wall" aria-hidden="true">
      @for (column of columns; track $index) {
        <div class="column">
          @for (src of column; track $index) {
            <img [src]="src" alt="" loading="lazy" />
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 48px;
      padding: 40px;
      overflow: hidden;
      color: var(--white);
    }
    mb-logo,
    .claim-block {
      position: relative;
      z-index: 1;
    }
    .claim-block {
      max-width: 440px;
      margin-top: 8vh;
    }
    .claim {
      font-size: 36px;
      font-weight: 700;
      line-height: 1.12;
      letter-spacing: -0.02em;
    }
    .note {
      margin-top: 16px;
      color: rgba(255, 255, 255, 0.72);
      font-size: 15px;
    }
    // Il muro di post, inclinato e in basso a destra: sfuma nel blu della cornice verso il testo.
    .wall {
      position: absolute;
      top: 34%;
      right: -12%;
      display: flex;
      gap: 14px;
      width: 78%;
      height: 120%;
      transform: rotate(-8deg);
      mask-image: linear-gradient(to bottom, transparent 0%, #000 22%, #000 70%, transparent 100%),
        linear-gradient(to right, transparent 0%, #000 30%);
      mask-composite: intersect;
    }
    .column {
      display: flex;
      flex: 1;
      flex-direction: column;
      animation: drift 60s linear infinite;
    }
    .column:nth-child(2) {
      margin-top: -90px;
      animation-duration: 75s;
    }
    .column:nth-child(3) {
      margin-top: 60px;
      animation-duration: 66s;
    }
    // Il margine invece del gap: con la colonna ripetuta, metà altezza cade esattamente sull'inizio della copia.
    img {
      display: block;
      width: 100%;
      margin-bottom: 14px;
      border-radius: var(--radius-lg);
      box-shadow: 0 20px 40px -16px rgba(0, 0, 0, 0.6);
    }
    @keyframes drift {
      to {
        transform: translateY(-50%);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .column {
        animation: none;
      }
    }
  `,
})
export class AuthSide {
  protected readonly columns = COLUMNS;
}
