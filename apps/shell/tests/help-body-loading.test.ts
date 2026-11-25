/** @vitest-environment jsdom */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider, useI18n } from '../src/renderer/src/locale'
import { HelpScreen } from '../src/renderer/src/i18n/help/HelpScreen'
import { topicTitle } from '../src/renderer/src/i18n/help/help-titles'

const delayed = vi.hoisted(() => ({
  requests: [] as Array<{ id: string; lang: string; resolve: (text: string | null) => void }>,
}))
vi.mock('../src/renderer/src/i18n/help/help-registry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/renderer/src/i18n/help/help-registry')>()),
  helpBody: (id: string, lang: string) =>
    new Promise<string | null>((resolve) => delayed.requests.push({ id, lang, resolve })),
}))

// These controlled payloads test loading identity, not translation accuracy.
const PREVIOUS_BODY = 'Previously loaded article payload'
const NEXT_BODY = 'Newly loaded article payload'
let host: HTMLDivElement
let root: Root

function Controls() {
  const { setLang } = useI18n()
  return createElement(
    'button',
    { id: 'switch-script', onClick: () => setLang('mn-Mong') },
    'Switch',
  )
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.stubGlobal('aiOffice', { setLanguage: vi.fn().mockResolvedValue(undefined) })
  Element.prototype.scrollTo ??= function scrollTo(): void {}
  history.replaceState(null, '', '/?mode=help&topic=getting-started')
  delayed.requests.length = 0
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  act(() => {
    root.render(
      createElement(LocaleProvider, {
        initial: 'ja',
        children: [
          createElement(Controls, { key: 'controls' }),
          createElement(HelpScreen, { key: 'help' }),
        ],
      }),
    )
  })
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})

async function finish(index: number, text: string) {
  await act(async () => delayed.requests[index]!.resolve(`# Heading\n\n${text}`))
}

describe('help bodies remain attached to the requested topic and language', () => {
  it('clears the previous body when switching to traditional Mongolian', async () => {
    await finish(0, PREVIOUS_BODY)
    expect(host.querySelector('.help-article')?.textContent).toContain(PREVIOUS_BODY)
    await act(async () => {
      host.querySelector<HTMLButtonElement>('#switch-script')!.click()
    })
    expect(delayed.requests[1]).toMatchObject({ id: 'getting-started', lang: 'mn-Mong' })
    expect(host.querySelector('.help-article')?.getAttribute('lang')).toBe('mn-Mong')
    expect(host.querySelector('.help-language-fallback')).toBeNull()
    expect(host.querySelector('.help-article')?.textContent).not.toContain(PREVIOUS_BODY)
    await finish(1, NEXT_BODY)
    expect(host.querySelector('.help-article')?.textContent).toContain(NEXT_BODY)
  })

  it('clears the previous topic body while the next topic chunk is delayed', async () => {
    await finish(0, PREVIOUS_BODY)
    const fonts = [...host.querySelectorAll<HTMLButtonElement>('.help-topic')].find(
      (button) => button.textContent === topicTitle('fonts', 'ja'),
    )!
    act(() => fonts.click())
    expect(delayed.requests[1]).toMatchObject({ id: 'fonts', lang: 'ja' })
    expect(host.querySelector('.help-article')?.textContent).not.toContain(PREVIOUS_BODY)
    await finish(1, NEXT_BODY)
    expect(host.querySelector('.help-article')?.textContent).toContain(NEXT_BODY)
  })
})
