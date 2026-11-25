import { describe, expect, it } from 'vitest'
import { LANGS, MONGOLIAN_LOCALIZATION_STATUS, isPreviewUiLanguage } from '@genoffice/i18n'
import { expectPreviewDictionary } from '../../../packages/i18n/tests/preview-assertions'
import { strings as docs } from '../../docs/src/renderer/i18n/strings'
import { strings as sheets } from '../../sheets/src/renderer/i18n/strings'
import { strings as slides } from '../../slides/src/renderer/i18n/strings'
import { strings as pdf } from '../../pdf/src/renderer/i18n/strings'
import { strings as markdown } from '../../markdown/src/renderer/i18n/strings'
import { strings as html } from '../../html/src/renderer/i18n/strings'
import { strings as mindmap } from '../../mindmap/src/renderer/i18n/strings'
import { strings as hwp } from '../../hwp/src/renderer/i18n/strings'
import { strings as epub } from '../../epub/src/renderer/i18n/strings'
import { strings as diagram } from '../../diagram/src/renderer/i18n/strings'
import { strings as shell } from '../src/renderer/src/strings'
import { editorPickStrings } from '../src/renderer/src/i18n/strings-editor-pick'
import { editorSettingsStrings } from '../src/renderer/src/i18n/strings-editor-settings'
import { generateStrings } from '../src/renderer/src/i18n/strings-generate'
import { DEFAULT_GENERATE_PROMPTS } from '../src/shared/generate-default-prompts'
import { recoveryListStrings } from '../src/renderer/src/i18n/strings-recovery'
import { mcpServersUiStrings } from '../src/renderer/src/i18n/strings-mcp-servers'
import { skillsUiStrings } from '../src/renderer/src/i18n/strings-skills'
import { agentWebStrings } from '../src/renderer/src/i18n/strings-agent-web'
import { mainMenuStrings } from './helpers/main-menu-strings'

const tables = {
  docs,
  sheets,
  slides,
  pdf,
  markdown,
  html,
  mindmap,
  hwp,
  epub,
  diagram,
  shell,
  editorPickStrings,
  editorSettingsStrings,
  generateStrings,
  DEFAULT_GENERATE_PROMPTS,
  recoveryListStrings,
  mcpServersUiStrings,
  skillsUiStrings,
  agentWebStrings,
  mainMenuStrings,
}

describe('Mongolian preview dictionaries across the shell and all ten editors', () => {
  it('distinguishes 22 established editions from two incomplete previews', () => {
    expect(LANGS.filter((lang) => !isPreviewUiLanguage(lang))).toHaveLength(22)
    expect(LANGS.filter(isPreviewUiLanguage)).toEqual(['mn-Cyrl', 'mn-Mong'])
    expect(MONGOLIAN_LOCALIZATION_STATUS).toBe('preview-incomplete')
  })
  for (const [name, table] of Object.entries(tables)) {
    it.each(['mn-Cyrl', 'mn-Mong'] as const)(
      `${name} %s preserves every key and uses only sourced translations or explicit English fallback`,
      (lang) => {
        expectPreviewDictionary(lang, table[lang], table.en, `${name}.${lang}`)
      },
    )
  }
})
