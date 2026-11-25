import { describe, expect, it } from 'vitest'
import { defaultEpubTargetLanguage } from '../src/translate/language'

describe('Mongolian EPUB script targets', () => {
  it('does not skip Cyrillic to Mongol bichig conversion as same-language content', () => {
    expect(defaultEpubTargetLanguage('mn-Mong', ['mn-Cyrl-MN'], '')).toBe('mn-Mong')
    expect(defaultEpubTargetLanguage('mn-Cyrl', ['mn-Mong-CN'], '')).toBe('mn-Cyrl')
    expect(defaultEpubTargetLanguage('mn-Mong', ['mn-CN'], '')).toBe('en')
    expect(defaultEpubTargetLanguage('mn-Cyrl', ['mn-MN'], '')).toBe('en')
    expect(defaultEpubTargetLanguage('mn-Mong', ['mn-Mong'], '', 'easy')).toBe('mn-Mong')
  })
})
