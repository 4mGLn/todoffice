import type { Lang } from '@genoffice/i18n'

export const LANGUAGE_MENU_TOOLTIP: Partial<Record<Lang, string>> = {
  'mn-Mong': 'ᠳᠡᠯᠭᠡᠴᠡ ᠶᠢᠨ ᠬᠡᠯᠡ ᠰᠣᠯᠢᠬᠤ',
  'mn-Cyrl': 'Интерфэйсийн хэлийг солих',
  en: 'Change the interface language',
  ko: '인터페이스 언어 변경',
}

export const PINNED_LANG_OPTIONS = [
  { value: 'mn-Mong', label: 'ᠮᠣᠩᠭᠣᠯ ᠬᠡᠯᠡ' },
  { value: 'mn-Cyrl', label: 'Монгол хэл' },
  { value: 'en', label: 'English' },
  { value: 'ko', label: '한국어' },
] as const satisfies readonly { value: Lang; label: string }[]

export const OTHER_LANGUAGES_LABEL: Record<Lang, string> = {
  ar: 'لغات أخرى',
  cs: 'Další jazyky',
  de: 'Weitere Sprachen',
  en: 'Other',
  es: 'Otros idiomas',
  fr: 'Autres langues',
  he: 'שפות נוספות',
  hi: 'अन्य भाषाएँ',
  id: 'Bahasa lain',
  it: 'Altre lingue',
  ja: 'その他の言語',
  ko: '다른 언어',
  'mn-Cyrl': 'Бусад',
  'mn-Mong': 'ᠪᠤᠰᠤᠳ',
  ms: 'Bahasa lain',
  nl: 'Andere talen',
  pl: 'Inne języki',
  pt: 'Outros idiomas',
  ru: 'Другие языки',
  th: 'ภาษาอื่น',
  tr: 'Diğer diller',
  vi: 'Ngôn ngữ khác',
  zh: '其他语言',
  'zh-TW': '其他語言',
}

// sorted by ISO 639 language code — native-script labels have no natural
// shared alphabet, so the code is the ordering key
export const LANG_OPTIONS = [
  { value: 'ar', label: 'العربية' },
  { value: 'cs', label: 'Čeština' },
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'he', label: 'עברית' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'it', label: 'Italiano' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'mn-Cyrl', label: 'Монгол (кирилл) · preview' },
  { value: 'mn-Mong', label: 'Монгол бичиг · Mongol bichig · preview' },
  { value: 'ms', label: 'Bahasa Melayu' },
  { value: 'nl', label: 'Nederlands' },
  { value: 'pl', label: 'Polski' },
  { value: 'pt', label: 'Português' },
  { value: 'ru', label: 'Русский' },
  { value: 'th', label: 'ไทย' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'zh', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
] as const satisfies readonly { value: Lang; label: string }[]
