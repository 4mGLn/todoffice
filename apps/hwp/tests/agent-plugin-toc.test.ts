/**
 * The plugin's table-of-contents tools against the real rhwp engine, on a report long
 * enough to run over several pages.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import init, { HwpDocument } from '@rhwp/core'
import { agentPlugin, type AgentPluginHost } from '../studio-plugin/agent-plugin.mjs'

const require = createRequire(import.meta.url)

beforeAll(async () => {
  const wasm = join(dirname(require.resolve('@rhwp/core')), 'rhwp_bg.wasm')
  await init({ module_or_path: readFileSync(wasm) })
})

const CHAPTERS = 4
const BODY_LINES = 30

/** 보고서 제목, then chapters of a heading, a sub-heading and body lines. */
function report() {
  const doc = HwpDocument.createEmpty()
  doc.createBlankDocument()
  const lines = ['보고서 제목']
  for (let i = 1; i <= CHAPTERS; i++) {
    lines.push(`${i}. 장 제목 ${i}`, `${i}.1 절 제목 ${i}`)
    for (let j = 0; j < BODY_LINES; j++) lines.push(`본문 ${i}-${j} 문장입니다. 줄을 채웁니다.`)
  }
  lines.forEach((line, k) => {
    if (k > 0) doc.splitParagraph(0, k - 1, doc.getParagraphLength(0, k - 1))
    doc.insertText(0, k, 0, line)
  })
  return doc
}

function open(start: HwpDocument = report()) {
  let doc = start
  const history: Uint8Array[] = []
  const host = {
    read: (fn: (d: never) => unknown) => fn(doc as never),
    transaction: (_label: string, fn: (tx: never) => unknown) => {
      const before = doc.exportHwp()
      try {
        const result = fn({ doc: () => doc, deferPagination: () => {} } as never)
        history.push(before)
        return result
      } catch (thrown) {
        doc = new HwpDocument(before)
        throw thrown
      }
    },
    events: { on: () => 0 },
    automation: { registerCommand: () => {}, execute: () => ({ ok: false }) },
  } as unknown as AgentPluginHost
  return { plugin: agentPlugin.activate(host), doc: () => doc, steps: () => history.length }
}

const ENTRIES = Array.from({ length: CHAPTERS }, (_, i) => [
  { find: `장 제목 ${i + 1}`, level: 1 },
  { find: `절 제목 ${i + 1}`, level: 2 },
]).flat()

/** The page the engine lays a body paragraph that starts with `text` out on. */
function pageOf(doc: HwpDocument, text: string): number {
  for (let k = 0; k < doc.getParagraphCount(0); k++) {
    if (doc.getTextRange(0, k, 0, doc.getParagraphLength(0, k)).startsWith(text)) {
      const at = JSON.parse(doc.getPageOfPosition(0, k)) as { page: number }
      return at.page + 1
    }
  }
  throw new Error(`no paragraph starts with ${text}`)
}

describe('making a table of contents', () => {
  it('lists the headings with the pages they are on once the contents are in place', () => {
    const { plugin, doc, steps } = open()
    const result = plugin.insertToc('보고서 제목', null, 'after', '차 례', ENTRIES)
    expect(result).toMatchObject({ ok: true, count: ENTRIES.length })
    expect(steps()).toBe(1)
    const table = plugin.readTable(1)
    if (!table.ok) throw new Error('no table')
    expect(table.rows).toBe(ENTRIES.length)
    expect(table.cols).toBe(2)
    const rows = Array.from({ length: table.rows }, (_, r) =>
      table.cells.filter((cell) => cell.row === r + 1).map((cell) => cell.text),
    )
    expect(rows[0]).toEqual(['1. 장 제목 1', String(pageOf(doc(), '1. 장 제목 1'))])
    expect(rows[ENTRIES.length - 1]).toEqual([
      `${CHAPTERS}.1 절 제목 ${CHAPTERS}`,
      String(pageOf(doc(), `${CHAPTERS}.1 절 제목 ${CHAPTERS}`)),
    ])
    expect(result.ok && result.pages.at(-1)).toBeGreaterThan(1)
    // the title line, then the table, right after the anchor
    expect(doc().getTextRange(0, 1, 0, doc().getParagraphLength(0, 1))).toBe('차 례')
  })

  it('goes before the anchor too, and without a title', () => {
    const { plugin } = open()
    const result = plugin.insertToc('1. 장 제목 1', null, 'before', null, ENTRIES.slice(0, 2))
    expect(result).toMatchObject({ ok: true, count: 2 })
    const table = plugin.readTable(1)
    expect(table.ok && table.cells.map((cell) => cell.text)).toEqual([
      '1. 장 제목 1',
      '1',
      '1.1 절 제목 1',
      '1',
    ])
  })

  it('names the heading it cannot use and changes nothing', () => {
    const { plugin, steps } = open()
    expect(
      plugin.insertToc('보고서 제목', null, 'after', '차 례', [{ find: '제목', level: 1 }]),
    ).toMatchObject({ ok: false, reason: 'no_heading', heading: '제목', why: 'ambiguous' })
    expect(
      plugin.insertToc('보고서 제목', null, 'after', '차 례', [{ find: '없는 제목', level: 1 }]),
    ).toMatchObject({ ok: false, reason: 'no_heading', why: 'not_found' })
    expect(steps()).toBe(0)
  })

  it('refuses entries without a level and too many of them', () => {
    const { plugin } = open()
    expect(() =>
      plugin.insertToc('보고서 제목', null, 'after', null, [{ find: '장 제목 1', level: 4 }]),
    ).toThrow()
    expect(() => plugin.insertToc('보고서 제목', null, 'after', null, [])).toThrow()
  })
})

describe('writing the page numbers again', () => {
  it('follows the headings after the document moved them, and touches nothing else', () => {
    const { plugin, doc } = open()
    plugin.insertToc('보고서 제목', null, 'after', '차 례', ENTRIES)
    // a page and more of text pushed in before the first chapter
    const at = 3
    for (let i = 0; i < 45; i++) doc().splitParagraph(0, at, doc().getParagraphLength(0, at))
    const result = plugin.refreshToc('차 례', null)
    expect(result).toMatchObject({ ok: true, lines: ENTRIES.length })
    expect(result.ok && result.changed).toBeGreaterThan(0)
    const table = plugin.readTable(1)
    if (!table.ok) throw new Error('no table')
    const pages = table.cells.filter((cell) => cell.col === 2).map((cell) => Number(cell.text))
    expect(pages[0]).toBe(pageOf(doc(), '1. 장 제목 1'))
    expect(pages.at(-1)).toBe(pageOf(doc(), `${CHAPTERS}.1 절 제목 ${CHAPTERS}`))
    // nothing more to change the second time
    expect(plugin.refreshToc('차 례', null)).toMatchObject({ ok: true, changed: 0 })
  })

  it('says when no table of contents follows the line', () => {
    const { plugin } = open()
    expect(plugin.refreshToc('보고서 제목', null)).toMatchObject({ ok: false, reason: 'no_toc' })
  })
})

/** The look of the first paragraph of a cell of the table in body paragraph `para`. */
function cellLook(doc: HwpDocument, para: number, cell: number) {
  const chars = JSON.parse(doc.getCellCharPropertiesAt(0, para, 0, cell, 0, 0)) as {
    fontFamily: string
    fontSize: number
  }
  const shape = JSON.parse(doc.getCellParaPropertiesAt(0, para, 0, cell, 0)) as {
    marginLeft: number
  }
  const style = (JSON.parse(doc.getCellStyleAt(0, para, 0, cell, 0)) as { name?: string }).name
  return { font: chars.fontFamily, size: chars.fontSize / 100, margin: shape.marginLeft, style }
}

/** The look of the start of body paragraph `para`. */
function paragraphLook(doc: HwpDocument, para: number) {
  const chars = JSON.parse(doc.getCharPropertiesAt(0, para, 0)) as {
    fontFamily: string
    fontSize: number
    bold: boolean
  }
  const shape = JSON.parse(doc.getParaPropertiesAt(0, para)) as { alignment: string }
  const style = (JSON.parse(doc.getStyleAt(0, para)) as { name?: string }).name
  return {
    font: chars.fontFamily,
    size: chars.fontSize / 100,
    bold: chars.bold,
    align: shape.alignment,
    style,
  }
}

describe('the look of a table of contents', () => {
  it('takes the 차례 styles of the document, not the look of the heading it follows', () => {
    const { plugin, doc } = open()
    // the anchor is a heading in 16pt bold
    doc().applyCharFormat(0, 0, 0, doc().getParagraphLength(0, 0), '{"fontSize":1600,"bold":true}')
    expect(plugin.insertToc('보고서 제목', null, 'after', '차 례', ENTRIES.slice(0, 2))).toMatchObject(
      { ok: true },
    )
    expect(paragraphLook(doc(), 1)).toMatchObject({ size: 16, align: 'center', style: '차례 제목' })
    expect(paragraphLook(doc(), 2).style).toBe('바탕글')
    const first = cellLook(doc(), 2, 0)
    const second = cellLook(doc(), 2, 2)
    expect(first).toMatchObject({ size: 11, style: '차례 1' })
    expect(second).toMatchObject({ size: 11, style: '차례 2' })
    expect(second.margin).toBeGreaterThan(first.margin)
  })

  it('takes the body font without 차례 styles, with an indent for each level and a bold title', () => {
    const start = new HwpDocument(
      new Uint8Array(readFileSync(join(__dirname, 'fixtures', 'generated-form-tables.hwpx'))),
    )
    const heading = (para: number) => start.getTextRange(0, para, 0, start.getParagraphLength(0, para))
    const entries = [
      { find: heading(2), level: 1 },
      { find: heading(14), level: 2 },
    ]
    const { plugin, doc } = open(start)
    expect(plugin.insertToc(heading(2), null, 'after', '차 례', entries)).toMatchObject({
      ok: true,
    })
    // the heading is 함초롬돋움 11pt bold; the body text is 맑은 고딕 10pt
    expect(paragraphLook(doc(), 3)).toEqual({
      font: '맑은 고딕',
      size: 10,
      bold: true,
      align: 'center',
      style: '바탕글',
    })
    const first = cellLook(doc(), 4, 0)
    const second = cellLook(doc(), 4, 2)
    expect(first).toMatchObject({ font: '맑은 고딕', size: 10 })
    expect(second).toMatchObject({ font: '맑은 고딕', size: 10 })
    expect(second.margin).toBeGreaterThan(first.margin)
  })
})

describe('a second table of contents and new headings', () => {
  it('refuses a second table of contents and names the one there', () => {
    const { plugin, steps } = open()
    plugin.insertToc('보고서 제목', null, 'after', '차 례', ENTRIES.slice(0, 2))
    expect(
      plugin.insertToc('보고서 제목', null, 'after', '차 례', ENTRIES.slice(0, 4)),
    ).toEqual({ ok: false, reason: 'toc_exists', count: 1, table: 1, title: '차 례' })
    expect(steps()).toBe(1)
  })

  it('writes the rows anew from entries, a chapter added at the end, and keeps one table', () => {
    const { plugin, doc } = open()
    plugin.insertToc('보고서 제목', null, 'after', '차 례', ENTRIES.slice(0, 4))
    const last = doc().getParagraphCount(0) - 1
    doc().splitParagraph(0, last, doc().getParagraphLength(0, last))
    doc().insertText(0, last + 1, 0, '5. 향후 계획')
    const result = plugin.refreshToc('차 례', null, [
      ...ENTRIES.slice(0, 4),
      { find: '향후 계획', level: 1 },
    ])
    expect(result).toMatchObject({ ok: true, rebuilt: true, count: 5, table: 1 })
    const table = plugin.readTable(1)
    if (!table.ok) throw new Error('no table')
    expect(plugin.listTables().tables).toHaveLength(1)
    const headings = table.cells.filter((cell) => cell.col === 1).map((cell) => cell.text)
    expect(headings).toEqual([
      '1. 장 제목 1',
      '1.1 절 제목 1',
      '2. 장 제목 2',
      '2.1 절 제목 2',
      '5. 향후 계획',
    ])
    const pages = table.cells.filter((cell) => cell.col === 2).map((cell) => Number(cell.text))
    expect(pages.at(-1)).toBe(pageOf(doc(), '5. 향후 계획'))
    expect(cellLook(doc(), 2, 8).style).toBe('차례 1')
  })

  it('names a new heading it cannot find and changes nothing', () => {
    const { plugin, steps } = open()
    plugin.insertToc('보고서 제목', null, 'after', '차 례', ENTRIES.slice(0, 2))
    expect(plugin.refreshToc('차 례', null, [{ find: '없는 장', level: 1 }])).toMatchObject({
      ok: false,
      reason: 'no_heading',
      why: 'not_found',
    })
    expect(steps()).toBe(1)
  })
})
