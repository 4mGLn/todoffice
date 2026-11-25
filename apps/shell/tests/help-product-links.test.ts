import { describe, expect, it } from 'vitest'
import { withoutUpstreamProductLinks } from '../src/renderer/src/i18n/help/help-product-links'

describe('TodOffice inherited help service links', () => {
  it('does not advertise upstream downloads or support as TodOffice services', () => {
    const text =
      '[Download](https://github.com/pblsketch/ieumoffice/releases/latest) [Support](https://ieumoffice.com/help)'
    expect(withoutUpstreamProductLinks(text)).toBe('Download Support')
  })
  it('keeps source attribution and internal manual links intact', () => {
    const text =
      '[Upstream](https://github.com/genspark-ai/genoffice) [License](https://github.com/pblsketch/ieumoffice/blob/main/LICENSE) [Docs](help://docs)'
    expect(withoutUpstreamProductLinks(text)).toBe(text)
  })
})
