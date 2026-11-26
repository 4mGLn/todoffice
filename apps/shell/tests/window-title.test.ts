import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { shellWindowTitle } from '../src/main/window-title'

const home = { kind: 'home' as const, title: 'TodOffice', active: false }

describe('shellWindowTitle', () => {
  it('names the active document before the product, like other document programs', () => {
    expect(
      shellWindowTitle([home, { kind: 'hwp', title: '보고서.hwp', active: true }], 'TodOffice'),
    ).toBe('보고서.hwp - TodOffice')
  })

  it('is the product alone on Home', () => {
    expect(
      shellWindowTitle(
        [
          { ...home, active: true },
          { kind: 'docs', title: 'a.docx', active: false },
        ],
        'TodOffice',
      ),
    ).toBe('TodOffice')
  })

  it('uses an untitled tab name as the tab strip shows it', () => {
    expect(
      shellWindowTitle(
        [home, { kind: 'docs', title: '제목 없는 문서', active: true }],
        'TodOffice',
      ),
    ).toBe('제목 없는 문서 - TodOffice')
  })

  it('falls back to the product with no active tab or an empty title', () => {
    expect(shellWindowTitle([home], 'TodOffice')).toBe('TodOffice')
    expect(shellWindowTitle([home, { kind: 'pdf', title: '  ', active: true }], 'TodOffice')).toBe(
      'TodOffice',
    )
  })
})

/**
 * The main entry cannot be imported in a node test, so the wiring is read out
 * of the source: every tab change and language change re-titles the window,
 * and the renderer's <title> cannot overwrite it.
 */
describe('shell window title wiring', () => {
  const main = readFileSync(join(__dirname, '../src/main/index.ts'), 'utf8')

  it('re-titles on every tab change', () => {
    expect(main).toMatch(
      /win\.webContents\.send\(TABS_CHANNELS\.changed, manager\.list\(\)\)\s*\n\s*syncShellWindowTitle\(\)/,
    )
  })

  it('re-titles when the interface language changes', () => {
    const change = main.slice(main.indexOf('function changeUiLanguage('))
    expect(change.slice(0, change.indexOf('\n}'))).toContain('syncShellWindowTitle()')
    expect(main).toMatch(
      /HOME_CHANNELS\.setLanguage,[^]*?if \(isLang\(lang\)\) changeUiLanguage\(lang\)/,
    )
    expect(main).toMatch(/TABS_CHANNELS\.showLanguageMenu,[^]*?changeUiLanguage\(value\)/)
  })

  it('keeps the renderer document title from replacing it', () => {
    const create = main.slice(main.indexOf('function createShellWindow'))
    expect(create.slice(0, create.indexOf('const manager = new TabManager'))).toMatch(
      /win\.on\('page-title-updated', \(event\) => event\.preventDefault\(\)\)/,
    )
  })
})
