# Mongolian support in TodOffice

Implementation record: 2026-11-25. The Mongolian interfaces are **incomplete translation previews**. Selecting a language does not mean every screen or manual has been translated.

## Language and naming

| Locale    | User-facing name             | Interface flow                            |
| --------- | ---------------------------- | ----------------------------------------- |
| `mn-Cyrl` | Mongolian Cyrillic / Монгол  | Horizontal                                |
| `mn-Mong` | Mongol bichig / Монгол бичиг | Top to bottom, columns from left to right |

Use **Mongolian Traditional Script** when explaining the script in context. The requested Korean name is **몽곫문자**. Mongolian Cyrillic and Mongol bichig are separate locale choices, rather than two names for the same translation.

Bare `mn` and `mn-MN` resolve to `mn-Cyrl`; `mn-CN` resolves to `mn-Mong`. Explicit script subtags take priority. Translation target comparisons preserve the script, so translating between the two is not dismissed as a same-language operation.

## Interface and document direction

The latest requested layout is a vertical interface, including navigation, menus, the ribbon and settings. Shared rules in `packages/ui/src/mongolian-ui.css` apply only to `mn-Mong`. The native window caption and shell tab strip keep their physical bounds because the shell positions editor views below that strip.

Existing document direction is independent of interface changes: changing the interface does not rotate an opened file. New blank Docs drafts created while Mongol bichig is selected now start with `tbLrV` section layout (vertical text and columns from left to right). This default applies at creation time and is saved in DOCX. New Cyrillic and other-language drafts keep their horizontal default. Docs exposes an explicit writing-direction choice for Mongol bichig; its engine tests cover preservation of the direction and Mongolian shaping controls in DOCX. Support in Docs does not establish equivalent editing, shaping or export behavior in PPTX, XLSX, PDF, EPUB, HWP or the embedded diagram editor.

Mongolian text uses the bundled Noto Sans Mongolian font through the existing local font protocol. No font download or operating-system font installation is required when the application runs. Font source, revision, hash and OFL notice are recorded alongside `packages/ui/template-fonts` and included in the generated installer notices.

URLs, passwords, numeric values and code remain horizontal. Latin fallback strings follow the surrounding vertical interface with mixed text orientation. Existing document surfaces keep their own writing direction.

## Translation coverage and sources

The initial source-backed catalogs contain 32 Cyrillic entries and 8 traditional-script entries. Title-case aliases are counted separately; these are not counts of fully translated screens. On 2026-11-24, 229 separately identified contextual traditional-script drafts were added for primary navigation, cards, ribbon tabs/actions and Settings. Existing source-backed terms take precedence. Unmapped interface messages continue to use English fallback. The language picker and settings identify this preview status.

The [source and help review](mongolian-localization-review.md) records pinned AOSP, Mongol Library and Chimee-iOS sources, resource contexts and licenses. A published translation is evidence of actual use, not independent native-speaker approval of its use in an office suite. Ambiguous terms need contextual review.

Run the strict inventory from the app root:

```bash
npm run check:mongolian-coverage -- --json /tmp/todoffice-mongolian-coverage.json
npm run check:help-langs
```

`check:help-langs` checks all 27 topics in each script against the English manual. Both Mongolian editions have draft articles. The interface inventory still reports unmapped messages and exits with a failure. It covers literal English dictionary leaves. Referenced constants, dynamic templates and embedded vendor interfaces require additional review.

The app continues to fall back to horizontal English if an article is unavailable in the selected language. HWP's embedded editor and draw.io retain their English fallback where no Mongolian language pack exists.

## Compact controls (2026-11-25)

Formatting glyphs such as B, I and U use horizontal physical controls, independently of the vertical script labels. Icon buttons have 28px square hit areas; primary tabs use a 40px width and 84px height at normal window widths. Editor rails total 192px (48px navigation plus 144px tools), reduced to 172px at viewport widths of 1100px or less. Collapsing leaves only the 48px or 44px navigation rail. The high-specificity expanded geometry no longer reserves a hidden panel's width.

Large actions use 36px widths and 112px heights. Split Paste shares that combined height instead of allocating a full tall button to its icon alone. Tool groups wrap controls internally. Home uses a default 184px sidebar and equal 176px tiles, with six columns in wide windows and fewer columns below that width. Vertical filter chips get matching physical containers; extensions stay horizontal and ellipsize. A manually resized Home sidebar retains its chosen width.

This changes application chrome only. The existing Mongol bichig naming/loanword policy and document direction settings remain independent.

## Menu refinement (2026-11-24)

Mongol bichig structural containers use physical grids and flex rows, with vertical script inside labels. Home tiles share 208-pixel heights and responsive equal columns; primary tabs use 48 by 104-pixel cells in a 56-pixel navigation rail beside a 216-pixel tool panel. Settings uses 144-pixel field cards, bounded physical inputs and horizontal paths. Menus and tools scroll within their rails; document direction remains independent of UI language. These rules apply only to `mn-Mong`.

Draft terms are recorded in `packages/i18n/src/mongolian-ui-drafts.ts` and their review status in `localization-sources/ui-drafts.json`. Selected single-word spellings were checked against Greg Eck's CC0 dictionary through a pinned lookup snapshot; this does not establish the correctness of authored office phrases. The implementation uses explicit translations rather than a generic Cyrillic transliterator. Basic actions keep familiar Mongolian wording. Specialist names such as Style, Font, Format and Markdown use explicit English-sound Mongol bichig display spellings instead of forced literal translations. These loanword spellings are drafts, not a standardized transliteration system. File extensions, executable commands, protocol identifiers, font values, URLs and numbers retain their exact spelling.

The strict source inventory finds 226 of 7,876 literal messages mapped in `mn-Mong`: 8 source-backed and 218 drafts, with 7,650 still missing and two dynamic templates requiring review. Catalog size (237 entries including aliases) is distinct from messages matched in application dictionaries. Cyrillic display strings are unchanged; the shared source denominator now includes the specialist display names, so its inventory is 30 mapped and 7,846 missing. Neither the draft additions nor script-presence tests establish native-speaker approval or complete localization.

Current verification evidence is recorded separately under `.agents/.analysis/ui-refinement/`. On 2026-11-24, four actual Electron tests passed after the final production build: two window widths with equal Home tiles; bounded Settings controls and both light/dark screenshots; script switching without rotating the existing document; regular primary ribbon tabs in Docs, Sheets and Slides; and the existing vertical DOCX input/save round trip. These are representative flows, not an exhaustive check of every menu or translation. Historical verification below refers to its stated date.

## Verification boundaries

Focused unit tests, type checks, production builds and packaging establish different properties. Chromium checks against production CSS can detect overlap and clipping in representative layouts, but do not prove every live application screen works. Native IME composition, pointer selection across vertical lines, multi-page layout, printing, PDF export and Office interoperability require their own runtime checks. Record exact executed checks in the workspace's `.agents/.analysis/mongolian/` evidence directory before making claims about them.

On 2026-11-18, two actual Electron tests passed on an isolated Linux Xvfb display:

- Selecting Mongol bichig section direction, observing vertical glyph advance and left-to-right paragraph advance, entering Unicode controls and supplementary birga, saving the DOCX and reparsing the exact text, then restoring horizontal direction.
- Switching between the two Mongolian interface locales through Settings, loading the bundled font, keeping Settings reachable, and opening an existing horizontal document under a vertical ribbon without rotating its content.

The fixture checks also covered light, dark and system themes at two viewport widths in 36 Chromium cases. Those fixture checks are distinct from the two live application flows. There was no OS package installation, native Mongolian IME test, older-Linux runtime test or Word execution.

Word interoperability has an additional known boundary: Microsoft's [implementation notes](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-oe376/084bdcbc-8c2b-4f4e-a1fb-b47f175c5e32) say Word applies the `tbLrV` direction to both `tbLrV` and `tbRlV`. TodOffice retains its existing handling of legacy modes. The local DOCX round-trip tests therefore do not certify Word round-trip layout parity.

The current locale work is a foundation for completing Mongolian support, not a certified complete localization or proof of all-format vertical document compatibility.
