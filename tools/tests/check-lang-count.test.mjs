import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { languageCountPolicy, validLanguageCount } from '../lib/lang-count-policy.mjs'
const source = readFileSync(new URL('../../packages/i18n/src/index.ts', import.meta.url), 'utf8')
const policy = languageCountPolicy(source)
test('keeps established coverage separate from preview choices', () => {
  assert.deepEqual(policy, { established: 22, total: 24, previews: 2 })
  assert.equal(validLanguageCount(22, '22 UI languages', policy), true)
  assert.equal(validLanguageCount(24, '24 fully translated UI languages', policy), false)
  assert.equal(validLanguageCount(24, '24 UI languages including 2 preview locales', policy), true)
  const outdatedCount = policy.established - 1
  assert.equal(validLanguageCount(outdatedCount, outdatedCount + ' UI languages', policy), false)
})
