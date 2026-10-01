import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import type { ChannelId } from '@moonbrand/shared/domain/brand';

import { Icon } from '../../../ui/icon';
import { FOLD } from '../../contents/labels';

const HASHTAG = /(#[\p{L}\p{N}_]+)/u;

export interface ExampleAuthor {
  name: string;
  handle: string;
  logo: string | null;
  initial: string;
  color: string;
  person: boolean;
}

// Un esempio dell'onboarding come si vedrebbe sul suo canale: nella stessa cornice dell'anteprima dei contenuti,
// con il testo piegato a «…altro». Su TikTok la copertina porta il segno del play: il video vero si fa dopo.
@Component({
  selector: 'mb-example-post',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, NgTemplateOutlet],
  templateUrl: './example-post.html',
  styleUrl: './example-post.scss',
})
export class ExamplePost {
  readonly channel = input.required<ChannelId>();
  readonly url = input.required<string>();
  readonly text = input.required<string>();
  readonly author = input.required<ExampleAuthor>();
  readonly label = input.required<string>();
  readonly zoom = output<void>();

  protected readonly expanded = signal(false);

  protected readonly caption = computed(() => {
    const full = this.text();
    const fold = FOLD[this.channel()];
    const parts = (text: string) => text.split(HASHTAG).map((part, index) => ({ text: part, tag: index % 2 === 1 }));
    if (this.expanded() || fold === null || full.length <= fold + 20) return { parts: parts(full), folded: false };
    const cut = full.slice(0, fold);
    return { parts: parts(cut.slice(0, Math.max(cut.lastIndexOf(' '), fold / 2)).replace(/[\s.,;:!?]+$/, '')), folded: true };
  });
}
