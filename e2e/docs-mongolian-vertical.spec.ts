import { test, expect } from '@playwright/test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseDocx, readSectionSettings } from '../packages/docx-engine/src/index'
import { launchShell, closeAndSaveVideo, waitForPageWithUrl } from './helpers'
import {
  mongolianDocxFixture,
  MONGOL_BICHIG_SAMPLE,
  MONGOLIAN_CYRILLIC_SAMPLE,
} from './mongolian-docx-fixture'

/** Chromium rendering and actual file save; keyboard.insertText exercises text
 * entry, not a native OS Mongolian IME or Word interoperability. */
test('explicit Mongol bichig section direction renders vertical-lr and saves exact text', async () => {
  test.setTimeout(180_000)
  const dir = mkdtempSync(join(tmpdir(), 'todoffice-mongolian-'))
  const path = join(dir, 'mongol-bichig.docx')
  writeFileSync(path, await mongolianDocxFixture())
  const launched = await launchShell({
    onboardingSeen: true,
    videoDir: 'mongolian-vertical',
    openFile: path,
  })
  try {
    const page = await waitForPageWithUrl(launched.app, '/docs/')
    await expect(page.locator('.ProseMirror').first()).toBeVisible()
    // Opening a horizontal file never rotates it based on UI language.
    await expect(page.locator('.doc-vert-tbLrV')).toHaveCount(0)
    await page.locator('.ribbon-tab', { hasText: /^Layout$/ }).click()
    await page.getByLabel('Text direction', { exact: true }).selectOption('tbLrV')
    // Font loading schedules pagination's temporary horizontal measurement pass.
    // Finish it before taking one synchronous snapshot of the visible layout.
    await page.evaluate(async () => {
      await document.fonts.load('20px "TodOffice Mongolian Fallback"', 'ᠮᠣᠩᠭᠣᠯ \u{11660}\u{1166c}')
      await document.fonts.ready
    })
    const paragraphs = page.locator('.doc-page:not(.measuring-columns) .doc-vert-tbLrV')
    await expect(paragraphs.first()).toHaveCSS('writing-mode', 'vertical-lr')
    const geometry = await paragraphs.first().evaluate((first) => {
      const second = first.nextElementSibling!
      const walker = document.createTreeWalker(first, NodeFilter.SHOW_TEXT)
      const text = walker.nextNode()!
      const glyphRect = (offset: number) => {
        const range = document.createRange()
        range.setStart(text, offset)
        range.setEnd(text, offset + 1)
        const rect = range.getBoundingClientRect()
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      }
      return {
        mode: getComputedStyle(first).writingMode,
        firstX: first.getBoundingClientRect().x,
        secondX: second.getBoundingClientRect().x,
        a: glyphRect(0),
        b: glyphRect(1),
        fallbackLoaded: document.fonts.check('20px "TodOffice Mongolian Fallback"', 'ᠮᠣᠩᠭᠣᠯ'),
      }
    })
    expect(geometry.mode).toBe('vertical-lr')
    expect(geometry.fallbackLoaded).toBe(true)
    expect(geometry.b.y).toBeGreaterThan(geometry.a.y)
    expect(geometry.secondX).toBeGreaterThan(geometry.firstX)
    await page.screenshot({ path: test.info().outputPath('mongol-bichig-vertical.png') })
    // Enter all shaping controls through Chromium's input path, then save.
    await paragraphs.last().click()
    await page.keyboard.press('End')
    await page.keyboard.insertText(` ${MONGOL_BICHIG_SAMPLE}`)
    const saved = await page.evaluate(async () => {
      const api = (window as unknown as { __aidocs: { save(): Promise<boolean> } }).__aidocs
      return api.save()
    })
    expect(saved).toBe(true)
    const parsed = await parseDocx(readFileSync(path))
    expect(readSectionSettings(parsed).textDirection).toBe('tbLrV')
    const text = parsed.blocks
      .flatMap((block) => block.runs ?? [])
      .map((run) => run.text)
      .join('\n')
    expect(text).toContain(MONGOL_BICHIG_SAMPLE)
    expect(text).toContain(MONGOLIAN_CYRILLIC_SAMPLE)
    expect(text.match(/\u{11660}\u{1166c}/gu)).toHaveLength(2)
    expect(text.match(/ᠮᠣᠩᠭᠣᠯ ᠪᠢᠴᠢᠭ ᠭ\u180bᠠᠯ/g)).toHaveLength(2)
    await page.getByLabel('Text direction', { exact: true }).selectOption('lrTb')
    await expect(page.locator('.doc-vert-tbLrV')).toHaveCount(0)
  } finally {
    await closeAndSaveVideo(launched, 'mongolian-vertical')
    rmSync(dir, { recursive: true, force: true })
  }
})

test('new Mongol bichig document starts vertical and saves that direction', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'todoffice-new-mongol-'))
  const path = join(dir, 'new-mongol.docx')
  const launched = await launchShell({
    lang: 'mn-Mong',
    onboardingSeen: true,
    settings: { aiFeatures: false, defaultSaveDir: dir },
    videoDir: 'mongolian-new-vertical',
    recordVideo: false,
  })
  try {
    await launched.app.evaluate(({ dialog }, path) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: path })
    }, path)
    await launched.page.evaluate(() => window.aiOffice.newDoc())
    const page = await waitForPageWithUrl(launched.app, '/docs/')
    await expect(page.locator('.ProseMirror').first()).toBeVisible()
    await page.locator('.ProseMirror').first().click()
    await page.keyboard.insertText('ᠮᠣᠩᠭᠣᠯ ᠪᠢᠴᠢᠭ')
    await page.keyboard.press('Enter')
    await page.keyboard.insertText('ᠮᠣᠩᠭᠣᠯ ᠬᠡᠯᠡ')
    const paragraphs = page.locator('.ProseMirror .doc-vert-tbLrV')
    await expect(paragraphs).toHaveCount(2)
    const geometry = await paragraphs.first().evaluate(async (first) => {
      await document.fonts.ready
      const text = document.createTreeWalker(first, NodeFilter.SHOW_TEXT).nextNode()!
      const rectAt = (offset: number) => {
        const range = document.createRange()
        range.setStart(text, offset)
        range.setEnd(text, offset + 1)
        const rect = range.getBoundingClientRect()
        return { x: rect.x, y: rect.y }
      }
      return {
        mode: getComputedStyle(first).writingMode,
        a: rectAt(0),
        b: rectAt(1),
        firstX: first.getBoundingClientRect().x,
        nextX: first.nextElementSibling!.getBoundingClientRect().x,
      }
    })
    expect(geometry.mode).toBe('vertical-lr')
    expect(geometry.b.y).toBeGreaterThan(geometry.a.y)
    expect(geometry.nextX).toBeGreaterThan(geometry.firstX)
    await page.screenshot({ path: test.info().outputPath('new-mongol-vertical.png') })
    const saved = await page.evaluate(() =>
      (window as unknown as { __aidocs: { save(): Promise<boolean> } }).__aidocs.save(),
    )
    expect(saved).toBe(true)
    const parsed = await parseDocx(readFileSync(path))
    expect(readSectionSettings(parsed).textDirection).toBe('tbLrV')
    const text = parsed.blocks
      .flatMap((block) => block.runs ?? [])
      .map((run) => run.text)
      .join('\n')
    expect(text).toContain('ᠮᠣᠩᠭᠣᠯ ᠪᠢᠴᠢᠭ')
    expect(text).toContain('ᠮᠣᠩᠭᠣᠯ ᠬᠡᠯᠡ')
  } finally {
    await closeAndSaveVideo(launched, 'mongolian-new-vertical')
    rmSync(dir, { recursive: true, force: true })
  }
})
