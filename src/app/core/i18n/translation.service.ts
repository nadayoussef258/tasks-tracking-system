import { Injectable, computed, signal } from '@angular/core';
import { formatDate } from '@angular/common';
import { EN, AR } from './translations';

export type Lang = 'en' | 'ar';

const STORAGE_KEY = 'tasks.lang';
const BOOTSTRAP_LTR = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';
const BOOTSTRAP_RTL = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.rtl.min.css';

const DATE_FORMATS: Record<string, { en: string; ar: string }> = {
  short: { en: 'MMM d', ar: 'd MMM' },
  medium: { en: 'MMM d, y', ar: 'd MMM y' },
  time: { en: 'MMM d · h:mm a', ar: 'd MMM · h:mm a' },
  full: { en: 'MMM d, y · h:mm a', ar: 'd MMM y · h:mm a' },
};

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private _lang = signal<Lang>(this.initialLang());
  readonly lang = this._lang.asReadonly();
  readonly isRtl = computed(() => this._lang() === 'ar');

  constructor() { this.apply(this._lang()); }

  toggle() { this.setLang(this._lang() === 'ar' ? 'en' : 'ar'); }

  setLang(lang: Lang) {
    if (lang === this._lang()) return;
    this._lang.set(lang);
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* private mode */ }
    this.apply(lang);
  }

  /** Translate a key; `{name}` placeholders come from params. */
  t(key: string, params?: Record<string, string | number | null | undefined>): string {
    const dict = (this._lang() === 'ar' ? AR : EN) as Record<string, string>;
    let text = dict[key] ?? (EN as Record<string, string>)[key] ?? key;
    if (params) for (const [k, v] of Object.entries(params)) text = text.split(`{${k}}`).join(String(v ?? ''));
    return text;
  }

  /** Department name in the current language. */
  deptName(d: { name_ar: string; name_en: string } | null | undefined): string {
    if (!d) return '';
    return this._lang() === 'ar' ? d.name_ar : d.name_en;
  }

  date(value: string | number | Date | null | undefined, format: keyof typeof DATE_FORMATS = 'medium'): string {
    if (value === null || value === undefined || value === '') return '';
    const lang = this._lang();
    // a bare 'YYYY-MM-DD' is a calendar date: read it as local, not UTC
    const v = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T00:00:00' : value;
    try { return formatDate(v, DATE_FORMATS[format][lang], lang === 'ar' ? 'ar' : 'en-US'); } catch { return ''; }
  }

  private initialLang(): Lang {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'ar' || saved === 'en') return saved;
    } catch { /* ignore */ }
    return 'ar';
  }

  private apply(lang: Lang) {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === 'ar' ? 'rtl' : 'ltr';
    const link = document.getElementById('bootstrap-css') as HTMLLinkElement | null;
    const href = lang === 'ar' ? BOOTSTRAP_RTL : BOOTSTRAP_LTR;
    if (link && link.href !== href) link.href = href;
    document.title = lang === 'ar' ? 'نظام متابعة المهام' : 'Tasks Tracking';
  }
}