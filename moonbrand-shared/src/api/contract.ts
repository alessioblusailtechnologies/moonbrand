import type { AiStep } from '../ai/steps';
import type { BrandCategory, BrandDraft, BrandFonts, BrandKind, ChannelId, ChannelState, Identity, MediaFile, Positioning } from '../domain/brand';
import type { CarouselSlide, ChannelVariant, Content, ContentFile, ContentFormat, ContentStatus, VideoScene } from '../domain/content';
import type { Idea, IdeaSignalKind, IdeaStatus } from '../domain/idea';
import type { ContentState, PlanRequest, PlanSlot, Publication, SlotDraft, SlotStatus } from '../domain/plan';
import type { SubscriptionPlanId } from '../domain/subscription';
import type { Greeting, Occasion, WelcomeSuggestion } from '../domain/welcome';
import type { Locale } from '../i18n/locales';

// locale: la lingua dell'interfaccia e di tutto quello che il motore dice a chi usa moonbrand.
// emailConfirmed: se ha aperto il link dell'email di benvenuto; finché no, lo studio glielo ricorda.
export interface Account {
  id: string;
  email: string;
  name: string;
  locale: Locale;
  emailConfirmed: boolean;
  // Il piano Ultra in omaggio (FREE_ULTRA_EMAILS dell'API): niente da pagare, lo studio non propone il checkout.
  freePlan?: boolean;
}

// locale: la lingua del browser al momento della registrazione, se è tra le nostre.
export interface SignUpRequest {
  name: string;
  email: string;
  password: string;
  locale?: Locale;
}

export interface UpdateMeRequest {
  locale: Locale;
}

// L'accesso con Google, spento per ora (12/10/2026): lo studio mostra il bottone con «arriva presto» e l'API rifiuta il giro.
export const GOOGLE_SIGN_IN = false;

export interface SignInRequest {
  email: string;
  password: string;
}

// I token arrivano dai link delle email: /conferma-email?token=… e /nuova-password?token=….
export interface ConfirmEmailRequest {
  token: string;
}

// L'email per la nuova password parte nella lingua dell'account; a un indirizzo senza account non parte niente.
export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface Session {
  accessToken: string;
  expiresIn: number;
  account: Account;
}

export interface Me {
  account: Account;
  activeBrandId: string | null;
  // Chi può aprire /admin: le email di ADMIN_EMAILS nell'API.
  admin: boolean;
}

export interface BrandSummary {
  id: string;
  kind: BrandKind;
  name: string;
  logoUri: string | null;
  color: string;
  // I canali dove il social ha chiuso l'accesso: lo studio chiede di ricollegarli.
  lostChannels: ChannelId[];
}

// La bozza dell'onboarding sul server, una per account: la stessa in ogni scheda e dispositivo. Lo stato è quello dello
// studio, il server lo tiene com'è. revision cresce a ogni salvataggio; 0 vuol dire nessuna bozza.
export interface OnboardingDraft {
  state: unknown;
  revision: number;
}

// Si salva dicendo da quale revisione si parte: se un'altra scheda ha salvato nel frattempo, o il brand della bozza è
// già nato, il server risponde 409 e la scheda rilegge.
export type OnboardingDraftSave = OnboardingDraft;

// referenceExamples: gli esempi scelti nell'onboarding, che diventano i riferimenti da seguire del brand.
// plan: il piano scelto nell'onboarding; senza, il brand parte con quello di base.
export type CreateBrandRequest = BrandDraft & { id: string; referenceExamples?: string[]; plan?: SubscriptionPlanId };

// Il cambio di piano dalle Impostazioni brand. Per ora senza pagamento: il piano vale subito.
export interface UpdateBrandPlanRequest {
  plan: SubscriptionPlanId;
}

// Il brand nuovo e i lavori che lo preparano (lo stile dai riferimenti, le prime idee): l'onboarding li segue fino alla fine.
export type CreateBrandResponse = BrandSummary & { setupJobs: string[] };

// Il profilo di un brand com'è salvato, con i link ai file già firmati.
export interface BrandProfile {
  id: string;
  draft: BrandDraft;
  // Gli esempi scelti nell'onboarding (o rifatti dopo) che il brand segue come riferimento: file della sua cartella,
  // non della bozza. Si cambiano rifacendo gli esempi.
  followed: MediaFile[];
}

// referenceExamples: gli esempi rifatti dal Profilo, che prendono il posto dei riferimenti da seguire.
export type UpdateBrandRequest = BrandDraft & { referenceExamples?: string[] };

export interface ActiveBrandRequest {
  brandId: string;
}

export interface ReferenceUploadRequest {
  dataUri: string;
}

export type ReferenceUploadResponse = MediaFile;

// stopped: fermato da chi l'aveva chiesto (per ora solo i turni della chat).
export type AiJobStatus = 'queued' | 'running' | 'done' | 'failed' | 'stopped';

export interface AiJob<Result = unknown> {
  id: string;
  kind: string;
  status: AiJobStatus;
  steps: AiStep[];
  result: Result | null;
  error: string | null;
}

export interface AiJobCreated {
  id: string;
}

export interface WebsiteJobRequest {
  site: string;
  // Il brand per cui si legge il sito: se è ancora in bozza (onboarding) il lavoro non scala crediti.
  brandId?: string;
}

export interface WebsiteReading {
  site: string;
  name: string;
  sector: string;
  // La categoria dell'attività, null se nessuna è adatta; manca nelle letture fatte prima che ci fosse.
  category?: BrandCategory | null;
  summary: string;
  pitch: string;
  themes: string[];
  goals: string[];
  audiences: string[];
  colors: string[];
  // Il logo del sito come data URI, pronto per il brand; null se non c'è o non si è riusciti a scaricarlo.
  logo: string | null;
  // I font del sito come famiglie di Google Fonts (vedi BrandFonts); null se il sito non ne ha di riconoscibili.
  // Manca nelle letture fatte prima che ci fosse.
  fonts?: BrandFonts | null;
  // La lingua principale dei testi del sito (ISO 639-1, es. it, de), anche se non è tra le nostre: vedi siteLanguage.
  // Manca nelle letture fatte prima che ci fosse.
  language?: string;
}

export interface VisualBrandContext {
  identity: Identity;
  positioning: Positioning;
  channels: ChannelId[];
  themes: string[];
  // Le istruzioni personalizzate del brand, vuote se non ce ne sono.
  instructions: string;
  palette: string[];
  notes: string;
  // Il template di moonbrand scelto (domain/templates): gli esempi si fanno con i suoi layout. null: nessun template.
  template?: string | null;
  fonts?: BrandFonts | null;
}

export interface VisualJobRequest {
  brandId: string;
  brand: VisualBrandContext;
  // Il logo della bozza (data URI): l'API lo mette nella cartella del brand, così gli esempi lo usano com'è.
  logo?: string | null;
}

export interface VisualEditJobRequest {
  jobId: string;
  instruction: string;
}

// Quello che l'API mette in coda: la sessione, la cartella degli esempi e i canali vengono dal job da modificare.
export interface VisualEditJobInput {
  brandId: string;
  dir: string;
  sessionId: string;
  channels: ChannelId[];
  instruction: string;
  fromJobId: string;
}

export interface VisualExampleFile {
  channel: ChannelId;
  file: string;
  url: string;
  caption: string;
}

export interface VisualReading {
  examples: VisualExampleFile[];
}

export interface BrandContext {
  identity: Identity;
  positioning: Positioning;
  channels: ChannelId[];
  themes: { id: string; name: string; weight: number }[];
  // Le istruzioni personalizzate del brand, vuote se non ce ne sono.
  instructions: string;
  // Lo stile letto dai riferimenti dal job style: null se non è ancora stato letto, vuoto se non ci sono riferimenti.
  style: string | null;
  // Le impaginazioni degli ultimi contenuti, per farne una diversa.
  layouts: { title: string; format: ContentFormat; layout: string }[];
  // Il template di moonbrand scelto (domain/templates), null se il brand segue i suoi riferimenti.
  template: string | null;
  // I colori della palette del brand: principale, secondario, accento, sfondo.
  palette: string[];
  // I font del brand, null se non ne ha scelti.
  fonts: BrandFonts | null;
  // Le uscite delle prossime due settimane, con quello che hanno: l'assistente sa cosa esce e quando.
  plan: { id: string; date: string; time: string; channels: ChannelId[]; status: SlotStatus; theme: string | null; title: string | null }[];
}

// Il job style legge i riferimenti dalla cartella del brand: gli basta sapere quale.
export interface StyleJobInput {
  brandId: string;
}

// Il job video-setup prepara il progetto Remotion nella cartella del brand: gli basta sapere quale.
export interface VideoSetupJobInput {
  brandId: string;
}

// I gusti su tutta la storia del brand: ogni idea tenuta vale +1 per il suo tema e il suo segnale, ogni scartata -0,5.
export interface IdeaPreferences {
  decided: number;
  saved: number;
  themes: { themeId: string; score: number }[];
  signals: { kind: IdeaSignalKind; score: number }[];
}

// Quello che l'API mette in coda: il brand dal DB, le idee più recenti (per non ripetersi) e i gusti.
export interface IdeasJobInput {
  brandId: string;
  count: number;
  brand: BrandContext;
  recent: { title: string; status: IdeaStatus; themeId: string | null; signal: IdeaSignalKind }[];
  preferences: IdeaPreferences;
}

export interface IdeasResponse {
  ideas: Idea[];
  themes: { id: string; name: string; color: string }[];
  // I canali del brand: tra questi si sceglie dove far uscire un contenuto.
  channels: ChannelId[];
  // Il lavoro che sta preparando nuove idee, se c'è.
  jobId: string | null;
}

export interface IdeaStatusRequest {
  status: IdeaStatus;
}

export interface CreateContentRequest {
  format: ContentFormat;
  channels: ChannelId[];
}

export interface ContentCreated {
  id: string;
  jobId: string;
}

export interface ContentSummary {
  id: string;
  title: string;
  format: ContentFormat;
  channels: ChannelId[];
  status: ContentStatus;
  // Lo stato con com'è andata la pubblicazione: quello da mostrare.
  state: ContentState;
  coverUrl: string | null;
  // La proporzione della copertina, es. 9:16: la griglia sa quanto è alta la card prima che l'immagine arrivi.
  coverAspect: string | null;
  updatedAt: string;
  preparing: boolean;
  // Quando esce, se è nel piano.
  scheduledFor: { date: string; time: string } | null;
}

export interface ContentResponse {
  content: Content;
  // La sua uscita nel piano, se c'è.
  slot: SlotView | null;
  // Il lavoro che sta preparando o ritoccando il contenuto, se c'è.
  jobId: string | null;
  // I canali del brand: tra questi si aggiungono canali al contenuto.
  brandChannels: ChannelId[];
}

export interface ContentEditRequest {
  instruction: string;
}

// Programmare un contenuto: crea la sua uscita o sposta quella che ha.
export interface ContentScheduleRequest {
  date: string;
  time: string;
}

// Il testo di un canale corretto a mano.
export interface ContentVariantRequest {
  text: string;
  hashtags: string[];
}

// Un canale in più: testo e immagini li prepara un job, tranne nel copione di un video, dove si aggiunge e basta.
export interface ContentChannelRequest {
  channel: ChannelId;
}

// Il copione di un video, come lo corregge l'utente prima di generare il video.
export interface ContentScriptRequest {
  script: string;
  scenes: VideoScene[];
}

// L'idea da cui nasce il contenuto, con il nome del tema invece dell'id.
export interface ContentIdea {
  title: string;
  angleLabel: string;
  angle: string;
  rationale: string;
  theme: string | null;
}

// Per un video il job content scrive solo il copione; il video lo fa content-video quando il copione è approvato.
export interface ContentJobInput {
  brandId: string;
  contentId: string;
  format: ContentFormat;
  channels: ChannelId[];
  brand: BrandContext;
  idea: ContentIdea;
}

// scriptOnly: un video di cui c'è solo il copione, quindi si ritocca il copione.
export interface ContentEditJobInput {
  brandId: string;
  contentId: string;
  sessionId: string;
  format: ContentFormat;
  channels: ChannelId[];
  instruction: string;
  scriptOnly: boolean;
}

// Il video dal copione approvato, com'è sul DB dopo le correzioni dell'utente.
export interface ContentVideoJobInput {
  brandId: string;
  contentId: string;
  sessionId: string;
  format: 'video';
  channels: ChannelId[];
  script: string;
  scenes: VideoScene[];
}

// La chat: tante conversazioni per brand, ognuna una sessione di Claude nella cartella del brand.
// Ogni messaggio è un turno, cioè un job chat che riprende la sessione del turno prima.

export interface ConversationSummary {
  id: string;
  brandId: string;
  title: string;
  updatedAt: string;
  // Un turno in coda o in corso.
  busy: boolean;
}

// La risposta finale di Claude al turno; il resto (testi intermedi e tool) sta negli step del job.
export interface ChatReply {
  text: string;
}

// Una foto o un video allegato a un messaggio: il percorso nella cartella del brand e il link firmato.
// Un video è sempre un MP4, con il link alla sua copertina.
export interface ChatAttachment {
  file: string;
  url: string;
  poster?: string;
}

export interface ChatAttachmentUpload {
  dataUri: string;
}

export interface ConversationTurn {
  id: string;
  message: string;
  attachments: ChatAttachment[];
  // L'idea e l'uscita del piano menzionate nel messaggio, se ci sono.
  idea: { id: string; title: string } | null;
  slot: Pick<ChatSlot, 'id' | 'date' | 'time' | 'channels'> | null;
  createdAt: string;
  job: AiJob<ChatReply>;
  // I contenuti che l'assistente ha proposto di pubblicare in questo turno: sotto la risposta, il pulsante per farlo.
  publishRequests: string[];
}

// Un contenuto proposto per la pubblicazione, con com'è andata canale per canale (vuoto finché non si pubblica).
export interface PublishProposal {
  content: Content;
  publications: Publication[];
}

export interface ConversationResponse {
  conversation: ConversationSummary;
  turns: ConversationTurn[];
  // I contenuti nati in questa conversazione, completi: la chat li mostra interi, con i link alle immagini.
  contents: Content[];
  // I contenuti proposti per la pubblicazione nei turni, anche se nati altrove.
  proposals: PublishProposal[];
}

// La dettatura: il testo di quello che si è detto al microfono, da rileggere nella casella.
export interface TranscriptionResponse {
  text: string;
}

// Il collegamento di un canale, con Zernio. redirectUrl: la pagina dove torna il browser dopo l'accesso al social;
// Zernio ci aggiunge connected, accountId e username, o error ed error_message.
export interface ConnectChannelRequest {
  redirectUrl: string;
}

// La pagina di accesso del social, dove mandare il browser.
export interface ConnectChannelResponse {
  authUrl: string;
}

// Al ritorno: l'account che Zernio ha passato nella redirezione. Il server lo verifica prima di salvarlo.
export interface ConfirmChannelRequest {
  accountId: string;
}

// Facebook, LinkedIn e Pinterest chiedono dove pubblicare (una Pagina, il profilo o una pagina aziendale, la bacheca): la
// scelta la fa studio, al posto della pagina di Zernio. Al ritorno l'indirizzo porta step (select_page, select_organization
// o select_board) e questi dati, che servono a elencare le scelte e a completare il collegamento. userProfile e
// organizations arrivano come JSON codificato nell'indirizzo: si passano così come sono.
export interface ChannelChoicesRequest {
  tempToken: string;
  connectToken: string;
  userProfile: string;
  organizations?: string;
}

export interface ChannelChoice {
  id: string;
  name: string;
  // Cosa è: «Profilo personale», «Pagina aziendale», la categoria della Pagina…
  detail: string;
  picture: string | null;
}

export interface ChannelChoicesResponse {
  choices: ChannelChoice[];
}

export interface SelectChannelRequest extends ChannelChoicesRequest {
  choiceId: string;
}

// Il canale com'è dopo il collegamento o lo scollegamento.
// Se l'ambiente permette il collegamento finto dei canali (solo fuori produzione).
export interface SocialSimulationResponse {
  enabled: boolean;
}

export interface ChannelConnectionResponse {
  channel: ChannelId;
  state: ChannelState;
}

// attachments: i percorsi delle foto già caricate con /attachments; ideaId e slotId: l'idea o l'uscita del piano menzionate.
export interface ChatMessageRequest {
  message: string;
  attachments?: string[];
  ideaId?: string;
  slotId?: string;
}

// L'uscita menzionata in un messaggio, per Claude: quando, dove, con quale tema.
export interface ChatSlot {
  id: string;
  date: string;
  time: string;
  channels: ChannelId[];
  theme: string | null;
}

// L'idea menzionata in un messaggio, per Claude: tutta, con il nome del tema.
export interface ChatIdea extends ContentIdea {
  id: string;
}

export interface ChatTurnCreated {
  conversationId: string;
  turnId: string;
  jobId: string;
}

export interface ChatJobInput {
  brandId: string;
  conversationId: string;
  // La sessione da riprendere: null al primo turno.
  sessionId: string | null;
  brand: BrandContext;
  message: string;
  attachments: string[];
  idea: ChatIdea | null;
  slot: ChatSlot | null;
}

// L'API che i tool della chat chiamano con il token del job: agisce solo sul brand del job.

export interface AgentContentRequest {
  // L'uscita del piano in cui esce il contenuto, se l'utente l'ha chiesto per quella.
  slotId?: string;
  title: string;
  format: ContentFormat;
  channels: ChannelId[];
  variants: ChannelVariant[];
  headline: string;
  slides: CarouselSlide[];
  // Solo nei video: l'idea in breve e le inquadrature del copione.
  script?: string;
  scenes?: VideoScene[];
  // L'impaginazione in una frase (vedi ContentVisual.layout).
  layout?: string;
  // Le immagini e i video finali, ovunque siano nella cartella del brand: l'API li copia in quella del contenuto.
  // channel solo per i file fatti apposta per un canale (vedi ContentFile.channel).
  files: { file: string; role: ContentFile['role']; index: number; aspect: string; channel?: ChannelId }[];
}

export interface AgentContentSaved {
  id: string;
  title: string;
  files: string[];
}

// La pubblicazione proposta dalla chat: esce solo quando l'utente preme il pulsante sotto la risposta.
export interface AgentPublishRequested {
  id: string;
  title: string;
  channels: ChannelId[];
}

export interface AgentIdeaRequest {
  title: string;
  angleLabel: string;
  angle: string;
  rationale: string;
  themeId: string | null;
}

export interface ApiErrorBody {
  status: number;
  code: string;
  message: string;
}

export const PASSWORD_MIN = 8;
export const REFRESH_COOKIE = 'mb_refresh';

// Il piano: le uscite di un periodo, con quello che hanno, e quello che si può ancora mettere in calendario.

// Un'uscita come la mostra il piano: con l'idea e il contenuto che ha, e lo stato che ne segue.
export interface SlotView extends PlanSlot {
  idea: { id: string; title: string } | null;
  content: ContentSummary | null;
  // Com'è andata l'uscita sui social, canale per canale: vuoto finché non è l'ora.
  publications: Publication[];
}

export interface PlanResponse {
  // Le uscite tra from e to, in ordine di data e ora.
  slots: SlotView[];
  // I contenuti che non hanno un'uscita: si trascinano sul calendario.
  unscheduled: ContentSummary[];
  // Le idee tenute che non sono ancora nel piano.
  ideas: Idea[];
  themes: { id: string; name: string; color: string; weight: number }[];
  channels: ChannelId[];
  postsPerWeek: number;
  // Oggi, a Roma.
  today: string;
}

export type PlanProposalRequest = PlanRequest;

export interface PlanProposal {
  drafts: SlotDraft[];
}

export interface PlanConfirmRequest {
  drafts: SlotDraft[];
}

// Un'uscita nuova: vuota (con il tema), con un'idea o con un contenuto già fatto. Senza canali, quelli dell'idea o del contenuto.
export interface SlotCreateRequest {
  date: string;
  time: string;
  channels?: ChannelId[];
  themeId?: string | null;
  ideaId?: string | null;
  contentId?: string | null;
}

// Spostare un'uscita o cambiarne canali, tema e idea. I canali di un'uscita con il contenuto sono quelli del contenuto.
export interface SlotPatchRequest {
  date?: string;
  time?: string;
  channels?: ChannelId[];
  themeId?: string | null;
  ideaId?: string | null;
}

// Aggiungere un'idea al piano: la prima uscita vuota del suo tema, altrimenti il primo giorno buono libero.
export interface PlanIdeaRequest {
  ideaId: string;
}

// Il benvenuto della chat: i saluti e gli spunti di oggi per il brand, vuoti se non sono ancora pronti.
// jobId: il job che li sta scrivendo, da seguire per mostrarli appena arrivano.
export interface WelcomeResponse {
  greetings: Greeting[];
  suggestions: WelcomeSuggestion[];
  jobId: string | null;
}

// Quello che succede nel brand, contato dall'API: gli spunti nascono da qui e dal piano del BrandContext.
export interface WelcomeSignals {
  // Le ricorrenze e le date del brand da oggi alla settimana prossima.
  occasions: Occasion[];
  milestones: { label: string; date: string; anniversary: boolean }[];
  // Le uscite di questa settimana (da lunedì a domenica) con qualcosa dentro, e quante ne chiede il ritmo del brand.
  week: { planned: number; target: number };
  // L'ultima uscita già pubblicata, se c'è.
  lastPublished: string | null;
  // Le bozze non ancora approvate e le idee tenute ma non ancora nel piano né in un contenuto, le più recenti.
  drafts: { title: string; updatedAt: string }[];
  savedIdeas: string[];
  // I titoli delle ultime conversazioni con l'assistente.
  recentChats: string[];
}

// day: il giorno (a Roma) per cui valgono; fingerprint: lo stato del brand da cui nascono, per sapere quando rifarli.
export interface WelcomeJobInput {
  brandId: string;
  day: string;
  fingerprint: string;
  // Il nome di chi usa l'app, com'è nell'account.
  name: string;
  brand: BrandContext;
  signals: WelcomeSignals;
}

// I crediti del mese: ogni interazione costa quanto è costata davvero, 1 credito per centesimo di dollaro, e si
// scala dai crediti del piano. Piani e crediti sono di un brand: ognuno ha i suoi. Per ora si contano soltanto: finiti i
// crediti non si blocca niente.
export interface CreditsResponse {
  plan: SubscriptionPlanId;
  // Quelli del piano più quelli aggiunti nel mese dall'admin.
  monthlyCredits: number;
  // Consumati dal primo del mese (a Roma); remaining può andare sotto zero.
  usedThisMonth: number;
  remaining: number;
  // Il giorno in cui i crediti si rinnovano, YYYY-MM-DD.
  renewsOn: string;
  // L'abbonamento pagato del brand, su Dodo Payments; null se il piano non è ancora attivato.
  subscription: BrandSubscription | null;
  // Perché i lavori a pagamento del brand non partono: senza piano attivo o senza crediti; null se partono.
  blocked: SpendBlock | null;
}

export type SpendBlock = 'PLAN_REQUIRED' | 'NO_CREDITS';

// Gli stati di Dodo Payments: pending è appena nato (pagamento in corso); past_due e on_hold sono un rinnovo non pagato
// (con o senza periodo di grazia), che riparte quando il cliente cambia la carta; cancelled, expired e failed sono finiti.
export type SubscriptionStatus = 'pending' | 'active' | 'past_due' | 'on_hold' | 'paused' | 'cancelled' | 'failed' | 'expired';

export interface BrandSubscription {
  plan: SubscriptionPlanId;
  status: SubscriptionStatus;
  // Fine del periodo pagato, ISO.
  periodEnd: string | null;
  // La disdetta programmata: l'abbonamento resta attivo fino a questa data, ISO.
  cancelsAt: string | null;
  // In omaggio: non è un abbonamento su Dodo Payments ma il piano Ultra regalato all'utenza; niente portale né cambi.
  free?: boolean;
}

// plan: il piano da attivare su un brand che non ha ancora l'abbonamento; topup: una ricarica da 1.000 crediti.
export interface CheckoutRequest {
  brandId: string;
  kind: 'plan' | 'topup';
  plan?: SubscriptionPlanId;
}

// La pagina di pagamento di Dodo Payments, dove lo studio manda il browser; si torna su /abbonamento.
export interface CheckoutResponse {
  url: string;
}

// Il cambio di piano prima di confermarlo. Importi in centesimi nella valuta dell'abbonamento: oggi tasse comprese (0
// scendendo di piano) e il prezzo del piano nuovo a ogni rinnovo, tasse escluse, con la data del prossimo rinnovo (ISO).
export interface PlanPreviewResponse {
  upgrade: boolean;
  currency: string;
  today: number;
  next: number;
  nextAt: string;
}

export interface BillingPortalResponse {
  url: string;
}

// Come si sono consumati i crediti di un brand in un mese, attività per attività: chi usa moonbrand deve poterlo
// sapere. Le voci dicono il tipo di lavoro, mai il servizio o il modello che l'ha fatto.
export type CreditCategory =
  | 'assistant'
  | 'image'
  | 'clip'
  | 'music'
  | 'voice'
  | 'sound'
  | 'subtitles'
  | 'check'
  | 'export'
  | 'download'
  | 'dictation'
  | 'other';

// Da dove è partita l'attività: una richiesta in chat, un contenuto, le idee, l'impostazione del brand…
export type CreditActivityKind = 'chat' | 'content' | 'ideas' | 'brand' | 'welcome' | 'dictation' | 'other';

export interface CreditPart {
  category: CreditCategory;
  // Crediti con due decimali: un controllo vale una frazione di credito.
  credits: number;
  // Quante generazioni di quel tipo; per l'assistente quante volte ha lavorato.
  count: number;
  // I secondi generati o ascoltati, per clip, musica, voce e dettatura.
  seconds?: number;
}

export interface CreditActivity {
  id: string;
  // Quando è partita, ISO.
  at: string;
  kind: CreditActivityKind;
  // Il titolo della conversazione o del contenuto, se c'è.
  title: string | null;
  // La richiesta che ha fatto partire il lavoro, accorciata.
  request: string | null;
  credits: number;
  parts: CreditPart[];
}

export interface CreditUsageResponse {
  // Il mese mostrato, YYYY-MM (a Roma), e quelli con dei consumi, dal più recente; il mese in corso c'è sempre.
  month: string;
  months: string[];
  used: number;
  categories: { category: CreditCategory; credits: number }[];
  activities: CreditActivity[];
}

// La sezione admin dello studio (/admin): solo per le email di ADMIN_EMAILS. I costi sono in dollari, quelli veri:
// claude dai job (ai_jobs.cost_usd), generations dai servizi (ai_usage: clip, immagini, musica, controlli, export).
export interface AdminCost {
  claude: number;
  generations: number;
}

export interface AdminOverview {
  accounts: { total: number; newToday: number; new7d: number; active7d: number };
  brands: number;
  contents: { total: number; new7d: number };
  published: number;
  jobs: { queued: number; running: number; failed24h: number; done24h: number };
  cost: { today: AdminCost; days7: AdminCost; days30: AdminCost };
  // Gli ultimi 30 giorni a Roma, dal più vecchio: YYYY-MM-DD.
  daily: ({ date: string } & AdminCost)[];
  // I servizi degli ultimi 30 giorni, dal più caro.
  byTask: { task: string; model: string; count: number; usd: number }[];
  failures: AdminJob[];
}

export interface AdminAccount {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmed: boolean;
  brands: number;
  contents: number;
  jobs: number;
  // L'ultimo lavoro partito, ISO.
  lastActivityAt: string | null;
  cost: AdminCost;
  creditsMonth: number;
}

export interface AdminJob {
  id: string;
  kind: string;
  status: 'queued' | 'running' | 'done' | 'failed' | 'stopped';
  accountId: string;
  email: string;
  brandName: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  // Secondi dall'inizio alla fine (o a adesso, se gira); in coda: da quanto aspetta.
  seconds: number | null;
  cost: AdminCost;
  error: string | null;
  // La richiesta in chat, se il lavoro viene da lì.
  request: string | null;
}

export interface AdminAccountDetail {
  account: AdminAccount;
  brands: { id: string; name: string; category: string | null; plan: string; createdAt: string; creditsMonth: number; cost: AdminCost }[];
  conversations: { id: string; brandName: string | null; title: string; createdAt: string; turns: number; lastTurnAt: string | null }[];
  contents: (ContentSummary & { brandName: string | null; videoUrl: string | null })[];
  jobs: AdminJob[];
}

export interface AdminJobsResponse {
  active: AdminJob[];
  failed: AdminJob[];
  slowest: AdminJob[];
}

// Tutti i contenuti fatti, per la galleria admin. cost: i lavori sul contenuto più quelli della conversazione da cui è
// nato (che può averne fatti altri).
export interface AdminContent extends ContentSummary {
  brandId: string;
  brandName: string | null;
  accountId: string;
  email: string;
  createdAt: string;
  videoUrl: string | null;
  cost: AdminCost;
  // Lo stesso costo per voce (Claude, clip, immagini...), dalla più cara.
  parts: AdminCostPart[];
}

export interface AdminCostPart {
  category: CreditCategory;
  usd: number;
}

export interface AdminContentsResponse {
  items: AdminContent[];
  total: number;
  brands: { id: string; name: string; email: string }[];
}

export interface AdminCosts {
  // Ultimi 30 giorni, per tipo di lavoro.
  byKind: { kind: string; jobs: number; avgUsd: number; avgSeconds: number; totalUsd: number }[];
  // Ultimi 30 giorni, per formato: il costo medio di un contenuto (vedi AdminContent.cost).
  // parts: il costo medio per voce.
  byFormat: { format: string; contents: number; avgUsd: number; maxUsd: number; parts: AdminCostPart[] }[];
  // Questo mese, per piano: quanti brand, quanto consumano in media rispetto ai crediti del piano.
  plans: { plan: string; name: string; monthlyCredits: number; brands: number; avgUsed: number; maxUsed: number; over: number }[];
  // Questo mese, i brand che costano di più.
  topBrands: { brandId: string; name: string; accountId: string; email: string; plan: string; used: number; usd: number }[];
}

// Quanto si è speso in un mese (a Roma) per voce, con le voci dei crediti: Claude (la parte dei job e le sue chiamate
// dirette) è «assistant». Diviso tra la parte addebitata ai clienti e quella dei lavori gratuiti (ai_jobs.free).
export interface AdminSpending {
  // Il mese mostrato, YYYY-MM, e quelli con dei costi, dal più recente; il mese in corso c'è sempre.
  month: string;
  months: string[];
  paidUsd: number;
  freeUsd: number;
  categories: {
    category: CreditCategory;
    paidUsd: number;
    freeUsd: number;
    // Le generazioni di quel tipo; per Claude i lavori e le chiamate dirette.
    count: number;
    // I secondi generati, per clip, musica, voce e dettatura.
    seconds: number | null;
    // Da quali task di ai_usage viene la voce («job» per la parte di Claude dei lavori), dal più caro.
    tasks: { task: string; usd: number }[];
  }[];
}

// I lavori gratuiti di un mese (onboarding e saluti del mattino): li paga moonbrand, ai clienti non scalano crediti.
export interface AdminFreeJobs {
  month: string;
  months: string[];
  totalUsd: number;
  byKind: { kind: string; jobs: number; usd: number }[];
  byCategory: AdminCostPart[];
  // I più recenti, al massimo 300.
  jobs: (AdminJob & { parts: AdminCostPart[] })[];
}

export interface AdminHealth {
  // L'ultimo lavoro partito e finito: se è passato tanto con lavori in coda, il worker è fermo.
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  oldestQueuedSeconds: number | null;
  // In corso da più di 30 minuti, o con il lease scaduto.
  stuck: AdminJob[];
  lostChannels: { brandId: string; brandName: string; accountId: string; email: string; channel: string }[];
  failedPublications: { id: string; brandName: string; email: string; channel: string; error: string | null; at: string }[];
  // Clip e altre generazioni finite in errore, ultimi 7 giorni.
  failedGenerations: { at: string; task: string; model: string; seconds: number | null; error: string | null; email: string | null }[];
}

// Dove è andato il tempo di un lavoro, dalla sessione di Claude Code: il modello che pensa e gli strumenti che aspetta.
// Gli strumenti in parallelo si sovrappongono: la somma dei loro secondi può superare la durata.
export interface AdminJobTimeline {
  job: AdminJob;
  // false: la sessione non c'è (lavoro senza Claude Code, o non ancora copiata sullo storage).
  available: boolean;
  modelSeconds: number;
  tools: { name: string; calls: number; seconds: number; maxSeconds: number }[];
  steps: { at: string; seconds: number; tool: string; detail: string }[];
}

// La sezione Prompt: cosa leggono Claude e Gemini in ogni punto in cui moonbrand li chiama, preso dal codice del worker
// che gira (sola lettura). Nei testi le parti tra ${…} si riempiono a ogni lavoro.
export interface AdminPromptPiece {
  // system: prompt di sistema; message: il messaggio del lavoro; brand: quello che si legge del brand; check: le domande
  // fisse ai controlli; external: un pezzo che non è nel nostro codice (text lo descrive).
  kind: 'system' | 'message' | 'brand' | 'check' | 'external';
  label: string;
  // Dove sta, es. src/jobs/chat.ts · guide.
  source: string;
  // null: nel codice non si trova più (il catalogo dell'API va aggiornato).
  text: string | null;
  words: number;
}

export interface AdminPromptEntry {
  id: string;
  name: string;
  // Cosa lo fa partire, detto per l'admin.
  trigger: string;
  model: string;
  // Le skill di moonbrand che può caricare e i gruppi di strumenti che vede.
  skills: string[];
  tools: string[];
  note: string | null;
  pieces: AdminPromptPiece[];
}

export interface AdminPromptTool {
  file: string;
  name: string;
  description: string;
}

export interface AdminPromptFile {
  path: string;
  words: number;
}

export interface AdminPrompts {
  entries: AdminPromptEntry[];
  tools: AdminPromptTool[];
  // Le skill e le guide dei template (plugin/): il testo si chiede a parte, uno alla volta.
  files: AdminPromptFile[];
  // I file del worker che chiamano Claude o Gemini e che il catalogo non descrive ancora.
  uncatalogued: string[];
  brands: { id: string; name: string; email: string }[];
}

export interface AdminPromptFileText {
  path: string;
  text: string;
}

export interface AdminBrandPrompts {
  // Il CLAUDE.md scritto per l'ultimo lavoro del brand; null se il brand non ha ancora lavorato.
  guide: string | null;
  // La memoria che Claude Code si è scritto da solo per questo brand.
  memory: { name: string; text: string }[];
}

export interface AdminCreateAccountRequest {
  email: string;
  name: string;
  password: string;
}

export interface AdminAddCreditsRequest {
  amount: number;
}

// L'header con cui un admin guarda lo studio come un'altra utenza, in sola lettura.
export const VIEW_AS_HEADER = 'x-moonbrand-view-as';
