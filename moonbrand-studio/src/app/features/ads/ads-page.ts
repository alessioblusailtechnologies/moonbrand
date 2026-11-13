import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import type { AdsResponse } from '@moonbrand/shared/api/contract';
import { maxSpend, SEARCH_LIMITS, type Ad, type AdAccount, type AdDraft, type AdStatus, type KeywordMatch } from '@moonbrand/shared/domain/ads';
import type { MessageKey } from '@moonbrand/shared/i18n/translate';

import { AdsService } from '../../core/ads/ads.service';
import { BrandsService } from '../../core/brands/brands.service';
import { errorMessage } from '../../core/errors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { pageHeader } from '../../core/layout/page-header';
import { ConfirmService } from '../../ui/confirm';
import { Icon } from '../../ui/icon';
import { Loader } from '../../ui/loader';
import { Select, type SelectOption } from '../../ui/select';
import { CHANNEL_ICONS } from '../../ui/channel-icons';
import { ToastService } from '../../ui/toast';

const L = SEARCH_LIMITS;
const COUNTRIES = ['IT', 'SM', 'CH', 'FR', 'DE', 'ES', 'GB', 'US'] as const;
const LANGUAGES = ['it', 'en', 'fr', 'de', 'es'];

// I loghi delle piattaforme (Simple Icons, CC0), su 24×24. color null: quello del testo, per il tema scuro.
const LOGOS: Record<'google' | 'meta' | 'linkedin' | 'openai', { path: string; color: string | null }> = {
  google: { color: '#4285F4', path: 'M3.9998 22.9291C1.7908 22.9291 0 21.1383 0 18.9293s1.7908-3.9998 3.9998-3.9998 3.9998 1.7908 3.9998 3.9998-1.7908 3.9998-3.9998 3.9998zm19.4643-6.0004L15.4632 3.072C14.3586 1.1587 11.9121.5028 9.9988 1.6074S7.4295 5.1585 8.5341 7.0718l8.0009 13.8567c1.1046 1.9133 3.5511 2.5679 5.4644 1.4646 1.9134-1.1046 2.568-3.5511 1.4647-5.4644zM7.5137 4.8438L1.5645 15.1484A4.5 4.5 0 0 1 4 14.4297c2.5597-.0075 4.6248 2.1585 4.4941 4.7148l3.2168-5.5723-3.6094-6.25c-.4499-.7793-.6322-1.6394-.5878-2.4784z' },
  meta: { color: '#0866FF', path: 'M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z' },
  linkedin: CHANNEL_ICONS.linkedin,
  openai: { color: null, path: 'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z' },
};

// La campagna nell'editor: i campi come li scrive la persona, il budget come testo finché non si salva.
interface Form {
  id: string | null;
  name: string;
  linkUrl: string;
  headlines: string[];
  descriptions: string[];
  keywords: string;
  match: KeywordMatch;
  countries: string[];
  language: string;
  dailyBudget: string;
  startsOn: string;
  endsOn: string;
  noEnd: boolean;
}

const day = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(date);
const addDays = (from: string, days: number) => day(new Date(Date.parse(from) + days * 86_400_000));
const ACTIVE: AdStatus[] = ['in_review', 'active'];

// Campagne: le campagne Google del brand sulla rete di ricerca. Si collega Google Ads, si scrive la campagna e la si
// avvia; la spesa la addebita Google sull'account del cliente. Niente chat: tutto qui.
@Component({
  selector: 'mb-ads-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Loader, Select, TranslatePipe],
  template: `
    <section class="ads">
      <header class="texts">
        <h1 class="title">{{ 'ads.title' | t }}</h1>
        <p class="caption">{{ 'ads.intro' | t }}</p>
      </header>

      @if (loading() && !data()) {
        <div class="empty"><mb-loader /></div>
      } @else if (data(); as current) {
        <div class="platforms">
          <section class="panel tile">
            <div class="tile-head">
              <span class="mark" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path [attr.d]="logos.google.path" [attr.fill]="logos.google.color" /></svg>
              </span>
              @if (current.connection; as connection) {
                <span class="badge" [class.st-active]="!connection.lost && connection.adAccountId" [class.st-rejected]="connection.lost">
                  {{ (connection.lost ? 'ads.tileLost' : connection.adAccountId ? 'ads.tileOn' : 'ads.tileChoose') | t }}
                </span>
              }
            </div>
            <div class="texts">
              <span class="strong-sm">{{ 'ads.google' | t }}</span>
              @if (current.connection; as connection) {
                @if (connection.lost) {
                  <span class="caption danger">{{ 'ads.lost' | t }}</span>
                } @else if (connection.adAccountId) {
                  <span class="caption">{{ 'ads.account' | t: { name: connection.adAccountName ?? connection.adAccountId, currency: connection.currency ?? '—' } }}</span>
                } @else {
                  <span class="caption">{{ 'ads.chooseAccountHint' | t }}</span>
                }
                @if (connection.simulated) {
                  <span class="caption">{{ 'ads.simulated' | t }}</span>
                }
              } @else {
                <span class="caption">{{ 'ads.connectHint' | t }}</span>
              }
            </div>
            <div class="tile-actions">
              @if (!current.connection || current.connection.lost) {
                <button class="btn btn-primary btn-sm" type="button" [disabled]="busy()" (click)="connect()">{{ 'ads.connectShort' | t }}</button>
                @if (current.simulation) {
                  <button class="link-btn" type="button" [disabled]="busy()" (click)="simulate()">{{ 'ads.simulate' | t }}</button>
                }
              } @else {
                @if (current.connection.adAccountId && !accounts()) {
                  <button class="link-btn" type="button" [disabled]="busy()" (click)="loadAccounts()">{{ 'ads.changeAccount' | t }}</button>
                }
                <button class="link-btn" type="button" [disabled]="busy()" (click)="disconnect()">{{ 'ads.disconnect' | t }}</button>
              }
            </div>
          </section>
          @for (platform of upcoming; track platform.key) {
            <section class="panel tile off" aria-disabled="true">
              <div class="tile-head">
                <span class="mark" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path [attr.d]="logos[platform.key].path" [attr.fill]="logos[platform.key].color ?? 'currentColor'" /></svg>
                </span>
                <span class="badge">{{ 'ads.soon' | t }}</span>
              </div>
              <div class="texts">
                <span class="strong-sm">{{ platform.name }}</span>
                <span class="caption">{{ platform.hint | t }}</span>
              </div>
              <div class="tile-actions">
                <button class="btn btn-secondary btn-sm" type="button" disabled>{{ 'ads.connectShort' | t }}</button>
              </div>
            </section>
          }
        </div>

        @if (accounts(); as list) {
          <section class="panel accounts">
            <p class="label">{{ 'ads.chooseAccount' | t }}</p>
            @for (account of list; track account.id) {
              <button class="account" type="button" [class.on]="current.connection?.adAccountId === account.id"
                [disabled]="busy() || !usable(account)" (click)="choose(account)">
                <span class="strong-sm">{{ account.name }}</span>
                <span class="caption">{{ account.id }} · {{ account.currency ?? '—' }}{{ usable(account) ? '' : ' · ' + ('ads.accountClosed' | t) }}</span>
              </button>
            } @empty {
              <p class="caption">{{ 'ads.noAccounts' | t }}</p>
            }
          </section>
        }

        @if (form(); as f) {
          <section class="panel editor">
            <p class="label">{{ (f.id ? 'ads.form.titleEdit' : 'ads.form.titleNew') | t }}</p>

            <label class="field">
              <span class="label-sm">{{ 'ads.form.name' | t }}</span>
              <input class="sunken" [attr.maxlength]="limits.name" [placeholder]="'ads.form.namePlaceholder' | t" [value]="f.name" (input)="set('name', $any($event.target).value)" />
            </label>

            <label class="field">
              <span class="label-sm">{{ 'ads.form.link' | t }}</span>
              <input class="sunken" type="url" placeholder="https://" [value]="f.linkUrl" (input)="set('linkUrl', $any($event.target).value)" />
              <span class="caption">{{ 'ads.form.linkHint' | t }}</span>
            </label>

            <div class="field">
              <span class="label-sm">{{ 'ads.form.headlines' | t }}</span>
              <span class="caption">{{ 'ads.form.headlinesHint' | t: { min: limits.headlines.min, max: limits.headlines.max, chars: limits.headlines.chars } }}</span>
              @for (headline of f.headlines; track $index) {
                <div class="item">
                  <input class="sunken grow" [attr.maxlength]="limits.headlines.chars" [value]="headline" (input)="setItem('headlines', $index, $any($event.target).value)" />
                  <span class="count" [class.full]="headline.length >= limits.headlines.chars">{{ headline.length }}/{{ limits.headlines.chars }}</span>
                  <button class="icon-btn" type="button" [disabled]="f.headlines.length <= limits.headlines.min" [attr.aria-label]="'ads.form.removeItem' | t"
                    (click)="removeItem('headlines', $index)">
                    <mb-icon name="x" [size]="14" />
                  </button>
                </div>
              }
              @if (f.headlines.length < limits.headlines.max) {
                <button class="link-btn align-start" type="button" (click)="addItem('headlines')"><mb-icon name="plus" [size]="13" /> {{ 'ads.form.addHeadline' | t }}</button>
              }
            </div>

            <div class="field">
              <span class="label-sm">{{ 'ads.form.descriptions' | t }}</span>
              <span class="caption">{{ 'ads.form.descriptionsHint' | t: { min: limits.descriptions.min, max: limits.descriptions.max, chars: limits.descriptions.chars } }}</span>
              @for (description of f.descriptions; track $index) {
                <div class="item">
                  <textarea class="sunken grow" rows="2" [attr.maxlength]="limits.descriptions.chars" [value]="description"
                    (input)="setItem('descriptions', $index, $any($event.target).value)"></textarea>
                  <span class="count" [class.full]="description.length >= limits.descriptions.chars">{{ description.length }}/{{ limits.descriptions.chars }}</span>
                  <button class="icon-btn" type="button" [disabled]="f.descriptions.length <= limits.descriptions.min" [attr.aria-label]="'ads.form.removeItem' | t"
                    (click)="removeItem('descriptions', $index)">
                    <mb-icon name="x" [size]="14" />
                  </button>
                </div>
              }
              @if (f.descriptions.length < limits.descriptions.max) {
                <button class="link-btn align-start" type="button" (click)="addItem('descriptions')"><mb-icon name="plus" [size]="13" /> {{ 'ads.form.addDescription' | t }}</button>
              }
            </div>

            <div class="field">
              <span class="label-sm">{{ 'ads.form.keywords' | t }}</span>
              <span class="caption">{{ 'ads.form.keywordsHint' | t }}</span>
              <textarea class="sunken" rows="5" [value]="f.keywords" (input)="set('keywords', $any($event.target).value)"></textarea>
              <div class="row">
                <span class="caption">{{ 'ads.form.match' | t }}</span>
                <mb-select class="narrow" [options]="matchOptions()" [value]="f.match" (changed)="set('match', $any($event))" />
              </div>
            </div>

            <div class="field">
              <span class="label-sm">{{ 'ads.form.where' | t }}</span>
              <div class="chips">
                @for (code of countries; track code) {
                  <button class="chip" type="button" [class.on]="f.countries.includes(code)" (click)="toggleCountry(code)">{{ countryName(code) }}</button>
                }
              </div>
            </div>

            <div class="grid">
              <label class="field">
                <span class="label-sm">{{ 'ads.form.language' | t }}</span>
                <mb-select [options]="languageOptions()" [value]="f.language" (changed)="set('language', $event)" />
              </label>
              <label class="field">
                <span class="label-sm">{{ 'ads.form.budget' | t }}</span>
                <input class="sunken" type="number" inputmode="numeric" [attr.min]="limits.dailyBudget.min" [attr.max]="limits.dailyBudget.max" step="1"
                  [value]="f.dailyBudget" (input)="set('dailyBudget', $any($event.target).value)" />
                <span class="caption">{{ 'ads.form.currency' | t: { currency: currency() } }}</span>
              </label>
              <label class="field">
                <span class="label-sm">{{ 'ads.form.start' | t }}</span>
                <input class="sunken" type="date" [attr.min]="today" [value]="f.startsOn" (input)="set('startsOn', $any($event.target).value)" />
              </label>
              <div class="field">
                <span class="label-sm">{{ 'ads.form.end' | t }}</span>
                <input class="sunken" type="date" [attr.min]="f.startsOn" [disabled]="f.noEnd" [value]="f.endsOn" (input)="set('endsOn', $any($event.target).value)" />
                <label class="check">
                  <input type="checkbox" [checked]="f.noEnd" (change)="set('noEnd', $any($event.target).checked)" />
                  <span class="caption">{{ 'ads.form.noEnd' | t }}</span>
                </label>
              </div>
            </div>

            <p class="spend strong-sm">{{ spendLine() }}</p>

            <div class="preview">
              <span class="caption">{{ 'ads.form.preview' | t }}</span>
              <div class="serp">
                <span class="serp-top"><b>{{ 'ads.form.sponsored' | t }}</b> · {{ domain() }}</span>
                <span class="serp-title">{{ previewTitle() }}</span>
                <span class="serp-body">{{ f.descriptions[0] || '…' }}</span>
              </div>
            </div>

            <div class="row end">
              <button class="btn btn-ghost" type="button" [disabled]="busy()" (click)="form.set(null)">{{ 'ads.form.cancel' | t }}</button>
              <button class="btn btn-secondary" type="button" [disabled]="busy()" (click)="save(false)">{{ 'ads.form.save' | t }}</button>
              <button class="btn btn-primary" type="button" [disabled]="busy() || !canLaunch()" (click)="save(true)">{{ 'ads.form.saveAndLaunch' | t }}</button>
            </div>
          </section>
        }

        <section class="campaigns">
          <div class="row">
            <h2 class="grow subtitle">{{ 'ads.campaigns' | t }}</h2>
            @if (!form()) {
              <button class="btn btn-primary btn-sm" type="button" (click)="startNew()"><mb-icon name="plus" [size]="14" /> {{ 'ads.newCampaign' | t }}</button>
            }
          </div>
          @for (ad of current.ads; track ad.id) {
            <article class="panel campaign">
              <div class="row">
                <div class="grow texts">
                  <span class="name">
                    <span class="strong-sm">{{ ad.name }}</span>
                    <span class="badge" [class]="'st-' + ad.status">{{ statusLabel(ad.status) }}</span>
                  </span>
                  <span class="caption">{{ adLine(ad) }}</span>
                </div>
                <div class="actions">
                  @if (ad.status === 'draft' || ad.status === 'failed') {
                    <button class="btn btn-ghost btn-sm" type="button" [disabled]="busy()" (click)="edit(ad)">{{ 'ads.edit' | t }}</button>
                    <button class="btn btn-primary btn-sm" type="button" [disabled]="busy() || !canLaunch()" (click)="launch(ad)">{{ 'ads.launch' | t }}</button>
                  }
                  @if (active(ad)) {
                    <button class="btn btn-secondary btn-sm" type="button" [disabled]="busy()" (click)="pause(ad)">{{ 'ads.pause' | t }}</button>
                  }
                  @if (ad.status === 'paused') {
                    <button class="btn btn-secondary btn-sm" type="button" [disabled]="busy()" (click)="resume(ad)">{{ 'ads.resume' | t }}</button>
                  }
                  @if (ad.status !== 'deleted') {
                    <button class="icon-btn" type="button" [attr.aria-label]="'ads.remove' | t" [title]="'ads.remove' | t" [disabled]="busy()" (click)="remove(ad)">
                      <mb-icon name="trash" [size]="15" />
                    </button>
                  }
                </div>
              </div>
              @if (ad.error) {
                <p class="caption danger">{{ ad.error }}</p>
              }
              @if (ad.rejectionReason) {
                <p class="caption danger">{{ ad.rejectionReason }}</p>
              }
              @if (ad.status !== 'draft' && ad.status !== 'failed') {
                @if (ad.metrics; as m) {
                  <div class="metrics">
                    <div><span class="caption">{{ 'ads.spend' | t }}</span><span class="strong-sm">{{ money(m.spend, ad.currency) }}</span></div>
                    <div><span class="caption">{{ 'ads.impressions' | t }}</span><span class="strong-sm">{{ number(m.impressions) }}</span></div>
                    <div><span class="caption">{{ 'ads.clicks' | t }}</span><span class="strong-sm">{{ number(m.clicks) }}</span></div>
                    <div><span class="caption">{{ 'ads.ctr' | t }}</span><span class="strong-sm">{{ percent(m.ctr) }}</span></div>
                    <div><span class="caption">{{ 'ads.cpc' | t }}</span><span class="strong-sm">{{ money(m.cpc, ad.currency) }}</span></div>
                  </div>
                } @else {
                  <p class="caption">{{ 'ads.noMetrics' | t }}</p>
                }
              }
            </article>
          } @empty {
            <div class="panel empty small">
              <p class="strong-sm">{{ 'ads.none' | t }}</p>
              <p class="caption">{{ 'ads.noneHint' | t }}</p>
            </div>
          }
        </section>
      } @else {
        <div class="empty">
          <p class="strong-sm">{{ 'ads.loadFailed' | t }}</p>
          <button class="btn btn-secondary btn-sm" type="button" (click)="reload()">{{ 'common.retry' | t }}</button>
        </div>
      }
    </section>
  `,
  styles: `
    .ads {
      display: flex;
      flex-direction: column;
      gap: 20px;
      max-width: 860px;
      margin: 0 auto;
      animation: fade-up 240ms var(--ease);
    }
    .texts {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .title,
    .subtitle {
      margin: 0;
    }
    .subtitle {
      font-size: 1.05rem;
    }
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 48px 16px;
      text-align: center;
    }
    .empty.small {
      padding: 24px 12px;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }
    .row.end {
      justify-content: flex-end;
    }
    .grow {
      flex: 1 1 0;
      min-width: 0;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }
    .danger {
      color: var(--danger);
    }
    .platforms {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
      gap: 12px;
    }
    .tile {
      gap: 12px;
      min-height: 190px;
    }
    .tile.off {
      opacity: 0.55;
    }
    .tile-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    }
    .tile-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin-top: auto;
    }
    .mark {
      display: grid;
      flex: none;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: var(--grey-100);
      color: var(--text-title);
    }
    .mark svg {
      width: 24px;
      height: 24px;
    }
    .editor,
    .campaign {
      gap: 14px;
    }
    .accounts {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .account {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      padding: 10px 12px;
      border: 1px solid var(--grey-200);
      border-radius: 10px;
      background: transparent;
      text-align: left;
      cursor: pointer;
    }
    .account.on {
      border-color: var(--text-title);
    }
    .account:disabled {
      cursor: default;
      opacity: 0.6;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .item textarea {
      resize: vertical;
    }
    .count {
      flex: none;
      width: 44px;
      color: var(--text-muted);
      font-size: 0.75rem;
      text-align: right;
    }
    .count.full {
      color: var(--danger);
    }
    .align-start {
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .narrow {
      width: 200px;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip {
      padding: 6px 12px;
      border: 1px solid var(--grey-200);
      border-radius: 999px;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }
    .chip.on {
      border-color: var(--text-title);
      background: var(--grey-100);
      color: var(--text-title);
      font-weight: 600;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    .check {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }
    .preview {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .serp {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 14px 16px;
      border: 1px solid var(--grey-200);
      border-radius: 12px;
      background: var(--surface, transparent);
      font-family: Arial, Helvetica, sans-serif;
    }
    .serp-top {
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .serp-title {
      color: #1a0dab;
      font-size: 1.1rem;
      line-height: 1.3;
    }
    .serp-body {
      font-size: 0.875rem;
      line-height: 1.45;
    }
    .campaigns {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .name {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .st-active {
      color: var(--success, #1e7d32);
    }
    .st-rejected,
    .st-failed {
      color: var(--danger);
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
    }
    .metrics > div {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    @media (max-width: 640px) {
      .grid {
        grid-template-columns: 1fr;
      }
      .metrics {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .narrow {
        width: 100%;
      }
    }
  `,
})
export class AdsPage {
  private readonly ads = inject(AdsService);
  private readonly brands = inject(BrandsService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);
  protected readonly limits = L;
  protected readonly countries = COUNTRIES;
  // Le piattaforme che arriveranno: si vedono, ma non si collegano ancora.
  protected readonly logos = LOGOS;
  protected readonly upcoming: { key: 'meta' | 'linkedin' | 'openai'; name: string; hint: MessageKey }[] = [
    { key: 'meta', name: 'Meta', hint: 'ads.metaHint' },
    { key: 'linkedin', name: 'LinkedIn', hint: 'ads.linkedinHint' },
    { key: 'openai', name: 'OpenAI', hint: 'ads.openaiHint' },
  ];
  protected readonly today = day(new Date());

  private readonly brandId = computed(() => this.brands.activeBrand()?.id ?? null);
  protected readonly data = signal<AdsResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly accounts = signal<AdAccount[] | null>(null);
  protected readonly form = signal<Form | null>(null);

  protected readonly currency = computed(() => this.data()?.connection?.currency ?? 'EUR');
  // Si avvia solo con Google Ads collegato e l'account scelto.
  protected readonly canLaunch = computed(() => {
    const connection = this.data()?.connection;
    return Boolean(connection && !connection.lost && connection.adAccountId);
  });

  protected readonly matchOptions = computed<SelectOption[]>(() => [
    { value: 'phrase', label: this.i18n.t('ads.form.matchPhrase') },
    { value: 'exact', label: this.i18n.t('ads.form.matchExact') },
    { value: 'broad', label: this.i18n.t('ads.form.matchBroad') },
  ]);
  protected readonly languageOptions = computed<SelectOption[]>(() => {
    const names = new Intl.DisplayNames([this.i18n.locale()], { type: 'language' });
    return LANGUAGES.map((code) => ({ value: code, label: names.of(code) ?? code }));
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
  protected readonly spendLine = computed(() => {
    const f = this.form();
    const daily = Number(f?.dailyBudget);
    if (!f || !Number.isFinite(daily) || daily <= 0) return '';
    const total = maxSpend({ dailyBudget: daily, startsOn: f.startsOn, endsOn: f.noEnd ? null : f.endsOn || null });
    return total === null
      ? this.i18n.t('ads.form.openSpend', { daily: this.money(daily, this.currency()) })
      : this.i18n.t('ads.form.maxSpend', { total: this.money(total, this.currency()) });
  });

  constructor() {
    pageHeader(() => [{ label: this.i18n.t('shell.ads') }]);
    // Il ritorno da Google: l'indirizzo porta l'account collegato o l'errore, e va ripulito subito.
    const params = this.route.snapshot.queryParamMap;
    const returning = params.get('brand');
    if (returning) {
      const accountId = params.get('accountId');
      const failed = params.get('error');
      void this.router.navigate([], { queryParams: {}, replaceUrl: true });
      if (failed) this.toast.show(params.get('error_message') ?? this.i18n.t('ads.connectFailed'));
      else if (accountId) void this.finishConnect(returning, accountId);
    }
    effect(() => {
      const brandId = this.brandId();
      if (brandId)
        untracked(() => {
          this.form.set(null);
          this.accounts.set(null);
          void this.load(brandId);
        });
    });
  }

  protected reload(): void {
    const brandId = this.brandId();
    if (brandId) void this.load(brandId);
  }

  private async load(brandId: string): Promise<void> {
    this.loading.set(true);
    try {
      const data = await this.ads.list(brandId);
      if (this.brandId() !== brandId) return;
      this.data.set(data);
      // Collegato ma senza account scelto: si mostra subito la scelta.
      if (data.connection && !data.connection.lost && !data.connection.adAccountId && !this.accounts()) void this.loadAccounts();
    } catch (error) {
      if (this.brandId() === brandId) this.data.set(null);
      this.toast.show(errorMessage(error, this.i18n.t('ads.loadFailed')));
    } finally {
      if (this.brandId() === brandId) this.loading.set(false);
    }
  }

  // Un'azione: rilegge alla fine, e un errore lo dice il toast.
  private async act(work: (brandId: string) => Promise<unknown>, done?: string): Promise<boolean> {
    const brandId = this.brandId();
    if (!brandId || this.busy()) return false;
    this.busy.set(true);
    try {
      await work(brandId);
      if (done) this.toast.show(done);
      return true;
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('ads.failed')));
      return false;
    } finally {
      this.busy.set(false);
      await this.load(brandId);
    }
  }

  protected usable(account: AdAccount): boolean {
    return account.selected && account.status?.toUpperCase() !== 'CLOSED';
  }

  protected async connect(): Promise<void> {
    const brandId = this.brandId();
    if (!brandId || this.busy()) return;
    this.busy.set(true);
    try {
      const back = new URL('/campagne', window.location.origin);
      back.searchParams.set('brand', brandId);
      const { authUrl } = await this.ads.connect(brandId, back.toString());
      if (authUrl) {
        window.location.assign(authUrl);
        return;
      }
      await this.load(brandId);
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('ads.connectFailed')));
    } finally {
      this.busy.set(false);
    }
  }

  private async finishConnect(brandId: string, accountId: string): Promise<void> {
    this.busy.set(true);
    try {
      const { connection, accounts } = await this.ads.confirm(brandId, accountId);
      this.toast.show(this.i18n.t('ads.connected'));
      if (!connection.adAccountId) this.accounts.set(accounts);
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('ads.connectFailed')));
    } finally {
      this.busy.set(false);
      if (this.brandId() === brandId) await this.load(brandId);
    }
  }

  protected simulate(): void {
    void this.act((brandId) => this.ads.simulate(brandId), this.i18n.t('ads.connected'));
  }

  protected async loadAccounts(): Promise<void> {
    const brandId = this.brandId();
    if (!brandId) return;
    try {
      this.accounts.set((await this.ads.accounts(brandId)).accounts);
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('ads.failed')));
    }
  }

  protected async choose(account: AdAccount): Promise<void> {
    if (await this.act((brandId) => this.ads.chooseAccount(brandId, account.id))) this.accounts.set(null);
  }

  protected async disconnect(): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: this.i18n.t('ads.disconnectConfirm'),
      message: this.i18n.t('ads.disconnectMessage'),
      confirmLabel: this.i18n.t('ads.disconnect'),
      tone: 'danger',
    });
    if (confirmed && (await this.act((brandId) => this.ads.disconnect(brandId)))) this.accounts.set(null);
  }

  // L'editor.

  protected startNew(): void {
    const defaults = this.data()?.defaults;
    const language = defaults?.language ?? 'it';
    this.form.set({
      id: null,
      name: '',
      linkUrl: defaults?.linkUrl ?? '',
      headlines: ['', '', ''],
      descriptions: ['', ''],
      keywords: '',
      match: 'phrase',
      countries: [language === 'fr' ? 'FR' : language === 'en' ? 'GB' : 'IT'],
      language,
      dailyBudget: '10',
      startsOn: this.today,
      endsOn: addDays(this.today, 13),
      noEnd: false,
    });
  }

  protected edit(ad: Ad): void {
    this.form.set({
      id: ad.id,
      name: ad.name,
      linkUrl: ad.spec.linkUrl,
      headlines: [...ad.spec.headlines],
      descriptions: [...ad.spec.descriptions],
      keywords: ad.spec.keywords.map((keyword) => keyword.text).join('\n'),
      match: ad.spec.keywords[0]?.match ?? 'phrase',
      countries: [...ad.spec.countries],
      language: ad.spec.languages[0] ?? 'it',
      dailyBudget: String(ad.dailyBudget),
      startsOn: ad.startsOn < this.today ? this.today : ad.startsOn,
      endsOn: ad.endsOn ?? addDays(this.today, 13),
      noEnd: ad.endsOn === null,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected set<K extends keyof Form>(key: K, value: Form[K]): void {
    this.form.update((f) => (f ? { ...f, [key]: value } : f));
  }

  protected setItem(key: 'headlines' | 'descriptions', index: number, value: string): void {
    this.form.update((f) => (f ? { ...f, [key]: f[key].map((item, i) => (i === index ? value : item)) } : f));
  }

  protected addItem(key: 'headlines' | 'descriptions'): void {
    this.form.update((f) => (f ? { ...f, [key]: [...f[key], ''] } : f));
  }

  protected removeItem(key: 'headlines' | 'descriptions', index: number): void {
    this.form.update((f) => (f ? { ...f, [key]: f[key].filter((_, i) => i !== index) } : f));
  }

  protected toggleCountry(code: string): void {
    this.form.update((f) =>
      f ? { ...f, countries: f.countries.includes(code) ? f.countries.filter((c) => c !== code) : [...f.countries, code] } : f,
    );
  }

  private draftOf(f: Form): AdDraft {
    return {
      name: f.name.trim(),
      spec: {
        headlines: f.headlines.map((text) => text.trim()).filter(Boolean),
        descriptions: f.descriptions.map((text) => text.trim()).filter(Boolean),
        keywords: f.keywords
          .split('\n')
          .map((text) => text.trim().replace(/^["[+]+|["\]]+$/g, ''))
          .filter(Boolean)
          .map((text) => ({ text, match: f.match })),
        linkUrl: f.linkUrl.trim(),
        countries: f.countries,
        languages: [f.language],
      },
      dailyBudget: Math.round(Number(f.dailyBudget)),
      startsOn: f.startsOn,
      endsOn: f.noEnd ? null : f.endsOn || null,
    };
  }

  protected async save(andLaunch: boolean): Promise<void> {
    const f = this.form();
    const brandId = this.brandId();
    if (!f || !brandId || this.busy()) return;
    const draft = this.draftOf(f);
    if (andLaunch && !(await this.confirmLaunch(draft))) return;
    this.busy.set(true);
    let saved: Ad | null = null;
    try {
      saved = f.id ? await this.ads.update(brandId, f.id, draft) : await this.ads.create(brandId, draft);
      this.form.set(null);
      if (andLaunch) {
        await this.ads.launch(brandId, saved.id);
        this.toast.show(this.i18n.t('ads.launched'));
      } else {
        this.toast.show(this.i18n.t('ads.saved'));
      }
    } catch (error) {
      // La bozza non salvata resta nell'editor; quella salvata ma non partita resta nell'elenco con l'errore.
      if (!saved) this.form.set({ ...f });
      this.toast.show(errorMessage(error, this.i18n.t('ads.failed')));
    } finally {
      this.busy.set(false);
      await this.load(brandId);
    }
  }

  private confirmLaunch(ad: Pick<AdDraft, 'name' | 'dailyBudget' | 'startsOn' | 'endsOn'>): Promise<boolean> {
    const currency = this.currency();
    const total = maxSpend(ad);
    const daily = this.money(ad.dailyBudget, currency);
    const days = total === null ? 0 : Math.round(total / ad.dailyBudget);
    return this.confirm.ask({
      title: this.i18n.t('ads.launchConfirm', { name: ad.name }),
      message:
        total === null
          ? this.i18n.t('ads.launchMessageOpen', { daily })
          : this.i18n.t('ads.launchMessageMax', { total: this.money(total, currency), daily, days }),
      confirmLabel: this.i18n.t('ads.launchLabel'),
    });
  }

  protected async launch(ad: Ad): Promise<void> {
    if (!(await this.confirmLaunch(ad))) return;
    void this.act((brandId) => this.ads.launch(brandId, ad.id), this.i18n.t('ads.launched'));
  }

  protected pause(ad: Ad): void {
    void this.act((brandId) => this.ads.pause(brandId, ad.id), this.i18n.t('ads.paused'));
  }

  protected resume(ad: Ad): void {
    void this.act((brandId) => this.ads.resume(brandId, ad.id), this.i18n.t('ads.resumed'));
  }

  protected async remove(ad: Ad): Promise<void> {
    const draft = ad.status === 'draft' || ad.status === 'failed';
    const confirmed = await this.confirm.ask({
      title: this.i18n.t(draft ? 'ads.removeDraftConfirm' : 'ads.removeConfirm', { name: ad.name }),
      ...(!draft && { message: this.i18n.t('ads.removeMessage') }),
      confirmLabel: this.i18n.t('ads.remove'),
      tone: 'danger',
    });
    if (confirmed) void this.act((brandId) => this.ads.remove(brandId, ad.id), this.i18n.t('ads.removed'));
  }

  // Le righe.

  protected active(ad: Ad): boolean {
    return ACTIVE.includes(ad.status);
  }

  protected statusLabel(status: AdStatus): string {
    return this.i18n.t(`ads.status.${status}` as MessageKey);
  }

  protected countryName(code: string): string {
    return this.i18n.t(`ads.countries.${code}` as MessageKey);
  }

  private date(value: string): string {
    return new Intl.DateTimeFormat(this.i18n.locale(), { day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`));
  }

  protected adLine(ad: Ad): string {
    const dates = ad.endsOn
      ? this.i18n.t('ads.dates', { from: this.date(ad.startsOn), to: this.date(ad.endsOn) })
      : this.i18n.t('ads.datesOpen', { from: this.date(ad.startsOn) });
    const parts = [this.i18n.t('ads.perDay', { amount: this.money(ad.dailyBudget, ad.currency ?? this.currency()) }), dates];
    if (ad.syncedAt && ad.status !== 'draft') {
      const time = new Intl.DateTimeFormat(this.i18n.locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ad.syncedAt));
      parts.push(this.i18n.t('ads.syncedAt', { time }));
    }
    return parts.join(' · ');
  }

  protected money(value: number | null, currency: string | null): string {
    if (value === null) return '—';
    return new Intl.NumberFormat(this.i18n.locale(), { style: 'currency', currency: currency ?? 'EUR', maximumFractionDigits: value % 1 ? 2 : 0 }).format(value);
  }

  protected number(value: number | null): string {
    return value === null ? '—' : new Intl.NumberFormat(this.i18n.locale()).format(value);
  }

  protected percent(value: number | null): string {
    return value === null ? '—' : `${new Intl.NumberFormat(this.i18n.locale(), { maximumFractionDigits: 1 }).format(value)}%`;
  }
}
