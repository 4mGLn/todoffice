import {
  CYRILLIC_MESSAGES,
  MONGOLIAN_CATALOG_REVIEW,
  TRADITIONAL_MESSAGES,
} from './mongolian-sourced-catalogs'
import { isMongolianLang, type MongolianLang } from './mongolian-locales'
import { DRAFT_TRADITIONAL_MESSAGES } from './mongolian-ui-drafts'

const catalogs: Record<MongolianLang, Readonly<Record<string, string>>> = {
  'mn-Cyrl': CYRILLIC_MESSAGES,
  'mn-Mong': { ...DRAFT_TRADITIONAL_MESSAGES, ...TRADITIONAL_MESSAGES },
}

/** These are previews, not declarations of complete interface localization. */
export const MONGOLIAN_LOCALIZATION_STATUS = 'preview-incomplete' as const

// Exact technical/product tokens legitimately stay unchanged. Never use a
// broad ASCII allowlist: that would turn untranslated English into coverage.
const UNCHANGED_TOKENS = new Set([
  '',
  'HWPX',
  'EPUB',
  'CSV',
  'JSON',
  'API',
  'URL',
  'HTTP',
  'HTTPS',
  'UTF-8',
  'RGB',
  'CMYK',
  'A4',
  'A3',
  'GenOffice',
  'IeumOffice',
  'TodOffice',
  'Claude',
  'Codex',
  'ChatGPT',
])
const encountered = new Set<string>()

export interface MongolianMessageResult {
  readonly text: string
  readonly translated: boolean
  readonly unchangedToken: boolean
}

export function mongolianMessage(lang: MongolianLang, english: string): MongolianMessageResult {
  encountered.add(english)
  const translated = catalogs[lang][english]
  if (translated !== undefined) return { text: translated, translated: true, unchangedToken: false }
  if (UNCHANGED_TOKENS.has(english))
    return { text: english, translated: false, unchangedToken: true }
  return { text: english, translated: false, unchangedToken: false }
}

export function mongolianCatalog(lang: MongolianLang): Readonly<Record<string, string>> {
  return catalogs[lang]
}

/** Authored drafts remain distinguishable from imported, source-backed terms. */
export function mongolianMessageReview(lang: MongolianLang, english: string) {
  if ((lang === 'mn-Mong' ? TRADITIONAL_MESSAGES : CYRILLIC_MESSAGES)[english] !== undefined)
    return 'source-backed' as const
  if (lang === 'mn-Mong' && DRAFT_TRADITIONAL_MESSAGES[english] !== undefined)
    return 'draft' as const
  return UNCHANGED_TOKENS.has(english) ? ('unchanged' as const) : ('missing' as const)
}

export function isUnchangedMongolianToken(text: string): boolean {
  return UNCHANGED_TOKENS.has(text)
}

/** Recursively translate dictionary values; object keys and parameters survive. */
function translateValues(value: unknown, lang: MongolianLang): unknown {
  if (typeof value === 'string') return mongolianMessage(lang, value).text
  if (Array.isArray(value)) return value.map((entry) => translateValues(entry, lang))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, translateValues(entry, lang)]),
    )
  }
  return value
}

/**
 * Preserve the existing locale dictionaries verbatim, adding two independent
 * preview editions. Missing translations use a reported English fallback;
 * check-mongolian-coverage.mjs treats every such fallback as incomplete.
 */
export function withMongolianLocales<T extends { en: unknown }>(
  base: T,
): T & Record<MongolianLang, T['en']> {
  const existing = base as T & Partial<Record<MongolianLang, T['en']>>
  return {
    ...base,
    'mn-Cyrl': existing['mn-Cyrl'] ?? translateValues(base.en, 'mn-Cyrl'),
    'mn-Mong': existing['mn-Mong'] ?? translateValues(base.en, 'mn-Mong'),
  } as T & Record<MongolianLang, T['en']>
}

/** Loaded-module coverage only; the source-wide checker covers all editors. */
export function getMongolianTranslationCoverage() {
  const source = [...encountered].filter((message) => !UNCHANGED_TOKENS.has(message)).sort()
  return {
    status: MONGOLIAN_LOCALIZATION_STATUS,
    review: MONGOLIAN_CATALOG_REVIEW,
    draftReview: 'native-review-required' as const,
    scope: 'loaded-modules' as const,
    sourceMessages: source.length,
    locales: Object.fromEntries(
      (['mn-Cyrl', 'mn-Mong'] as const).map((lang) => {
        const missing = source.filter((message) => catalogs[lang][message] === undefined)
        return [
          lang,
          {
            translatedMessages: source.length - missing.length,
            missingMessages: missing,
            draftMessages: source.filter(
              (message) => mongolianMessageReview(lang, message) === 'draft',
            ).length,
          },
        ]
      }),
    ),
  }
}

export function isPreviewUiLanguage(lang: string): boolean {
  return isMongolianLang(lang)
}

export * from './mongolian-locales'
