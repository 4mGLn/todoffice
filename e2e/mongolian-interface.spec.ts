import { test, expect } from '@playwright/test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launchShell, closeAndSaveVideo, waitForPageWithUrl } from './helpers'
import { mongolianDocxFixture } from './mongolian-docx-fixture'

test('Mongol bichig settings are vertical and locale switching preserves document direction', async () => {
  const scratch = mkdtempSync(join(tmpdir(), 'todoffice-mongolian-ui-'))
  const file = join(scratch, 'horizontal.docx')
  writeFileSync(file, await mongolianDocxFixture(false))
  const launched = await launchShell({
    lang: 'mn-Mong',
    onboardingSeen: true,
    settings: { aiFeatures: false },
    videoDir: 'mongolian-interface',
    recordVideo: false,
  })
  try {
    const home = launched.page
    await expect(home.locator('html')).toHaveAttribute('lang', 'mn-Mong')
    const account = await home.locator('.account-btn').boundingBox()
    const sidebar = await home.locator('.sidebar').boundingBox()
    expect(account!.x).toBeGreaterThanOrEqual(sidebar!.x)
    expect(account!.x + account!.width).toBeLessThanOrEqual(sidebar!.x + sidebar!.width + 1)
    for (const width of [1360, 1000]) {
      await launched.app.evaluate(({ BrowserWindow }, width) => {
        BrowserWindow.getAllWindows()[0].setSize(width, 900)
      }, width)
      const cards = await home.locator('.quick-card').evaluateAll((nodes) =>
        nodes.map((node) => {
          const box = node.getBoundingClientRect()
          return { width: box.width, height: box.height }
        }),
      )
      expect(cards.length).toBeGreaterThan(3)
      for (const card of cards) {
        expect(Math.abs(card.width - cards[0].width)).toBeLessThan(1)
        expect(card.height).toBe(176)
      }
      const sidebarMetrics = await home
        .locator('.sidebar')
        .evaluate((el) => ({ width: el.clientWidth, scrollWidth: el.scrollWidth }))
      expect(sidebarMetrics.scrollWidth).toBeLessThanOrEqual(sidebarMetrics.width)
      await home.screenshot({ path: test.info().outputPath(`mongolian-home-${width}.png`) })
    }
    await launched.app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(1360, 900),
    )

    await home.locator('.account-btn').click()
    const dialog = home.locator('.set-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveCSS('writing-mode', 'vertical-lr')
    await expect(home.locator('[data-mongolian-preview]')).toBeVisible()
    await home.evaluate(async () => {
      await document.fonts.load('20px "Noto Sans Mongolian"', 'ᠮᠣᠩᠭᠣᠯ')
      if (!document.fonts.check('20px "Noto Sans Mongolian"', 'ᠮᠣᠩᠭᠣᠯ'))
        throw new Error('Bundled Mongolian font did not load')
    })
    await home.screenshot({ path: test.info().outputPath('mongolian-settings-initial.png') })
    const fields = await home
      .locator('.set-pane > .set-field')
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().width))
    for (const width of fields) expect(width).toBe(144)
    const overflowingControls = await home.locator('.set-pane > .set-field').evaluateAll((nodes) =>
      nodes.flatMap((node) => {
        const parent = node.getBoundingClientRect()
        return [...node.querySelectorAll('input, .gs-dd, .set-btn')]
          .filter((control) => {
            const box = control.getBoundingClientRect()
            return box.width && (box.left < parent.left || box.right > parent.right)
          })
          .map((control) => control.className)
      }),
    )
    expect(overflowingControls).toEqual([])
    const picker = home.locator('.set-dd').first().getByRole('button')
    await picker.click()
    const cyrl = home.locator('[role="option"][data-value="mn-Cyrl"]')
    await cyrl.scrollIntoViewIfNeeded()
    await cyrl.click()
    await expect(home.locator('html')).toHaveAttribute('lang', 'mn-Cyrl-MN')
    await expect(dialog).toHaveCSS('writing-mode', 'horizontal-tb')
    await picker.click()
    const mong = home.locator('[role="option"][data-value="mn-Mong"]')
    await mong.scrollIntoViewIfNeeded()
    await mong.click()
    await expect(dialog).toHaveCSS('writing-mode', 'vertical-lr')
    await home.screenshot({ path: test.info().outputPath('mongolian-settings.png') })
    const themePicker = home.locator('.set-dd').nth(1).getByRole('button')
    await themePicker.click()
    await home.locator('[role="option"][data-value="dark"]').click()
    await home.screenshot({ path: test.info().outputPath('mongolian-settings-dark.png') })
    await themePicker.click()
    await home.locator('[role="option"][data-value="light"]').click()
    await home.locator('.set-close').click()
    await home.evaluate((path) => window.aiOffice.openPath(path), file)
    const docs = await waitForPageWithUrl(launched.app, '/docs/')
    await expect(docs.locator('html')).toHaveAttribute('lang', 'mn-Mong')
    await expect(docs.locator('.ribbon')).toHaveCSS('writing-mode', 'vertical-lr')
    await expect(docs.locator('.rb-font-family')).toHaveCSS('writing-mode', 'horizontal-tb')
    await expect(docs.locator('.ProseMirror')).toBeVisible()
    await expect(docs.locator('.doc-vert-tbLrV')).toHaveCount(0)
    const boxes = await docs.evaluate(() => {
      const ribbon = document.querySelector('.ribbon')!.getBoundingClientRect()
      const main = document.querySelector('.app-main')!.getBoundingClientRect()
      return { ribbonRight: ribbon.right, mainLeft: main.left, mainWidth: main.width }
    })
    expect(boxes.ribbonRight).toBeLessThanOrEqual(boxes.mainLeft + 1)
    expect(boxes.mainWidth).toBeGreaterThan(300)
    const tabs = await docs.locator('.ribbon-tabs > .ribbon-tab').evaluateAll((nodes) =>
      nodes.map((node) => ({
        width: node.getBoundingClientRect().width,
        height: node.getBoundingClientRect().height,
        text: node.textContent,
      })),
    )
    for (const tab of tabs) {
      expect(tab.width).toBe(40)
      expect(tab.height).toBe(84)
      expect(tab.text).toMatch(/\p{Script=Mongolian}/u)
    }
    const bold = docs
      .locator('.rb-icon')
      .filter({ has: docs.locator('b') })
      .first()
    const italic = docs
      .locator('.rb-icon')
      .filter({ has: docs.locator('i') })
      .first()
    for (const button of [bold, italic]) {
      await expect(button).toHaveCSS('writing-mode', 'horizontal-tb')
      await expect(button.locator('b, i')).toHaveCSS('writing-mode', 'horizontal-tb')
      const box = await button.boundingBox()
      expect(box?.width).toBe(28)
      expect(box?.height).toBe(28)
    }
    await expect(bold.locator('b')).toHaveCSS('font-weight', '700')
    await expect(italic.locator('i')).toHaveCSS('font-style', 'italic')
    await docs.locator('.ProseMirror').first().click()
    await docs.keyboard.press('Control+Home')
    await bold.click()
    await expect(bold).toHaveClass(/active/)
    await italic.click()
    await expect(italic).toHaveClass(/active/)
    await bold.click()
    await italic.click()
    for (const width of [1360, 1000]) {
      await launched.app.evaluate(
        ({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setSize(width, 900),
        width,
      )
      await expect(docs.locator('.ribbon')).toHaveCSS('width', width === 1360 ? '192px' : '172px')
      const mainWidth = await docs
        .locator('.app-main')
        .evaluate((el) => el.getBoundingClientRect().width)
      expect(mainWidth).toBeGreaterThan(width - 180 - 40)
      await docs.screenshot({ path: test.info().outputPath(`mongolian-docs-compact-${width}.png`) })
    }
    await docs.keyboard.press('Control+F1')
    await expect(docs.locator('.ribbon')).toHaveCSS('width', '44px')
    await docs.screenshot({ path: test.info().outputPath('mongolian-docs-collapsed.png') })
    await docs.keyboard.press('Control+F1')
    await launched.app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(1360, 900),
    )
    await expect(docs.locator('.ribbon')).toHaveCSS('width', '192px')
    await docs.screenshot({
      path: test.info().outputPath('mongolian-ribbon-horizontal-document.png'),
    })
    const fontGroup = docs
      .locator('.rb-font-group')
      .filter({ has: docs.locator('.rb-font-family') })
    const fontBounds = await fontGroup.boundingBox()
    for (const input of await fontGroup.locator('input').all()) {
      const box = await input.boundingBox()
      if (box) expect(box.x + box.width).toBeLessThanOrEqual(fontBounds!.x + fontBounds!.width + 1)
    }
    const paste = docs.locator('.rb-big-split').first()
    const pasteBox = await paste.boundingBox()
    expect(pasteBox?.width).toBe(36)
    expect(pasteBox?.height).toBe(112)
    await docs.getByTestId('ribbon-paste-menu').click()
    await expect(docs.locator('.paste-menu')).toBeVisible()
    await docs.locator('.ProseMirror').first().click()
    await expect(docs.locator('.paste-menu')).toHaveCount(0)
    for (const label of ['ᠣᠷᠣᠭᠤᠯᠬᠤ', 'ᠯᠡᠶᠢᠠᠤᠲ']) {
      const tab = docs.locator('.ribbon-tab').filter({ hasText: label }).first()
      await tab.scrollIntoViewIfNeeded()
      await tab.click()
      await docs.screenshot({
        path: test
          .info()
          .outputPath(`mongolian-tab-${label === 'ᠣᠷᠣᠭᠤᠯᠬᠤ' ? 'insert' : 'layout'}.png`),
      })
    }
  } finally {
    if (test.info().status !== test.info().expectedStatus) {
      await launched.page
        .screenshot({ path: test.info().outputPath('mongolian-ui-failure.png') })
        .catch(() => {})
    }
    await closeAndSaveVideo(launched, 'mongolian-interface')
    rmSync(scratch, { recursive: true, force: true })
  }
})

for (const kind of ['sheets', 'slides'] as const) {
  test(`${kind} uses the regular Mongol bichig ribbon rail`, async () => {
    const launched = await launchShell({
      lang: 'mn-Mong',
      onboardingSeen: true,
      settings: { aiFeatures: false },
      videoDir: `mongolian-${kind}`,
      recordVideo: false,
    })
    try {
      await launched.app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].setSize(1360, 900),
      )
      if (kind === 'sheets') await launched.page.evaluate(() => window.aiOffice.newSheet())
      else await launched.page.evaluate(() => window.aiOffice.newSlide())
      const page = await waitForPageWithUrl(launched.app, `/${kind}/`)
      await expect(page.locator('html')).toHaveAttribute('lang', 'mn-Mong')
      const tabs = page.locator('.ribbon-tabs > button:not(.qa-btn)')
      await expect(tabs.first()).toBeVisible()
      for (const tab of await tabs.all()) {
        const box = await tab.boundingBox()
        expect(box?.width).toBe(40)
        expect(box?.height).toBe(84)
        expect(await tab.textContent()).toMatch(/\p{Script=Mongolian}|^AI$/u)
      }
      const rail = page.locator(kind === 'sheets' ? '.excel-header' : '.app > .ribbon')
      await expect(rail).toHaveCSS('width', '192px')
      const formattingSymbols = page
        .locator(kind === 'sheets' ? '.inline-tools button' : '.rb-icon')
        .filter({ has: page.locator('b, i, em') })
      expect(await formattingSymbols.count()).toBeGreaterThanOrEqual(2)
      for (const button of await formattingSymbols.all()) {
        await expect(button).toHaveCSS('writing-mode', 'horizontal-tb')
        await expect(button.locator('b, i, em')).toHaveCSS('writing-mode', 'horizontal-tb')
      }
      for (const width of [1360, 1000]) {
        await launched.app.evaluate(
          ({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setSize(width, 900),
          width,
        )
        await expect(rail).toHaveCSS('width', width === 1360 ? '192px' : '172px')
        await page.screenshot({
          path: test.info().outputPath(`mongolian-${kind}-ribbon-${width}.png`),
        })
      }
      await page.keyboard.press('Control+F1')
      await expect(rail).toHaveCSS('width', '44px')
      await page.keyboard.press('Control+F1')
      await expect(rail).toHaveCSS('width', '172px')
    } finally {
      await closeAndSaveVideo(launched, `mongolian-${kind}`)
    }
  })
}
