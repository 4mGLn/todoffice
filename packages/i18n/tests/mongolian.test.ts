import { describe, expect, it } from 'vitest'
import {
  LANGS,
  MONGOL_BICHIG_NAMES,
  MONGOLIAN_LOCALIZATION_STATUS,
  getMongolianTranslationCoverage,
  htmlDir,
  htmlLang,
  htmlWritingMode,
  localeProfile,
  mongolianCatalog,
  mongolianMessage,
  mongolianMessageReview,
  isUnchangedMongolianToken,
  normalizeLang,
  sameLanguageAndScript,
  withMongolianLocales,
} from '../src/index'

describe('Mongolian script identity', () => {
  it.each([
    ['mn', 'mn-Cyrl'],
    ['mn-MN', 'mn-Cyrl'],
    ['mn-CN', 'mn-Mong'],
    ['MN_mOnG_CN', 'mn-Mong'],
    ['mn-Mong-MN', 'mn-Mong'],
    ['mn-Cyrl-CN', 'mn-Cyrl'],
  ])('normalizes %s without discarding its script', (raw, expected) => {
    expect(normalizeLang(raw)).toBe(expected)
  })
  it('keeps traditional app writing separate from RTL and document layout', () => {
    expect(htmlLang('mn-Mong')).toBe('mn-Mong')
    expect(htmlLang('mn-Cyrl')).toBe('mn-Cyrl-MN')
    expect(htmlWritingMode('mn-Mong')).toBe('vertical-lr')
    expect(htmlWritingMode('mn-Cyrl')).toBe('horizontal-tb')
    expect(htmlDir('mn-Mong')).toBe('ltr')
    expect(localeProfile('mn-Mong')?.status).toBe('preview')
    expect(localeProfile('ru')).toBeNull()
    expect(normalizeLang('mn-Latn')).toBe('en')
    expect(MONGOL_BICHIG_NAMES).toEqual({
      english: 'Mongol bichig',
      contextualEnglish: 'Mongolian Traditional Script',
      cyrillic: 'Монгол бичиг',
      korean: '몽곫문자',
    })
  })
  it('distinguishes two Mongolian targets while preserving other language comparisons', () => {
    expect(sameLanguageAndScript('mn-Cyrl', 'mn-Mong')).toBe(false)
    expect(sameLanguageAndScript('mn-MN', 'mn-Cyrl')).toBe(true)
    expect(sameLanguageAndScript('mn-CN', 'mn-Mong')).toBe(true)
    expect(sameLanguageAndScript('mn-Mong', 'ru')).toBe(false)
    expect(sameLanguageAndScript('en-US', 'en-GB')).toBe(true)
    expect(sameLanguageAndScript(undefined, 'mn-Mong')).toBe(false)
  })
})

describe('Mongolian preview dictionaries', () => {
  it('distinguishes contextual drafts from sourced terms and technical names', () => {
    for (const label of [
      'Home',
      'File',
      'Insert',
      'Layout',
      'Settings',
      'Language',
      'Recent',
      'Projects',
    ]) {
      expect(mongolianMessage('mn-Mong', label).text).toMatch(/\p{Script=Mongolian}/u)
      expect(mongolianMessageReview('mn-Mong', label)).toBe('draft')
    }
    expect(mongolianMessageReview('mn-Mong', 'Copy')).toBe('source-backed')
    expect(mongolianMessageReview('mn-Mong', 'JSON')).toBe('unchanged')
    expect(mongolianMessageReview('mn-Mong', 'not translated')).toBe('missing')
    expect(mongolianMessage('mn-Mong', 'AI PDF').text).toBe('ᠫᠢ ᠳᠢ ᠡᠹ')
    expect(mongolianMessage('mn-Mong', 'Styles').text).toBe('ᠰᠲᠠᠶᠢᠯ')
    expect(mongolianMessage('mn-Mong', 'AI Markdown').text).toBe('ᠮᠠᠷᠺᠳᠠᠤᠨ')
    expect(getMongolianTranslationCoverage().draftReview).toBe('native-review-required')
  })
  it('uses independent real strings, rather than an English or Cyrillic alias', () => {
    expect(mongolianMessage('mn-Cyrl', 'Copy')).toEqual({
      text: 'Хуулах',
      translated: true,
      unchangedToken: false,
    })
    expect(mongolianMessage('mn-Mong', 'Copy')).toEqual({
      text: 'ᠬᠠᠭᠤᠯᠬᠤ',
      translated: true,
      unchangedToken: false,
    })
    for (const text of Object.values(mongolianCatalog('mn-Mong'))) {
      if (!isUnchangedMongolianToken(text)) expect(text).toMatch(/\p{Script=Mongolian}/u)
      expect(text).not.toMatch(/\p{Script=Cyrillic}/u)
    }
  })
  it('reports missing English fallback without presenting it as translated', () => {
    const missing = 'A deliberately missing {count} message'
    expect(mongolianMessage('mn-Mong', missing)).toEqual({
      text: missing,
      translated: false,
      unchangedToken: false,
    })
    expect(mongolianMessage('mn-Mong', 'JSON')).toEqual({
      text: 'JSON',
      translated: false,
      unchangedToken: true,
    })
    const coverage = getMongolianTranslationCoverage()
    expect(coverage.status).toBe('preview-incomplete')
    expect(coverage.scope).toBe('loaded-modules')
    expect(coverage.locales['mn-Mong']?.missingMessages).toContain(missing)
    expect(coverage.locales['mn-Mong']?.missingMessages).not.toContain('JSON')
    expect(MONGOLIAN_LOCALIZATION_STATUS).toBe('preview-incomplete')
  })
  it('preserves existing dictionary references, keys and unsupported parameter templates', () => {
    const old = {
      en: { copy: 'Copy', nested: { label: 'Cancel' }, count: 'Selected {n} files' },
      zh: { copy: '复制' },
    }
    const extended = withMongolianLocales(old)
    expect(extended.en).toBe(old.en)
    expect(extended.zh).toBe(old.zh)
    expect(extended['mn-Mong']).toEqual({
      copy: 'ᠬᠠᠭᠤᠯᠬᠤ',
      nested: { label: 'ᠪᠤᠯᠢ' },
      count: 'Selected {n} files',
    })
    expect(extended['mn-Cyrl'].copy).toBe('Хуулах')
    expect(LANGS.filter((lang) => !lang.startsWith('mn-'))).toHaveLength(22)
  })
})
