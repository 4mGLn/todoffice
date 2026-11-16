/**
 * The editor's table commands point at a table by the outermost table's numbers (the caret's
 * parentParaIndex/controlIndex/cellIndex, a cell block's or a selected table's sec/ppi/ci). In a
 * table inside a cell or a text box those numbers name the outer table, so the commands changed
 * the outer form table. Until they take the inner table by its path, they leave the document
 * alone there and say why (studio-plugin/hancom-keys.mjs, refuseInNestedTable, hooked into the
 * studio's command dispatcher by the studio-nested-table-refusal patch).
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterAll, describe, expect, it, vi } from 'vitest'
import {
  HANCOM_KEYS_MODULE,
  NESTED_TABLE_EDITS,
  NESTED_TABLE_LATER,
  hancomCommands,
  hancomTableObjectKey,
  nestedTableAt,
  refuseInNestedTable,
} from '../studio-plugin/hancom-keys.mjs'
import { STUDIO_PATCHES, applyPatch, patchTargets } from '../scripts/rhwp-patches.mjs'

interface Where {
  /** The caret's cell path; one step is a table in the body (or a text box itself). */
  path?: { controlIndex: number; cellIndex: number; cellParaIndex: number }[]
  textBox?: boolean
  block?: boolean
  object?: boolean
  header?: boolean
  footnote?: boolean
}

const step = (controlIndex: number, cellIndex = 0) => ({
  controlIndex,
  cellIndex,
  cellParaIndex: 0,
})
const BODY = [step(0, 3)]
const NESTED = [step(0, 3), step(0, 5)]
const DEEPER = [step(0, 3), step(1, 2), step(0, 1)]

/** An input handler with the caret, a cell block or a selected table at `where`. */
function handler(where: Where) {
  const path = where.path
  const position = {
    sectionIndex: 0,
    paragraphIndex: 0,
    charOffset: 0,
    parentParaIndex: path ? 4 : undefined,
    controlIndex: path ? path[0].controlIndex : undefined,
    cellIndex: path ? path[path.length - 1].cellIndex : undefined,
    cellParaIndex: path ? 0 : undefined,
    cellPath: path,
    isTextBox: where.textBox ? true : undefined,
  }
  const ref = { sec: 0, ppi: 4, ci: 0, ...(path && path.length > 1 ? { cellPath: path } : {}) }
  const cursor = {
    getPosition: () => position,
    isInCell: () => path !== undefined,
    isInTextBox: () => where.textBox === true,
    isInHeaderFooter: () => where.header === true,
    isInFootnote: () => where.footnote === true,
    isInCellSelectionMode: () => where.block === true,
    isInTableObjectSelection: () => where.object === true,
    getCellTableContext: () =>
      path ? { sec: 0, ppi: 4, ci: path[0].controlIndex, cellPath: path } : null,
    getSelectedTableRef: () => (where.object ? ref : null),
  }
  return {
    cursor,
    getCursorPosition: () => position,
    getSelectedTableRef: cursor.getSelectedTableRef,
  }
}

const servicesAt = (where: Where) => {
  const ih = handler(where)
  return { getInputHandler: () => ih }
}

const REFUSED = [...NESTED_TABLE_EDITS, ...NESTED_TABLE_LATER]

describe('where a table command would reach the outer table', () => {
  it('is nowhere for a table in the body', () => {
    expect(nestedTableAt(handler({ path: BODY }))).toBeNull()
    expect(nestedTableAt(handler({ path: BODY, block: true }))).toBeNull()
    expect(nestedTableAt(handler({ path: BODY, object: true }))).toBeNull()
    // a caret outside any table, and a depth-1 caret written without a path
    expect(nestedTableAt(handler({}))).toBeNull()
    const flat = handler({ path: BODY })
    flat.cursor.getPosition().cellPath = undefined
    expect(nestedTableAt(flat)).toBeNull()
  })

  it('is a table inside a cell, at any depth', () => {
    expect(nestedTableAt(handler({ path: NESTED }))).toBe('cell')
    expect(nestedTableAt(handler({ path: DEEPER }))).toBe('cell')
    expect(nestedTableAt(handler({ path: NESTED, block: true }))).toBe('cell')
    expect(nestedTableAt(handler({ path: NESTED, object: true }))).toBe('cell')
  })

  it('is a table inside a text box, but not the text box itself', () => {
    expect(nestedTableAt(handler({ path: [step(1)], textBox: true }))).toBeNull()
    expect(nestedTableAt(handler({ path: [step(1), step(0, 2)], textBox: true }))).toBe('textBox')
    expect(
      nestedTableAt(handler({ path: [step(1), step(0, 2)], textBox: true, object: true })),
    ).toBe('textBox')
  })

  it('leaves the tables of headers, footers and notes as they were', () => {
    expect(nestedTableAt(handler({ path: NESTED, header: true }))).toBeNull()
    expect(nestedTableAt(handler({ path: NESTED, footnote: true }))).toBeNull()
  })
})

describe('refusing a table command in a table inside a cell or a text box', () => {
  it('refuses every listed command there, with the reason', () => {
    const showToast = vi.fn()
    hancomCommands('en', { showToast })
    for (const id of REFUSED) {
      showToast.mockClear()
      const where = id === 'format:object-properties' ? { object: true } : {}
      expect(refuseInNestedTable(id, servicesAt({ path: NESTED, ...where })), id).toBe(true)
      expect(showToast, id).toHaveBeenCalledWith({
        message: 'This cannot be done in a table inside a table yet.',
      })
    }
  })

  it('names a table inside a text box as such, in Korean too', () => {
    const showToast = vi.fn()
    hancomCommands('ko', { showToast })
    const inBox = servicesAt({ path: [step(1), step(0, 2)], textBox: true })
    expect(refuseInNestedTable('table:insert-row-above', inBox)).toBe(true)
    expect(showToast).toHaveBeenCalledWith({
      message: '글상자 안의 표에서는 아직 할 수 없습니다.',
    })
    showToast.mockClear()
    expect(refuseInNestedTable('table:cell-merge', servicesAt({ path: NESTED }))).toBe(true)
    expect(showToast).toHaveBeenCalledWith({ message: '표 안의 표에서는 아직 할 수 없습니다.' })
    hancomCommands('en', { showToast: vi.fn() })
  })

  it('lets a table in the body take every command, without a word', () => {
    const showToast = vi.fn()
    hancomCommands('en', { showToast })
    for (const id of REFUSED) {
      expect(refuseInNestedTable(id, servicesAt({ path: BODY })), id).toBe(false)
      expect(refuseInNestedTable(id, servicesAt({ path: BODY, block: true })), id).toBe(false)
      expect(refuseInNestedTable(id, servicesAt({ path: BODY, object: true })), id).toBe(false)
    }
    expect(showToast).not.toHaveBeenCalled()
  })

  it('keeps out of what already works or refuses on its own', () => {
    const showToast = vi.fn()
    hancomCommands('en', { showToast })
    for (const id of [
      // deletes the inner table (studio-nested-table-command)
      'table:delete',
      // makes a table in the cell by its path
      'table:create',
      // refuse a table inside a cell themselves, as they did
      'table:block-sum',
      'table:block-avg',
      'table:block-product',
      'ieum:table-auto-fill',
      'edit:paste',
      'edit:copy',
      'format:bold',
    ]) {
      expect(refuseInNestedTable(id, servicesAt({ path: NESTED })), id).toBe(false)
    }
    // object properties of a picture in an inner cell are the picture's
    expect(refuseInNestedTable('format:object-properties', servicesAt({ path: NESTED }))).toBe(
      false,
    )
    expect(showToast).not.toHaveBeenCalled()
  })

  it('lists the editing commands apart from the ones that stay refused', () => {
    for (const id of [
      'table:insert-row-col',
      'table:delete-row-col',
      'table:insert-row-above',
      'table:insert-row-below',
      'table:insert-col-left',
      'table:insert-col-right',
      'table:delete-row',
      'table:delete-col',
      'table:cell-merge',
      'table:cell-split',
      'ieum:cell-border-each',
      'ieum:cell-background-each',
      'ieum:cell-border-one',
      'ieum:cell-background-one',
      'table:cell-props',
      'table:cell-height-equal',
      'table:cell-width-equal',
      'ieum:table-block-resize',
      'ieum:table-row-column-resize',
      'ieum:table-cell-resize',
    ]) {
      expect(NESTED_TABLE_EDITS, id).toContain(id)
    }
    for (const id of [
      'table:split',
      'table:attach',
      'table:caption-toggle',
      'table:formula',
      'table:thousand-sep',
      'table:decimal-add',
      'table:decimal-remove',
      'table:transpose-paste',
      'ieum:table-transpose',
    ]) {
      expect(NESTED_TABLE_LATER, id).toContain(id)
    }
    expect(NESTED_TABLE_EDITS.filter((id) => NESTED_TABLE_LATER.includes(id))).toEqual([])
  })

  it('names only commands the app registers', () => {
    const own = new Set(hancomCommands('en').map((command) => command.id))
    for (const id of REFUSED.filter((id) => id.startsWith('ieum:'))) {
      expect(own.has(id), id).toBe(true)
    }
  })
})

describe('moving a selected table inside a cell', () => {
  const arrow = (key: string, init: Partial<KeyboardEvent> = {}) => ({
    key,
    code: key,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    isComposing: false,
    preventDefault: vi.fn(),
    ...init,
  })

  it('stops the arrow with the reason, where the studio would move the outer table', () => {
    const showToast = vi.fn()
    hancomCommands('en', { showToast })
    const ih = { ...handler({ path: NESTED, object: true }), dispatcher: { dispatch: vi.fn() } }
    const e = arrow('ArrowLeft')
    expect(hancomTableObjectKey(ih, e)).toBe(true)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(ih.dispatcher.dispatch).not.toHaveBeenCalled()
    expect(showToast).toHaveBeenCalledWith({
      message: 'This cannot be done in a table inside a table yet.',
    })
  })

  it('leaves the arrow to the studio for a table in the body', () => {
    const showToast = vi.fn()
    hancomCommands('en', { showToast })
    const ih = { ...handler({ path: BODY, object: true }), dispatcher: { dispatch: vi.fn() } }
    expect(hancomTableObjectKey(ih, arrow('ArrowLeft'))).toBe(false)
    expect(showToast).not.toHaveBeenCalled()
  })
})

describe('the studio-nested-table-refusal patch', () => {
  const dispatcher = [
    "import type { CommandResult, CommandServices, EditorContext } from './types';",
    '',
    '    const ctx = this.services.getContext();',
    '    if (isBlockedInFormMode(commandId, ctx)) {',
    "      return { ok: false, reason: 'blocked-in-form-mode' };",
    '    }',
    '    if (def.canExecute && !def.canExecute(ctx)) {',
    '      // canExecute 실패 — 비활성 상태',
    "      return { ok: false, reason: 'disabled' };",
    '    }',
    '',
    '    try {',
    '      def.execute(this.services, params);',
    '',
  ].join('\n')

  it('asks the module before a command runs, after the studio has found it enabled', () => {
    const patched = applyPatch('studio-nested-table-refusal', dispatcher)
    expect(patched).toContain(`import { refuseInNestedTable } from '${HANCOM_KEYS_MODULE}';`)
    const asked = patched.indexOf('refuseInNestedTable(commandId, this.services)')
    expect(asked).toBeGreaterThan(patched.indexOf('def.canExecute(ctx)'))
    expect(asked).toBeLessThan(patched.indexOf('def.execute(this.services, params)'))
    expect(STUDIO_PATCHES).toContain('studio-nested-table-refusal')
  })

  it('keeps a selected table inside a cell from being dragged by the outer numbers', () => {
    const mouse = [
      '    const ref = this.cursor.getSelectedTableRef();',
      '    if (ref && e.button === 0) {',
      '      const zoom = this.viewportManager.getZoom();',
      '',
    ].join('\n')
    const patched = applyPatch('studio-nested-table-move-drag', mouse)
    expect(patched).toContain('if (ref && e.button === 0 && (ref.cellPath?.length ?? 0) < 2) {')
    expect(STUDIO_PATCHES).toContain('studio-nested-table-move-drag')
  })

  it('fails when the dispatcher or the drag start is gone', () => {
    expect(() => applyPatch('studio-nested-table-refusal', 'export class X {}')).toThrow(
      /rhwp patch/,
    )
    expect(() => applyPatch('studio-nested-table-move-drag', 'export class X {}')).toThrow(
      /rhwp patch/,
    )
  })
})

describe('the patched studio dispatcher, from the source the build fetched', () => {
  const core = JSON.parse(
    readFileSync(join(__dirname, '..', '..', '..', 'vendor', 'rhwp-core', 'package.json'), 'utf8'),
  )
  const studio = join(
    __dirname,
    '..',
    'node_modules',
    '.cache',
    'rhwp-studio',
    core.rhwp.tag,
    'rhwp-studio',
  )
  const source = join(studio, 'src', 'command', 'dispatcher.ts')
  const scratch = existsSync(source) ? mkdtempSync(join(tmpdir(), 'ieum-dispatcher-')) : null
  afterAll(() => {
    if (scratch) rmSync(scratch, { recursive: true, force: true })
  })

  /** The studio's dispatcher with the build's patches, importing the app's module from its file. */
  async function patchedDispatcher() {
    let code = readFileSync(source, 'utf8')
    for (const name of STUDIO_PATCHES) {
      if (patchTargets(name, source)) code = applyPatch(name, code)
    }
    const module = pathToFileURL(join(__dirname, '..', 'studio-plugin', 'hancom-keys.mjs')).href
    code = code.replaceAll(`'${HANCOM_KEYS_MODULE}'`, `'${module}'`)
    const file = join(scratch!, `dispatcher-${Date.now()}.ts`)
    writeFileSync(file, code)
    return (await import(/* @vite-ignore */ pathToFileURL(file).href)) as {
      CommandDispatcher: new (
        registry: { get(id: string): unknown },
        services: unknown,
        eventBus: { emit(name: string): void },
      ) => {
        dispatchWithResult(id: string): { ok: boolean; reason?: string }
      }
    }
  }

  /** Every refused command, each changing the table its numbers name through the engine. */
  function commands(wasm: { insertTableRow: ReturnType<typeof vi.fn> }) {
    const defs = new Map(
      REFUSED.map((id) => [
        id,
        {
          id,
          canExecute: () => true,
          execute: () => wasm.insertTableRow(0, 4, 0, 0, true),
        },
      ]),
    )
    return { get: (id: string) => defs.get(id) }
  }

  it.skipIf(!existsSync(source))(
    'changes nothing for a table inside a cell, and runs the command for one in the body',
    async () => {
      const { CommandDispatcher } = await patchedDispatcher()
      hancomCommands('en', { showToast: vi.fn() })
      for (const id of REFUSED) {
        for (const [where, runs] of [
          [{ path: NESTED, object: id === 'format:object-properties' }, false],
          [
            {
              path: [step(1), step(0, 2)],
              textBox: true,
              object: id === 'format:object-properties',
            },
            false,
          ],
          [{ path: NESTED, block: true, object: id === 'format:object-properties' }, false],
          [{ path: BODY, object: id === 'format:object-properties' }, true],
        ] as [Where, boolean][]) {
          const wasm = { insertTableRow: vi.fn() }
          const services = { ...servicesAt(where), getContext: () => ({ isFormMode: false }) }
          const result = new CommandDispatcher(commands(wasm), services, {
            emit: () => {},
          }).dispatchWithResult(id)
          expect(result.ok, `${id} ${JSON.stringify(where)}`).toBe(runs)
          expect(wasm.insertTableRow, `${id} ${JSON.stringify(where)}`).toHaveBeenCalledTimes(
            runs ? 1 : 0,
          )
        }
      }
    },
    60_000,
  )

  it.skipIf(!existsSync(source))('names only commands the studio has', () => {
    const sources = ['table.ts', 'format.ts']
      .map((file) => readFileSync(join(studio, 'src', 'command', 'commands', file), 'utf8'))
      .join('\n')
    for (const id of REFUSED.filter((id) => !id.startsWith('ieum:'))) {
      expect(sources, id).toContain(`'${id}'`)
    }
  })
})
