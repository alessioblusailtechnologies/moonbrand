import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type {
  ChatAttachment,
  ChatAttachmentUpload,
  ChatMessageRequest,
  ChatTurnCreated,
  ConversationResponse,
  ConversationSummary,
} from '@moonbrand/shared/api/contract';

import { BrandsService } from '../brands/brands.service';

// Le conversazioni con l'assistente: ogni messaggio mette in coda un turno, che si segue con AiJobsService.follow.
// L'elenco del brand attivo sta qui: lo mostra la sidebar e lo aggiorna la pagina della chat.
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly brands = inject(BrandsService);

  readonly conversations = signal<ConversationSummary[]>([]);

  constructor() {
    effect(() => {
      const brand = this.brands.activeBrand();
      this.conversations.set([]);
      if (brand) untracked(() => void this.refresh());
    });
  }

  async refresh(): Promise<void> {
    const brand = this.brands.activeBrand();
    if (!brand) return;
    try {
      const list = await firstValueFrom(this.http.get<ConversationSummary[]>(`/v1/brands/${brand.id}/conversations`));
      if (this.brands.activeBrand()?.id === brand.id) this.conversations.set(list);
    } catch {
      // L'elenco resta quello di prima: si riprova al prossimo aggiornamento.
    }
  }

  start(brandId: string, request: ChatMessageRequest): Promise<ChatTurnCreated> {
    return firstValueFrom(this.http.post<ChatTurnCreated>(`/v1/brands/${brandId}/conversations`, request));
  }

  get(conversationId: string): Promise<ConversationResponse> {
    return firstValueFrom(this.http.get<ConversationResponse>(`/v1/conversations/${conversationId}`));
  }

  send(conversationId: string, request: ChatMessageRequest): Promise<ChatTurnCreated> {
    return firstValueFrom(this.http.post<ChatTurnCreated>(`/v1/conversations/${conversationId}/messages`, request));
  }

  async stop(conversationId: string): Promise<void> {
    await firstValueFrom(this.http.post(`/v1/conversations/${conversationId}/stop`, {}));
  }

  upload(brandId: string, dataUri: string): Promise<ChatAttachment> {
    return firstValueFrom(
      this.http.post<ChatAttachment>(`/v1/brands/${brandId}/attachments`, { dataUri } satisfies ChatAttachmentUpload),
    );
  }

  async remove(conversationId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`/v1/conversations/${conversationId}`));
    this.conversations.update((list) => list.filter((item) => item.id !== conversationId));
  }
}
