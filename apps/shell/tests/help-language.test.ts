/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import type { Lang } from '@genoffice/i18n'
import { LocaleProvider } from '../src/renderer/src/locale'
import { HelpScreen } from '../src/renderer/src/i18n/help/HelpScreen'
import * as helpRegistry from '../src/renderer/src/i18n/help/help-registry'

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root

import gettingStarted from '../src/renderer/src/i18n/help/topics/getting-started.en.md?raw'
import gettingStartedJa from '../src/renderer/src/i18n/help/topics/getting-started.ja.md?raw'
import gettingStartedZh from '../src/renderer/src/i18n/help/topics/getting-started.zh.md?raw'
import gettingStartedZhTW from '../src/renderer/src/i18n/help/topics/getting-started.zh-TW.md?raw'
import gettingStartedDe from '../src/renderer/src/i18n/help/topics/getting-started.de.md?raw'
import gettingStartedMnCyrl from '../src/renderer/src/i18n/help/topics/getting-started.mn-Cyrl.md?raw'
import gettingStartedMnMong from '../src/renderer/src/i18n/help/topics/getting-started.mn-Mong.md?raw'
import { topicTitle } from '../src/renderer/src/i18n/help/help-titles'

const TOPIC = 'getting-started'

/**
 * A run of prose lifted out of each edition of one topic, rather than a phrase
 * typed in here: the manual is edited, and a hand-copied sentence would fail
 * the moment a translator reworded it without saying anything about languages.
 *
 * Both the body and the title are looked up by short code, so both are what a
 * BCP-47 tag misses — the body falls back to English, and so does the title.
 */
function proseFrom(markdown: string): string {
  const line = markdown
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 60 && !/[#|*!`[\]]/.test(l))
  if (!line) throw new Error('no prose line to sample')
  // A slice from the middle: the start of a line tends to carry a heading or a
  // list the renderer rewrites. Collapsed first, because the renderer collapses
  // runs of whitespace and a sample spanning one would never match.
  const flat = line.replace(/\s+/g, ' ')
  const at = Math.floor(flat.length / 2)
  return flat.slice(at, at + 24).trim()
}

const BODIES: Partial<Record<Lang, string>> = {
  en: proseFrom(gettingStarted),
  ja: proseFrom(gettingStartedJa),
  zh: proseFrom(gettingStartedZh),
  'zh-TW': proseFrom(gettingStartedZhTW),
  de: proseFrom(gettingStartedDe),
  'mn-Cyrl': proseFrom(gettingStartedMnCyrl),
  'mn-Mong': proseFrom(gettingStartedMnMong),
}

const TITLES: Partial<Record<Lang, string>> = {
  en: topicTitle(TOPIC, 'en'),
  ja: topicTitle(TOPIC, 'ja'),
  zh: topicTitle(TOPIC, 'zh'),
  'zh-TW': topicTitle(TOPIC, 'zh-TW'),
  de: topicTitle(TOPIC, 'de'),
  'mn-Cyrl': topicTitle(TOPIC, 'mn-Cyrl'),
  'mn-Mong': topicTitle(TOPIC, 'mn-Mong'),
}

beforeEach(() => {
  // jsdom implements neither of these, and the screen calls both on render
  Element.prototype.scrollTo ??= function scrollTo(): void {}
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  vi.restoreAllMocks()
  act(() => root.unmount())
  host.remove()
})

/**
 * Wait for the screen to stop changing.
 *
 * The body arrives through a dynamic import and then a state update, so how
 * long that takes is not something a fixed number of ticks can promise — one
 * tick was enough for the first language and not the fifth. Polling until the
 * text stops growing is what the assertion actually depends on.
 */
/**
 * Wait until the article actually contains what the caller is about to assert.
 *
 * Polling for "the text stopped changing" was flaky: the sidebar is there from
 * the first paint and the body lands a tick or two later, so the screen can sit
 * unchanged for a turn and then change anyway. Waiting for the expected phrase
 * is the same thing the assertion does, and it cannot stop early.
 */
async function settle(host: HTMLDivElement, expected: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const text = host.querySelector('.help-article')?.textContent?.replace(/\s+/g, ' ') ?? ''
    if (text.includes(expected)) return
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1))
    })
  }
}

async function render(lang: Lang, expected: string, htmlLang = 'en-US'): Promise<HTMLDivElement> {
  // the document tag is the trap: it is always the BCP-47 form, and reading it
  // is exactly the bug. Every case sets it to something that would break.
  document.documentElement.lang = htmlLang
  act(() => root.unmount())
  root = createRoot(host)
  act(() => {
    root.render(
      createElement(LocaleProvider, { initial: lang, children: createElement(HelpScreen) }),
    )
  })
  // Open the topic by name rather than taking the one that happens to be first:
  // adding an article would otherwise move this test's subject out from under it.
  const button = [...host.querySelectorAll('button.help-topic')].find(
    (b) => b.textContent?.trim() === topicTitle(TOPIC, lang),
  )
  if (button) {
    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
  }
  await settle(host, expected)
  return host
}

/** the article heading, which is the one place `topicTitle` drives */
function heading(root: HTMLDivElement): string {
  return root.querySelector('h1')?.textContent ?? ''
}

describe('the manual renders in the reader’s language', () => {
  it.each(['mn-Cyrl', 'mn-Mong'] as const)(
    'labels untranslated %s help as English and resets its text direction',
    async (lang) => {
      const load = helpRegistry.helpBody
      const hasBody = helpRegistry.helpHasBody
      vi.spyOn(helpRegistry, 'helpHasBody').mockImplementation((id, locale) =>
        id === TOPIC && locale === lang ? false : hasBody(id, locale),
      )
      vi.spyOn(helpRegistry, 'helpBody').mockImplementation((id, locale) =>
        load(id, id === TOPIC && locale === lang ? 'en' : locale),
      )
      const view = await render(lang, BODIES.en!, lang)
      const notice = view.querySelector('.help-language-fallback')
      const article = view.querySelector<HTMLElement>('.help-article')
      expect(notice?.textContent).toContain(`not yet available in ${lang}`)
      expect(notice?.textContent).toContain('Showing the English manual')
      expect(notice?.getAttribute('lang')).toBe('en')
      expect(article?.textContent).toContain(BODIES.en!)
      expect(article?.lang).toBe('en')
      expect(article?.dir).toBe('ltr')
      expect(article?.style.writingMode).toBe('horizontal-tb')
      expect(article?.style.textOrientation).toBe('mixed')
      expect(heading(view)).toBe(TITLES.en)
    },
  )

  it.each(['mn-Cyrl', 'mn-Mong'] as const)('renders the shipped %s help body', async (lang) => {
    const phrase = BODIES[lang]!
    const view = await render(lang, phrase, lang)
    const article = view.querySelector<HTMLElement>('.help-article')
    expect(view.querySelector('.help-language-fallback')).toBeNull()
    expect(article?.lang).toBe(lang)
    expect(article?.textContent?.replace(/\s+/g, ' ')).toContain(phrase)
    expect(article?.style.writingMode).toBe('')
  })

  it('resolves each topic body in the language asked for', async () => {
    for (const [lang, phrase] of Object.entries(BODIES) as Array<[Lang, string]>) {
      const body = await helpRegistry.helpBody(TOPIC, lang)
      expect((body ?? '').replace(/\s+/g, ' '), `body for ${lang}`).toContain(phrase)
    }
  })

  it("titles the article in the shell's language, not the document tag's", async () => {
    // The wiring claim, on the heading alone. `topicTitle` has its own table
    // and the same failure mode — an unknown key misses every row and lands on
    // English — and the sidebar renders the same title through the same
    // function, so asserting on the whole screen would paper over a heading
    // that fell back.
    for (const [lang, title] of Object.entries(TITLES) as Array<[Lang, string]>) {
      // the document tag is deliberately a tag the lookups have to reject
      const view = await render(lang, title, `${lang}-XX`)
      expect(heading(view), `heading for ${lang}`).toBe(title)
      expect(view.querySelector('.help-language-fallback')).toBeNull()
    }
  })

  it("does not hand back another language's body", async () => {
    // zh and zh-TW are separate files, not a variant of one: the Simplified
    // text appearing in the Traditional one is the failure `startsWith('zh')`
    // would have shipped
    const traditional = (await helpRegistry.helpBody(TOPIC, 'zh-TW')) ?? ''
    expect(traditional).toContain(BODIES['zh-TW']!)
    expect(traditional).not.toContain(BODIES.zh!)
    expect(traditional).not.toContain(BODIES.en!)
  })
})
