import { expect, test } from '@playwright/test'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { htmlLang } from '@genoffice/i18n'
import type { Menu } from 'electron'
import {
  LANG_OPTIONS,
  LANGUAGE_MENU_TOOLTIP,
  OTHER_LANGUAGES_LABEL,
  PINNED_LANG_OPTIONS,
} from '../apps/shell/src/shared/language-options'
import { closeAndSaveVideo, launchShell, waitForPageWithUrl } from './helpers'

test('the title-bar language menu updates the open editor and survives relaunch', async () => {
  const run = 'interface-language-menu'
  const launched = await launchShell({
    onboardingSeen: true,
    settings: { aiFeatures: false, autoUpdateCheck: false },
    videoDir: run,
    recordVideo: false,
  })
  const { app, page, userDataDir } = launched
  try {
    try {
      await page.evaluate(() => window.aiOffice.newMarkdown())
      const editor = await waitForPageWithUrl(app, '/markdown/')
      await expect(editor.locator('html')).toHaveAttribute('lang', htmlLang('en'))

      // Electron's native popup lives outside the renderer DOM. Capture the
      // menu sent to it and invoke the same item callbacks as native selection.
      await app.evaluate(({ Menu }) => {
        const state = globalThis as typeof globalThis & { languageMenu?: Menu }
        Menu.prototype.popup = function (this: Menu) {
          state.languageMenu = this
        }
      })
      const button = page.locator('.tab-language-btn')
      await expect(button).toHaveAccessibleName('Language')
      await button.hover()
      const tooltip = await waitForPageWithUrl(app, '/language-tooltip.html')
      const getOverlayVisible = () =>
        app.evaluate(({ BrowserWindow, WebContentsView }) =>
          BrowserWindow.getAllWindows()[0].contentView.children.some(
            (view) =>
              view instanceof WebContentsView &&
              view.webContents.getURL().endsWith('/language-tooltip.html') &&
              view.getVisible(),
          ),
        )
      await expect.poll(getOverlayVisible).toBe(true)
      await expect(tooltip.getByRole('tooltip').locator('p')).toHaveText(
        Object.values(LANGUAGE_MENU_TOOLTIP),
      )
      await expect(tooltip.locator('p[lang="mn-Mong"]')).toHaveCSS('writing-mode', 'vertical-lr')
      await page.locator('.tab-item.tab-home').hover()
      await expect.poll(getOverlayVisible).toBe(false)

      for (const [previous, next] of [
        ['en', 'ar'],
        ['ar', 'mn-Cyrl'],
        ['mn-Cyrl', 'mn-Mong'],
        ['mn-Mong', 'ko'],
      ] as const) {
        const gap = await button.evaluate((element) => {
          const caption = element.nextElementSibling!.getBoundingClientRect()
          return caption.left - element.getBoundingClientRect().right
        })
        expect(gap).toBeGreaterThanOrEqual(0)
        expect(gap).toBeLessThanOrEqual(16)
        await button.click()
        await expect
          .poll(() =>
            app.evaluate(() => {
              const state = globalThis as typeof globalThis & { languageMenu?: Menu }
              const other = state.languageMenu?.getMenuItemById('other-languages')
              return other?.submenu?.items.find(({ checked }) => checked)?.id
            }),
          )
          .toBe(`all-${previous}`)
        const menuState = await app.evaluate((_, locale) => {
          const state = globalThis as typeof globalThis & { languageMenu?: Menu }
          const menu = state.languageMenu!
          const other = menu.getMenuItemById('other-languages')!
          const item =
            menu.getMenuItemById(locale) ?? other.submenu!.getMenuItemById(`all-${locale}`)!
          const result = {
            top: menu.items.slice(0, 4).map(({ id, label }) => ({ value: id, label })),
            tail: menu.items.slice(4).map(({ type }) => type),
            otherLabel: other.label,
            all: other.submenu!.items.map(({ id }) => id),
            checked: menu.items.find(({ checked }) => checked)?.id ?? null,
          }
          item.click()
          state.languageMenu = undefined
          return result
        }, next)
        expect(menuState.top).toEqual(PINNED_LANG_OPTIONS)
        expect(menuState.tail).toEqual(['separator', 'submenu'])
        expect(menuState.otherLabel).toBe(OTHER_LANGUAGES_LABEL[previous])
        expect(menuState.all).toEqual(LANG_OPTIONS.map(({ value }) => `all-${value}`))
        expect(menuState.checked).toBe(previous === 'ar' ? null : previous)
        await expect(page.locator('html')).toHaveAttribute('lang', htmlLang(next))
        await expect(editor.locator('html')).toHaveAttribute('lang', htmlLang(next))
      }
      const settings = JSON.parse(await readFile(join(userDataDir, 'app-settings.json'), 'utf8'))
      expect(settings.language).toBe('ko')
    } finally {
      await closeAndSaveVideo(launched, run)
    }

    const reopened = await launchShell({
      userDataDir,
      env: { GENOFFICE_LANG: '' },
      videoDir: run,
      recordVideo: false,
    })
    try {
      await expect(reopened.page.locator('html')).toHaveAttribute('lang', htmlLang('ko'))
      await expect(reopened.page.locator('.tab-language-btn')).toHaveAccessibleName('언어')
    } finally {
      await closeAndSaveVideo(reopened, run)
    }
  } finally {
    await rm(userDataDir, { recursive: true, force: true })
  }
})
