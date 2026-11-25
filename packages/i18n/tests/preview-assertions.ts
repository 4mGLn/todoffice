import { expect } from 'vitest'
import { LANGS, isMongolianLang, mongolianMessage, type LegacyLang } from '../src/index'

/** Existing translated editions remain subject to all their original checks. */
export const ESTABLISHED_TEST_LANGS = LANGS.filter(
  (lang): lang is LegacyLang => !isMongolianLang(lang),
)
export const PREVIEW_TEST_LANGS = ['mn-Cyrl', 'mn-Mong'] as const

/** Assert the actual preview contract, including every explicitly missing string. */
export function expectPreviewDictionary(
  lang: (typeof PREVIEW_TEST_LANGS)[number],
  actual: unknown,
  english: unknown,
  location: string = lang,
): void {
  if (typeof english === 'string') {
    const result = mongolianMessage(lang, english)
    expect(actual, location).toBe(result.text)
    if (!result.translated && !result.unchangedToken)
      expect(actual, `${location}: explicit English fallback`).toBe(english)
    return
  }
  if (Array.isArray(english)) {
    expect(Array.isArray(actual), location).toBe(true)
    expect((actual as unknown[]).length, location).toBe(english.length)
    english.forEach((value, index) =>
      expectPreviewDictionary(lang, (actual as unknown[])[index], value, `${location}[${index}]`),
    )
    return
  }
  if (english !== null && typeof english === 'object') {
    expect(actual !== null && typeof actual === 'object', location).toBe(true)
    expect(Object.keys(actual as object).sort(), location).toEqual(Object.keys(english).sort())
    for (const [key, value] of Object.entries(english))
      expectPreviewDictionary(
        lang,
        (actual as Record<string, unknown>)[key],
        value,
        `${location}.${key}`,
      )
    return
  }
  expect(actual, location).toBe(english)
}
