import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import {
  applySectionSettings,
  parseDocx,
  readSectionSettings,
  saveDocx,
  sectionSettingsFromXml,
  type SaveBlock,
} from '../src/index'
import { buildDocx } from './helpers/build-docx'

// Keep legacy NNBSP and modern MVS distinct; neither invisible controls nor
// variation selectors may disappear when a Mongol bichig document is edited.
const MONGOL =
  'ᠮᠣᠩᠭᠣᠯ ᠪᠢᠴᠢᠭ ᠭ\u180bᠠᠯ ᠠ\u180c ᠠ\u180d ᠠ\u180f ᠨ\u180eᠠ ᠮᠣᠩᠭᠣᠯ\u202fᠤᠨ ᠠ\u200dᠠ ᠠ\u200cᠠ \u{11660}\u{1166c}'
const CYRILLIC = 'Монгол хэл: Өө Үү Ёё'
const p = (text: string) => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`
const originals = (doc: Awaited<ReturnType<typeof parseDocx>>): SaveBlock[] =>
  doc.blocks.filter((b) => !b.hidden).map((b) => ({ kind: 'original', docxIndex: b.docxIndex! }))

describe('Mongol bichig document support', () => {
  it('preserves Cyrillic, joining controls, MVS, NNBSP and all four FVS without an edit', async () => {
    const bytes = await buildDocx({ bodyXml: p(MONGOL) + p(CYRILLIC) })
    const doc = await parseDocx(bytes)
    expect(doc.blocks[0].runs?.map((r) => r.text).join('')).toBe(MONGOL)
    expect(doc.blocks[1].runs?.map((r) => r.text).join('')).toBe(CYRILLIC)
    expect(await saveDocx(doc, originals(doc))).toBe(bytes)
  })

  it('writes explicit vertical-lr section selection and can switch back to horizontal', async () => {
    const xml =
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/><w:cols/><w:docGrid w:linePitch="360"/></w:sectPr>'
    const vertical = applySectionSettings(xml, {
      ...sectionSettingsFromXml(xml),
      textDirection: 'tbLrV',
    })
    expect(vertical).toContain('<w:textDirection w:val="tbLrV"/>')
    expect(vertical.indexOf('<w:textDirection')).toBeLessThan(vertical.indexOf('<w:docGrid'))
    const horizontal = applySectionSettings(vertical, {
      ...sectionSettingsFromXml(vertical),
      textDirection: 'lrTb',
    })
    expect(horizontal).not.toContain('<w:textDirection')
    expect(horizontal).toContain('<w:docGrid w:linePitch="360"/>')
  })

  it('preserves unknown upstream direction values and refuses attribute injection', () => {
    const xml =
      '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/><w:textDirection w:val="futureMode"/></w:sectPr>'
    const settings = sectionSettingsFromXml(xml)
    expect(applySectionSettings(xml, settings)).toContain('<w:textDirection w:val="futureMode"/>')
    expect(() =>
      applySectionSettings(xml, { ...settings, textDirection: 'tbLrV" bad="1' }),
    ).toThrow('Unsupported section text direction')
  })

  it('retains Mongol bichig flow in section, frame and cell models', async () => {
    const bytes = await buildDocx({
      bodyXml:
        '<w:p><w:pPr><w:framePr w:w="1440"/><w:textDirection w:val="tbLrV"/></w:pPr><w:r><w:t>ᠮᠣᠩᠭᠣᠯ</w:t></w:r></w:p>' +
        '<w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="3000"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:textDirection w:val="tbLrV"/></w:tcPr>' +
        p(MONGOL) +
        '</w:tc></w:tr></w:tbl>',
      sectPrExtra: '<w:textDirection w:val="tbLrV"/>',
    })
    const doc = await parseDocx(bytes)
    expect(readSectionSettings(doc).textDirection).toBe('tbLrV')
    expect(doc.blocks[0].format?.textDirection).toBe('tbLrV')
    expect(doc.blocks[1].table?.rows[0][0].textDirection).toBe('tbLrV')
    expect(await saveDocx(doc, originals(doc))).toBe(bytes)
  })

  it('a generated Mongolian paragraph keeps every Unicode control and untouched ZIP parts', async () => {
    const bytes = await buildDocx({ bodyXml: p('Before') + p(CYRILLIC) })
    const doc = await parseDocx(bytes)
    const blocks = originals(doc)
    blocks[0] = { kind: 'generated', block: { type: 'paragraph', runs: [{ text: MONGOL }] } }
    const saved = await saveDocx(doc, blocks, {
      section: { ...readSectionSettings(doc), textDirection: 'tbLrV' },
    })
    const after = await parseDocx(saved)
    expect(after.blocks[0].runs?.map((r) => r.text).join('')).toBe(MONGOL)
    expect(after.blocks[1].originalXml).toBe(doc.blocks[1].originalXml)
    expect(readSectionSettings(after).textDirection).toBe('tbLrV')
    const beforeZip = await JSZip.loadAsync(bytes)
    const afterZip = await JSZip.loadAsync(saved)
    for (const [name, entry] of Object.entries(beforeZip.files)) {
      if (entry.dir || name === 'word/document.xml') continue
      expect(await afterZip.file(name)!.async('uint8array'), name).toEqual(
        await entry.async('uint8array'),
      )
    }
  })
})
