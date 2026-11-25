#!/usr/bin/env node
/** Strict source-wide preview inventory. English fallbacks are missing translations. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const legacy = new Set(
  'zh en ja ko fr de es th id ru ar pt it pl cs nl ms he hi zh-TW vi tr'.split(' '),
)
const metadata = new Set([
  'HTML_LANGS',
  'AI_LANG_DIRECTIVES',
  'DATE_LOCALES',
  'LANGUAGE_NAMES',
  'AUTONYMS',
  'NUMFMT_LOCALES',
])
const messages = new Map()
const derived = []
const key = (node) =>
  node?.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
    ? node.name.text
    : undefined
const parse = (file) =>
  ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
function files(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? files(path.join(dir, e.name))
        : /\.(tsx?|m?js)$/.test(e.name)
          ? [path.join(dir, e.name)]
          : [],
    )
}
function collect(node, sf, file) {
  if (ts.isStringLiteralLike(node)) {
    const locations = messages.get(node.text) ?? new Set()
    locations.add(
      `${path.relative(root, file)}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`,
    )
    messages.set(node.text, locations)
  } else if (ts.isTemplateExpression(node)) {
    derived.push(
      `${path.relative(root, file)}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`,
    )
  } else ts.forEachChild(node, (child) => collect(child, sf, file))
}
for (const area of ['apps', 'packages'])
  for (const workspace of fs.readdirSync(path.join(root, area))) {
    const dir = path.join(root, area, workspace, 'src')
    if (!fs.existsSync(dir) || workspace === 'i18n') continue
    for (const file of files(dir)) {
      const sf = parse(file)
      // English shard files export the source dictionary rather than a locale table.
      if (path.basename(file) === 'en.ts' && /(?:i18n|strings-)/.test(file)) {
        for (const stmt of sf.statements)
          if (ts.isVariableStatement(stmt))
            for (const decl of stmt.declarationList.declarations)
              if (decl.initializer) collect(decl.initializer, sf, file)
        continue
      }
      const visit = (node) => {
        if (ts.isObjectLiteralExpression(node)) {
          const names = node.properties.map(key)
          const parentName = ts.isVariableDeclaration(node.parent)
            ? node.parent.name.getText(sf)
            : undefined
          if (
            !metadata.has(parentName) &&
            names.includes('en') &&
            names.filter((n) => legacy.has(n)).length >= 8
          ) {
            const english = node.properties.find((p) => key(p) === 'en')
            if (english && ts.isPropertyAssignment(english)) collect(english.initializer, sf, file)
            return
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(sf)
    }
  }
const catalogs = {}
for (const filename of ['mongolian-sourced-catalogs.ts', 'mongolian-ui-drafts.ts']) {
  const catalogFile = parse(path.join(root, 'packages/i18n/src', filename))
  for (const stmt of catalogFile.statements)
    if (ts.isVariableStatement(stmt))
      for (const decl of stmt.declarationList.declarations) {
        if (!decl.initializer || !ts.isObjectLiteralExpression(decl.initializer)) continue
        catalogs[decl.name.getText(catalogFile)] = Object.fromEntries(
          decl.initializer.properties
            .filter(ts.isPropertyAssignment)
            .map((p) => [key(p), p.initializer.text]),
        )
      }
}
const sourcedTraditional = catalogs.TRADITIONAL_MESSAGES
catalogs.TRADITIONAL_MESSAGES = { ...catalogs.DRAFT_TRADITIONAL_MESSAGES, ...sourcedTraditional }
const tokensFile = parse(path.join(root, 'packages/i18n/src/mongolian.ts'))
let unchanged = new Set()
for (const stmt of tokensFile.statements)
  if (ts.isVariableStatement(stmt))
    for (const decl of stmt.declarationList.declarations) {
      if (decl.name.getText(tokensFile) === 'UNCHANGED_TOKENS')
        unchanged = new Set(decl.initializer.arguments[0].elements.map((e) => e.text))
    }
const source = [...messages.keys()].filter((text) => !unchanged.has(text)).sort()
const report = {
  status: 'preview-incomplete',
  method:
    'literal English leaves in locale tables and English shards; referenced constants and dynamic templates require separate review',
  sourceMessages: source.length,
  dynamicTemplatesRequiringReview: [...new Set(derived)].sort(),
  locales: Object.fromEntries(
    [
      ['mn-Cyrl', 'CYRILLIC_MESSAGES'],
      ['mn-Mong', 'TRADITIONAL_MESSAGES'],
    ].map(([lang, name]) => {
      const missing = source.filter((text) => catalogs[name][text] === undefined)
      return [
        lang,
        {
          catalogEntries: Object.keys(catalogs[name]).length,
          sourceBackedMessages: source.filter(
            (text) =>
              (lang === 'mn-Mong' ? sourcedTraditional : catalogs[name])[text] !== undefined,
          ).length,
          draftMessages:
            lang === 'mn-Mong'
              ? source.filter(
                  (text) =>
                    sourcedTraditional[text] === undefined &&
                    catalogs.DRAFT_TRADITIONAL_MESSAGES[text] !== undefined,
                ).length
              : 0,
          draftReview: 'native-review-required',
          translatedMessages: source.length - missing.length,
          missingMessages: missing.map((text) => ({
            text,
            locations: [...messages.get(text)].sort(),
          })),
        },
      ]
    }),
  ),
}
const outputIndex = process.argv.indexOf('--json')
if (outputIndex !== -1) {
  const target = process.argv[outputIndex + 1]
  if (!target) throw new Error('--json requires an output path')
  fs.writeFileSync(path.resolve(target), `${JSON.stringify(report, null, 2)}\n`)
}
for (const [lang, value] of Object.entries(report.locales))
  console.log(
    `${lang}: ${value.translatedMessages}/${report.sourceMessages} literal messages translated (${value.draftMessages} drafts); ${value.missingMessages.length} missing; ${report.dynamicTemplatesRequiringReview.length} dynamic templates require review`,
  )
if (
  Object.values(report.locales).some((v) => v.missingMessages.length) ||
  report.dynamicTemplatesRequiringReview.length
)
  process.exitCode = 1
