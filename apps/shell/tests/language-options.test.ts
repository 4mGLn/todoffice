import { LANGS } from '@genoffice/i18n'
import { describe, expect, it } from 'vitest'
import {
  LANGUAGE_MENU_TOOLTIP,
  LANG_OPTIONS,
  OTHER_LANGUAGES_LABEL,
  PINNED_LANG_OPTIONS,
} from '../src/shared/language-options'

describe('interface language shortcuts', () => {
  it('offers every supported locale exactly once', () => {
    expect(LANG_OPTIONS.map(({ value }) => value).sort()).toEqual([...LANGS].sort())
  })

  it('includes all four language descriptions independently of the active locale', () => {
    expect(Object.keys(LANGUAGE_MENU_TOOLTIP)).toEqual(['mn-Mong', 'mn-Cyrl', 'en', 'ko'])
    expect(LANGUAGE_MENU_TOOLTIP.en).toBe('Change the interface language')
    expect(LANGUAGE_MENU_TOOLTIP['mn-Cyrl']).toMatch(/\p{Script=Cyrillic}/u)
    expect(LANGUAGE_MENU_TOOLTIP['mn-Mong']).toMatch(/\p{Script=Mongolian}/u)
    expect(LANGUAGE_MENU_TOOLTIP.ko).toBe('인터페이스 언어 변경')
  })

  it('pins both Mongolian scripts, English and Korean in order', () => {
    expect(PINNED_LANG_OPTIONS).toEqual([
      { value: 'mn-Mong', label: 'ᠮᠣᠩᠭᠣᠯ ᠬᠡᠯᠡ' },
      { value: 'mn-Cyrl', label: 'Монгол хэл' },
      { value: 'en', label: 'English' },
      { value: 'ko', label: '한국어' },
    ])
    expect(Object.keys(OTHER_LANGUAGES_LABEL).sort()).toEqual([...LANGS].sort())
  })
})
