import { describe, expect, it } from 'vitest'
import { subscriptionConnectHelpUrl } from '../src/browser'

describe('TodOffice subscription connect links', () => {
  it('does not send users to an upstream product website', () => {
    for (const path of [
      'claude-code',
      'codex',
      'chatgpt',
      'free',
      null,
      undefined,
      '',
      'https://example.com',
    ]) {
      expect(subscriptionConnectHelpUrl(path)).toBe('')
    }
  })
})
