import { describe, expect, it } from 'vitest'
import { MONGOLIAN_LOCALIZATION_STATUS, mongolianMessage } from '@genoffice/i18n'
import { AI_CHANGES_LABELS } from '../src/strings-ai-changes'
import { AI_RUN_STOP_LABELS } from '../src/strings-run-stop'
import { PRINT_LAYOUT_STRINGS } from '../src/strings-print-layout'

describe('explicitly incomplete Mongolian interface previews', () => {
  it.each(['mn-Cyrl', 'mn-Mong'] as const)(
    'keeps %s available without claiming English fallback is translated',
    (lang) => {
      expect(MONGOLIAN_LOCALIZATION_STATUS).toBe('preview-incomplete')
      for (const table of [AI_CHANGES_LABELS, PRINT_LAYOUT_STRINGS]) {
        const english = table.en as unknown as Record<string, unknown>
        const preview = table[lang] as unknown as Record<string, unknown>
        expect(Object.keys(preview)).toEqual(Object.keys(english))
        for (const [key, value] of Object.entries(english)) {
          if (typeof value === 'string')
            expect(preview[key]).toBe(mongolianMessage(lang, value).text)
        }
      }
      expect(AI_RUN_STOP_LABELS[lang].keptChanges).toContain(
        AI_RUN_STOP_LABELS[lang].continueAction,
      )
      expect(mongolianMessage(lang, PRINT_LAYOUT_STRINGS.en.panelTitle).translated).toBe(false)
    },
  )
})
