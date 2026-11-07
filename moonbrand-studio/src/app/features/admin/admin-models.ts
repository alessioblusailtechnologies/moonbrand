import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { AdminModelSettings } from '@moonbrand/shared/api/contract';
import { DEFAULT_MODEL_SETTINGS, MODEL_TOOLS, THINKING_LEVELS, THINKING_TOOLS, type CatalogModel, type ModelSettings, type ModelTool, type ThinkingLevel } from '@moonbrand/shared/domain/models';

import { errorMessage } from '../../core/errors';
import { pageHeader } from '../../core/layout/page-header';
import { Loader } from '../../ui/loader';
import { Select, type SelectOption } from '../../ui/select';
import { ToastService } from '../../ui/toast';
import { AdminTabs, when } from './admin-ui';

// Quale modello e quanto ragionamento usano la chat e ogni strumento del motore. Si salvano nel DB e il worker li legge a
// ogni lavoro: valgono dal turno di chat dopo, senza riavviare niente. Le tendine vengono dal catalogo che il worker scrive
// dalle fonti a runtime (Pi, Google, Atlas, ElevenLabs) e rinfresca ogni ora; finché per una riga non c'è catalogo, il nome
// si scrive a mano.

type Row = 'chat' | ModelTool;

const TOOLS: Record<ModelTool, { label: string; hint: string }> = {
  testi: { label: 'Testi', hint: 'scrivi_copy, i brief, scrivi_parlato e scrivi_testo_canzone · un modello di Gemini' },
  immagini: { label: 'Immagini', hint: 'genera_immagine · un modello di Gemini o di Atlas' },
  vista: { label: 'Vista', hint: 'guarda_file, i controlli di renderizza e controlla_video · un modello di Gemini' },
  ricerca: { label: 'Ricerca web', hint: 'cerca_web con la ricerca Google · un modello di Gemini' },
  voce: { label: 'Voce fuori campo', hint: 'genera_voce · un modello di ElevenLabs' },
  musica: { label: 'Musica e canzoni', hint: 'genera_musica e genera_canzone · un modello Suno su Atlas' },
};

const LEVELS: SelectOption[] = THINKING_LEVELS.map((level) => ({ value: level, label: level }));

@Component({
  selector: 'mb-admin-models',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminTabs, Loader, Select],
  styleUrl: './admin.scss',
  template: `
    <section class="admin">
      <header class="head">
        <h1 class="title grow">Modelli</h1>
        <button class="btn btn-secondary btn-sm" type="button" (click)="load()" [disabled]="saving()">Aggiorna</button>
      </header>
      <mb-admin-tabs />

      @if (form(); as f) {
        <form class="panel" (submit)="save($event)">
          <p class="caption">
            Valgono dal turno di chat dopo il salvataggio, senza riavvii. Le tendine mostrano i modelli che il motore trova dai fornitori con una chiave
            configurata; il ragionamento vale per la chat e per gli strumenti su Gemini, «predefinito» lascia decidere al modello, e si spegne se il modello
            scelto non ragiona. {{ catalogStamp() }}
          </p>
          <div class="scroll">
            <table class="models">
              <thead>
                <tr><th>Cosa</th><th>Modello</th><th>Ragionamento</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>Chat</strong>
                    <div class="caption">Pi: fornitore/modello, es. anthropic/claude-opus-5-5</div>
                  </td>
                  <td>
                    @if (options().chat; as opts) {
                      <mb-select [options]="opts" [value]="f.chat.model" (changed)="setChat('model', $event)" />
                    } @else {
                      <input type="text" required [value]="f.chat.model" (input)="setChat('model', $any($event.target).value)" />
                    }
                  </td>
                  <td><mb-select [options]="levels" [value]="f.chat.thinking" [disabled]="!reasons('chat')" (changed)="setChat('thinking', $event)" /></td>
                </tr>
                @for (tool of tools; track tool) {
                  <tr>
                    <td>
                      <strong>{{ labels[tool].label }}</strong>
                      <div class="caption">{{ labels[tool].hint }}</div>
                    </td>
                    <td>
                      @if (options()[tool]; as opts) {
                        <mb-select [options]="opts" [value]="f.tools[tool].model" (changed)="setTool(tool, 'model', $event)" />
                      } @else {
                        <input type="text" required [value]="f.tools[tool].model" (input)="setTool(tool, 'model', $any($event.target).value)" />
                      }
                    </td>
                    <td>
                      @if (thinks(tool)) {
                        <mb-select [options]="toolLevels" [value]="f.tools[tool].thinking ?? ''" [disabled]="!reasons(tool)" (changed)="setTool(tool, 'thinking', $event)" />
                      } @else {
                        <span class="caption">—</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="actions">
            <button class="btn btn-primary btn-sm" type="submit" [disabled]="saving()">{{ saving() ? 'Salvo…' : 'Salva' }}</button>
            <button class="btn btn-secondary btn-sm" type="button" (click)="reset()" [disabled]="saving()">Predefiniti del motore</button>
            <span class="caption">{{ stamp() }}</span>
          </div>
        </form>
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
    .models td {
      vertical-align: top;
    }
    .models input,
    .models td > mb-select {
      width: 100%;
      min-width: 320px;
      box-sizing: border-box;
    }
    .models mb-select {
      min-width: 150px;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin-top: 14px;
    }
  `,
})
export class AdminModelsPage {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);

  protected readonly data = signal<AdminModelSettings | null>(null);
  protected readonly form = signal<ModelSettings | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly failed = signal('');

  protected readonly tools = MODEL_TOOLS;
  protected readonly labels = TOOLS;
  protected readonly levels = LEVELS;
  protected readonly toolLevels: SelectOption[] = [{ value: '', label: 'predefinito' }, ...LEVELS];

  // Le opzioni di ogni riga dal catalogo, a gruppi per fonte; null se per quella riga il catalogo non c'è (si scrive a mano).
  // Il modello salvato che nel catalogo non c'è più resta scelto, segnato.
  protected readonly options = computed<Record<Row, SelectOption[] | null>>(() => {
    const form = this.form();
    const build = (row: Row): SelectOption[] | null => {
      const models = this.catalog(row);
      if (models.length === 0) return null;
      const current = row === 'chat' ? form?.chat.model : form?.tools[row].model;
      const list = models.map((model) => ({ value: model.id, label: model.label && model.label !== model.id ? `${model.id} · ${model.label}` : model.id, group: model.source }));
      if (current && !models.some((model) => model.id === current)) list.unshift({ value: current, label: `${current} (non nel catalogo)`, group: 'Salvato' });
      return list;
    };
    return Object.fromEntries((['chat', ...MODEL_TOOLS] as Row[]).map((row) => [row, build(row)])) as Record<Row, SelectOption[] | null>;
  });

  constructor() {
    pageHeader(() => [{ label: 'Admin', link: '/admin' }, { label: 'Modelli' }]);
    void this.load();
  }

  protected thinks(tool: ModelTool): boolean {
    return THINKING_TOOLS.includes(tool);
  }

  // Se il modello scelto ragiona: no solo quando il catalogo dice di no.
  protected reasons(row: Row): boolean {
    const form = this.form();
    const current = row === 'chat' ? form?.chat.model : form?.tools[row].model;
    return this.catalog(row).find((model) => model.id === current)?.thinking !== false;
  }

  protected stamp(): string {
    const current = this.data();
    if (!current?.updatedAt) return 'Valgono i predefiniti del motore.';
    return `Salvati ${when(current.updatedAt)}${current.updatedBy ? ` da ${current.updatedBy}` : ''}.`;
  }

  protected catalogStamp(): string {
    const current = this.data();
    if (!current?.catalog) return 'Il motore non ha ancora scritto il catalogo dei modelli: i nomi si scrivono a mano.';
    return `Catalogo del motore aggiornato ${when(current.catalogAt)}.`;
  }

  protected setChat(key: 'model' | 'thinking', value: string): void {
    this.form.update((f) => (f ? { ...f, chat: { ...f.chat, [key]: value } } : f));
  }

  protected setTool(tool: ModelTool, key: 'model' | 'thinking', value: string): void {
    this.form.update((f) => {
      if (!f) return f;
      const { thinking: _thinking, ...rest } = f.tools[tool];
      let choice: ModelSettings['tools'][ModelTool];
      if (key === 'model') {
        // Un modello che non ragiona perde il livello.
        const reasons = this.catalog(tool).find((model) => model.id === value)?.thinking !== false;
        choice = reasons ? { ...f.tools[tool], model: value } : { ...rest, model: value };
      } else {
        choice = { ...rest, ...(value && { thinking: value as ThinkingLevel }) };
      }
      return { ...f, tools: { ...f.tools, [tool]: choice } };
    });
  }

  protected reset(): void {
    this.form.set(structuredClone(DEFAULT_MODEL_SETTINGS));
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    const settings = this.form();
    if (!settings) return;
    this.saving.set(true);
    try {
      const saved = await firstValueFrom(this.http.put<AdminModelSettings>('/v1/admin/models', settings));
      this.data.set(saved);
      this.form.set(saved.settings);
      this.toast.show('Modelli salvati: valgono dal prossimo turno di chat.');
    } catch (error) {
      this.toast.show(errorMessage(error, 'I modelli non si sono salvati.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set('');
    try {
      const current = await firstValueFrom(this.http.get<AdminModelSettings>('/v1/admin/models'));
      this.data.set(current);
      this.form.set(current.settings);
    } catch (error) {
      this.data.set(null);
      this.form.set(null);
      this.failed.set(errorMessage(error, 'I modelli non si leggono.'));
    } finally {
      this.loading.set(false);
    }
  }

  private catalog(row: Row): CatalogModel[] {
    const catalog = this.data()?.catalog;
    return (row === 'chat' ? catalog?.chat : catalog?.tools[row]) ?? [];
  }
}
