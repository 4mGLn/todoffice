import { writeFileSync } from 'node:fs'
import { createXmindDocumentFromSheets, newSheet, newTopic } from '@genoffice/xmind-engine'

/**
 * The map the `map-*` tests read and edit: one sheet "Plan", Root with A and B,
 * A1 under A, a floating topic under A1 (a preserved element), and a note and a
 * link on B. Built with the engine into a temp dir; nothing here touches a real
 * program or a real user's files.
 */
export async function sampleMap(path: string) {
  const sheet = newSheet({ title: 'Plan', rootTitle: 'Root' })
  const a = newTopic('A')
  const b = newTopic('B')
  const a1 = newTopic('A1')
  a1.children = { detached: [{ id: 'float-1', title: 'Floating' }] }
  a.children = { attached: [a1] }
  b.notes = { plain: { content: 'B note' } }
  b.href = 'https://example.com/b'
  sheet.rootTopic.children = { attached: [a, b] }
  const document = await createXmindDocumentFromSheets([sheet])
  writeFileSync(path, await document.save())
  return { root: sheet.rootTopic.id, a: a.id, b: b.id, a1: a1.id, float: 'float-1' }
}
