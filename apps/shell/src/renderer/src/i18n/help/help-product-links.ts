/** Remove inherited product service links; source/license attribution links remain intact. */
export function withoutUpstreamProductLinks(markdown: string): string {
  const service =
    /^(?:https?:\/\/(?:www\.)?ieumoffice\.com(?:[/?#]|$)|https?:\/\/github\.com\/(?:pblsketch\/ieumoffice|genspark-ai\/genoffice)\/(?:releases|issues)(?:[/?#]|$)|mailto:pblsketch@gmail\.com)/i
  return markdown
    .replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (match, label: string, href: string) =>
      service.test(href) ? label : match,
    )
    .replace(/https?:\/\/(?:www\.)?ieumoffice\.com[^\s<)]*/gi, '')
}
