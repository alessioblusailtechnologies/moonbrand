import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import type { AdminContent, AdminContentsResponse } from '@moonbrand/shared/api/contract';

import { errorMessage } from '../../core/errors';
import { pageHeader } from '../../core/layout/page-header';
import { LightboxService } from '../../ui/lightbox';
import { Loader } from '../../ui/loader';
import { AdminCostDetail, AdminTabs, money, total, when, type CostDetail } from './admin-ui';

// Tutti i contenuti fatti da tutti, dal più recente: anteprima o video, brand, utenza, stato e costo. Filtri per brand,
// formato, stato e titolo; 48 alla volta.
@Component({
  selector: 'mb-admin-contents',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminCostDetail, AdminTabs, Loader, RouterLink],
  styleUrl: './admin.scss',
  template: `
    <section class="admin">
      <header class="head">
        <h1 class="title grow">Contenuti</h1>
      </header>
      <mb-admin-tabs />

      <div class="filters">
        <select aria-label="Brand" [value]="brandId()" (change)="brandId.set($any($event.target).value)">
          <option value="">Tutti i brand</option>
          @for (brand of brands(); track brand.id) {
            <option [value]="brand.id">{{ brand.name }} · {{ brand.email }}</option>
          }
        </select>
        <select aria-label="Formato" [value]="format()" (change)="format.set($any($event.target).value)">
          <option value="">Tutti i formati</option>
          <option value="post">Post</option>
          <option value="carousel">Carosello</option>
          <option value="video">Video</option>
          <option value="article">Articolo</option>
        </select>
        <select aria-label="Stato" [value]="status()" (change)="status.set($any($event.target).value)">
          <option value="">Tutti gli stati</option>
          <option value="draft">Bozza</option>
          <option value="approved">Approvato</option>
        </select>
        <input type="search" placeholder="Cerca nel titolo" aria-label="Cerca nel titolo" [value]="query()"
          (change)="query.set($any($event.target).value)" />
        @if (total() !== null) {
          <span class="caption">{{ total() }} contenuti</span>
        }
      </div>

      @if (loading() && items().length === 0) {
        <div class="empty"><mb-loader /></div>
      } @else if (failed()) {
        <div class="empty">
          <p class="caption">{{ failed() }}</p>
          <button class="btn btn-secondary btn-sm" type="button" (click)="load(true)">Riprova</button>
        </div>
      } @else if (items().length === 0) {
        <div class="empty"><p class="caption">Nessun contenuto.</p></div>
      } @else {
        <div class="gallery">
          @for (content of items(); track content.id) {
            <figure class="item">
              <div class="media">
                @if (content.videoUrl) {
                  <video [src]="content.videoUrl" [poster]="content.coverUrl ?? ''" controls preload="none" playsinline></video>
                } @else if (content.coverUrl) {
                  <button class="zoom" type="button" (click)="open(content)">
                    <img [src]="content.coverUrl" [alt]="content.title" loading="lazy" />
                  </button>
                } @else {
                  <span class="caption">senza immagine</span>
                }
              </div>
              <figcaption>
                <span class="strong-sm title-line">{{ content.title }}</span>
                <span class="caption">{{ content.brandName }} · {{ content.format }} · {{ content.status }}</span>
                <span class="caption">
                  <a class="link" [routerLink]="['/admin/utenze', content.accountId]">{{ content.email }}</a>
                </span>
                <span class="caption">
                  {{ when(content.createdAt) }} ·
                  <button class="cost-link" type="button" title="Dettaglio per voce" (click)="showCost(content)">{{ money(costOf(content.cost)) }}</button>
                </span>
              </figcaption>
            </figure>
          }
        </div>
        @if (items().length < (total() ?? 0)) {
          <button class="btn btn-secondary btn-sm more" type="button" [disabled]="loading()" (click)="load(false)">
            {{ loading() ? 'Carico…' : 'Carica altri' }}
          </button>
        }
      }
      <mb-admin-cost-detail [detail]="detail()" (closed)="detail.set(null)" />
    </section>
  `,
  styles: `
    .more {
      align-self: center;
    }
  `,
})
export class AdminContentsPage {
  private readonly http = inject(HttpClient);
  private readonly lightbox = inject(LightboxService);

  protected readonly brandId = signal('');
  protected readonly format = signal('');
  protected readonly status = signal('');
  protected readonly query = signal('');

  protected readonly items = signal<AdminContent[]>([]);
  protected readonly total = signal<number | null>(null);
  protected readonly brands = signal<AdminContentsResponse['brands']>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal('');

  protected readonly money = money;
  protected readonly costOf = total;
  protected readonly detail = signal<CostDetail | null>(null);
  protected readonly when = when;

  constructor() {
    pageHeader(() => [{ label: 'Admin', link: '/admin' }, { label: 'Contenuti' }]);
    // Cambiando un filtro si riparte dalla prima pagina.
    effect(() => {
      this.brandId();
      this.format();
      this.status();
      this.query();
      untracked(() => void this.load(true));
    });
  }

  protected showCost(content: AdminContent): void {
    this.detail.set({
      title: content.title,
      subtitle: `${content.brandName ?? 'Brand'} · ${content.format} · con la conversazione da cui è nato`,
      total: total(content.cost),
      parts: content.parts,
    });
  }

  protected open(content: AdminContent): void {
    if (content.coverUrl) this.lightbox.open([{ url: content.coverUrl, alt: content.title, caption: content.title }]);
  }

  protected async load(reset: boolean): Promise<void> {
    this.loading.set(true);
    this.failed.set('');
    const params: Record<string, string> = { offset: String(reset ? 0 : this.items().length) };
    if (this.brandId()) params['brandId'] = this.brandId();
    if (this.format()) params['format'] = this.format();
    if (this.status()) params['status'] = this.status();
    if (this.query().trim()) params['q'] = this.query().trim();
    try {
      const page = await firstValueFrom(this.http.get<AdminContentsResponse>('/v1/admin/contents', { params }));
      this.items.set(reset ? page.items : [...this.items(), ...page.items]);
      this.total.set(page.total);
      this.brands.set(page.brands);
    } catch (error) {
      this.failed.set(errorMessage(error, 'I contenuti non si sono caricati.'));
    } finally {
      this.loading.set(false);
    }
  }
}
