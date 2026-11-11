import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  type TemplateRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import type { AiStep } from '@moonbrand/shared/ai/steps';
import type { Artifact } from '@moonbrand/shared/domain/artifact';
import type { ChannelId } from '@moonbrand/shared/domain/brand';
import { channelName } from '@moonbrand/shared/domain/catalog';
import type { Content } from '@moonbrand/shared/domain/content';
import type { MessageKey } from '@moonbrand/shared/i18n/translate';
import { formatWeekdayShort } from '@moonbrand/shared/lib/dates';
import type { ConversationSummary, ConversationTurn, PublishProposal, WelcomeResponse } from '@moonbrand/shared/api/contract';

import { AiJobsService } from '../../core/ai/ai-jobs.service';
import { AuthService } from '../../core/auth/auth.service';
import { BrandsService } from '../../core/brands/brands.service';
import { ChatService } from '../../core/chat/chat.service';
import { errorMessage } from '../../core/errors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { pageHeader } from '../../core/layout/page-header';
import { ConfirmService } from '../../ui/confirm';
import { Icon, type IconName } from '../../ui/icon';
import { Loader } from '../../ui/loader';
import { LightboxService } from '../../ui/lightbox';
import { PendingMedia, pendingFromSteps } from '../../ui/pending-media';
import { Markdown } from '../../ui/markdown';
import { StepList } from '../../ui/step-list';
import { ToastService } from '../../ui/toast';
import { ArtifactPanel, KIND_ICON } from './artifact-panel';
import { contentItemId, groupItems, latestOnly, panelItems, type PanelItem } from './artifacts';
import { Composer, type ComposerMessage } from './composer';
import { type ShownGreeting, fallbackGreeting, greetingText, pickGreeting } from './greeting';

// Nella risposta di un turno i testi di Claude si leggono, i tool di fila si raccolgono in un blocco solo.
// streaming: il testo sta ancora arrivando.
type Block = { kind: 'text'; id: string; text: string; streaming: boolean } | { kind: 'tools'; id: string; steps: AiStep[] };

// Spunti per la prima domanda: riempiono la casella, non partono da soli. Questi valgono finché non ci sono quelli di
// oggi, scritti per il brand. Il draft è il messaggio di chi scrive: nella lingua dell'interfaccia (chat.suggestions).
const SUGGESTIONS: { icon: IconName; key: 'ideas' | 'carousel' | 'fromIdea' | 'review' }[] = [
  { icon: 'sparkle', key: 'ideas' },
  { icon: 'layers', key: 'carousel' },
  { icon: 'pen', key: 'fromIdea' },
  { icon: 'bar-chart', key: 'review' },
];

// Mentre risponde si legge più spesso: il testo arriva a pezzi e si svela con un ritmo costante.
const LIVE_POLL_MS = 400;
// Il saluto e gli spunti di oggi si scrivono in pochi secondi: basta guardare ogni tanto.
const WELCOME_POLL_MS = 2000;
// Il filo segue la risposta finché chi legge sta in fondo (entro questa distanza).
const STICK_PX = 80;
// Dopo «Pubblica ora» si guarda com'è andata finché ogni canale ha finito: un post esce in pochi secondi, un video in
// qualche decina; poi si smette, e il resto si vede riaprendo la conversazione.
const PUBLISH_POLL_MS = 3000;
const PUBLISH_POLL_MAX = 100;
// Un file appena fatto diventa artefatto poco dopo la fine del passaggio (copia, storage, riga): si rilegge due volte.
const ARTIFACT_RELOAD_MS = [1500, 5000];
// Nel filo, oltre tante card per turno si vedono le prime e il resto si apre con «Mostra altri».
const CARDS_COLLAPSE = 4;
const CARDS_SHOWN = 3;
// La larghezza del pannello, trascinando il bordo: tra questi limiti, ricordata nel browser.
const PANEL_MIN = 340;
const PANEL_MAX = 900;
const PANEL_DEFAULT = 480;
const PANEL_WIDTH_KEY = 'mb.chat.panelWidth';

@Component({
  selector: 'mb-chat-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RouterLink, Icon, Loader, Markdown, StepList, PendingMedia, ArtifactPanel, Composer, TranslatePipe],
  host: {
    '(window:pointermove)': 'resizing($event)',
    '(window:pointerup)': 'resized()',
    '(document:click)': 'menuOpen.set(false)',
    '(document:keydown.escape)': 'menuOpen.set(false)',
  },
  templateUrl: './chat-page.html',
  styleUrl: './chat-page.scss',
})
export class ChatPage {
  private readonly chat = inject(ChatService);
  private readonly ai = inject(AiJobsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly lightbox = inject(LightboxService);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  protected readonly brands = inject(BrandsService);

  // Dal percorso /assistente/:conversationId; senza, è una conversazione nuova.
  readonly conversationId = input<string>();
  // ?artefatto=<id>: l'elemento aperto nel pannello a destra.
  readonly artefatto = input<string>();

  protected readonly current = signal<ConversationSummary | null>(null);
  protected readonly turns = signal<ConversationTurn[]>([]);
  protected readonly contents = signal<Content[]>([]);
  protected readonly proposals = signal<PublishProposal[]>([]);
  protected readonly artifacts = signal<Artifact[]>([]);
  // Tutto quello che è nato nella conversazione; nel menu del pannello l'ultima versione di ogni file.
  protected readonly items = computed(() => panelItems(this.contents(), this.proposals(), this.artifacts()));
  protected readonly menu = computed(() => latestOnly(this.items()));
  // La tendina nella topbar e il menu del pannello: i post in cima, poi i file per tipo, i più recenti per primi.
  protected readonly groups = computed(() => groupItems(this.menu()));
  protected readonly menuOpen = signal(false);
  // I turni con tutte le card aperte.
  protected readonly expanded = signal<ReadonlySet<string>>(new Set());
  protected readonly panelItem = computed(() => {
    const id = this.artefatto();
    return id ? (this.items().find((item) => item.id === id) ?? null) : null;
  });
  protected readonly panelWidth = signal(readPanelWidth());
  private resizeFrom: { x: number; width: number } | null = null;
  // Gli elementi già visti in questa conversazione: uno nuovo, arrivato mentre si segue il turno, si apre da solo.
  private seen: Set<string> | null = null;
  protected readonly kindIcon = KIND_ICON;
  protected readonly CARDS_COLLAPSE = CARDS_COLLAPSE;
  // I contenuti per cui si è appena premuto «Pubblica ora» e la risposta non è ancora arrivata.
  protected readonly starting = signal<ReadonlySet<string>>(new Set());
  private readonly watching = new Set<string>();
  protected readonly loading = signal(false);
  protected readonly sending = signal(false);
  protected readonly stopping = signal(false);
  // Il saluto in cima: null finché non si sa se quelli di oggi ci sono, così non ne compare uno per poi cambiare subito.
  // Quelli di oggi sono già nella lingua dell'account; quello di riserva si legge nella lingua dell'interfaccia.
  private readonly shownGreeting = signal<ShownGreeting | null>(null);
  protected readonly greeting = computed(() => {
    const shown = this.shownGreeting();
    return shown ? greetingText(shown, this.i18n.locale()) : null;
  });
  private readonly welcome = signal<WelcomeResponse | null>(null);
  protected readonly suggestions = computed(() => {
    const today = this.welcome()?.suggestions ?? [];
    if (today.length > 0) return today;
    return SUGGESTIONS.map(({ icon, key }) => ({
      icon,
      label: this.i18n.t(`chat.suggestions.${key}.label` as MessageKey),
      draft: this.i18n.t(`chat.suggestions.${key}.draft` as MessageKey),
    }));
  });
  // Solo l'id: il brand attivo si ricarica anche quando cambia altro, e il saluto non deve cambiare con lui.
  private readonly activeBrandId = computed(() => this.brands.activeBrand()?.id ?? null);
  // Ogni caricamento del benvenuto ha il suo numero: quello di un brand lasciato nel frattempo non arriva a schermo.
  private welcomeLoad = 0;

  private readonly thread = viewChild<ElementRef<HTMLElement>>('thread');
  private readonly composer = viewChild(Composer);
  private readonly headerActions = viewChild<TemplateRef<unknown>>('headerActions');
  // Il lavoro che si sta seguendo e i blocchi che c'erano già quando si è cominciato: solo i nuovi si svelano piano.
  private readonly live = signal<{ jobId: string; known: Set<string> } | null>(null);
  private stick = true;

  protected readonly running = computed(() =>
    this.turns().some((turn) => turn.job.status === 'queued' || turn.job.status === 'running'),
  );
  private readonly turnCount = computed(() => this.turns().length);
  // Ogni contenuto sta nella risposta del turno in cui è nato: l'ultimo turno partito prima che venisse creato.
  protected readonly view = computed(() => {
    const turns = this.turns();
    const contents = this.contents();
    const items = new Map(this.items().map((item) => [item.id, item]));
    const artifacts = this.artifacts();
    return turns.map((turn, index) => {
      const next = turns[index + 1]?.createdAt;
      // Le card del turno: i contenuti nati qui, quelli proposti per la pubblicazione e l'ultima versione di ogni file.
      const born = contents.filter((content) => content.createdAt >= turn.createdAt && (!next || content.createdAt < next)).map((content) => content.id);
      const ids = [...new Set([...born, ...turn.publishRequests])].map(contentItemId);
      const lastOfSource = new Map<string, string>();
      for (const artifact of artifacts) if (artifact.jobId === turn.job.id) lastOfSource.set(artifact.source, artifact.id);
      // Come nella tendina: i post in cima, poi i file per tipo, i più recenti per primi.
      const cards = groupItems([...ids, ...lastOfSource.values()].flatMap((id) => items.get(id) ?? [])).flatMap((group) => group.items);
      return {
        ...turn,
        blocks: blocksOf(turn.job.steps),
        cards,
        // Tante card: si vedono le prime, finché non si apre il resto.
        hiddenCards: cards.length > CARDS_COLLAPSE && !this.expanded().has(turn.id) ? cards.length - CARDS_SHOWN : 0,
        // I file che il turno in corso sta facendo: al loro posto arriva la card, quando il passaggio finisce.
        pending: turn.job.status === 'queued' || turn.job.status === 'running' ? pendingFromSteps(turn.job.steps, { running: true }) : [],
      };
    });
  });

  constructor() {
    pageHeader(
      () => {
        const open = this.current();
        const title = this.i18n.t('shell.assistant');
        return open ? [{ label: title, link: '/assistente' }, { label: open.title }] : [{ label: title }];
      },
      () => this.headerActions(),
    );
    effect(() => {
      const id = this.conversationId();
      untracked(() => (id ? void this.open(id) : this.reset()));
    });
    // Senza conversazione aperta si vede il benvenuto del brand attivo: si rilegge ogni volta che si torna qui.
    effect(() => {
      const brandId = this.activeBrandId();
      if (brandId && !this.conversationId()) untracked(() => void this.loadWelcome(brandId));
    });
    // Cambiando brand, la conversazione aperta non è più di quello attivo.
    effect(() => {
      const brand = this.brands.activeBrand();
      const open = untracked(this.current);
      if (brand && open && open.brandId !== brand.id) void this.router.navigateByUrl('/assistente');
    });
    // Un elemento nuovo arrivato mentre si segue il turno si apre da solo nel pannello, come in Claude.
    effect(() => {
      const ids = this.items().map((item) => item.id);
      if (this.loading()) return;
      untracked(() => {
        if (!this.seen) {
          this.seen = new Set(ids);
          return;
        }
        const fresh = ids.filter((id) => !this.seen!.has(id));
        for (const id of fresh) this.seen.add(id);
        if (fresh.length > 0 && this.live()) this.openItem(fresh.at(-1)!);
      });
    });
    // Un messaggio nuovo porta in fondo al filo.
    afterRenderEffect(() => {
      this.turnCount();
      this.stick = true;
      this.toBottom();
    });
    // La risposta cresce anche tra un aggiornamento e l'altro, mentre si svela: il filo la segue se si è in fondo.
    effect((onCleanup) => {
      const element = this.thread()?.nativeElement;
      if (!element) return;
      const observer = new MutationObserver(() => this.stick && this.toBottom());
      observer.observe(element, { childList: true, subtree: true, characterData: true });
      onCleanup(() => observer.disconnect());
    });
  }

  protected scrolled(): void {
    const element = this.thread()?.nativeElement;
    if (element) this.stick = element.scrollHeight - element.scrollTop - element.clientHeight < STICK_PX;
  }

  private toBottom(): void {
    const element = this.thread()?.nativeElement;
    if (element) element.scrollTop = element.scrollHeight;
  }

  private reset(): void {
    this.live.set(null);
    this.current.set(null);
    this.turns.set([]);
    this.contents.set([]);
    this.proposals.set([]);
    this.artifacts.set([]);
    this.seen = null;
    queueMicrotask(() => this.composer()?.focus());
  }

  // Il benvenuto di oggi; se lo sta ancora scrivendo si vede quello di riserva e, appena pronto, il suo.
  private async loadWelcome(brandId: string): Promise<void> {
    const load = ++this.welcomeLoad;
    const name = this.auth.account()?.name ?? '';
    const show = (welcome: WelcomeResponse) => {
      this.welcome.set(welcome);
      this.shownGreeting.set(pickGreeting(brandId, welcome.greetings, name));
    };
    this.welcome.set(null);
    this.shownGreeting.set(null);
    try {
      const welcome = await this.chat.welcome(brandId);
      if (load !== this.welcomeLoad) return;
      show(welcome);
      if (!welcome.jobId) return;
      await this.ai.follow(welcome.jobId, undefined, WELCOME_POLL_MS);
      if (load !== this.welcomeLoad) return;
      const ready = await this.chat.welcome(brandId);
      if (load === this.welcomeLoad && ready.greetings.length > 0) show(ready);
    } catch {
      // Resta il benvenuto di riserva; se non si è saputo niente, il saluto semplice.
      if (load === this.welcomeLoad && this.shownGreeting() === null) this.shownGreeting.set(fallbackGreeting(name));
    }
  }

  private async open(conversationId: string): Promise<void> {
    if (this.current()?.id !== conversationId) {
      this.live.set(null);
      this.loading.set(true);
      this.turns.set([]);
      this.contents.set([]);
      this.proposals.set([]);
      this.artifacts.set([]);
      this.seen = null;
    }
    try {
      await this.refresh(conversationId);
      // Un post che stava uscendo quando si è lasciata la conversazione: si segue fino alla fine.
      for (const proposal of this.proposals()) {
        if (proposal.publications.some((item) => item.status === 'publishing')) void this.watchPublishing(conversationId, proposal.content.id);
      }
      const active = this.turns().find(
        (turn) => turn.job.status === 'queued' || turn.job.status === 'running',
      );
      if (active) void this.follow(conversationId, active.job.id);
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('chat.page.notFound')));
      void this.router.navigateByUrl('/assistente');
    } finally {
      this.loading.set(false);
    }
  }

  private async refresh(conversationId: string): Promise<void> {
    const { conversation, turns, contents, proposals, artifacts } = await this.chat.get(conversationId);
    if (this.conversationId() !== conversationId) return;
    this.current.set(conversation);
    this.turns.set(turns);
    this.contents.set(contents);
    this.proposals.set(proposals);
    this.artifacts.set(artifacts ?? []);
  }

  // I contenuti, le proposte di pubblicazione con com'è andata e i file; dei turni, che si stanno seguendo, solo le proposte.
  private async refreshContents(conversationId: string): Promise<void> {
    const response = await this.chat.get(conversationId).catch(() => null);
    if (!response || this.conversationId() !== conversationId) return;
    this.contents.set(response.contents);
    this.proposals.set(response.proposals);
    this.artifacts.set(response.artifacts ?? []);
    const requests = new Map(response.turns.map((turn) => [turn.id, turn.publishRequests]));
    this.turns.update((turns) => turns.map((turn) => ({ ...turn, publishRequests: requests.get(turn.id) ?? turn.publishRequests })));
  }

  // Gli step arrivano man mano; a turno finito si rilegge tutto, per i contenuti salvati e lo stato finale.
  private async follow(conversationId: string, jobId: string): Promise<void> {
    if (this.live()?.jobId === jobId) return;
    const turn = this.turns().find((item) => item.job.id === jobId);
    this.live.set({ jobId, known: new Set(blocksOf(turn?.job.steps ?? []).map((block) => block.id)) });
    let saved = savesOf(turn?.job.steps ?? []);
    let made = madeOf(turn?.job.steps ?? []);
    const update = (steps: AiStep[]) => {
      if (this.live()?.jobId !== jobId) return;
      // Un contenuto appena salvato o aggiornato compare subito, senza aspettare la fine del turno.
      const now = savesOf(steps);
      if (now > saved) {
        saved = now;
        void this.refreshContents(conversationId);
      }
      // Un file appena fatto: lo registra il worker poco dopo, e si rilegge quando c'è.
      const files = madeOf(steps);
      if (files > made) {
        made = files;
        for (const delay of ARTIFACT_RELOAD_MS) {
          setTimeout(() => this.live()?.jobId === jobId && void this.refreshContents(conversationId), delay);
        }
      }
      this.turns.update((turns) =>
        turns.map((item) =>
          item.job.id === jobId ? { ...item, job: { ...item.job, status: 'running', steps } } : item,
        ),
      );
    };
    try {
      await this.ai.follow(jobId, update, LIVE_POLL_MS);
    } catch {
      // L'errore o lo stop del turno si vedono nel filo, dopo la rilettura.
    }
    if (this.live()?.jobId !== jobId) return;
    await this.refresh(conversationId).catch(() => undefined);
    this.live.set(null);
    this.stopping.set(false);
    void this.chat.refresh();
  }

  // Solo i blocchi arrivati mentre si segue il turno si svelano piano; quelli già scritti si mostrano interi.
  protected animated(turn: ConversationTurn, blockId: string): boolean {
    const live = this.live();
    return live?.jobId === turn.job.id && !live.known.has(blockId);
  }

  protected async send({ message, attachments }: ComposerMessage): Promise<void> {
    const brand = this.brands.activeBrand();
    if (!brand || this.sending() || this.running()) return;
    this.sending.set(true);
    try {
      const open = this.current();
      if (open) {
        const created = await this.chat.send(open.id, { message, attachments });
        this.composer()?.clear();
        await this.refresh(open.id);
        void this.follow(open.id, created.jobId);
        void this.chat.refresh();
      } else {
        const created = await this.chat.start(brand.id, { message, attachments });
        this.composer()?.clear();
        void this.chat.refresh();
        await this.router.navigate(['/assistente', created.conversationId]);
      }
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('chat.page.sendFailed')));
    } finally {
      this.sending.set(false);
    }
  }

  protected async stop(): Promise<void> {
    const open = this.current();
    if (!open || this.stopping()) return;
    this.stopping.set(true);
    try {
      await this.chat.stop(open.id);
    } catch (error) {
      this.stopping.set(false);
      this.toast.show(errorMessage(error, this.i18n.t('chat.page.stopFailed')));
    }
  }

  protected suggest(text: string): void {
    this.composer()?.setDraft(text);
  }

  // Nella lightbox solo le foto: i video si guardano nel messaggio.
  protected openPhoto(turn: ConversationTurn, file: string): void {
    const photos = turn.attachments.filter((item) => !item.poster);
    this.lightbox.open(
      photos.map((item, i) => ({ url: item.url, alt: this.i18n.t('chat.page.photoAlt', { n: i + 1 }) })),
      photos.findIndex((item) => item.file === file),
    );
  }

  protected async remove(): Promise<void> {
    const open = this.current();
    if (!open) return;
    const confirmed = await this.confirm.ask({
      title: this.i18n.t('chat.page.deleteTitle'),
      message: this.i18n.t('chat.page.deleteMessage'),
      confirmLabel: this.i18n.t('common.delete'),
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      await this.chat.remove(open.id);
      void this.router.navigateByUrl('/assistente');
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('chat.page.deleteFailed')));
    }
  }

  protected active(turn: ConversationTurn): boolean {
    return turn.job.status === 'queued' || turn.job.status === 'running';
  }

  // Finché il turno non è finito qualcosa si muove sempre: prima della risposta e dopo un testo concluso si dice che
  // sta pensando; tra un passaggio e l'altro lo dice il blocco dei passaggi, che resta vivo finché è l'ultimo.
  protected waiting(blocks: Block[], turn: ConversationTurn): boolean {
    if (!this.active(turn)) return false;
    const last = blocks.at(-1);
    return !last || (last.kind === 'text' && !last.streaming);
  }

  // L'uscita menzionata in un messaggio, in breve: «gio 2 ott · 18:30 · Instagram».
  protected slotLabel(slot: { date: string; time: string; channels: ChannelId[] }): string {
    return `${formatWeekdayShort(slot.date, this.i18n.locale())} · ${slot.time} · ${slot.channels.map(channelName).join(', ')}`;
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

  // La conferma è dell'utente: il pulsante chiede ancora una volta, poi il contenuto si approva ed esce subito.
  protected async publish(proposal: PublishProposal): Promise<void> {
    const conversationId = this.current()?.id;
    const contentId = proposal.content.id;
    if (!conversationId || this.starting().has(contentId)) return;
    const confirmed = await this.confirm.ask({
      title: this.i18n.t('chat.publish.confirmTitle'),
      message: this.i18n.t('chat.publish.confirmMessage', { channels: this.channelNames(this.toPublish(proposal)) }),
      confirmLabel: this.i18n.t('chat.publish.confirmLabel'),
    });
    if (!confirmed) return;
    this.starting.update((set) => new Set(set).add(contentId));
    try {
      const started = await this.chat.publish(contentId);
      this.proposals.update((list) => list.map((item) => (item.content.id === contentId ? started : item)));
      void this.watchPublishing(conversationId, contentId);
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('chat.publish.startFailed')));
    } finally {
      this.starting.update((set) => new Set([...set].filter((id) => id !== contentId)));
    }
  }

  // Si rilegge la conversazione finché ogni canale del contenuto è uscito o non è riuscito.
  private async watchPublishing(conversationId: string, contentId: string): Promise<void> {
    if (this.watching.has(contentId)) return;
    this.watching.add(contentId);
    try {
      for (let round = 0; round < PUBLISH_POLL_MAX; round++) {
        await new Promise((resolve) => setTimeout(resolve, PUBLISH_POLL_MS));
        if (this.conversationId() !== conversationId) return;
        await this.refreshContents(conversationId);
        const proposal = this.proposals().find((item) => item.content.id === contentId);
        const settled = (channel: ChannelId) =>
          proposal?.publications.some((item) => item.channel === channel && item.status !== 'publishing') ?? true;
        if (!proposal || proposal.content.channels.every(settled)) return;
      }
    } finally {
      this.watching.delete(contentId);
    }
  }

  // Sotto il titolo di una card: il formato del contenuto o il tipo del file.
  protected cardLabel(item: PanelItem): string {
    return item.kind === 'content' ? this.i18n.t(`chat.format.${item.content.format}`) : this.i18n.t(`chat.artifacts.kind.${item.kind}`);
  }

  // Il pannello segue il link: aprire, cambiare e chiudere cambiano ?artefatto= senza aggiungere passi alla cronologia.
  protected openItem(id: string): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { artefatto: id }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected closePanel(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { artefatto: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  // La tendina nella topbar: un clic su una voce la apre nell'anteprima.
  protected toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen.update((open) => !open);
  }

  protected pickFromMenu(id: string): void {
    this.menuOpen.set(false);
    this.openItem(id);
  }

  protected groupLabel(kind: PanelItem['kind']): string {
    return this.i18n.t(`chat.artifacts.group.${kind}`);
  }

  protected toggleCards(turnId: string): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (!next.delete(turnId)) next.add(turnId);
      return next;
    });
  }

  protected startResize(event: PointerEvent): void {
    event.preventDefault();
    this.resizeFrom = { x: event.clientX, width: this.panelWidth() };
  }

  protected resizing(event: PointerEvent): void {
    if (!this.resizeFrom) return;
    // Il pannello sta a destra: trascinando il bordo verso sinistra si allarga.
    this.panelWidth.set(clampWidth(this.resizeFrom.width + this.resizeFrom.x - event.clientX));
  }

  protected resized(): void {
    if (!this.resizeFrom) return;
    this.resizeFrom = null;
    this.saveWidth();
  }

  protected resizeByKey(step: number): void {
    this.panelWidth.update((width) => clampWidth(width + step));
    this.saveWidth();
  }

  private saveWidth(): void {
    try {
      localStorage.setItem(PANEL_WIDTH_KEY, String(this.panelWidth()));
    } catch {
      // Senza storage la larghezza vale finché la pagina resta aperta.
    }
  }

  // Sul telefono il pannello è un foglio: trascinato in giù dalla maniglia si chiude.
  private sheetFrom: number | null = null;

  protected sheetStart(event: PointerEvent): void {
    this.sheetFrom = event.clientY;
  }

  protected sheetEnd(event: PointerEvent): void {
    if (this.sheetFrom !== null && event.clientY - this.sheetFrom > 80) this.closePanel();
    this.sheetFrom = null;
  }
}

function clampWidth(width: number): number {
  return Math.round(Math.min(PANEL_MAX, Math.max(PANEL_MIN, width)));
}

function readPanelWidth(): number {
  try {
    const saved = Number(localStorage.getItem(PANEL_WIDTH_KEY));
    return saved > 0 ? clampWidth(saved) : PANEL_DEFAULT;
  } catch {
    return PANEL_DEFAULT;
  }
}

// I passaggi conclusi che hanno prodotto un file: ognuno diventa un artefatto.
function madeOf(steps: AiStep[]): number {
  return steps.filter((step) => step.kind === 'tool' && step.status === 'done' && step.media?.some((item) => item.file)).length;
}

// I tool che salvano o aggiornano un contenuto o ne propongono la pubblicazione, già conclusi: contenuto_salva fino al v2,
// salva_contenuto dal v3 (con il prefisso del server MCP nel v3, senza nel v4). Negli step più vecchi il nome del tool era la label.
function savesOf(steps: AiStep[]): number {
  return steps.filter(
    (step) => step.kind === 'tool' && /(contenuto_(salva|aggiorna)|salva_contenuto|pubblicazione_proponi)$/.test(step.tool ?? step.label) && step.status === 'done',
  ).length;
}

// Un blocco di passaggi prende il nome dal testo che lo precede: resta lo stesso anche quando un passaggio
// nascosto si mostra dopo, così il blocco non si ricrea (e non perde tempi e accordion aperto).
function blocksOf(steps: AiStep[]): Block[] {
  const blocks: Block[] = [];
  let after = 'start';
  for (const step of steps) {
    if (step.kind === 'text') {
      blocks.push({ kind: 'text', id: step.id, text: step.label, streaming: step.status === 'running' });
      after = step.id;
      continue;
    }
    const last = blocks.at(-1);
    if (last?.kind === 'tools') last.steps.push(step);
    else blocks.push({ kind: 'tools', id: `tools-${after}`, steps: [step] });
  }
  return blocks;
}
