import { SITE } from './site';

/** H0 = one global English variant (x-default + en-GB self-reference). See plan §3.1. */
export const HREFLANG_PHASE: 'H0' | 'H1' = 'H0';

export const LOCALES = {
  'en-GB': { path: '', region: 'United Kingdom' },
  'en-US': { path: '/en-us', region: 'United States' },
  'en-SG': { path: '/en-sg', region: 'Singapore' },
  'en-AE': { path: '/en-ae', region: 'United Arab Emirates' },
} as const;
export type Locale = keyof typeof LOCALES;

/** H1: only locales that actually ship a variant may appear, en-GB first (= the x-default target). */
export const PUBLISHED_LOCALES: Locale[] = ['en-GB'];

export function localeMapFor(path: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const l of PUBLISHED_LOCALES) {
    const url = `${SITE.origin}${LOCALES[l].path}${path}`;
    map[l] = url;
    map['x-default'] ??= url;
  }
  return map;
}

/** Emitted on hub / brand URLs only — never on the 217 deep topic pages. */
export function alternatesFor(path: string): Record<string, string> {
  if (HREFLANG_PHASE === 'H0') {
    const url = `${SITE.origin}${path}`;
    return { 'x-default': url, 'en-GB': url };
  }
  return localeMapFor(path);
}
