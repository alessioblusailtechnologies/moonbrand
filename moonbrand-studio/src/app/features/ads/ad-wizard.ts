import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked, viewChild, type OnInit } from '@angular/core';

import type { AdsResponse } from '@moonbrand/shared/api/contract';
import {
  AD_BID_STRATEGIES,
  AD_CAMPAIGN_TYPES,
  AD_DEVICES,
  AD_IMAGE_ASPECT,
  AD_IMAGES,
  AD_LIMITS,
  adSteps,
  AGE_RANGES,
  DEMAND_GEN_CHANNELS,
  maxSpend,
  SNIPPET_HEADERS,
  type Ad,
  type AdAudience,
  type AdAudienceRef,
  type AdBidStrategy,
  type AdCampaignType,
  type AdDraft,
  type AdGender,
  type AdGoal,
  type AdImageOption,
  type AdImageRole,
  type AdKeywordIdea,
  type AdLocation,
  type AdSitelink,
  type AdSnippet,
  type AdStep,
  type KeywordMatch,
} from '@moonbrand/shared/domain/ads';
import type { MessageKey } from '@moonbrand/shared/i18n/translate';

import { AdsService } from '../../core/ads/ads.service';
import { AiJobsService } from '../../core/ai/ai-jobs.service';
import { errorMessage } from '../../core/errors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { resizedDataUri } from '../../core/images';
import { ConfirmService } from '../../ui/confirm';
import { Icon } from '../../ui/icon';
import { lockPageScroll } from '../../ui/scroll-lock';
import { StepList } from '../../ui/step-list';
import { ToastService } from '../../ui/toast';
import { Composer } from '../chat/composer';
import { AdImagePicker } from './wizard/image-picker';
import { AdSearchPicker, type PickerItem } from './wizard/search-picker';
import { AdTextList } from './wizard/text-list';
import {
  applyPatch,
  day,
  draftOf,
  formOf,
  keywordsOf,
  newForm,
  problemsOf,
  progressOf,
  textLimits,
  withType,
  youtubeId,
  type Problem,
  type WizardForm,
} from './wizard/wizard-form';

const L = AD_LIMITS;
const LANGUAGES = ['it', 'en', 'fr', 'de', 'es', 'pt', 'nl'];
const AGE_MINS = [18, 25, 35, 45, 55, 65];
const AGE_MAXES = [24, 34, 44, 54, 64];
// Il lato lungo delle immagini caricate: basta per tutti i formati di Google e resta sotto i 3 MB.
const UPLOAD_SIDE = 1920;

// Uno scambio con l'AI in un passaggio: la richiesta e la risposta (null mentre lavora, o se non è andata).
interface Exchange {
  instruction: string;
  reply: string | null;
  failed?: boolean;
  // false: l'AI non ha toccato i campi (di solito una domanda).
  changed?: boolean;
}

// La campagna in una modale a passaggi, per tutti i tipi di Google: rete di ricerca, Display, Performance Max e Demand
// Gen. In ogni passaggio la persona compila i campi o scrive cosa vuole e l'AI li compila (lavoro ad-step del worker).
// Nel primo basta descrivere cosa si promuove: l'AI prepara tutta la bozza. Alla fine si salva la bozza o si avvia, con
// la conferma della spesa massima.
@Component({
  selector: 'mb-ad-wizard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdImagePicker, AdSearchPicker, AdTextList, Composer, Icon, NgTemplateOutlet, StepList, TranslatePipe],
  host: { '(document:keydown.escape)': 'close()' },
  template: `
    <div class="scrim" (click)="close()"></div>
    <div class="dialog" role="dialog" aria-modal="true" [attr.aria-label]="(ad() ? 'ads.wizard.titleEdit' : 'ads.wizard.titleNew') | t">
      <header class="bar">
        <div class="bar-side">
          @if (index() > 0) {
            <button class="icon-btn" type="button" [attr.aria-label]="'ads.wizard.back' | t" [disabled]="busy()" (click)="go(index() - 1)">
              <mb-icon name="chevron-left" />
            </button>
          }
        </div>
        <div class="bar-center">
          <span class="label">{{ 'ads.wizard.stepOf' | t: { n: index() + 1, total: steps().length } }}</span>
          <div class="progress" aria-hidden="true">
            @for (s of steps(); track s; let i = $index) {
              <span [class.on]="i <= index()"></span>
            }
          </div>
        </div>
        <div class="bar-side end">
          <button class="icon-btn" type="button" [attr.aria-label]="'common.close' | t" [disabled]="busy()" (click)="close()">
            <mb-icon name="x" />
          </button>
        </div>
      </header>

      <main class="page">
        @for (key of [step()]; track key) {
          <div class="step">
            <div class="titles">
              <h1 class="title">{{ k('ads.wizard.steps.' + key) | t }}</h1>
              <p class="body">{{ k('ads.wizard.hints.' + key) | t }}</p>
            </div>

            <section class="assistant">
              <mb-composer [label]="'ads.wizard.askLabel' | t" [placeholder]="k('ads.wizard.placeholders.' + key) | t" [media]="false" [busy]="thinking()"
                (submitted)="ask($event.message)" />
              <!-- Come la lettura del sito nell'onboarding: mentre lavora i passaggi, poi l'esito dell'ultima richiesta. -->
              @if (lastExchange(key); as last) {
                @if (last.reply === null) {
                  <div class="panel">
                    <p class="strong-sm">{{ 'ads.wizard.working' | t: { request: last.instruction } }}</p>
                    <mb-step-list [steps]="[]" [waiting]="'ads.wizard.thinking' | t" />
                  </div>
                } @else {
                  <div class="panel">
                    @if (last.failed || last.changed) {
                      <span class="badge" [class.mint]="!last.failed" [class.warn]="last.failed">{{ (last.failed ? 'ads.wizard.notDone' : 'ads.wizard.done') | t }}</span>
                    }
                    <p class="body ink">{{ last.reply }}</p>
                  </div>
                }
              }
            </section>

            @if (form(); as f) {
              @switch (key) {
                @case ('goal') {
                  <div class="stack-sm">
                    <p class="label">{{ 'ads.form.type' | t }}</p>
                    @for (type of types; track type) {
                      <button class="option-card" type="button" role="radio" [attr.aria-checked]="f.type === type" [class.selected]="f.type === type"
                        (click)="setType(type)">
                        <span class="grow">
                          <span class="strong-sm">{{ k('ads.types.' + type + '.name') | t }}</span>
                          <span class="caption">{{ k('ads.types.' + type + '.hint') | t }}</span>
                        </span>
                        <span class="radio-mark" [class.on]="f.type === type"></span>
                      </button>
                    }
                  </div>
                  @if (f.type !== 'pmax') {
                    <div class="stack-sm">
                      <p class="label">{{ 'ads.form.goal' | t }}</p>
                      <div class="segmented">
                        @for (goal of goals; track goal) {
                          <button type="button" [class.selected]="f.goal === goal" (click)="set('goal', goal)">{{ k('ads.goals.' + goal + '.name') | t }}</button>
                        }
                      </div>
                      <span class="caption">{{ k('ads.goals.' + f.goal + '.hint') | t }}</span>
                    </div>
                  }
                  <div class="field">
                    <label for="ad-name">{{ 'ads.form.name' | t }}</label>
                    <input id="ad-name" type="text" [attr.maxlength]="limits.name" [placeholder]="'ads.form.namePlaceholder' | t" [value]="f.name"
                      (input)="set('name', $any($event.target).value)" />
                  </div>
                  <div class="field">
                    <label for="ad-link">{{ 'ads.form.link' | t }}</label>
                    <input id="ad-link" type="url" placeholder="https://" [value]="f.linkUrl" (input)="set('linkUrl', $any($event.target).value)" />
                    <span class="hint">{{ 'ads.form.linkHint' | t }}</span>
                  </div>
                }

                @case ('ad') {
                  <mb-ad-text-list [label]="'ads.form.headlines' | t" [addLabel]="'ads.form.addHeadline' | t"
                    [hint]="'ads.form.headlinesHint' | t: { min: text().headlines.min, max: text().headlines.max, chars: text().headlines.chars }"
                    [items]="f.headlines" [pins]="f.headlinePins" [pinMax]="f.type === 'search' ? 3 : 0" [min]="text().headlines.min"
                    [max]="text().headlines.max" [chars]="text().headlines.chars" (itemsChange)="set('headlines', $event)" (pinsChange)="set('headlinePins', $event)" />
                  @if (f.type !== 'search') {
                    <mb-ad-text-list [label]="'ads.form.longHeadlines' | t" [addLabel]="'ads.form.addLongHeadline' | t"
                      [hint]="'ads.form.longHeadlinesHint' | t: { min: text().longHeadlines.min, max: text().longHeadlines.max, chars: text().longHeadlines.chars }"
                      [items]="f.longHeadlines" [min]="text().longHeadlines.min" [max]="text().longHeadlines.max" [chars]="text().longHeadlines.chars" [multiline]="true"
                      (itemsChange)="set('longHeadlines', $event)" />
                  }
                  <mb-ad-text-list [label]="'ads.form.descriptions' | t" [addLabel]="'ads.form.addDescription' | t"
                    [hint]="'ads.form.descriptionsHint' | t: { min: text().descriptions.min, max: text().descriptions.max, chars: text().descriptions.chars }"
                    [items]="f.descriptions" [pins]="f.descriptionPins" [pinMax]="f.type === 'search' ? 2 : 0" [min]="text().descriptions.min"
                    [max]="text().descriptions.max" [chars]="text().descriptions.chars" [multiline]="true"
                    (itemsChange)="set('descriptions', $event)" (pinsChange)="set('descriptionPins', $event)" />
                  @if (f.type !== 'search') {
                    <div class="field">
                      <label for="ad-business">{{ 'ads.form.businessName' | t }}</label>
                      <div class="field-row">
                        <input id="ad-business" type="text" [attr.maxlength]="limits.businessName" [value]="f.businessName"
                          (input)="set('businessName', $any($event.target).value)" />
                        <span class="count" [class.full]="f.businessName.length >= limits.businessName">{{ f.businessName.length }}/{{ limits.businessName }}</span>
                      </div>
                    </div>
                    <div class="stack-sm">
                      <p class="label">{{ 'ads.form.images' | t }}</p>
                      <span class="caption">{{ 'ads.form.imagesHint' | t }}</span>
                    </div>
                    @for (rule of imageRules(); track rule.role) {
                      <mb-ad-image-picker [label]="k('ads.form.imageRoles.' + rule.role) | t"
                        [hint]="(rule.min ? 'ads.form.imageCountRequired' : 'ads.form.imageCountOptional') | t: { min: rule.min, max: rule.max }"
                        [aspect]="aspects[rule.role]" [options]="images()" [selected]="f.images[rule.role]" [max]="rule.max" [uploading]="uploading() === rule.role"
                        (selectedChange)="setImages(rule.role, $event)" (upload)="upload(rule.role, $event)" />
                    }
                    @if (f.type === 'pmax' || f.type === 'demand_gen') {
                      <div class="field">
                        <label for="ad-youtube">{{ 'ads.form.youtube' | t }}</label>
                        <span class="hint">{{ 'ads.form.youtubeHint' | t: { max: limits.youtube.max } }}</span>
                        @for (id of f.youtube; track id; let i = $index) {
                          <div class="field-row item">
                            <a class="grow link" [href]="'https://youtu.be/' + id" target="_blank" rel="noopener">youtu.be/{{ id }}</a>
                            <button class="icon-btn" type="button" [attr.aria-label]="'ads.form.removeItem' | t" (click)="removeYoutube(i)">
                              <mb-icon name="x" [size]="15" />
                            </button>
                          </div>
                        }
                        @if (f.youtube.length < limits.youtube.max) {
                          <div class="field-row item">
                            <input id="ad-youtube" type="url" [placeholder]="'ads.form.youtubePlaceholder' | t" [value]="youtubeDraft()"
                              (input)="youtubeDraft.set($any($event.target).value)" (keydown.enter)="addYoutube()" />
                            <button class="link-btn" type="button" [disabled]="!youtubeDraft().trim()" (click)="addYoutube()">{{ 'ads.form.addYoutube' | t }}</button>
                          </div>
                        }
                      </div>
                    }
                    @if (f.type === 'demand_gen') {
                      <div class="field">
                        <label for="ad-cta">{{ 'ads.form.callToAction' | t }}</label>
                        <input id="ad-cta" type="text" maxlength="30" [placeholder]="'ads.form.callToActionPlaceholder' | t" [value]="f.callToAction"
                          (input)="set('callToAction', $any($event.target).value)" />
                        <span class="hint">{{ 'ads.form.callToActionHint' | t }}</span>
                      </div>
                      <div class="stack-sm">
                        <p class="label">{{ 'ads.form.carousel' | t }}</p>
                        <span class="caption">{{ 'ads.form.carouselHint' | t: { min: limits.carousel.min, max: limits.carousel.max } }}</span>
                        @for (card of f.carousel; track $index; let i = $index) {
                          <div class="panel card">
                            <div class="row">
                              <span class="strong-sm grow">{{ 'ads.form.card' | t: { n: i + 1 } }}</span>
                              <button class="icon-btn" type="button" [attr.aria-label]="'ads.form.removeItem' | t" (click)="removeCard(i)">
                                <mb-icon name="trash" [size]="15" />
                              </button>
                            </div>
                            <div class="field">
                              <label [attr.for]="'ad-card-' + i">{{ 'ads.form.cardHeadline' | t }}</label>
                              <input [id]="'ad-card-' + i" type="text" [attr.maxlength]="text().headlines.chars" [value]="card.headline"
                                (input)="setCard(i, { headline: $any($event.target).value })" />
                            </div>
                            <mb-ad-image-picker [label]="'ads.form.cardImage' | t" [aspect]="aspects.square" [options]="images()"
                              [selected]="card.image ? [card.image] : []" [max]="1" [uploading]="uploading() === 'card' + i"
                              (selectedChange)="setCard(i, { image: $event[0] ?? '' })" (upload)="upload('card' + i, $event)" />
                          </div>
                        }
                        @if (f.carousel.length < limits.carousel.max) {
                          <button class="link-btn add" type="button" (click)="addCard()"><mb-icon name="plus" [size]="14" /> {{ 'ads.form.addCard' | t }}</button>
                        }
                      </div>
                    }
                  }
                  <ng-container [ngTemplateOutlet]="preview" />
                }

                @case ('keywords') {
                  <div class="field">
                    <label for="ad-keywords">{{ 'ads.form.keywords' | t }}</label>
                    <textarea id="ad-keywords" rows="8" [value]="f.keywords" (input)="set('keywords', $any($event.target).value)"></textarea>
                    <span class="hint">{{ 'ads.form.keywordsHint' | t }}</span>
                  </div>
                  <div class="stack-sm">
                    <p class="label">{{ 'ads.form.match' | t }}</p>
                    <div class="segmented">
                      @for (option of matches; track option) {
                        <button type="button" [class.selected]="f.match === option" (click)="set('match', option)">{{ k('ads.form.matchNames.' + option) | t }}</button>
                      }
                    </div>
                    <span class="caption">{{ k('ads.form.matchHints.' + f.match) | t }}</span>
                  </div>
                  <div class="panel ideas">
                    <div class="row">
                      <div class="grow texts">
                        <span class="strong-sm">{{ 'ads.form.ideas' | t }}</span>
                        <span class="caption">{{ 'ads.form.ideasHint' | t }}</span>
                      </div>
                      <button class="btn btn-secondary btn-sm" type="button" [disabled]="ideasLoading()" (click)="loadIdeas()">
                        @if (ideasLoading()) {
                          <span class="spinner"></span>
                        }
                        {{ (ideas() ? 'ads.form.ideasAgain' : 'ads.form.ideasLoad') | t }}
                      </button>
                    </div>
                    @if (ideasFailed()) {
                      <p class="caption danger">{{ ideasFailed() }}</p>
                    }
                    @if (ideas(); as list) {
                      @for (idea of list; track idea.text) {
                        <div class="idea">
                          <div class="grow texts">
                            <span class="strong-sm">{{ idea.text }}</span>
                            <span class="caption">{{ ideaLine(idea) }}</span>
                          </div>
                          @if (hasKeyword(idea.text)) {
                            <span class="badge mint">{{ 'ads.form.ideaAdded' | t }}</span>
                          } @else {
                            <button class="icon-btn" type="button" [attr.aria-label]="'ads.form.ideaAdd' | t: { text: idea.text }" (click)="addKeyword(idea.text)">
                              <mb-icon name="plus" [size]="16" />
                            </button>
                          }
                        </div>
                      } @empty {
                        <p class="caption">{{ 'ads.form.ideasEmpty' | t }}</p>
                      }
                    }
                  </div>
                  <div class="field">
                    <label for="ad-negatives">{{ 'ads.form.negatives' | t }}</label>
                    <textarea id="ad-negatives" rows="4" [value]="f.negatives" (input)="set('negatives', $any($event.target).value)"></textarea>
                    <span class="hint">{{ 'ads.form.negativesHint' | t }}</span>
                  </div>
                }

                @case ('audience') {
                  <mb-ad-search-picker [label]="'ads.form.locations' | t" [hint]="'ads.form.locationsHint' | t" [placeholder]="'ads.form.locationsPlaceholder' | t"
                    [note]="canLaunch() ? '' : ('ads.form.countriesOnly' | t)" [search]="searchLocations" [selected]="placeItems(f.locations)" (picked)="addPlace('locations', $event)" (removed)="removePlace('locations', $event)" />
                  <mb-ad-search-picker [label]="'ads.form.excluded' | t" [hint]="'ads.form.excludedHint' | t" [placeholder]="'ads.form.locationsPlaceholder' | t"
                    [search]="searchLocations" [selected]="placeItems(f.excludedLocations)" (picked)="addPlace('excludedLocations', $event)"
                    (removed)="removePlace('excludedLocations', $event)" />
                  <div class="stack-sm">
                    <button class="option-card" type="button" role="radio" [attr.aria-checked]="f.presenceOnly" [class.selected]="f.presenceOnly" (click)="set('presenceOnly', true)">
                      <span class="grow">
                        <span class="strong-sm">{{ 'ads.form.presenceOnly' | t }}</span>
                        <span class="caption">{{ 'ads.form.presenceOnlyHint' | t }}</span>
                      </span>
                      <span class="radio-mark" [class.on]="f.presenceOnly"></span>
                    </button>
                    <button class="option-card" type="button" role="radio" [attr.aria-checked]="!f.presenceOnly" [class.selected]="!f.presenceOnly" (click)="set('presenceOnly', false)">
                      <span class="grow">
                        <span class="strong-sm">{{ 'ads.form.presenceInterest' | t }}</span>
                        <span class="caption">{{ 'ads.form.presenceInterestHint' | t }}</span>
                      </span>
                      <span class="radio-mark" [class.on]="!f.presenceOnly"></span>
                    </button>
                  </div>
                  <div class="stack-sm">
                    <p class="label">{{ 'ads.form.languages' | t }}</p>
                    <div class="chips">
                      @for (option of languageOptions(); track option.value) {
                        <button class="chip" type="button" [class.selected]="f.languages.includes(option.value)" [attr.aria-pressed]="f.languages.includes(option.value)"
                          (click)="toggle('languages', option.value)">{{ option.label }}</button>
                      }
                    </div>
                  </div>
                  @if (f.type === 'pmax') {
                    <p class="caption">{{ 'ads.form.pmaxAudience' | t }}</p>
                  } @else {
                    @if (f.type === 'demand_gen') {
                      <div class="stack-sm">
                        <p class="label">{{ 'ads.form.age' | t }}</p>
                        <div class="chips">
                          @for (range of ageRanges; track range.min) {
                            <button class="chip" type="button" [class.selected]="hasRange(range.min)" [attr.aria-pressed]="hasRange(range.min)" (click)="toggleRange(range)">
                              {{ range.max ? range.min + '–' + range.max : range.min + '+' }}
                            </button>
                          }
                        </div>
                        <span class="caption">{{ 'ads.form.ageRangesHint' | t }}</span>
                      </div>
                    } @else {
                      <div class="pair">
                        <div class="field">
                          <label for="ad-age-min">{{ 'ads.form.ageFrom' | t }}</label>
                          <select id="ad-age-min" (change)="set('ageMin', $any($event.target).value ? +$any($event.target).value : null)">
                            <option value="" [selected]="f.ageMin === null">{{ 'ads.form.ageAny' | t }}</option>
                            @for (n of ageMins; track n) {
                              <option [value]="n" [selected]="f.ageMin === n">{{ n }}</option>
                            }
                          </select>
                        </div>
                        <div class="field">
                          <label for="ad-age-max">{{ 'ads.form.ageTo' | t }}</label>
                          <select id="ad-age-max" (change)="set('ageMax', $any($event.target).value ? +$any($event.target).value : null)">
                            <option value="" [selected]="f.ageMax === null">{{ 'ads.form.ageAny' | t }}</option>
                            @for (n of ageMaxes; track n) {
                              <option [value]="n" [selected]="f.ageMax === n" [disabled]="f.ageMin !== null && n < f.ageMin">{{ n }}</option>
                            }
                          </select>
                        </div>
                      </div>
                    }
                    <div class="stack-sm">
                      <p class="label">{{ 'ads.form.gender' | t }}</p>
                      <div class="segmented">
                        <button type="button" [class.selected]="f.genders.length !== 1" (click)="set('genders', [])">{{ 'ads.form.genderAll' | t }}</button>
                        @for (gender of genders; track gender) {
                          <button type="button" [class.selected]="f.genders.length === 1 && f.genders[0] === gender" (click)="set('genders', [gender])">
                            {{ k('ads.form.genderNames.' + gender) | t }}
                          </button>
                        }
                      </div>
                    </div>
                    @if (f.type !== 'demand_gen') {
                      <button class="option-card" type="button" role="checkbox" [attr.aria-checked]="f.incomeTop10" [class.selected]="f.incomeTop10"
                        (click)="set('incomeTop10', !f.incomeTop10)">
                        <span class="grow">
                          <span class="strong-sm">{{ 'ads.form.incomeTop10' | t }}</span>
                          <span class="caption">{{ 'ads.form.incomeTop10Hint' | t }}</span>
                        </span>
                        <span class="radio-mark" [class.on]="f.incomeTop10"></span>
                      </button>
                    }
                    <mb-ad-search-picker [label]="'ads.form.interests' | t" [hint]="'ads.form.interestsHint' | t" [placeholder]="'ads.form.interestsPlaceholder' | t"
                      [search]="searchInterests" [selected]="refItems(f.interests)" (picked)="addRef('interests', $event)" (removed)="removeRef('interests', $event)" />
                    <div class="stack-sm">
                      <p class="label">{{ 'ads.form.audiences' | t }}</p>
                      <span class="caption">{{ 'ads.form.audiencesHint' | t }}</span>
                      @if (audiences(); as list) {
                        @if (list.length) {
                          <div class="chips">
                            @for (audience of list; track audience.id) {
                              <button class="chip" type="button" [class.selected]="hasRef(f.audiences, audience)" [attr.aria-pressed]="hasRef(f.audiences, audience)"
                                (click)="toggleAudience('audiences', audience)">{{ audience.name }}</button>
                            }
                          </div>
                          @if (f.type !== 'demand_gen') {
                            <p class="label">{{ 'ads.form.audiencesExclude' | t }}</p>
                            <div class="chips">
                              @for (audience of list; track audience.id) {
                                <button class="chip" type="button" [class.selected]="hasRef(f.excludedAudiences, audience)"
                                  [attr.aria-pressed]="hasRef(f.excludedAudiences, audience)" (click)="toggleAudience('excludedAudiences', audience)">{{ audience.name }}</button>
                              }
                            </div>
                          }
                        } @else {
                          <span class="caption">{{ 'ads.form.audiencesNone' | t }}</span>
                        }
                      } @else if (audiencesFailed()) {
                        <span class="caption">{{ 'ads.form.audiencesUnavailable' | t }}</span>
                      } @else {
                        <span class="caption">{{ 'ads.form.searching' | t }}</span>
                      }
                    </div>
                    @if (f.type === 'demand_gen') {
                      <div class="stack-sm">
                        <p class="label">{{ 'ads.form.channels' | t }}</p>
                        <div class="chips">
                          @for (channel of channels; track channel) {
                            <button class="chip" type="button" [class.selected]="f.channels.includes(channel)" [attr.aria-pressed]="f.channels.includes(channel)"
                              (click)="toggle('channels', channel)">{{ k('ads.form.channelNames.' + channel) | t }}</button>
                          }
                        </div>
                        <span class="caption">{{ 'ads.form.channelsHint' | t }}</span>
                      </div>
                    }
                  }
                }

                @case ('budget') {
                  <div class="field">
                    <label for="ad-budget">{{ 'ads.form.budget' | t }}</label>
                    <div class="field-row">
                      <input id="ad-budget" type="number" inputmode="numeric" [attr.min]="limits.dailyBudget.min" [attr.max]="limits.dailyBudget.max" step="1"
                        [value]="f.dailyBudget" (input)="set('dailyBudget', $any($event.target).value)" />
                      <span class="hint">{{ currency() }}</span>
                    </div>
                  </div>
                  <div class="pair">
                    <div class="field">
                      <label for="ad-start">{{ 'ads.form.start' | t }}</label>
                      <input id="ad-start" type="date" [attr.min]="today" [value]="f.startsOn" (input)="set('startsOn', $any($event.target).value)" />
                    </div>
                    <div class="field">
                      <label for="ad-end">{{ 'ads.form.end' | t }}</label>
                      <input id="ad-end" type="date" [attr.min]="f.startsOn" [disabled]="f.noEnd" [value]="f.endsOn" (input)="set('endsOn', $any($event.target).value)" />
                    </div>
                  </div>
                  <button class="option-card" type="button" role="checkbox" [attr.aria-checked]="f.noEnd" [class.selected]="f.noEnd" (click)="set('noEnd', !f.noEnd)">
                    <span class="grow">
                      <span class="strong-sm">{{ 'ads.form.noEnd' | t }}</span>
                      <span class="caption">{{ 'ads.wizard.noEndHint' | t }}</span>
                    </span>
                    <span class="radio-mark" [class.on]="f.noEnd"></span>
                  </button>
                  @if (spendLine()) {
                    <p class="strong-sm">{{ spendLine() }}</p>
                  }
                  @if (startNote()) {
                    <p class="caption">{{ startNote() }}</p>
                  }
                  <div class="stack-sm">
                    <p class="label">{{ 'ads.form.bidding' | t }}</p>
                    @for (strategy of strategies(); track strategy) {
                      <button class="option-card" type="button" role="radio" [attr.aria-checked]="f.strategy === strategy" [class.selected]="f.strategy === strategy"
                        (click)="set('strategy', strategy)">
                        <span class="grow">
                          <span class="strong-sm">{{ k('ads.bid.' + strategy + '.name') | t }}</span>
                          <span class="caption">{{ k('ads.bid.' + strategy + '.hint') | t }}</span>
                        </span>
                        <span class="radio-mark" [class.on]="f.strategy === strategy"></span>
                      </button>
                    }
                  </div>
                  @if (f.strategy === 'max_clicks' || f.strategy === 'target_cpa' || f.strategy === 'manual_cpc') {
                    <div class="field">
                      <label for="ad-bid">{{ k('ads.bid.' + f.strategy + '.amount') | t }}</label>
                      <div class="field-row">
                        <input id="ad-bid" type="number" inputmode="decimal" min="0.01" step="0.01" [value]="f.bidAmount" (input)="set('bidAmount', $any($event.target).value)" />
                        <span class="hint">{{ currency() }}</span>
                      </div>
                    </div>
                  }
                  @if (f.strategy === 'target_roas') {
                    <div class="field">
                      <label for="ad-roas">{{ 'ads.bid.target_roas.amount' | t }}</label>
                      <div class="field-row">
                        <input id="ad-roas" type="number" inputmode="numeric" min="1" step="1" [value]="f.roasPercent" (input)="set('roasPercent', $any($event.target).value)" />
                        <span class="hint">%</span>
                      </div>
                      <span class="hint">{{ 'ads.bid.target_roas.example' | t }}</span>
                    </div>
                  }
                }

                @case ('extras') {
                  @if (f.type === 'search') {
                    <div class="stack-sm">
                      <p class="label">{{ 'ads.form.sitelinks' | t }}</p>
                      <span class="caption">{{ 'ads.form.sitelinksHint' | t }}</span>
                      @for (link of f.sitelinks; track $index; let i = $index) {
                        <div class="panel card">
                          <div class="row">
                            <span class="strong-sm grow">{{ 'ads.form.sitelink' | t: { n: i + 1 } }}</span>
                            <button class="icon-btn" type="button" [attr.aria-label]="'ads.form.removeItem' | t" (click)="removeSitelink(i)">
                              <mb-icon name="trash" [size]="15" />
                            </button>
                          </div>
                          <div class="pair">
                            <div class="field">
                              <label [attr.for]="'ad-sl-text-' + i">{{ 'ads.form.sitelinkText' | t }}</label>
                              <input [id]="'ad-sl-text-' + i" type="text" [attr.maxlength]="limits.sitelinks.text" [value]="link.text"
                                (input)="setSitelink(i, { text: $any($event.target).value })" />
                            </div>
                            <div class="field">
                              <label [attr.for]="'ad-sl-url-' + i">{{ 'ads.form.sitelinkUrl' | t }}</label>
                              <input [id]="'ad-sl-url-' + i" type="url" placeholder="https://" [value]="link.linkUrl" (input)="setSitelink(i, { linkUrl: $any($event.target).value })" />
                            </div>
                          </div>
                          <div class="pair">
                            <div class="field">
                              <label [attr.for]="'ad-sl-d1-' + i">{{ 'ads.form.sitelinkLine' | t: { n: 1 } }}</label>
                              <input [id]="'ad-sl-d1-' + i" type="text" [attr.maxlength]="limits.sitelinks.description" [value]="link.description1 ?? ''"
                                (input)="setSitelink(i, { description1: $any($event.target).value })" />
                            </div>
                            <div class="field">
                              <label [attr.for]="'ad-sl-d2-' + i">{{ 'ads.form.sitelinkLine' | t: { n: 2 } }}</label>
                              <input [id]="'ad-sl-d2-' + i" type="text" [attr.maxlength]="limits.sitelinks.description" [value]="link.description2 ?? ''"
                                (input)="setSitelink(i, { description2: $any($event.target).value })" />
                            </div>
                          </div>
                        </div>
                      }
                      @if (f.sitelinks.length < limits.sitelinks.max) {
                        <button class="link-btn add" type="button" (click)="addSitelink()"><mb-icon name="plus" [size]="14" /> {{ 'ads.form.addSitelink' | t }}</button>
                      }
                    </div>
                    <mb-ad-text-list [label]="'ads.form.callouts' | t" [hint]="'ads.form.calloutsHint' | t: { chars: limits.callouts.chars }"
                      [addLabel]="'ads.form.addCallout' | t" [items]="f.callouts" [max]="limits.callouts.max" [chars]="limits.callouts.chars"
                      (itemsChange)="set('callouts', $event)" />
                    <div class="field">
                      <label for="ad-snippet">{{ 'ads.form.snippet' | t }}</label>
                      <span class="hint">{{ 'ads.form.snippetHint' | t: { min: limits.snippetValues.min, max: limits.snippetValues.max } }}</span>
                      <select id="ad-snippet" (change)="setSnippetHeader($any($event.target).value)">
                        <option value="" [selected]="!f.snippet">{{ 'ads.form.snippetNone' | t }}</option>
                        @for (header of snippetHeaders; track header) {
                          <option [value]="header" [selected]="f.snippet?.header === header">{{ snippetLabel(header) }}</option>
                        }
                      </select>
                    </div>
                    @if (f.snippet; as snippet) {
                      <mb-ad-text-list [label]="'ads.form.snippetValues' | t" [addLabel]="'ads.form.addSnippetValue' | t" [items]="snippet.values"
                        [min]="limits.snippetValues.min" [max]="limits.snippetValues.max" [chars]="limits.snippetValues.chars" (itemsChange)="setSnippetValues($event)" />
                    }
                    <div class="stack-sm">
                      <p class="label">{{ 'ads.form.networks' | t }}</p>
                      <button class="option-card" type="button" role="checkbox" [attr.aria-checked]="f.searchPartners" [class.selected]="f.searchPartners"
                        (click)="set('searchPartners', !f.searchPartners)">
                        <span class="grow">
                          <span class="strong-sm">{{ 'ads.form.searchPartners' | t }}</span>
                          <span class="caption">{{ 'ads.form.searchPartnersHint' | t }}</span>
                        </span>
                        <span class="radio-mark" [class.on]="f.searchPartners"></span>
                      </button>
                      <button class="option-card" type="button" role="checkbox" [attr.aria-checked]="f.displayNetwork" [class.selected]="f.displayNetwork"
                        (click)="set('displayNetwork', !f.displayNetwork)">
                        <span class="grow">
                          <span class="strong-sm">{{ 'ads.form.displayNetwork' | t }}</span>
                          <span class="caption">{{ 'ads.form.displayNetworkHint' | t }}</span>
                        </span>
                        <span class="radio-mark" [class.on]="f.displayNetwork"></span>
                      </button>
                    </div>
                  }
                  @if (f.type === 'search' || f.type === 'display') {
                    <div class="stack-sm">
                      <p class="label">{{ 'ads.form.devices' | t }}</p>
                      <div class="chips">
                        @for (device of devices; track device) {
                          <button class="chip" type="button" [class.selected]="f.devices.includes(device)" [attr.aria-pressed]="f.devices.includes(device)"
                            (click)="toggle('devices', device)">{{ k('ads.form.deviceNames.' + device) | t }}</button>
                        }
                      </div>
                      <span class="caption">{{ 'ads.form.devicesHint' | t }}</span>
                    </div>
                  }
                  <button class="link-btn advanced" type="button" [attr.aria-expanded]="advanced()" (click)="advanced.set(!advanced())">
                    <mb-icon [name]="advanced() ? 'chevron-down' : 'chevron-right'" [size]="14" /> {{ 'ads.form.advanced' | t }}
                  </button>
                  @if (advanced()) {
                    <div class="field">
                      <label for="ad-suffix">{{ 'ads.form.urlSuffix' | t }}</label>
                      <input id="ad-suffix" type="text" placeholder="utm_source=google&utm_medium=cpc" [value]="f.finalUrlSuffix"
                        (input)="set('finalUrlSuffix', $any($event.target).value)" />
                      <span class="hint">{{ 'ads.form.urlSuffixHint' | t }}</span>
                    </div>
                    <div class="field">
                      <label for="ad-tracking">{{ 'ads.form.trackingTemplate' | t }}</label>
                      <input id="ad-tracking" type="text" placeholder="{lpurl}?src=google" [value]="f.trackingUrlTemplate"
                        (input)="set('trackingUrlTemplate', $any($event.target).value)" />
                      <span class="hint">{{ 'ads.form.trackingTemplateHint' | t }}</span>
                    </div>
                  }
                }

                @case ('review') {
                  <div class="panel summary">
                    @for (row of summary(); track row.label) {
                      <div class="summary-row">
                        <span class="caption">{{ row.label }}</span>
                        <span class="strong-sm">{{ row.value }}</span>
                      </div>
                    }
                  </div>
                  <ng-container [ngTemplateOutlet]="preview" />
                  @if (problems().length) {
                    <div class="panel problems">
                      <span class="badge warn">{{ 'ads.form.problems' | t }}</span>
                      @for (problem of problems(); track $index) {
                        <p class="caption">{{ problemText(problem) }}</p>
                      }
                    </div>
                  }
                  @if (startNote()) {
                    <p class="caption">{{ startNote() }}</p>
                  }
                  @if (!canLaunch()) {
                    <p class="caption">{{ 'ads.wizard.connectFirst' | t }}</p>
                  }
                }
              }
            }
          </div>
        }
      </main>

      <footer class="footer">
        <div class="footer-inner">
          @if (step() === 'review') {
            <button class="btn btn-secondary btn-lg" type="button" [disabled]="busy()" (click)="save(false)">{{ 'ads.form.save' | t }}</button>
            <button class="btn btn-accent btn-lg" type="button" [disabled]="busy() || !canLaunch() || problems().length > 0" (click)="save(true)">
              @if (saving()) {
                <span class="spinner"></span>
              }
              {{ 'ads.launch' | t }}
            </button>
          } @else {
            <button class="btn btn-primary btn-lg" type="button" [disabled]="busy()" (click)="go(index() + 1)">{{ 'ads.wizard.next' | t }}</button>
          }
        </div>
        @if (step() !== 'review') {
          <button class="link-btn save-later" type="button" [disabled]="busy()" (click)="save(false)">{{ 'ads.form.save' | t }}</button>
        }
      </footer>
    </div>

    <ng-template #preview>
      <div class="stack-sm">
        <p class="label">{{ 'ads.form.preview' | t }}</p>
        @if (form()?.type === 'search') {
          <div class="panel serp">
            <span class="serp-top"><b>{{ 'ads.form.sponsored' | t }}</b> · {{ domain() }}</span>
            <span class="serp-title">{{ previewTitle() }}</span>
            <span class="serp-body">{{ form()?.descriptions?.[0] || '…' }}</span>
          </div>
        } @else {
          <div class="panel visual">
            @if (previewImage(); as url) {
              <img [src]="url" alt="" />
            } @else {
              <div class="visual-empty"><mb-icon name="image-plus" [size]="24" /></div>
            }
            <div class="visual-text">
              <span class="caption"><b>{{ 'ads.form.sponsored' | t }}</b> · {{ form()?.businessName || domain() }}</span>
              <span class="strong-sm">{{ form()?.longHeadlines?.[0] || form()?.headlines?.[0] || '…' }}</span>
              <span class="caption">{{ form()?.descriptions?.[0] || '…' }}</span>
            </div>
          </div>
        }
      </div>
    </ng-template>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 60;
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .scrim {
      position: absolute;
      inset: 0;
      background: var(--scrim);
      animation: fade-in 200ms var(--ease);
    }
    .dialog {
      position: relative;
      display: flex;
      flex-direction: column;
      width: min(760px, 100%);
      height: min(880px, 100%);
      overflow: hidden;
      border-radius: var(--radius-card);
      background: var(--surface-dialog);
      box-shadow: var(--shadow-menu);
      animation: fade-up 240ms var(--ease);
    }
    .bar {
      flex: none;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      align-items: center;
      gap: 16px;
      height: var(--topbar-height);
      padding: 0 20px;
    }
    .bar-side {
      display: flex;
      align-items: center;
    }
    .bar-side.end {
      justify-content: flex-end;
    }
    .bar-center {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .progress {
      display: flex;
      gap: 4px;
    }
    .progress span {
      width: 32px;
      height: 4px;
      border-radius: 2px;
      background: var(--grey-300);
      transition: background-color 200ms var(--ease);
    }
    .progress span.on {
      background: var(--primary);
    }
    .page {
      flex: 1;
      overflow-y: auto;
      padding: 16px 24px 24px;
    }
    .step {
      display: flex;
      flex-direction: column;
      gap: 20px;
      width: min(640px, 100%);
      margin: 0 auto;
      animation: enter-right 320ms var(--ease);
    }
    .titles,
    .texts {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .titles {
      gap: 8px;
    }
    .assistant {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .stack-sm {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .grow {
      flex: 1 1 0;
      min-width: 0;
    }
    .item {
      gap: 8px;
      padding-top: 10px;
      border-top: 1px solid var(--grey-100);
    }
    .item input {
      flex: 1;
      min-width: 0;
    }
    .link {
      color: var(--primary-soft);
      font-size: 14px;
      overflow-wrap: anywhere;
    }
    .count {
      flex: none;
      width: 44px;
      color: var(--text-body);
      font-size: 12px;
      text-align: right;
    }
    .count.full {
      color: var(--danger);
    }
    .add,
    .advanced {
      display: inline-flex;
      align-self: flex-start;
      align-items: center;
      gap: 4px;
    }
    .card {
      gap: 10px;
      padding: 14px;
    }
    .card .field {
      background: var(--surface-sunken);
    }
    .pair {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .ideas {
      gap: 8px;
    }
    .idea {
      display: flex;
      align-items: center;
      gap: 10px;
      padding-top: 8px;
      border-top: 1px solid var(--grey-100);
    }
    .danger {
      color: var(--danger);
    }
    .summary {
      gap: 0;
      padding: 4px 20px;
    }
    .summary-row {
      display: grid;
      grid-template-columns: 140px minmax(0, 1fr);
      gap: 12px;
      padding: 12px 0;
      border-top: 1px solid var(--grey-100);
      overflow-wrap: anywhere;
    }
    .summary-row:first-child {
      border-top: 0;
    }
    .problems {
      gap: 4px;
    }
    .serp {
      gap: 4px;
      font-family: Arial, Helvetica, sans-serif;
    }
    .serp-top {
      font-size: 12px;
      color: var(--text-body);
    }
    .serp-title {
      color: #1a0dab;
      font-size: 18px;
      line-height: 1.3;
    }
    .serp-body {
      font-size: 14px;
      line-height: 1.45;
      color: var(--text-title);
    }
    .visual {
      gap: 0;
      padding: 0;
      overflow: hidden;
      max-width: 360px;
    }
    .visual img,
    .visual-empty {
      width: 100%;
      aspect-ratio: 1.91;
      object-fit: cover;
      display: block;
    }
    .visual-empty {
      display: grid;
      place-items: center;
      background: var(--surface-sunken);
      color: var(--text-body);
    }
    .visual-text {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px 14px 14px;
    }
    .footer {
      flex: none;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 16px 24px 20px;
      border-top: 1px solid rgba(20, 33, 61, 0.08);
    }
    .footer-inner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
    }
    .footer-inner .btn {
      min-width: 200px;
    }
    @media (max-width: 640px) {
      :host {
        padding: 0;
      }
      .dialog {
        width: 100%;
        height: 100%;
        border-radius: 0;
      }
      .bar {
        padding: 0 12px;
      }
      .progress span {
        width: 18px;
      }
      .pair {
        grid-template-columns: 1fr;
      }
      .summary-row {
        grid-template-columns: 1fr;
        gap: 2px;
      }
      .footer-inner {
        flex-direction: column-reverse;
        width: 100%;
      }
      .footer-inner .btn {
        width: 100%;
      }
    }
  `,
})
export class AdWizard implements OnInit {
  readonly brandId = input.required<string>();
  readonly data = input.required<AdsResponse>();
  // La bozza da riprendere; null per una campagna nuova.
  readonly ad = input<Ad | null>(null);
  readonly closed = output<void>();
  // Salvata o avviata: la pagina rilegge l'elenco.
  readonly saved = output<void>();

  private readonly ads = inject(AdsService);
  private readonly jobs = inject(AiJobsService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly i18n = inject(I18nService);
  protected readonly limits = L;
  protected readonly types = AD_CAMPAIGN_TYPES;
  protected readonly goals: AdGoal[] = ['traffic', 'awareness', 'engagement'];
  protected readonly matches: KeywordMatch[] = ['phrase', 'exact', 'broad'];
  protected readonly genders: AdGender[] = ['female', 'male'];
  protected readonly devices = AD_DEVICES;
  protected readonly channels = DEMAND_GEN_CHANNELS;
  protected readonly ageRanges = AGE_RANGES;
  protected readonly ageMins = AGE_MINS;
  protected readonly ageMaxes = AGE_MAXES;
  protected readonly snippetHeaders = SNIPPET_HEADERS;
  protected readonly aspects = AD_IMAGE_ASPECT;
  protected readonly today = day(new Date());
  // Una chiave composta nel template (tipo, obiettivo, passaggio): sono tutte nel dizionario ads.
  protected readonly k = (key: string) => key as MessageKey;

  protected readonly form = signal<WizardForm | null>(null);
  protected readonly steps = computed<AdStep[]>(() => adSteps(this.form()?.type ?? 'search'));
  protected readonly index = signal(0);
  protected readonly step = computed<AdStep>(() => this.steps()[Math.min(this.index(), this.steps().length - 1)]!);
  protected readonly text = computed(() => textLimits(this.form()?.type ?? 'search'));
  protected readonly exchanges = signal<Partial<Record<AdStep, Exchange[]>>>({});
  protected readonly thinking = signal(false);
  protected readonly saving = signal(false);
  protected readonly busy = computed(() => this.thinking() || this.saving());
  protected readonly advanced = signal(false);
  // L'id della bozza una volta salvata: i salvataggi dopo la aggiornano.
  private readonly savedId = signal<string | null>(null);

  // Gli strumenti dei passaggi: immagini, pubblici, idee per le parole chiave. Si caricano quando servono.
  protected readonly images = signal<AdImageOption[] | null>(null);
  private imagesRequested = false;
  protected readonly uploading = signal<string | null>(null);
  protected readonly audiences = signal<AdAudienceRef[] | null>(null);
  protected readonly audiencesFailed = signal(false);
  private audiencesRequested = false;
  protected readonly ideas = signal<AdKeywordIdea[] | null>(null);
  protected readonly ideasLoading = signal(false);
  protected readonly ideasFailed = signal<string | null>(null);
  protected readonly youtubeDraft = signal('');

  protected readonly currency = computed(() => this.data().connection?.currency ?? 'EUR');
  protected readonly canLaunch = computed(() => {
    const connection = this.data().connection;
    return Boolean(connection && !connection.lost && connection.adAccountId);
  });
  protected readonly strategies = computed<readonly AdBidStrategy[]>(() => AD_BID_STRATEGIES[this.form()?.type ?? 'search']);
  protected readonly imageRules = computed(() =>
    (Object.entries(AD_IMAGES[this.form()?.type ?? 'search']) as [AdImageRole, { min: number; max: number }][]).map(([role, rule]) => ({ role, ...rule })),
  );
  protected readonly problems = computed(() => {
    const f = this.form();
    return f ? problemsOf(f) : [];
  });
  protected readonly languageOptions = computed<{ value: string; label: string }[]>(() => {
    const names = new Intl.DisplayNames([this.i18n.locale()], { type: 'language' });
    const chosen = this.form()?.languages ?? [];
    return [...LANGUAGES, ...chosen.filter((code) => !LANGUAGES.includes(code))].map((code) => ({ value: code, label: names.of(code.replace('_', '-')) ?? code }));
  });
  protected readonly domain = computed(() => {
    try {
      return new URL(this.form()?.linkUrl ?? '').hostname.replace(/^www\./, '');
    } catch {
      return 'www.example.com';
    }
  });
  protected readonly previewTitle = computed(() => {
    const titles = (this.form()?.headlines ?? []).map((title) => title.trim()).filter(Boolean).slice(0, 3);
    return titles.length ? titles.join(' | ') : '…';
  });
  protected readonly previewImage = computed(() => {
    const f = this.form();
    if (!f) return null;
    const file = f.images.landscape[0] ?? f.images.square[0] ?? f.images.portrait[0] ?? f.carousel[0]?.image;
    return file ? ((this.images() ?? []).find((option) => option.file === file)?.url ?? null) : null;
  });
  protected readonly spendLine = computed(() => {
    const f = this.form();
    const daily = Number(f?.dailyBudget);
    if (!f || !Number.isFinite(daily) || daily <= 0) return '';
    const total = maxSpend({ dailyBudget: daily, startsOn: f.startsOn, endsOn: f.noEnd ? null : f.endsOn || null });
    return total === null
      ? this.i18n.t('ads.form.openSpend', { daily: this.money(daily) })
      : this.i18n.t('ads.form.maxSpend', { total: this.money(total) });
  });
  // Partenza futura: la campagna va su Google in pausa e parte da sola. PMax e Demand Gen nascono in pausa comunque.
  protected readonly startNote = computed(() => {
    const f = this.form();
    if (!f) return '';
    if (f.startsOn > this.today) return this.i18n.t('ads.form.scheduledHint', { date: this.date(f.startsOn) });
    if (f.type === 'pmax' || f.type === 'demand_gen') return this.i18n.t('ads.form.startsPausedHint');
    return '';
  });
  protected readonly summary = computed(() => {
    const f = this.form();
    if (!f) return [];
    const t = (key: MessageKey, params?: Record<string, string | number>) => this.i18n.t(key, params);
    const rows: { label: string; value: string }[] = [
      { label: t('ads.form.type'), value: t(`ads.types.${f.type}.name` as MessageKey) },
      { label: t('ads.form.name'), value: f.name || '—' },
      { label: t('ads.form.link'), value: f.linkUrl || '—' },
    ];
    if (f.type !== 'pmax') rows.push({ label: t('ads.form.goal'), value: t(`ads.goals.${f.goal}.name` as MessageKey) });
    rows.push({ label: t('ads.form.headlines'), value: this.filled(f.headlines) });
    if (f.type !== 'search') rows.push({ label: t('ads.form.longHeadlines'), value: this.filled(f.longHeadlines) });
    rows.push({ label: t('ads.form.descriptions'), value: this.filled(f.descriptions) });
    if (f.type !== 'search') {
      rows.push({ label: t('ads.form.businessName'), value: f.businessName || '—' });
      const count = this.imageRules().reduce((sum, rule) => sum + f.images[rule.role].length, 0);
      rows.push({ label: t('ads.form.images'), value: count ? t('ads.form.imagesCount', { n: count }) : '—' });
      if (f.youtube.length) rows.push({ label: t('ads.form.youtube'), value: String(f.youtube.length) });
      if (f.carousel.length) rows.push({ label: t('ads.form.carousel'), value: t('ads.form.cardsCount', { n: f.carousel.length }) });
    }
    if (f.type === 'search') {
      const keywords = keywordsOf(f.keywords, f.match).map((keyword) => keyword.text);
      rows.push({ label: t('ads.form.keywords'), value: keywords.length ? `${keywords.length} · ${keywords.slice(0, 4).join(', ')}${keywords.length > 4 ? '…' : ''}` : '—' });
      const negatives = keywordsOf(f.negatives, 'phrase');
      if (negatives.length) rows.push({ label: t('ads.form.negatives'), value: String(negatives.length) });
    }
    const places = f.locations.map((place) => place.name).join(', ') || '—';
    const excluded = f.excludedLocations.length ? ` · ${t('ads.form.excludedCount', { n: f.excludedLocations.length })}` : '';
    rows.push({ label: t('ads.form.where'), value: places + excluded });
    rows.push({ label: t('ads.form.languages'), value: this.languageOptions().filter((option) => f.languages.includes(option.value)).map((option) => option.label).join(', ') || '—' });
    if (f.type !== 'pmax') rows.push({ label: t('ads.form.people'), value: this.peopleLine(f) });
    rows.push({ label: t('ads.form.budget'), value: this.spendLine() || '—' });
    rows.push({ label: t('ads.form.bidding'), value: this.bidLine(f) });
    if (f.type === 'search') {
      const extras = [
        f.sitelinks.length ? t('ads.form.sitelinksCount', { n: f.sitelinks.length }) : '',
        f.callouts.filter((item) => item.trim()).length ? t('ads.form.calloutsCount', { n: f.callouts.filter((item) => item.trim()).length }) : '',
        f.snippet ? this.snippetLabel(f.snippet.header) : '',
      ].filter(Boolean);
      rows.push({ label: t('ads.wizard.steps.extras'), value: extras.join(' · ') || '—' });
    }
    return rows;
  });

  constructor() {
    lockPageScroll();
    // Le immagini servono nell'annuncio dei tipi visivi; i pubblici nel passaggio del pubblico.
    effect(() => {
      const step = this.step();
      const type = this.form()?.type;
      untracked(() => {
        if ((step === 'ad' || step === 'review') && type && type !== 'search') void this.loadImages();
        if (step === 'audience' && type && type !== 'pmax') void this.loadAudiences();
      });
    });
  }

  ngOnInit(): void {
    const ad = this.ad();
    const name = (code: string) => this.countryName(code);
    if (ad) {
      this.savedId.set(ad.id);
      this.form.set(formOf(ad, this.today, name));
      if (ad.campaignType !== 'search') void this.loadImages();
      return;
    }
    this.form.set(newForm(this.data().defaults, this.today, name));
  }

  protected close(): void {
    if (!this.busy()) this.closed.emit();
  }

  protected go(index: number): void {
    if (this.busy()) return;
    this.index.set(Math.max(0, Math.min(this.steps().length - 1, index)));
  }

  protected set<K extends keyof WizardForm>(key: K, value: WizardForm[K]): void {
    this.form.update((f) => (f ? { ...f, [key]: value } : f));
  }

  protected setType(type: AdCampaignType): void {
    this.form.update((f) => (f && f.type !== type ? withType(f, type) : f));
  }

  protected toggle<K extends 'languages' | 'devices' | 'channels'>(key: K, value: WizardForm[K][number]): void {
    this.form.update((f) => {
      if (!f) return f;
      const list = f[key] as string[];
      return { ...f, [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value] };
    });
  }

  // Testi.

  protected filled(items: string[]): string {
    const done = items.map((item) => item.trim()).filter(Boolean);
    return done.length ? `${done.length} · ${done[0]}` : '—';
  }

  // Immagini.

  private async loadImages(): Promise<void> {
    if (this.imagesRequested) return;
    this.imagesRequested = true;
    try {
      this.images.set(await this.ads.images(this.brandId()));
    } catch (error) {
      this.imagesRequested = false;
      this.images.set([]);
      this.toast.show(errorMessage(error, this.i18n.t('ads.form.imagesFailed')));
    }
  }

  protected setImages(role: AdImageRole, files: string[]): void {
    this.form.update((f) => (f ? { ...f, images: { ...f.images, [role]: files } } : f));
  }

  // Un'immagine caricata va tra quelle del brand e si sceglie subito nel formato (o nella scheda) da cui è partita.
  protected async upload(target: string, file: File): Promise<void> {
    if (this.uploading()) return;
    this.uploading.set(target);
    try {
      const dataUri = await resizedDataUri(file, UPLOAD_SIDE, 'image/jpeg');
      const option = await this.ads.uploadImage(this.brandId(), dataUri);
      this.images.update((list) => [option, ...(list ?? [])]);
      if (target.startsWith('card')) this.setCard(Number(target.slice(4)), { image: option.file });
      else {
        const role = target as AdImageRole;
        const max = AD_IMAGES[this.form()?.type ?? 'search'][role]?.max ?? 1;
        this.form.update((f) => (f ? { ...f, images: { ...f.images, [role]: [...f.images[role], option.file].slice(0, max) } } : f));
      }
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('ads.form.uploadFailed')));
    } finally {
      this.uploading.set(null);
    }
  }

  // YouTube.

  protected addYoutube(): void {
    const id = youtubeId(this.youtubeDraft());
    if (!id) {
      this.toast.show(this.i18n.t('ads.form.youtubeInvalid'));
      return;
    }
    this.form.update((f) => (f && !f.youtube.includes(id) ? { ...f, youtube: [...f.youtube, id].slice(0, L.youtube.max) } : f));
    this.youtubeDraft.set('');
  }

  protected removeYoutube(index: number): void {
    this.form.update((f) => (f ? { ...f, youtube: f.youtube.filter((_, i) => i !== index) } : f));
  }

  // Carosello Demand Gen.

  protected addCard(): void {
    this.form.update((f) => {
      if (!f) return f;
      const cards = [...f.carousel];
      while (cards.length < L.carousel.min - 1) cards.push({ headline: '', image: '' });
      return { ...f, carousel: [...cards, { headline: '', image: '' }] };
    });
    void this.loadImages();
  }

  protected setCard(index: number, change: Partial<{ headline: string; image: string }>): void {
    this.form.update((f) => (f ? { ...f, carousel: f.carousel.map((card, i) => (i === index ? { ...card, ...change } : card)) } : f));
  }

  protected removeCard(index: number): void {
    this.form.update((f) => (f ? { ...f, carousel: f.carousel.filter((_, i) => i !== index) } : f));
  }

  // Parole chiave.

  private keywordList(): string[] {
    return keywordsOf(this.form()?.keywords ?? '', 'phrase').map((keyword) => keyword.text.toLowerCase());
  }

  protected hasKeyword(text: string): boolean {
    return this.keywordList().includes(text.toLowerCase());
  }

  protected addKeyword(text: string): void {
    this.form.update((f) => (f ? { ...f, keywords: [f.keywords.trimEnd(), text].filter(Boolean).join('\n') } : f));
  }

  protected async loadIdeas(): Promise<void> {
    const f = this.form();
    if (!f || this.ideasLoading()) return;
    const seeds = keywordsOf(f.keywords, f.match).map((keyword) => keyword.text).slice(0, 10);
    const countries = f.locations.filter((place) => place.type === 'country').map((place) => place.id);
    this.ideasLoading.set(true);
    this.ideasFailed.set(null);
    try {
      this.ideas.set(
        await this.ads.keywordIdeas(this.brandId(), {
          seedKeywords: seeds,
          ...(/^https?:\/\//.test(f.linkUrl.trim()) && { seedUrl: f.linkUrl.trim() }),
          countries: countries.length ? countries : ['IT'],
          language: f.languages[0] ?? 'it',
        }),
      );
    } catch (error) {
      this.ideasFailed.set(errorMessage(error, this.i18n.t('ads.form.ideasFailed')));
    } finally {
      this.ideasLoading.set(false);
    }
  }

  protected ideaLine(idea: AdKeywordIdea): string {
    const parts: string[] = [];
    if (idea.monthlySearches !== null) parts.push(this.i18n.t('ads.form.ideaSearches', { n: new Intl.NumberFormat(this.i18n.locale()).format(idea.monthlySearches) }));
    if (idea.competition && idea.competition !== 'UNSPECIFIED') parts.push(this.i18n.t(`ads.form.competition.${idea.competition}` as MessageKey));
    if (idea.lowBid !== null && idea.highBid !== null) parts.push(this.i18n.t('ads.form.ideaBids', { low: this.money(idea.lowBid), high: this.money(idea.highBid) }));
    return parts.join(' · ') || '—';
  }

  // Luoghi, interessi e pubblici.

  protected readonly searchLocations = async (query: string): Promise<PickerItem<AdLocation>[]> =>
    this.placeItems(await this.ads.locations(this.brandId(), query));

  protected readonly searchInterests = async (query: string): Promise<PickerItem<AdAudienceRef>[]> =>
    this.refItems(await this.ads.interests(this.brandId(), query));

  protected placeItems(places: AdLocation[]): PickerItem<AdLocation>[] {
    return places.map((place) => ({
      id: place.id,
      name: place.name,
      detail: [this.i18n.t(`ads.form.placeTypes.${place.type}` as MessageKey), place.path].filter(Boolean).join(' · '),
      value: place,
    }));
  }

  protected refItems(refs: AdAudienceRef[]): PickerItem<AdAudienceRef>[] {
    return refs.map((ref) => ({ id: ref.id, name: ref.name, value: ref }));
  }

  protected addPlace(key: 'locations' | 'excludedLocations', place: AdLocation): void {
    this.form.update((f) => {
      if (!f || f[key].some((item) => item.id === place.id)) return f;
      // Un luogo non sta insieme tra quelli scelti e quelli esclusi.
      const other = key === 'locations' ? 'excludedLocations' : 'locations';
      return { ...f, [key]: [...f[key], place], [other]: f[other].filter((item) => item.id !== place.id) };
    });
  }

  protected removePlace(key: 'locations' | 'excludedLocations', place: AdLocation): void {
    this.form.update((f) => (f ? { ...f, [key]: f[key].filter((item) => item.id !== place.id) } : f));
  }

  protected addRef(key: 'interests', ref: AdAudienceRef): void {
    this.form.update((f) => (f && !f[key].some((item) => item.id === ref.id) ? { ...f, [key]: [...f[key], ref] } : f));
  }

  protected removeRef(key: 'interests', ref: AdAudienceRef): void {
    this.form.update((f) => (f ? { ...f, [key]: f[key].filter((item) => item.id !== ref.id) } : f));
  }

  protected hasRef(list: AdAudienceRef[], ref: AdAudienceRef): boolean {
    return list.some((item) => item.id === ref.id);
  }

  protected toggleAudience(key: 'audiences' | 'excludedAudiences', ref: AdAudienceRef): void {
    this.form.update((f) => {
      if (!f) return f;
      if (this.hasRef(f[key], ref)) return { ...f, [key]: f[key].filter((item) => item.id !== ref.id) };
      const other = key === 'audiences' ? 'excludedAudiences' : 'audiences';
      return { ...f, [key]: [...f[key], ref], [other]: f[other].filter((item) => item.id !== ref.id) };
    });
  }

  private async loadAudiences(): Promise<void> {
    if (this.audiencesRequested) return;
    this.audiencesRequested = true;
    if (!this.canLaunch()) {
      this.audiences.set([]);
      return;
    }
    try {
      const list = await this.ads.audiences(this.brandId());
      this.audiences.set(list.filter((audience: AdAudience) => audience.platformId).map((audience) => ({ id: audience.platformId!, name: audience.name })));
    } catch {
      this.audiencesFailed.set(true);
    }
  }

  protected hasRange(min: number): boolean {
    return (this.form()?.ageRanges ?? []).some((range) => range.min === min);
  }

  protected toggleRange(range: { min: number; max: number | null }): void {
    this.form.update((f) => {
      if (!f) return f;
      const has = f.ageRanges.some((item) => item.min === range.min);
      return { ...f, ageRanges: has ? f.ageRanges.filter((item) => item.min !== range.min) : [...f.ageRanges, { min: range.min, max: range.max }].sort((a, b) => a.min - b.min) };
    });
  }

  // Estensioni.

  protected addSitelink(): void {
    this.form.update((f) => (f ? { ...f, sitelinks: [...f.sitelinks, { text: '', linkUrl: f.linkUrl, description1: '', description2: '' }] } : f));
  }

  protected setSitelink(index: number, change: Partial<AdSitelink>): void {
    this.form.update((f) => (f ? { ...f, sitelinks: f.sitelinks.map((link, i) => (i === index ? { ...link, ...change } : link)) } : f));
  }

  protected removeSitelink(index: number): void {
    this.form.update((f) => (f ? { ...f, sitelinks: f.sitelinks.filter((_, i) => i !== index) } : f));
  }

  protected setSnippetHeader(header: string): void {
    this.form.update((f) => {
      if (!f) return f;
      if (!header) return { ...f, snippet: null };
      const values = f.snippet?.values ?? Array<string>(L.snippetValues.min).fill('');
      return { ...f, snippet: { header: header as AdSnippet['header'], values } };
    });
  }

  protected setSnippetValues(values: string[]): void {
    this.form.update((f) => (f?.snippet ? { ...f, snippet: { ...f.snippet, values } } : f));
  }

  protected snippetLabel(header: string): string {
    return this.i18n.t(`ads.form.snippetHeaders.${header.replace(/\s+/g, '_')}` as MessageKey);
  }

  // Righe del riepilogo.

  private peopleLine(f: WizardForm): string {
    const t = (key: MessageKey, params?: Record<string, string | number>) => this.i18n.t(key, params);
    const parts: string[] = [];
    if (f.type === 'demand_gen') {
      if (f.ageRanges.length) parts.push(f.ageRanges.map((range) => (range.max ? `${range.min}–${range.max}` : `${range.min}+`)).join(', '));
    } else if (f.ageMin !== null || f.ageMax !== null) {
      parts.push(`${f.ageMin ?? 18}–${f.ageMax ?? '65+'}`);
    }
    if (f.genders.length === 1) parts.push(t(`ads.form.genderNames.${f.genders[0]!}` as MessageKey));
    if (f.incomeTop10 && f.type !== 'demand_gen') parts.push(t('ads.form.incomeTop10'));
    if (f.interests.length) parts.push(t('ads.form.interestsCount', { n: f.interests.length }));
    if (f.audiences.length) parts.push(t('ads.form.audiencesCount', { n: f.audiences.length }));
    return parts.join(' · ') || t('ads.form.peopleAll');
  }

  private bidLine(f: WizardForm): string {
    const name = this.i18n.t(`ads.bid.${f.strategy}.name` as MessageKey);
    const amount = Number(f.bidAmount.replace(',', '.'));
    if ((f.strategy === 'max_clicks' || f.strategy === 'target_cpa' || f.strategy === 'manual_cpc') && amount > 0) return `${name} · ${this.money(amount)}`;
    if (f.strategy === 'target_roas' && Number(f.roasPercent) > 0) return `${name} · ${f.roasPercent}%`;
    return name;
  }

  protected problemText(problem: Problem): string {
    const t = (key: MessageKey, params?: Record<string, string | number>) => this.i18n.t(key, params);
    if (problem.key === 'image') return t('ads.form.problemList.image', { role: t(`ads.form.imageRoles.${problem.role}` as MessageKey), n: problem.n });
    if (problem.key === 'headlines' || problem.key === 'descriptions') return t(`ads.form.problemList.${problem.key}` as MessageKey, { n: problem.n });
    return t(`ads.form.problemList.${problem.key}` as MessageKey);
  }

  protected countryName(code: string): string {
    try {
      return new Intl.DisplayNames([this.i18n.locale()], { type: 'region' }).of(code) ?? code;
    } catch {
      return code;
    }
  }

  private date(value: string): string {
    return new Intl.DateTimeFormat(this.i18n.locale(), { day: 'numeric', month: 'long' }).format(new Date(`${value}T12:00:00`));
  }

  private money(value: number): string {
    return new Intl.NumberFormat(this.i18n.locale(), { style: 'currency', currency: this.currency(), maximumFractionDigits: value % 1 ? 2 : 0 }).format(value);
  }

  // L'AI.

  private readonly composer = viewChild(Composer);

  // L'ultima richiesta del passaggio: si mostra solo quella, con il suo esito.
  protected lastExchange(step: AdStep): Exchange | null {
    return this.exchanges()[step]?.at(-1) ?? null;
  }

  protected async ask(message: string): Promise<void> {
    const text = message.trim();
    const f = this.form();
    const step = this.step();
    if (!text || !f || this.thinking()) return;
    const add = (exchange: Exchange) => this.exchanges.update((all) => ({ ...all, [step]: [...(all[step] ?? []), exchange] }));
    const settle = (exchange: Exchange) =>
      this.exchanges.update((all) => ({ ...all, [step]: [...(all[step] ?? []).slice(0, -1), exchange] }));
    add({ instruction: text, reply: null });
    this.composer()?.clear();
    this.thinking.set(true);
    try {
      const result = await this.jobs.assistAd(this.brandId(), { step, instruction: text, draft: progressOf(f) });
      const { spec, ...rest } = result.patch;
      const changed = Object.keys(rest).length > 0 || Object.keys(spec ?? {}).length > 0;
      const current = this.form();
      let names: string[] = [];
      if (current) {
        const applied = applyPatch(current, result.patch, (code) => this.countryName(code));
        this.form.set(applied.form);
        names = applied.locationNames;
      }
      settle({ instruction: text, reply: result.reply, changed });
      if (changed) this.toast.show(this.i18n.t('ads.wizard.updated'));
      if (names.length) await this.resolvePlaces(names);
    } catch (error) {
      settle({ instruction: text, reply: errorMessage(error, this.i18n.t('ads.wizard.askFailed')), failed: true });
    } finally {
      this.thinking.set(false);
    }
  }

  // I luoghi detti a parole dall'AI: si prende il primo risultato di Google per ciascuno.
  private async resolvePlaces(names: string[]): Promise<void> {
    const missing: string[] = [];
    for (const name of names.slice(0, 20)) {
      try {
        const [first] = await this.ads.locations(this.brandId(), name);
        if (first) this.addPlace('locations', first);
        else missing.push(name);
      } catch {
        missing.push(name);
      }
    }
    if (missing.length) this.toast.show(this.i18n.t('ads.form.placesNotFound', { names: missing.join(', ') }));
  }

  // Salvataggio e avvio.

  protected async save(andLaunch: boolean): Promise<void> {
    const f = this.form();
    if (!f || this.busy()) return;
    const draft = draftOf(f);
    if (andLaunch && !(await this.confirmLaunch(draft))) return;
    this.saving.set(true);
    try {
      const id = this.savedId();
      const saved = id ? await this.ads.update(this.brandId(), id, draft) : await this.ads.create(this.brandId(), draft);
      this.savedId.set(saved.id);
      if (andLaunch) await this.ads.launch(this.brandId(), saved.id);
      this.toast.show(this.i18n.t(andLaunch ? 'ads.launched' : 'ads.saved'));
      this.saved.emit();
      this.closed.emit();
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('ads.failed')));
      // Avviata male: la bozza è salvata con l'errore, la pagina la mostra.
      if (this.savedId()) this.saved.emit();
    } finally {
      this.saving.set(false);
    }
  }

  private confirmLaunch(ad: AdDraft): Promise<boolean> {
    const total = maxSpend(ad);
    const daily = this.money(ad.dailyBudget);
    const days = total === null ? 0 : Math.round(total / ad.dailyBudget);
    return this.confirm.ask({
      title: this.i18n.t('ads.launchConfirm', { name: ad.name }),
      message: total === null ? this.i18n.t('ads.launchMessageOpen', { daily }) : this.i18n.t('ads.launchMessageMax', { total: this.money(total), daily, days }),
      confirmLabel: this.i18n.t('ads.launchLabel'),
    });
  }
}
