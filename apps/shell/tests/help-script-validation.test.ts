import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const checker = fileURLToPath(new URL('../../../tools/check-help-langs.mjs', import.meta.url))
const roots: string[] = []
const english = '# Fonts\n\n' + 'The editor keeps document fonts and their names. '.repeat(8)
const cyrillic = '# Үсгийн хэлбэр\n\n' + 'Монгол бичиг болон үсгийн хэлбэр. '.repeat(16)
// Script fixtures exercise the mechanical guard, not translation quality.
const mongolian = '# ᠮᠣᠩᠭᠣᠯ\n\n' + 'ᠮᠣᠩᠭᠣᠯ ᠪᠢᠴᠢᠭ '.repeat(32)

function checkHelp(cyrl: string, mong: string | null): ReturnType<typeof spawnSync> {
  const root = mkdtempSync(join(tmpdir(), 'todoffice-help-script-'))
  roots.push(root)
  const write = (path: string, content: string) => {
    const full = join(root, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
  write('tools/check-help-langs.mjs', '')
  copyFileSync(checker, join(root, 'tools/check-help-langs.mjs'))
  write('packages/i18n/src/index.ts', "export const LANGS = ['en', 'mn-Cyrl', 'mn-Mong']\n")
  const help = 'apps/shell/src/renderer/src/i18n/help/'
  write(help + 'help-registry.ts', "export const HELP_TOPICS = [{\n  id: 'fonts',\n}]\n")
  write(help + 'topics/fonts.en.md', english)
  write(help + 'topics/fonts.mn-Cyrl.md', cyrl)
  if (mong !== null) write(help + 'topics/fonts.mn-Mong.md', mong)
  const result = spawnSync(process.execPath, [join(root, 'tools/check-help-langs.mjs')], {
    encoding: 'utf8',
    timeout: 10000,
  })
  // A blocked child process is a test failure, never a passing validation.
  expect(result.error, 'the real help checker must execute').toBeUndefined()
  expect(result.stdout, 'the real checker must produce its coverage report').toContain('manual:')
  return result
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('Mongolian help script validation', () => {
  it('accepts independently present Cyrillic and Mongolian-script letters', () => {
    const result = checkHelp(cyrillic, mongolian)
    expect(result.status, String(result.stdout)).toBe(0)
  })

  it('rejects a Cyrillic copy presented as Mongol bichig', () => {
    const result = checkHelp(cyrillic, cyrillic)
    expect(result.stderr).toBe('')
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('mn-Mong: fonts: no mn-Mong script anywhere')
  })

  it('rejects Mongolian punctuation and shaping controls without letters', () => {
    const controls = '# Script\n\n' + '\u1800\u1801\u180b\u180c\u180d\u180e\u180f '.repeat(80)
    const result = checkHelp(cyrillic, controls)
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('mn-Mong: fonts: no mn-Mong script anywhere')
  })

  it('rejects a Latin-only article presented as Mongolian Cyrillic', () => {
    const result = checkHelp(
      '# Interface\n\n' + 'Different Latin words only. '.repeat(30),
      mongolian,
    )
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('mn-Cyrl: fonts: no mn-Cyrl script anywhere')
  })

  it('rejects an empty localized article', () => {
    const result = checkHelp(cyrillic, '')
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('mn-Mong: fonts: no mn-Mong script anywhere')
  })

  it('still rejects a missing localized article', () => {
    const result = checkHelp(cyrillic, null)
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('mn-Mong: missing fonts')
  })
})
