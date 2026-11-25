/** Mongolian script identities are distinct even though they share a language. */
export type MongolianLang = 'mn-Cyrl' | 'mn-Mong'

export interface MongolianLocaleProfile {
  readonly script: 'Cyrl' | 'Mong'
  readonly writingMode: 'horizontal-tb' | 'vertical-lr'
  readonly label: string
  readonly contextualName: string
  readonly htmlLanguage: string
  readonly status: 'preview'
}

export const MONGOLIAN_LOCALE_PROFILES: Readonly<Record<MongolianLang, MongolianLocaleProfile>> = {
  'mn-Cyrl': {
    script: 'Cyrl',
    writingMode: 'horizontal-tb',
    label: 'Монгол (кирилл)',
    contextualName: 'Mongolian (Cyrillic)',
    htmlLanguage: 'mn-Cyrl-MN',
    status: 'preview',
  },
  'mn-Mong': {
    script: 'Mong',
    writingMode: 'vertical-lr',
    label: 'Монгол бичиг',
    contextualName: 'Mongolian Traditional Script',
    htmlLanguage: 'mn-Mong',
    status: 'preview',
  },
}

/** Public naming supplied for the TodOffice Mongol bichig experience. */
export const MONGOL_BICHIG_NAMES = {
  english: 'Mongol bichig',
  contextualEnglish: 'Mongolian Traditional Script',
  cyrillic: 'Монгол бичиг',
  korean: '몽곫문자',
} as const

export function isMongolianLang(value: unknown): value is MongolianLang {
  return value === 'mn-Cyrl' || value === 'mn-Mong'
}

/** Explicit script subtags win; the region defaults follow CLDR likely subtags. */
export function mongolianLangFromTag(value: string | null | undefined): MongolianLang | undefined {
  const parts = value?.trim().toLowerCase().replace(/_/g, '-').split('-')
  if (!parts || parts[0] !== 'mn') return undefined
  if (parts.includes('mong')) return 'mn-Mong'
  if (parts.includes('cyrl')) return 'mn-Cyrl'
  // An explicit unsupported script must not silently become Cyrillic.
  if (parts.slice(1).some((part) => /^[a-z]{4}$/.test(part))) return undefined
  if (parts.includes('cn')) return 'mn-Mong'
  return 'mn-Cyrl'
}

export function localeProfile(value: string | null | undefined): MongolianLocaleProfile | null {
  const lang = mongolianLangFromTag(value)
  return lang ? MONGOLIAN_LOCALE_PROFILES[lang] : null
}

/** Text flow for app chrome. Document layout is a separate, explicit setting. */
export function htmlWritingMode(value: string | null | undefined): 'horizontal-tb' | 'vertical-lr' {
  return localeProfile(value)?.writingMode ?? 'horizontal-tb'
}

/** Script-sensitive language identity, unlike comparing only the primary subtag. */
export function sameLanguageAndScript(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a?.trim() || !b?.trim()) return false
  const ma = mongolianLangFromTag(a)
  const mb = mongolianLangFromTag(b)
  if (ma || mb) return ma !== undefined && ma === mb
  return a.trim().toLowerCase().split(/[-_]/)[0] === b.trim().toLowerCase().split(/[-_]/)[0]
}
