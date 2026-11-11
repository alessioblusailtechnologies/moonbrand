import type { PublishProposal } from '@moonbrand/shared/api/contract';
import type { Artifact, ArtifactKind } from '@moonbrand/shared/domain/artifact';
import type { Content } from '@moonbrand/shared/domain/content';

// Quello che il pannello a destra della chat mostra: un contenuto salvato (con la sua proposta di pubblicazione, se c'è)
// o un file nato nella conversazione, con tutte le sue versioni. L'id va nel link (?artefatto=): content-<id> per i
// contenuti, l'id dell'artefatto per i file.
export type PanelItem =
  | { id: string; kind: 'content'; title: string; createdAt: string; content: Content; proposal: PublishProposal | null; thumb: string | null }
  | { id: string; kind: ArtifactKind; title: string; createdAt: string; artifact: Artifact; versions: Artifact[]; thumb: string | null };

export type PanelKind = PanelItem['kind'];

export const contentItemId = (contentId: string) => `content-${contentId}`;

function contentItem(content: Content, proposal: PublishProposal | null): PanelItem {
  return {
    id: contentItemId(content.id),
    kind: 'content',
    title: content.title,
    createdAt: content.createdAt,
    content,
    proposal,
    thumb: content.visual.files?.find((file) => file.index === 0 && file.role !== 'video')?.url ?? null,
  };
}

// Le versioni di un file sono gli artefatti con lo stesso percorso nella cartella del brand, dal primo all'ultimo.
export function artifactItems(artifacts: readonly Artifact[]): PanelItem[] {
  const bySource = new Map<string, Artifact[]>();
  for (const artifact of artifacts) bySource.set(artifact.source, [...(bySource.get(artifact.source) ?? []), artifact]);
  return artifacts.map((artifact) => ({
    id: artifact.id,
    kind: artifact.kind,
    title: artifact.title,
    createdAt: artifact.createdAt,
    artifact,
    versions: bySource.get(artifact.source) ?? [artifact],
    thumb: artifact.kind === 'image' ? (artifact.files[0]?.url ?? null) : null,
  }));
}

// Tutto quello che è nato nella conversazione, in ordine di arrivo: i contenuti salvati, quelli proposti per la
// pubblicazione (anche se nati altrove) e i file.
export function panelItems(contents: readonly Content[], proposals: readonly PublishProposal[], artifacts: readonly Artifact[]): PanelItem[] {
  const proposed = new Map(proposals.map((proposal) => [proposal.content.id, proposal]));
  const items = [
    ...contents.map((content) => contentItem(proposed.get(content.id)?.content ?? content, proposed.get(content.id) ?? null)),
    ...proposals.filter((proposal) => !contents.some((content) => content.id === proposal.content.id)).map((proposal) => contentItem(proposal.content, proposal)),
    ...artifactItems(artifacts),
  ];
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// Nel menu e nel filo di un file si vede solo l'ultima versione: le altre si scelgono nel pannello.
export function latestOnly(items: readonly PanelItem[]): PanelItem[] {
  return items.filter((item) => item.kind === 'content' || item.versions.at(-1)?.id === item.artifact.id);
}

// I gruppi della tendina e del menu del pannello: prima i contenuti (i post), poi i file per tipo; in ogni gruppo il
// più recente in alto.
const GROUP_ORDER: PanelKind[] = ['content', 'image', 'video', 'audio', 'document', 'html'];

export interface PanelGroup {
  kind: PanelKind;
  items: PanelItem[];
}

export function groupItems(items: readonly PanelItem[]): PanelGroup[] {
  return GROUP_ORDER.map((kind) => ({
    kind,
    items: items.filter((item) => item.kind === kind).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  })).filter((group) => group.items.length > 0);
}
