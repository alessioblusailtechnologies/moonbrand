import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { AdminAccountDetail } from '@moonbrand/shared/api/contract';

import { errorMessage } from '../../core/errors';
import { pageHeader } from '../../core/layout/page-header';
import { LightboxService } from '../../ui/lightbox';
import { Loader } from '../../ui/loader';
import { AdminJobsTable, AdminTabs, money, total, when } from './admin-ui';

// Un'utenza da vicino: i suoi brand con crediti e costi, i contenuti fatti (con le anteprime e i video), le
// conversazioni e gli ultimi 100 lavori.
@Component({
  selector: 'mb-admin-account',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminTabs, AdminJobsTable, Loader],
  template: `
    <section class="admin">
      <mb-admin-tabs />
      @if (loading()) {
        <div class="empty"><mb-loader /></div>
      } @else if (data(); as d) {
        <header class="panel who">
          <div class="grow texts">
            <h1 class="title">{{ d.account.email }}</h1>
            <span class="caption">
              {{ d.account.name }} · creata {{ when(d.account.createdAt) }} · ultimo accesso {{ when(d.account.lastSignInAt) }}
              {{ d.account.emailConfirmed ? '' : ' · email non confermata' }}
            </span>
          </div>
          <div class="stat"><span class="caption">Crediti del mese</span><span class="heading">{{ d.account.creditsMonth }}</span></div>
          <div class="stat" [title]="'Claude ' + money(d.account.cost.claude) + ' · servizi ' + money(d.account.cost.generations)">
            <span class="caption">Costo vero</span><span class="heading">{{ money(total(d.account.cost)) }}</span>
          </div>
        </header>

        <div class="panel">
          <h2 class="strong">Brand</h2>
          @if (d.brands.length === 0) {
            <p class="caption">Nessun brand: non ha finito l'onboarding.</p>
          } @else {
            <table>
              <thead><tr><th>Brand</th><th>Categoria</th><th>Creato</th><th class="num">Crediti mese</th><th class="num">Claude</th><th class="num">Servizi</th></tr></thead>
              <tbody>
                @for (brand of d.brands; track brand.id) {
                  <tr>
                    <td class="strong-sm">{{ brand.name }}</td>
                    <td>{{ brand.category ?? '—' }}</td>
                    <td>{{ when(brand.createdAt) }}</td>
                    <td class="num">{{ brand.creditsMonth }}</td>
                    <td class="num">{{ money(brand.cost.claude) }}</td>
                    <td class="num">{{ money(brand.cost.generations) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>

        <div class="panel">
          <h2 class="strong">Contenuti ({{ d.contents.length }})</h2>
          @if (d.contents.length === 0) {
            <p class="caption">Nessun contenuto.</p>
          } @else {
            <div class="gallery">
              @for (content of d.contents; track content.id) {
                <figure class="item">
                  <div class="media">
                    @if (content.videoUrl) {
                      <video [src]="content.videoUrl" [poster]="content.coverUrl ?? ''" controls preload="none" playsinline></video>
                    } @else if (content.coverUrl) {
                      <button class="zoom" type="button" (click)="open(content.coverUrl, content.title)">
                        <img [src]="content.coverUrl" [alt]="content.title" loading="lazy" />
                      </button>
                    } @else {
                      <span class="caption none">senza immagine</span>
                    }
                  </div>
                  <figcaption>
                    <span class="strong-sm title-line">{{ content.title }}</span>
                    <span class="caption">{{ content.brandName }} · {{ content.format }} · {{ content.status }} · {{ when(content.updatedAt) }}</span>
                  </figcaption>
                </figure>
              }
            </div>
          }
        </div>

        <div class="panel">
          <h2 class="strong">Conversazioni ({{ d.conversations.length }})</h2>
          @if (d.conversations.length === 0) {
            <p class="caption">Nessuna conversazione.</p>
          } @else {
            <table>
              <thead><tr><th>Titolo</th><th>Brand</th><th>Iniziata</th><th>Ultimo messaggio</th><th class="num">Messaggi</th></tr></thead>
              <tbody>
                @for (conversation of d.conversations; track conversation.id) {
                  <tr>
                    <td>{{ conversation.title }}</td>
                    <td>{{ conversation.brandName ?? '—' }}</td>
                    <td class="nowrap">{{ when(conversation.createdAt) }}</td>
                    <td class="nowrap">{{ when(conversation.lastTurnAt) }}</td>
                    <td class="num">{{ conversation.turns }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>

        <div class="panel">
          <h2 class="strong">Lavori ({{ d.jobs.length }})</h2>
          <mb-admin-jobs-table [jobs]="d.jobs" [showAccount]="false" />
        </div>
      } @else {
        <div class="empty">
          <p class="caption">{{ failed() }}</p>
          <button class="btn btn-secondary btn-sm" type="button" (click)="reload()">Riprova</button>
        </div>
      }
    </section>
  `,
  styles: `
    .admin {
      display: flex;
      flex-direction: column;
      gap: 18px;
      animation: fade-up 240ms var(--ease);
    }
    .who {
      flex-direction: row;
      align-items: center;
      gap: 24px;
      flex-wrap: wrap;
    }
    .texts,
    .stat {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .title {
      overflow-wrap: anywhere;
    }
    .stat .heading {
      font-variant-numeric: tabular-nums;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th,
    td {
      padding: 8px 10px;
      border-bottom: 1px solid var(--grey-100);
      text-align: left;
    }
    th {
      color: var(--text-body);
      font-weight: 500;
      white-space: nowrap;
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .nowrap {
      white-space: nowrap;
    }
    .gallery {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 14px;
    }
    .item {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
      margin: 0;
    }
    .media {
      display: flex;
      align-items: center;
      justify-content: center;
      aspect-ratio: 4 / 5;
      overflow: hidden;
      border-radius: var(--radius-md);
      background: var(--surface-sunken);
    }
    .media img,
    .media video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .media video {
      background: #000;
      object-fit: contain;
    }
    .zoom {
      width: 100%;
      height: 100%;
      padding: 0;
      border: 0;
      background: none;
      cursor: zoom-in;
    }
    figcaption {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .title-line {
      display: -webkit-box;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 40px 16px;
    }
    @media (max-width: 640px) {
      .gallery {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `,
})
export class AdminAccountPage {
  private readonly http = inject(HttpClient);
  private readonly lightbox = inject(LightboxService);

  readonly accountId = input.required<string>();

  protected readonly data = signal<AdminAccountDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal('');

  protected readonly money = money;
  protected readonly total = total;
  protected readonly when = when;

  constructor() {
    pageHeader(() => [
      { label: 'Admin', link: '/admin' },
      { label: 'Utenze', link: '/admin/utenze' },
      { label: this.data()?.account.email ?? '…' },
    ]);
    effect(() => {
      const id = this.accountId();
      untracked(() => void this.load(id));
    });
  }

  protected reload(): void {
    void this.load(this.accountId());
  }

  protected open(url: string, title: string): void {
    this.lightbox.open([{ url, alt: title, caption: title }]);
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    try {
      this.data.set(await firstValueFrom(this.http.get<AdminAccountDetail>(`/v1/admin/accounts/${id}`)));
    } catch (error) {
      this.data.set(null);
      this.failed.set(errorMessage(error, 'L’utenza non si è caricata.'));
    } finally {
      this.loading.set(false);
    }
  }
}
