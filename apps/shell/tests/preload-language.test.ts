import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LANGS } from '@genoffice/i18n'
import { HOME_CHANNELS, type HomeApi } from '../src/shared/home-api'

const electronMocks = vi.hoisted(() => ({
  exposed: new Map<string, unknown>(),
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
}))
vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (name: string, api: unknown) => electronMocks.exposed.set(name, api),
  },
  ipcRenderer: {
    invoke: electronMocks.invoke,
    send: vi.fn(),
    on: electronMocks.on,
    removeListener: electronMocks.removeListener,
  },
  webUtils: { getPathForFile: () => '' },
}))
import '../src/preload/index'

const api = electronMocks.exposed.get('aiOffice') as HomeApi
beforeEach(() => electronMocks.invoke.mockReset())

describe('the actual shell preload language boundary', () => {
  it.each(LANGS)('round-trips canonical locale %s through the IPC API', async (lang) => {
    electronMocks.invoke.mockResolvedValueOnce(lang)
    await expect(api.getLanguage()).resolves.toBe(lang)
    expect(electronMocks.invoke).toHaveBeenLastCalledWith(HOME_CHANNELS.getLanguage)
    electronMocks.invoke.mockResolvedValueOnce(undefined)
    await expect(api.setLanguage(lang)).resolves.toBeUndefined()
    expect(electronMocks.invoke).toHaveBeenLastCalledWith(HOME_CHANNELS.setLanguage, lang)
  })

  it.each(
    [null, undefined, 42, {}, [], '', 'mn', 'mn-CN', 'constructor', '__proto__'].map((value) => [
      value,
    ]),
  )('retains the invalid-value guard for %j', async (value) => {
    electronMocks.invoke.mockResolvedValueOnce(value)
    await expect(api.getLanguage()).resolves.toBe('zh')
    electronMocks.invoke.mockReset()
    const setUntrusted = api.setLanguage as (lang: unknown) => Promise<void>
    await expect(setUntrusted(value)).rejects.toThrow('Invalid language.')
    expect(electronMocks.invoke).not.toHaveBeenCalled()
  })

  it('delivers valid native language changes and unsubscribes', () => {
    const handler = vi.fn()
    const unsubscribe = api.onLanguageChanged(handler)
    const [channel, listener] = electronMocks.on.mock.lastCall!
    expect(channel).toBe('app:language-changed')
    listener({}, 'mn-Mong')
    listener({}, 'mn')
    expect(handler.mock.calls).toEqual([['mn-Mong']])
    unsubscribe()
    expect(electronMocks.removeListener).toHaveBeenCalledWith(channel, listener)
  })
})
