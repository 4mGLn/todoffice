/**
 * The line between the columns (rhwp patch 0051).
 *
 * The engine always read, saved and drew the separator line of a column definition, but no
 * call could set it, and `getColumnDef` did not report it. A test paper in the form Korean
 * schools use has two columns with a line between them. Patch 0051 adds
 * `setColumnSeparator(section, json)` and the three separator fields of `getColumnDef`.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import init, { HwpDocument } from '@rhwp/core'

const require = createRequire(import.meta.url)

beforeAll(async () => {
  const wasm = join(dirname(require.resolve('@rhwp/core')), 'rhwp_bg.wasm')
  await init({ module_or_path: readFileSync(wasm) })
})

const EIGHT_MM_COLUMN_GAP = 2268
const LINE = { type: 1, width: 1, color: '#112233' }

function twoColumns(): HwpDocument {
  const doc = HwpDocument.createEmpty()
  doc.createBlankDocument()
  for (let index = 0; index < 60; index += 1) {
    if (index > 0) doc.splitParagraph(0, index - 1, doc.getParagraphLength(0, index - 1))
    doc.insertText(0, index, 0, `문항 ${index + 1} 본문 한 줄`)
  }
  doc.setColumnDef(0, 2, 0, 1, EIGHT_MM_COLUMN_GAP)
  return doc
}

const separator = (doc: HwpDocument) => {
  const { separatorType, separatorWidth, separatorColor } = JSON.parse(doc.getColumnDef(0))
  return { type: separatorType, width: separatorWidth, color: separatorColor }
}

/** Vertical lines of the page picture drawn in the separator's colour. */
function separatorLines(doc: HwpDocument): { x: number; y1: number; y2: number }[] {
  const svg = doc.renderPageSvg(0)
  return [
    ...svg.matchAll(
      /<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)" stroke="#112233"/g,
    ),
  ]
    .filter((m) => m[1] === m[3])
    .map((m) => ({ x: Number(m[1]), y1: Number(m[2]), y2: Number(m[4]) }))
}

describe('the line between the columns (patch 0051)', () => {
  it('is set, reported, and drawn between the two columns', () => {
    const doc = twoColumns()
    expect(separator(doc).type).toBe(0)
    expect(separatorLines(doc)).toEqual([])

    expect(JSON.parse(doc.setColumnSeparator(0, JSON.stringify(LINE)))).toEqual({ ok: true })
    expect(separator(doc)).toEqual(LINE)
    const lines = separatorLines(doc)
    expect(lines).toHaveLength(1)
    const [{ x, y1, y2 }] = lines
    const pageWidth = Number(doc.renderPageSvg(0).match(/<svg[^>]* width="([\d.]+)"/)?.[1])
    expect(Math.abs(x - pageWidth / 2)).toBeLessThan(1)
    expect(y2).toBeGreaterThan(y1)
  })

  it('survives saving as .hwp and as HWPX', () => {
    const doc = twoColumns()
    doc.setColumnSeparator(0, JSON.stringify(LINE))
    for (const bytes of [doc.exportHwp(), doc.exportHwpx()]) {
      const reopened = new HwpDocument(bytes)
      expect(separator(reopened)).toEqual(LINE)
      expect(separatorLines(reopened)).toHaveLength(1)
    }
  })

  it('goes away with type 0, also after saving', () => {
    const doc = twoColumns()
    doc.setColumnSeparator(0, JSON.stringify(LINE))
    doc.setColumnSeparator(0, '{"type":0}')
    expect(separator(doc).type).toBe(0)
    expect(separatorLines(doc)).toEqual([])
    for (const bytes of [doc.exportHwp(), doc.exportHwpx()]) {
      expect(separator(new HwpDocument(bytes)).type).toBe(0)
    }
  })

  it('refuses a value a saved file could not keep', () => {
    const doc = twoColumns()
    expect(() => doc.setColumnSeparator(0, '{"type":8}')).toThrow()
    expect(() => doc.setColumnSeparator(0, '{"type":1,"width":16}')).toThrow()
    expect(() => doc.setColumnSeparator(0, '{"type":1,"color":"red"}')).toThrow()
    expect(separator(doc).type).toBe(0)
  })
})
