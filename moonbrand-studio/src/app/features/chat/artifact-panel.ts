import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, resource } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

import type { PublishProposal } from '@moonbrand/shared/api/contract';
import type { ChannelId } from '@moonbrand/shared/domain/brand';
import { channelName } from '@moonbrand/shared/domain/catalog';
import { contentState, publicationProblem, type Publication } from '@moonbrand/shared/domain/plan';

import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Icon, type IconName } from '../../ui/icon';
import { LightboxService } from '../../ui/lightbox';
import { Loader } from '../../ui/loader';
import { Markdown } from '../../ui/markdown';
import { ToastService } from '../../ui/toast';
import { ContentPreview } from '../contents/content-preview';
import { stateTone, statusLabel } from '../contents/labels';
import type { PanelGroup, PanelItem, PanelKind } from './artifacts';

export const KIND_ICON: Record<PanelKind, IconName> = {
  content: 'layers',
  image: 'image-plus',
  video: 'play',
  audio: 'music',
  document: 'file-text',
  html: 'globe',
};

// Il pannello a destra della chat: un elemento alla volta, con titolo, versioni e azioni del suo tipo, e il menu con
// tutto quello che è nato nella conversazione. Ogni tipo ha il suo visualizzatore; un tipo nuovo è un caso nuovo qui.
@Component({
  selector: 'mb-artifact-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, Loader, Markdown, ContentPreview, TranslatePipe],
  templateUrl: './artifact-panel.html',
  styleUrl: './artifact-panel.scss',
})
export class ArtifactPanel {
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly lightbox = inject(LightboxService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly item = input.required<PanelItem>();
  // Le voci del menu, a gruppi: i contenuti, poi l'ultima versione di ogni file per tipo.
  readonly groups = input.required<PanelGroup[]>();
  protected readonly count = computed(() => this.groups().reduce((sum, group) => sum + group.items.length, 0));
  // I contenuti per cui si è appena premuto «Pubblica ora».
  readonly starting = input<ReadonlySet<string>>(new Set());
  readonly closed = output<void>();
  readonly selected = output<string>();
  readonly publish = output<PublishProposal>();

  protected readonly icon = KIND_ICON;

  // La versione scelta di un file: l'elemento stesso, finché non se ne sceglie un'altra.
  protected readonly version = linkedSignal(() => {
    const item = this.item();
    return item.kind === 'content' ? null : item.artifact;
  });
  protected readonly versionIndex = computed(() => {
    const item = this.item();
    const version = this.version();
    return item.kind === 'content' || !version ? -1 : item.versions.findIndex((artifact) => artifact.id === version.id);
  });

  // I documenti e le pagine si leggono come testo: il Markdown con mb-markdown, l'HTML in un iframe isolato.
  private readonly textUrl = computed(() => {
    const version = this.version();
    if (!version || !(version.kind === 'html' || (version.kind === 'document' && version.mime !== 'application/pdf'))) return undefined;
    return version.files[0]?.url;
  });
  protected readonly text = resource({
    params: () => this.textUrl(),
    loader: async ({ params, abortSignal }) => {
      const response = await fetch(params, { signal: abortSignal });
      if (!response.ok) throw new Error(String(response.status));
      return response.text();
    },
  });
  // La pagina gira in un iframe senza allow-same-origin: script sì, ma niente accesso allo studio, ai cookie o all'API.
  protected readonly page = computed(() => {
    const html = this.version()?.kind === 'html' && this.text.hasValue() ? this.text.value() : null;
    return html === null ? null : this.sanitizer.bypassSecurityTrustHtml(html);
  });
  protected readonly pdf = computed(() => {
    const version = this.version();
    const url = version?.mime === 'application/pdf' ? version.files[0]?.url : undefined;
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  protected groupLabel(kind: PanelKind): string {
    return this.i18n.t(`chat.artifacts.group.${kind}`);
  }

  protected kindLabel(kind: PanelKind): string {
    return this.i18n.t(`chat.artifacts.kind.${kind}`);
  }

  protected zoom(): void {
    const version = this.version();
    if (version?.kind !== 'image') return;
    this.lightbox.open(version.files.map((file) => ({ url: file.url, alt: version.title })));
  }

  protected async copy(): Promise<void> {
    if (!this.text.hasValue()) return;
    try {
      await navigator.clipboard.writeText(this.text.value());
      this.toast.show(this.i18n.t('chat.artifacts.copied'));
    } catch {
      this.toast.show(this.i18n.t('chat.artifacts.copyFailed'));
    }
  }

  // Il nome del file scaricato: il titolo, con l'estensione della copia.
  protected downloadName(file: string, title: string): string {
    const extension = /\.[a-z0-9]+$/i.exec(file)?.[0] ?? '';
    return `${title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'file'}${extension}`;
  }

  protected pick(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    if (id) this.selected.emit(id);
  }

  protected pickVersion(event: Event): void {
    const item = this.item();
    if (item.kind === 'content') return;
    const found = item.versions.find((artifact) => artifact.id === (event.target as HTMLSelectElement).value);
    if (found) this.version.set(found);
  }

  // La pubblicazione di un contenuto proposto, come nella card di prima.
  protected readonly stateTone = stateTone;

  protected stateLabel(proposal: PublishProposal): string {
    return statusLabel(contentState(proposal.content.status, proposal.content.channels, proposal.publications), this.i18n.locale());
  }

  protected stateOf(proposal: PublishProposal) {
    return contentState(proposal.content.status, proposal.content.channels, proposal.publications);
  }

  // I canali dove il contenuto non è ancora uscito: lì va il pulsante. Vuoto mentre sta uscendo o quando è uscito ovunque.
  protected toPublish(proposal: PublishProposal): ChannelId[] {
    if (proposal.publications.some((item) => item.status === 'publishing')) return [];
    const done = new Set(proposal.publications.filter((item) => item.status === 'published').map((item) => item.channel));
    return proposal.content.channels.filter((channel) => !done.has(channel));
  }

  protected channelNames(channels: readonly ChannelId[]): string {
    return channels.map(channelName).join(', ');
  }

  protected channelLabel(channel: ChannelId): string {
    return channelName(channel);
  }

  protected problem(item: Publication): string {
    return publicationProblem(item, this.i18n.locale());
  }

  protected formatLabel(item: PanelItem): string {
    return item.kind === 'content' ? this.i18n.t(`chat.format.${item.content.format}`) : this.kindLabel(item.kind);
  }

  protected statusLabel(item: PanelItem): string {
    return item.kind === 'content' ? this.i18n.t(`chat.status.${item.content.status}`) : '';
  }
}
