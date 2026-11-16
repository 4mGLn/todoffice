/**
 * A table inside a table's cell (a form whose cells hold tables): the editor's table commands
 * that point at a table by the outer table's numbers leave the document alone there and say
 * why, instead of changing the outer form table. A table in the body still takes them.
 *
 * Runs against the production build with the 교과협의록 form (apps/hwp/tests/fixtures/nested-form.hwp:
 * a 5×2 table whose cells hold an 8×9 table and the achievement-level tables).
 */
import { test, expect } from '@playwright/test'
import type { Frame, Page } from '@playwright/test'
import { copyFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { closeAndSaveVideo, launchShell, screenshotPath, waitForPageWithUrl } from './helpers'

const FORM = join(__dirname, '../apps/hwp/tests/fixtures/nested-form.hwp')

interface PathStep {
  controlIndex: number
  cellIndex: number
  cellParaIndex: number
}

/** Only what the spec uses of the studio's window object. */
interface StudioLike {
  plugins: {
    load(id: string): Promise<unknown>
    invoke(id: string, method: string, args: unknown[]): unknown
  }
  automation: {
    execute(id: string): unknown
    registerCommand(def: {
      id: string
      label: string
      execute(services: StudioServices): void
    }): void
  }
  __nestedProbe?: boolean
}

interface StudioServices {
  wasm: {
    getParagraphCount(sec: number): number
    getTableDimensionsByPath(
      sec: number,
      ppi: number,
      path: string,
    ): { rowCount: number; colCount: number; cellCount: number }
    getCellParagraphCountByPath(sec: number, ppi: number, path: string): number
    exportHwp(): Uint8Array
  }
  getInputHandler(): {
    cursor: {
      moveTo(pos: Record<string, unknown>): void
      enterCellSelectionMode(): boolean
      exitCellSelectionMode(): void
      setCellSelectionFocus(row: number, col: number): void
      isInCellSelectionMode(): boolean
    }
    updateCaret?(): void
    updateCellSelection?(): void
  }
}

interface Fingerprint {
  tables: { table: number; rows: number; cols: number }[]
  cells: string[]
  bytes: string
}

interface NestedTarget {
  para: number
  outer: PathStep[]
  inner: PathStep[]
}

declare global {
  interface Window {
    __e2eNested?: NestedTarget | null
    __e2eBytes?: string
  }
}

async function studioFrame(hwp: Page): Promise<Frame> {
  const deadline = Date.now() + 60_000
  for (;;) {
    const frame = hwp.frames().find((f) => f.url().includes('/studio/'))
    if (frame) return frame
    if (Date.now() > deadline) throw new Error('studio frame never loaded')
    await hwp.waitForTimeout(100)
  }
}

/**
 * Test commands on the automation surface (no document change): find the body table that
 * holds a table in a cell, put the caret in a cell of either, and read the exported bytes.
 */
async function installProbe(frame: Frame): Promise<void> {
  await frame.evaluate(() => {
    const studio = (window as unknown as { rhwpStudio: StudioLike }).rhwpStudio
    if (studio.__nestedProbe) return
    const findNested = (services: StudioServices): NestedTarget | null => {
      const w = services.wasm
      const dims = (para: number, path: PathStep[]) => {
        try {
          return w.getTableDimensionsByPath(0, para, JSON.stringify(path))
        } catch {
          return null
        }
      }
      for (let para = 0; para < w.getParagraphCount(0); para += 1) {
        for (let ctrl = 0; ctrl < 4; ctrl += 1) {
          const outer = [{ controlIndex: ctrl, cellIndex: 0, cellParaIndex: 0 }]
          const table = dims(para, outer)
          if (!table) continue
          for (let cell = 0; cell < table.cellCount; cell += 1) {
            const paragraphs = w.getCellParagraphCountByPath(
              0,
              para,
              JSON.stringify([{ controlIndex: ctrl, cellIndex: cell, cellParaIndex: 0 }]),
            )
            for (let k = 0; k < paragraphs; k += 1) {
              for (let inner = 0; inner < 4; inner += 1) {
                const path = [
                  { controlIndex: ctrl, cellIndex: cell, cellParaIndex: k },
                  { controlIndex: inner, cellIndex: 0, cellParaIndex: 0 },
                ]
                if (dims(para, path)) return { para, outer, inner: path }
              }
            }
          }
        }
      }
      return null
    }
    const caretAt = (services: StudioServices, para: number, path: PathStep[]) => {
      const ih = services.getInputHandler()
      if (ih.cursor.isInCellSelectionMode()) ih.cursor.exitCellSelectionMode()
      const last = path[path.length - 1]
      ih.cursor.moveTo({
        sectionIndex: 0,
        paragraphIndex: last.cellParaIndex,
        charOffset: 0,
        parentParaIndex: para,
        controlIndex: path[0].controlIndex,
        cellIndex: last.cellIndex,
        cellParaIndex: last.cellParaIndex,
        cellPath: path,
      })
      ih.updateCaret?.()
    }
    studio.automation.registerCommand({
      id: 'ext:e2e-nested-inner-caret',
      label: 'E2E caret in a table inside a cell',
      execute(services) {
        const target = findNested(services)
        window.__e2eNested = target
        if (target) caretAt(services, target.para, target.inner)
      },
    })
    studio.automation.registerCommand({
      id: 'ext:e2e-nested-outer-caret',
      label: 'E2E caret in the body table',
      execute(services) {
        const target = findNested(services)
        // the body table's first cell: a caret at depth one
        if (target) caretAt(services, target.para, target.outer)
      },
    })
    studio.automation.registerCommand({
      id: 'ext:e2e-nested-inner-block',
      label: 'E2E cell block of two cells in the inner table',
      execute(services) {
        const ih = services.getInputHandler()
        if (!ih.cursor.enterCellSelectionMode()) return
        ih.cursor.setCellSelectionFocus(0, 1)
        ih.updateCellSelection?.()
      },
    })
    studio.automation.registerCommand({
      id: 'ext:e2e-nested-bytes',
      label: 'E2E exported bytes',
      execute(services) {
        const bytes = services.wasm.exportHwp()
        let hash = 2166136261
        for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619) >>> 0
        window.__e2eBytes = `${bytes.length}:${hash.toString(16)}`
      },
    })
    studio.__nestedProbe = true
  })
}

async function run(frame: Frame, id: string): Promise<void> {
  await frame.evaluate((command) => {
    const studio = (window as unknown as { rhwpStudio: StudioLike }).rhwpStudio
    studio.automation.execute(command)
  }, id)
}

/** Every table's size and cells (the AI plugin's reading, nested tables included) and the bytes. */
async function fingerprint(frame: Frame): Promise<Fingerprint> {
  await run(frame, 'ext:e2e-nested-bytes')
  return frame.evaluate(async () => {
    const studio = (window as unknown as { rhwpStudio: StudioLike }).rhwpStudio
    await studio.plugins.load('ieum-agent')
    const list = (await studio.plugins.invoke('ieum-agent', 'listTables', [])) as {
      tables: { table: number; rows: number; cols: number }[]
    }
    const cells: string[] = []
    for (const { table } of list.tables) {
      const read = (await studio.plugins.invoke('ieum-agent', 'readTable', [table])) as {
        cells?: { row: number; col: number; text: string }[]
      }
      cells.push(JSON.stringify(read.cells ?? []))
    }
    return {
      tables: list.tables.map(({ table, rows, cols }) => ({ table, rows, cols })),
      cells,
      bytes: window.__e2eBytes ?? '',
    }
  })
}

async function toast(frame: Frame): Promise<string> {
  return frame.evaluate(
    () => document.getElementById('rhwp-toast-container')?.textContent?.trim() ?? '',
  )
}

async function focusInput(frame: Frame): Promise<void> {
  await frame.evaluate(() => {
    const input = document.querySelector('textarea') as HTMLTextAreaElement | null
    input?.focus()
  })
}

/** Table menu → 줄/칸 추가하기, and OK in its dialog when one opens. */
async function insertRowFromMenu(frame: Frame): Promise<void> {
  await frame.locator('#menu-bar .menu-item[data-menu="table"] .menu-title').click()
  await frame.locator('.md-item[data-cmd="table:insert-row-col"]').click()
  const ok = frame.locator('.modal-overlay .dialog-btn-primary')
  if (await ok.isVisible({ timeout: 1_000 }).catch(() => false)) await ok.click()
}

test('table commands in a table inside a cell leave the form alone and say why', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'ieum-nested-refusal-'))
  const file = join(scratch, 'nested-form.hwp')
  await copyFile(FORM, file)
  const launched = await launchShell({ onboardingSeen: true, videoDir: 'hwp-nested-refusal' })
  const { page } = launched
  try {
    await page.evaluate((path) => window.aiOffice.openPath(path), file)
    const hwp = await waitForPageWithUrl(launched.app, '://hwp/')
    await hwp.waitForSelector('.hwp-app[data-phase="ready"]', { timeout: 90_000 })
    const frame = await studioFrame(hwp)
    await frame.locator('#scroll-content canvas').first().waitFor({ timeout: 60_000 })
    await installProbe(frame)

    const before = await fingerprint(frame)
    // the form: one body table, with tables in its cells
    expect(before.tables.length).toBeGreaterThan(1)
    // reading the document twice gives the same bytes, so bytes can tell a change
    expect((await fingerprint(frame)).bytes).toBe(before.bytes)
    await run(frame, 'ext:e2e-nested-inner-caret')
    expect(await frame.evaluate(() => window.__e2eNested)).toBeTruthy()

    const NOTICE = /inside a table|표 안의 표/
    /** The document before and after one step: the same, with the reason on screen. */
    const unchangedBy = async (name: string, action: () => Promise<void>) => {
      const ahead = await fingerprint(frame)
      await action()
      await hwp.waitForTimeout(300)
      const notice = await toast(frame)
      const after = await fingerprint(frame)
      console.log(
        `${name}:`,
        JSON.stringify(ahead.tables.map((t) => t.rows)),
        '->',
        JSON.stringify(after.tables.map((t) => t.rows)),
        after.cells[0] === ahead.cells[0] ? 'outer cells same' : 'outer cells changed',
        after.bytes === ahead.bytes ? 'bytes same' : 'bytes changed',
        `notice: ${notice}`,
      )
      expect.soft(after, name).toEqual(ahead)
      expect.soft(notice, name).toMatch(NOTICE)
    }

    // Table menu → 줄/칸 추가하기 with the caret in the inner table
    await unchangedBy('menu insert row', async () => {
      await run(frame, 'ext:e2e-nested-inner-caret')
      await insertRowFromMenu(frame)
    })
    await hwp.screenshot({ path: screenshotPath('hwp-nested-refusal-row') })

    // Alt+Insert: the same command from the keyboard
    await unchangedBy('Alt+Insert', async () => {
      await run(frame, 'ext:e2e-nested-inner-caret')
      await focusInput(frame)
      await hwp.keyboard.press('Alt+Insert')
      const ok = frame.locator('.modal-overlay .dialog-btn-primary')
      if (await ok.isVisible({ timeout: 1_000 }).catch(() => false)) await ok.click()
    })

    // M on an F5 block of two cells in the inner table
    await unchangedBy('M on a cell block', async () => {
      await run(frame, 'ext:e2e-nested-inner-caret')
      await run(frame, 'ext:e2e-nested-inner-block')
      await focusInput(frame)
      await hwp.keyboard.press('m')
    })

    // the body table itself still takes the command: a row goes in
    await hwp.keyboard.press('Escape')
    const rows = (await fingerprint(frame)).tables[0].rows
    await run(frame, 'ext:e2e-nested-outer-caret')
    await insertRowFromMenu(frame)
    await expect.poll(async () => (await fingerprint(frame)).tables[0].rows).toBe(rows + 1)
  } finally {
    await closeAndSaveVideo(launched, 'hwp-nested-refusal')
    await rm(scratch, { recursive: true, force: true })
  }
})
