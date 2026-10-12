import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { AdminBrandPrompts, AdminPromptFileText, AdminPromptPiece, AdminPrompts } from '@moonbrand/shared/api/contract';

import { errorMessage } from '../../core/errors';
import { pageHeader } from '../../core/layout/page-header';
import { Loader } from '../../ui/loader';
import { AdminTabs } from './admin-ui';

const KIND_LABELS: Record<AdminPromptPiece['kind'], string> = {
  system: 'sistema',
  message: 'messaggio',
  brand: 'brand',
  check: 'controllo',
  external: 'fuori dal nostro codice',
};

// Tutti i prompt, in sola lettura: per ogni punto in cui moonbrand chiama Claude o Gemini, cosa gli fa leggere, preso
// dal codice del worker che gira. Poi quello che Claude legge di un brand (CLAUDE.md e memoria), le skill e le guide dei
// template, e le descrizioni degli strumenti.
@Component({
  selector: 'mb-admin-prompts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminTabs, Loader],
  styleUrl: './admin.scss',
  template: `
    <section class="admin">
      <header class="head">
        <h1 class="title grow">Prompt</h1>
        <button class="btn btn-secondary btn-sm" type="button" (click)="load()">Aggiorna</button>
      </header>
      <mb-admin-tabs />

      @if (data(); as d) {
        <p class="caption">Letti adesso dal codice del worker: sono quelli che girano. Le parti tra {{ placeholder }} si riempiono a ogni lavoro.</p>

        @if (d.uncatalogued.length > 0) {
          <div class="panel">
            <h2 class="strong bad">Chiamate non descritte qui ({{ d.uncatalogued.length }})</h2>
            <p class="caption">Questi file del worker chiamano Claude o Gemini, ma la sezione non li conosce: vanno aggiunti al catalogo (modules/admin/prompts.ts dell'API).</p>
            <ul class="plain">
              @for (file of d.uncatalogued; track file) {
                <li class="mono">{{ file }}</li>
              }
            </ul>
          </div>
        }

        <div class="panel">
          <h2 class="strong">Punti di ingresso ({{ d.entries.length }})</h2>
          @for (entry of d.entries; track entry.id) {
            <details class="entry">
              <summary>
                <span class="strong-sm grow">{{ entry.name }}</span>
                <span class="caption">{{ entry.model }}</span>
                <span class="caption nowrap">{{ wordsOf(entry.pieces) }} parole</span>
              </summary>
              <div class="body">
                <p>{{ entry.trigger }}</p>
                @if (entry.note) {
                  <p class="caption">{{ entry.note }}</p>
                }
                <p class="caption">
                  Skill: {{ entry.skills.length ? entry.skills.join(', ') : 'nessuna' }} · Strumenti: {{ entry.tools.length ? entry.tools.join(', ') : 'nessuno' }}
                </p>
                @for (piece of entry.pieces; track $index) {
                  <details class="piece">
                    <summary>
                      <span class="kind" [class]="piece.kind">{{ kinds[piece.kind] }}</span>
                      <span class="grow">{{ piece.label }}</span>
                      <span class="caption mono">{{ piece.source }}</span>
                      <span class="caption nowrap">{{ piece.words }} parole</span>
                    </summary>
                    @if (piece.text === null) {
                      <p class="bad">Non trovato nel codice: il nome è cambiato, va aggiornato il catalogo.</p>
                    } @else {
                      <pre>{{ piece.text }}</pre>
                    }
                  </details>
                }
              </div>
            </details>
          }
        </div>

        <div class="panel">
          <h2 class="strong">Quello che Claude legge di un brand</h2>
          <p class="caption">Il CLAUDE.md scritto per l'ultimo lavoro e la memoria che Claude Code si è scritto da solo.</p>
          <div class="filters">
            <select [value]="brandId()" (change)="pickBrand($any($event.target).value)" aria-label="Brand">
              <option value="">Scegli un brand…</option>
              @for (brand of d.brands; track brand.id) {
                <option [value]="brand.id">{{ brand.name }} · {{ brand.email }}</option>
              }
            </select>
          </div>
          @if (brandLoading()) {
            <mb-loader />
          } @else if (brandFailed()) {
            <p class="bad">{{ brandFailed() }}</p>
          } @else if (brand(); as b) {
            <details class="piece">
              <summary>
                <span class="kind brand">brand</span>
                <span class="grow">CLAUDE.md</span>
                <span class="caption nowrap">{{ words(b.guide) }} parole</span>
              </summary>
              <pre>{{ b.guide ?? 'Il brand non ha ancora un CLAUDE.md: non ha mai lavorato.' }}</pre>
            </details>
            @for (note of b.memory; track note.name) {
              <details class="piece">
                <summary>
                  <span class="kind external">memoria</span>
                  <span class="grow mono">{{ note.name }}</span>
                  <span class="caption nowrap">{{ words(note.text) }} parole</span>
                </summary>
                <pre>{{ note.text }}</pre>
              </details>
            } @empty {
              <p class="caption">Nessuna memoria per questo brand.</p>
            }
          }
        </div>

        <div class="panel">
          <h2 class="strong">Skill e guide ({{ d.files.length }})</h2>
          <p class="caption">Le skill di moonbrand (Claude le carica quando servono) e le guide dei template (entrano nel CLAUDE.md del brand che ha scelto quel template).</p>
          @for (group of groups(); track group.name) {
            <details class="entry">
              <summary>
                <span class="strong-sm grow mono">{{ group.name }}</span>
                <span class="caption nowrap">{{ group.files.length }} file · {{ group.words }} parole</span>
              </summary>
              <div class="body">
                @for (file of group.files; track file.path) {
                  <details class="piece" (toggle)="openFile(file.path, $any($event.target).open)">
                    <summary>
                      <span class="grow mono">{{ file.path }}</span>
                      <span class="caption nowrap">{{ file.words }} parole</span>
                    </summary>
                    @if (texts()[file.path]; as text) {
                      <pre>{{ text }}</pre>
                    } @else {
                      <mb-loader />
                    }
                  </details>
                }
              </div>
            </details>
          }
        </div>

        <div class="panel">
          <h2 class="strong">Strumenti ({{ d.tools.length }})</h2>
          <p class="caption">Le descrizioni che Claude legge per ogni strumento dei nostri server.</p>
          <div class="scroll">
            <table>
              <thead><tr><th>Strumento</th><th>File</th><th>Descrizione</th></tr></thead>
              <tbody>
                @for (tool of d.tools; track tool.file + tool.name) {
                  <tr>
                    <td class="nowrap mono">{{ tool.name }}</td>
                    <td class="nowrap caption mono">{{ tool.file }}</td>
                    <td class="description">{{ tool.description }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @else if (loading()) {
        <div class="empty"><mb-loader /></div>
      } @else {
        <div class="empty">
          <p class="caption">{{ failed() }}</p>
          <button class="btn btn-secondary btn-sm" type="button" (click)="load()">Riprova</button>
        </div>
      }
    </section>
  `,
  styles: `
    .entry {
      border-bottom: 1px solid var(--grey-100);
    }
    .entry:last-of-type {
      border-bottom: 0;
    }
    summary {
      display: flex;
      align-items: baseline;
      gap: 12px;
      padding: 10px 0;
      cursor: pointer;
      flex-wrap: wrap;
    }
    .body {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 0 0 14px 18px;
    }
    .piece summary {
      padding: 6px 0;
      font-size: 13px;
    }
    .kind {
      padding: 1px 8px;
      border-radius: 6px;
      background: var(--surface-sunken);
      font-size: 11px;
      white-space: nowrap;
    }
    .kind.system {
      background: var(--primary-soft);
      color: var(--white);
    }
    .kind.check {
      background: color-mix(in srgb, var(--danger) 15%, transparent);
    }
    pre {
      max-height: 520px;
      margin: 4px 0 10px;
      padding: 12px 14px;
      overflow: auto;
      border-radius: 10px;
      background: var(--surface-sunken);
      font-family: ui-monospace, monospace;
      font-size: 12px;
      line-height: 1.55;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .mono {
      font-family: ui-monospace, monospace;
      font-size: 12px;
    }
    .plain {
      margin: 0;
      padding-left: 18px;
    }
    .description {
      min-width: 320px;
      max-width: 720px;
      color: var(--text-body);
    }
    .filters select {
      max-width: 100%;
    }
  `,
})
export class AdminPromptsPage {
  private readonly http = inject(HttpClient);

  protected readonly data = signal<AdminPrompts | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal('');
  protected readonly brandId = signal('');
  protected readonly brand = signal<AdminBrandPrompts | null>(null);
  protected readonly brandLoading = signal(false);
  protected readonly brandFailed = signal('');
  protected readonly texts = signal<Record<string, string>>({});

  // Le skill una per cartella (plugin/skills/video…), le guide dei template tutte insieme.
  protected readonly groups = computed(() => {
    const groups = new Map<string, { name: string; words: number; files: AdminPrompts['files'] }>();
    for (const file of this.data()?.files ?? []) {
      const segments = file.path.split('/');
      const key = segments[1] === 'skills' && segments.length > 3 ? segments.slice(0, 3).join('/') : segments.slice(0, 2).join('/');
      const group = groups.get(key) ?? { name: key, words: 0, files: [] };
      group.words += file.words;
      group.files.push(file);
      groups.set(key, group);
    }
    return [...groups.values()];
  });

  protected readonly kinds = KIND_LABELS;
  protected readonly placeholder = '${…}';

  constructor() {
    pageHeader(() => [{ label: 'Admin', link: '/admin' }, { label: 'Prompt' }]);
    void this.load();
  }

  protected words(text: string | null): number {
    return text ? text.split(/\s+/).filter(Boolean).length : 0;
  }

  protected wordsOf(pieces: AdminPromptPiece[]): number {
    return pieces.reduce((sum, piece) => sum + piece.words, 0);
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.data.set(await firstValueFrom(this.http.get<AdminPrompts>('/v1/admin/prompts')));
      this.texts.set({});
    } catch (error) {
      this.data.set(null);
      this.failed.set(errorMessage(error, 'I prompt non si sono caricati.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async pickBrand(id: string): Promise<void> {
    this.brandId.set(id);
    this.brand.set(null);
    this.brandFailed.set('');
    if (!id) return;
    this.brandLoading.set(true);
    try {
      const brand = await firstValueFrom(this.http.get<AdminBrandPrompts>(`/v1/admin/prompts/brands/${id}`));
      if (this.brandId() === id) this.brand.set(brand);
    } catch (error) {
      this.brandFailed.set(errorMessage(error, 'Il brand non si è caricato.'));
    } finally {
      this.brandLoading.set(false);
    }
  }

  protected async openFile(path: string, open: boolean): Promise<void> {
    if (!open || this.texts()[path] !== undefined) return;
    try {
      const { text } = await firstValueFrom(this.http.get<AdminPromptFileText>('/v1/admin/prompts/file', { params: { path } }));
      this.texts.update((texts) => ({ ...texts, [path]: text || '(vuoto)' }));
    } catch (error) {
      this.texts.update((texts) => ({ ...texts, [path]: errorMessage(error, 'Il file non si è caricato.') }));
    }
  }
}
