import { describe, expect, it } from 'vitest'
import {
  defaultTargetLanguage,
  translationLanguageName,
  TRANSLATION_LANGUAGES,
} from '../src/translate/language'
import { guessLanguageFromText } from '../src/epub/language'

describe('Mongolian translation targets', () => {
  const traditional = 'ᠮᠣᠩᠭᠣᠯ ᠪᠢᠴᠢᠭ ᠬᠠᠭᠤᠯᠬᠤ ᠨᠠᠭᠠᠬᠤ '.repeat(4)
  it('offers two independently named script targets', () => {
    expect(TRANSLATION_LANGUAGES).toContain('mn-Cyrl')
    expect(TRANSLATION_LANGUAGES).toContain('mn-Mong')
    expect(translationLanguageName('mn-Mong')).toBe('Mongolian Traditional Script')
    expect(translationLanguageName('mn-Cyrl')).toBe('Mongolian (Cyrillic)')
  })
  it('recognizes traditional script without treating it as Latin or Russian', () => {
    expect(guessLanguageFromText(traditional)).toBe('mn-Mong')
    expect(defaultTargetLanguage('mn-Cyrl', traditional)).toBe('mn-Cyrl')
    expect(defaultTargetLanguage('mn-Mong', traditional)).toBe('en')
    expect(defaultTargetLanguage('mn-Mong', traditional, 'easy')).toBe('mn-Mong')
  })
})
