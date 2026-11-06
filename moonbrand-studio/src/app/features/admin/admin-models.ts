import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { AdminModelSettings } from '@moonbrand/shared/api/contract';
import { DEFAULT_MODEL_SETTINGS, MODEL_TOOLS, THINKING_LEVELS, THINKING_TOOLS, type ModelSettings, type ModelTool, type ThinkingLevel } from '@moonbrand/shared/domain/models';

import { errorMessage } from '../../core/errors';
import { pageHeader } from '../../core/layout/page-header';
import { Loader } from '../../ui/loader';
import { Select, type SelectOption } from '../../ui/select';
import { ToastService } from '../../ui/toast';
import { AdminTabs, when } from './admin-ui';

// Quale modello e quanto ragionamento usano la chat e ogni strumento del motore. Si salvano nel DB e il worker li legge a
// ogni lavoro: valgono dal turno di chat dopo, senza riavviare niente. Il nome del modello non si controlla qui: se non
// esiste, il lavoro fallisce e lo dice.

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
            Valgono dal turno di chat dopo il salvataggio, senza riavvii. Il nome del modello non si controlla qui: se non esiste, il lavoro fallisce e lo dice.
            Il ragionamento vale per la chat e per gli strumenti su Gemini; «predefinito» lascia decidere al modello.
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
                  <td><input type="text" required [value]="f.chat.model" (input)="setChat('model', $any($event.target).value)" /></td>
                  <td><mb-select [options]="levels" [value]="f.chat.thinking" (changed)="setChat('thinking', $event)" /></td>
                </tr>
                @for (tool of tools; track tool) {
                  <tr>
                    <td>
                      <strong>{{ labels[tool].label }}</strong>
                      <div class="caption">{{ labels[tool].hint }}</div>
                    </td>
                    <td><input type="text" required [value]="f.tools[tool].model" (input)="setTool(tool, 'model', $any($event.target).value)" /></td>
                    <td>
                      @if (thinks(tool)) {
                        <mb-select [options]="toolLevels" [value]="f.tools[tool].thinking ?? ''" (changed)="setTool(tool, 'thinking', $event)" />
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
    .models input {
      width: 100%;
      min-width: 260px;
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

  constructor() {
    pageHeader(() => [{ label: 'Admin', link: '/admin' }, { label: 'Modelli' }]);
    void this.load();
  }

  protected thinks(tool: ModelTool): boolean {
    return THINKING_TOOLS.includes(tool);
  }

  protected stamp(): string {
    const current = this.data();
    if (!current?.updatedAt) return 'Valgono i predefiniti del motore.';
    return `Salvati ${when(current.updatedAt)}${current.updatedBy ? ` da ${current.updatedBy}` : ''}.`;
  }

  protected setChat(key: 'model' | 'thinking', value: string): void {
    this.form.update((f) => (f ? { ...f, chat: { ...f.chat, [key]: value } } : f));
  }

  protected setTool(tool: ModelTool, key: 'model' | 'thinking', value: string): void {
    this.form.update((f) => {
      if (!f) return f;
      const { thinking: _thinking, ...rest } = f.tools[tool];
      const choice = key === 'model' ? { ...f.tools[tool], model: value } : { ...rest, ...(value && { thinking: value as ThinkingLevel }) };
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
}
