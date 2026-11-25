/** Established dictionaries and explicitly incomplete preview choices differ. */
export function languageCountPolicy(source) {
  const union = source.match(/export type LegacyLang\s*=([\s\S]*?)export type Lang\s*=/)?.[1]
  const list = source.match(/export const LANGS:[^=]*=\s*\[([\s\S]*?)\]/)?.[1]
  if (!union || !list) throw new Error('Could not parse established and total locale inventories')
  const established = [...union.matchAll(/'([a-zA-Z-]+)'/g)].length
  const total = [...list.matchAll(/'([a-zA-Z-]+)'/g)].length
  if (established < 1 || total < established) throw new Error('Invalid locale inventory')
  return { established, total, previews: total - established }
}

export function validLanguageCount(count, line, policy) {
  if (count === policy.established) return true
  // A total that includes unfinished editions must say so on the same line.
  return count === policy.total && /preview|미리\s?보기|시험\s?지원/i.test(line)
}
