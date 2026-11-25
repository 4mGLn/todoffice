/** Resolve the existing main-process proxy policy independently of product links. */
export async function mainProcessProxyUrl(
  env: NodeJS.ProcessEnv,
  resolveProxy: (url: string) => Promise<string>,
): Promise<string | undefined> {
  const configured = [
    env.HTTPS_PROXY,
    env.https_proxy,
    env.HTTP_PROXY,
    env.http_proxy,
    env.ALL_PROXY,
    env.all_proxy,
  ].find((value) => value && /^https?:\/\//.test(value))
  if (configured) return configured
  try {
    // Match the standalone slides bootstrap: resolve PAC for a service the
    // app actually calls, even before a TodOffice update repository exists.
    const resolved = await resolveProxy('https://api.anthropic.com/')
    const match = /PROXY\s+([^;\s]+)/.exec(resolved)
    return match ? `http://${match[1]}` : undefined
  } catch {
    return undefined
  }
}
