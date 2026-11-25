import {
  buildBlankDocx,
  parseDocx,
  readSectionSettings,
  saveDocx,
} from '../packages/docx-engine/src/index'

export const MONGOL_BICHIG_SAMPLE =
  'ᠮᠣᠩᠭᠣᠯ ᠪᠢᠴᠢᠭ ᠭ\u180bᠠᠯ ᠠ\u180c ᠠ\u180d ᠠ\u180f ᠨ\u180eᠠ ᠮᠣᠩᠭᠣᠯ\u202fᠤᠨ ᠠ\u200dᠠ ᠠ\u200cᠠ \u{11660}\u{1166c}'
export const MONGOLIAN_CYRILLIC_SAMPLE = 'Монгол хэл: Өө Үү Ёё'

/** Real OOXML fixture, using default Calibri so the bundled missing-glyph
 * fallback is exercised without any Mongolian system font dependency. */
export async function mongolianDocxFixture(vertical = false): Promise<Uint8Array> {
  const base = await parseDocx(
    await buildBlankDocx({ application: 'TodOffice', createdAt: new Date('2026-11-18T00:00:00Z') }),
  )
  const texts = ['ᠮᠣᠩᠭᠣᠯ ᠪᠢᠴᠢᠭ', 'ᠮᠣᠩᠭᠣᠯ ᠬᠡᠯᠡ', MONGOL_BICHIG_SAMPLE, MONGOLIAN_CYRILLIC_SAMPLE]
  return saveDocx(
    base,
    texts.map((text) => ({
      kind: 'generated',
      block: { type: 'paragraph', runs: [{ text }] },
    })),
    vertical ? { section: { ...readSectionSettings(base), textDirection: 'tbLrV' } } : {},
  )
}
