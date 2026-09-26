import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { OnAiSteps, WebsiteInsights } from '@moonbrand/shared/ai/steps';
import type {
  AiJob,
  AiJobCreated,
  VisualEditJobRequest,
  VisualExampleFile,
  VisualJobRequest,
  VisualReading,
  WebsiteJobRequest,
  WebsiteReading,
} from '@moonbrand/shared/api/contract';
import type { Palette } from '@moonbrand/shared/domain/brand';
import { normalizeSite } from '@moonbrand/shared/lib/site';

const POLL_MS = 1000;

@Injectable({ providedIn: 'root' })
export class AiJobsService {
  private readonly http = inject(HttpClient);

  async readWebsite(site: string, onSteps?: OnAiSteps): Promise<WebsiteInsights> {
    const host = normalizeSite(site);
    const reading = await this.run<WebsiteReading>('/v1/ai/website', { site } satisfies WebsiteJobRequest, onSteps);
    return {
      site: host,
      name: reading.name,
      sector: reading.sector,
      summary: reading.summary,
      pitch: reading.pitch,
      themes: reading.themes,
      goals: reading.goals,
      audiences: reading.audiences,
      palette: { id: `site-${host}`, name: 'Dal sito', colors: reading.colors as Palette['colors'], origin: 'site' },
    };
  }

  // Si tiene l'id del job: una modifica successiva riprende la sua sessione.
  async createExamples(request: VisualJobRequest, onSteps?: OnAiSteps): Promise<{ jobId: string; examples: VisualExampleFile[] }> {
    const { id, result } = await this.runJob<VisualReading>('/v1/ai/visual', request, onSteps);
    return { jobId: id, examples: result.examples };
  }

  async editExamples(request: VisualEditJobRequest, onSteps?: OnAiSteps): Promise<{ jobId: string; examples: VisualExampleFile[] }> {
    const { id, result } = await this.runJob<VisualReading>('/v1/ai/visual/edit', request, onSteps);
    return { jobId: id, examples: result.examples };
  }

  private async run<Result>(url: string, body: unknown, onSteps?: OnAiSteps): Promise<Result> {
    return (await this.runJob<Result>(url, body, onSteps)).result;
  }

  private async runJob<Result>(url: string, body: unknown, onSteps?: OnAiSteps): Promise<{ id: string; result: Result }> {
    const { id } = await firstValueFrom(this.http.post<AiJobCreated>(url, body));
    return { id, result: await this.follow<Result>(id, onSteps) };
  }

  // Segue un lavoro già in coda fino al risultato, passando gli step man mano.
  async follow<Result>(jobId: string, onSteps?: OnAiSteps): Promise<Result> {
    for (;;) {
      const job = await firstValueFrom(this.http.get<AiJob<Result>>(`/v1/ai/jobs/${jobId}`));
      onSteps?.(job.steps);
      if (job.status === 'done' && job.result) return job.result;
      if (job.status === 'failed' || job.status === 'done') throw new Error(job.error ?? 'Lavoro AI senza risultato.');
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
  }
}
