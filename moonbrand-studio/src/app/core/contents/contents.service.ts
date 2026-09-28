import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type {
  ContentCreated,
  ContentEditRequest,
  ContentPhotosRequest,
  ContentPhotoUploadResponse,
  ContentResponse,
  ContentSummary,
  CreateContentRequest,
} from '@moonbrand/shared/api/contract';
import type { Content } from '@moonbrand/shared/domain/content';

@Injectable({ providedIn: 'root' })
export class ContentsService {
  private readonly http = inject(HttpClient);

  // Crea la bozza dall'idea (e salva l'idea): il lavoro che la scrive si segue con AiJobsService.follow.
  create(ideaId: string, request: CreateContentRequest): Promise<ContentCreated> {
    return firstValueFrom(this.http.post<ContentCreated>(`/v1/ideas/${ideaId}/content`, request));
  }

  list(brandId: string): Promise<ContentSummary[]> {
    return firstValueFrom(this.http.get<ContentSummary[]>(`/v1/brands/${brandId}/contents`));
  }

  get(contentId: string): Promise<ContentResponse> {
    return firstValueFrom(this.http.get<ContentResponse>(`/v1/contents/${contentId}`));
  }

  edit(contentId: string, instruction: string): Promise<{ jobId: string }> {
    return firstValueFrom(this.http.post<{ jobId: string }>(`/v1/contents/${contentId}/edit`, { instruction } satisfies ContentEditRequest));
  }

  regenerate(contentId: string): Promise<{ jobId: string }> {
    return firstValueFrom(this.http.post<{ jobId: string }>(`/v1/contents/${contentId}/regenerate`, {}));
  }

  uploadPhoto(contentId: string, dataUri: string): Promise<ContentPhotoUploadResponse> {
    return firstValueFrom(this.http.post<ContentPhotoUploadResponse>(`/v1/contents/${contentId}/photos`, { dataUri }));
  }

  // Riempie tutti insieme gli slot scelti: il lavoro si segue con AiJobsService.follow.
  fillPhotos(contentId: string, slots: ContentPhotosRequest['slots']): Promise<{ jobId: string }> {
    return firstValueFrom(this.http.post<{ jobId: string }>(`/v1/contents/${contentId}/photos/fill`, { slots } satisfies ContentPhotosRequest));
  }

  setApproved(contentId: string, approved: boolean): Promise<Content> {
    return firstValueFrom(this.http.post<Content>(`/v1/contents/${contentId}/${approved ? 'approve' : 'reopen'}`, {}));
  }
}
