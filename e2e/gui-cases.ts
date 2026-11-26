import type { Page } from '@playwright/test'

interface CaseInput {
  fixtureName: string
  marker: string
}

type SelectTarget = (page: Page) => void

// The runner serializes each function for playwright-cli run-code. Keep the
// functions self-contained and pass fixture values through CaseInput.
export const guiCases = {
  home: {
    description: 'Change which new-document cards appear on Home',
    run: async function (page: Page, _input: CaseInput, _selectTarget: SelectTarget) {
      const sheetsCard = page.locator('.quick-card').filter({ hasText: 'AI Sheets' })
      await sheetsCard.waitFor({ state: 'visible' })
      await page.getByRole('button', { name: 'Settings', exact: true }).click()
      await page.locator('.set-nav-item').filter({ hasText: 'General' }).click()
      const sheetsSwitch = page.getByTestId('home-kinds').getByRole('switch', { name: 'AI Sheets' })
      await sheetsSwitch.click()
      await sheetsSwitch.and(page.locator('[aria-checked="false"]')).waitFor()
      await page.locator('.set-close').click()
      await sheetsCard.waitFor({ state: 'hidden' })
      await page.locator('.quick-card').filter({ hasText: 'AI Docs' }).waitFor()
      return 'Settings hid the Sheets card and the Docs card stayed visible'
    },
  },
  docs: {
    description: 'Edit and save a vertically written Mongolian DOCX',
    run: async function (
      shell: Page,
      { fixtureName, marker }: CaseInput,
      selectTarget: SelectTarget,
    ) {
      await shell.locator('.folder-panel .tree .tree-row').first().locator('.tree-name').click()
      const file = shell.locator('.recent-list .recent-name').filter({ hasText: fixtureName })
      const [page] = await Promise.all([
        shell.context().waitForEvent('page', { timeout: 15_000 }),
        file.click(),
      ])
      selectTarget(page)
      await page.waitForURL('genoffice-app://docs/**', { waitUntil: 'commit' })
      await page.locator('.ProseMirror').first().waitFor()
      await page.getByRole('button', { name: 'Layout', exact: true }).click()
      await page.getByLabel('Text direction', { exact: true }).selectOption('tbLrV')
      const paragraphs = page.locator('.doc-page:not(.measuring-columns) .doc-vert-tbLrV')
      const first = paragraphs.first()
      await first.waitFor()
      const mode = await first.evaluate((element) => getComputedStyle(element).writingMode)
      if (mode !== 'vertical-lr') throw new Error(`Expected vertical-lr, received ${mode}`)
      await first.click()
      await page.keyboard.press('End')
      await page.keyboard.insertText(` ${marker}`)
      await paragraphs.filter({ hasText: marker }).first().waitFor()
      const save = page.getByRole('button', { name: /^Save \(/ })
      await save.click()
      await save.and(page.locator(':disabled')).waitFor()
      return 'Docs displayed vertical-lr and saved the text entered in the editor'
    },
  },
}

export type GuiCaseName = keyof typeof guiCases
