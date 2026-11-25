import { describe, expect, it, vi } from 'vitest'
import { mainProcessProxyUrl } from '../src/main/main-process-proxy'

describe('main-process proxy bootstrap without a product update feed', () => {
  it('discovers a system proxy for an actual service when there is no environment proxy', async () => {
    const resolve = vi.fn(async () => 'PROXY 127.0.0.1:3128; DIRECT')
    expect(await mainProcessProxyUrl({}, resolve)).toBe('http://127.0.0.1:3128')
    expect(resolve).toHaveBeenCalledWith('https://api.anthropic.com/')
  })

  it('prefers an explicit HTTPS environment proxy without probing the system', async () => {
    const resolve = vi.fn(async () => 'PROXY other.test:8080')
    expect(
      await mainProcessProxyUrl(
        { HTTPS_PROXY: 'https://proxy.test:8443', HTTP_PROXY: 'http://other.test' },
        resolve,
      ),
    ).toBe('https://proxy.test:8443')
    expect(resolve).not.toHaveBeenCalled()
  })

  it('retains lower-case proxy environment support', async () => {
    expect(await mainProcessProxyUrl({ all_proxy: 'http://proxy.test:8080' }, vi.fn())).toBe(
      'http://proxy.test:8080',
    )
  })

  it('does not install a dispatcher for DIRECT or unavailable system settings', async () => {
    expect(await mainProcessProxyUrl({}, async () => 'DIRECT')).toBeUndefined()
    expect(
      await mainProcessProxyUrl({}, async () => {
        throw new Error('unavailable')
      }),
    ).toBeUndefined()
  })
})
