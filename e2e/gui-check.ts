import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs, promisify } from 'node:util'
import { parseDocx, readSectionSettings } from '../packages/docx-engine/src/index'
import { guiCases, type GuiCaseName } from './gui-cases'
import { closeShell, launchShell, SHELL_DIR, type LaunchedApp } from './helpers'
import {
  mongolianDocxFixture,
  MONGOL_BICHIG_SAMPLE,
  MONGOLIAN_CYRILLIC_SAMPLE,
} from './mongolian-docx-fixture'

const exec = promisify(execFile)
const caseNames = Object.keys(guiCases) as GuiCaseName[]
const fixtureName = 'Mongolian GUI sample.docx'
const marker = 'ᠰᠤᠷᠭᠠᠭᠤᠯᠢ'
const shellUrl = pathToFileURL(join(SHELL_DIR, 'out/renderer/index.html')).href
const operationTimeout = 8_000

function runCli(cwd: string, args: string[], signal?: AbortSignal) {
  // npm's global executable on Windows is a .cmd shim. The arguments here
  // are fixed commands, a generated session ID and runner-owned basenames.
  return process.platform === 'win32'
    ? exec('cmd.exe', ['/d', '/c', 'playwright-cli', ...args], {
        cwd,
        signal,
        timeout: 50_000,
      })
    : exec('playwright-cli', args, { cwd, signal, timeout: 50_000 })
}

async function checkCase(
  name: GuiCaseName,
  scratch: string,
  artifacts: string,
  session: string,
  screenshots: boolean,
  signal: AbortSignal,
): Promise<string> {
  const failurePath = JSON.stringify(join(artifacts, `${name}-failure.png`))
  const screenshotPath = JSON.stringify(join(artifacts, `${name}.png`))
  const filename = `${name}.js`
  await writeFile(
    join(scratch, filename),
    `async (current) => {
      const shell = current.context().pages().find(page => page.url() === ${JSON.stringify(shellUrl)});
      if (!shell) throw new Error('Built TodOffice shell is missing from the session');
      let target = shell;
      shell.setDefaultTimeout(${operationTimeout});
      try {
        const result = await (${guiCases[name].run.toString()})(
          shell, ${JSON.stringify({ fixtureName, marker })},
          page => { target = page; page.setDefaultTimeout(${operationTimeout}); }
        );
        if (${screenshots}) await target.screenshot({ path: ${screenshotPath}, timeout: 3000 });
        return { message: result };
      } catch (error) {
        await target.screenshot({ path: ${failurePath}, timeout: 2000 }).catch(() => {});
        const snapshot = await target.locator('body').ariaSnapshot({ timeout: 2000 }).catch(() => '');
        throw new Error(String(error) + '\\nAccessibility snapshot:\\n' + snapshot.slice(0, 2500));
      }
    }`,
  )
  // CLI versions can surface automation failures in JSON and through the exit
  // code. Require a result in either case before marking a check as passed.
  const args = [session, 'run-code', '--json', `--filename=${filename}`]
  const response = await runCli(scratch, args, signal).catch((error) => {
    if (typeof error.stdout !== 'string' || !error.stdout.trim() || signal.aborted) throw error
    return { stdout: error.stdout, failed: true }
  })
  const report = JSON.parse(response.stdout) as {
    isError?: boolean
    error?: string
    result?: string
  }
  if ('failed' in response || report.isError || typeof report.result !== 'string') {
    throw new Error(report.error || 'Playwright CLI did not report a result')
  }
  // The CLI's JSON envelope contains the run-code return value as JSON text.
  const result = JSON.parse(report.result) as { message?: string }
  if (typeof result.message !== 'string') throw new Error('GUI case returned no result message')
  return result.message
}

async function checkSavedDocx(path: string): Promise<void> {
  const docx = await parseDocx(await readFile(path))
  const text = docx.blocks
    .flatMap((block) => block.runs ?? [])
    .map((run) => run.text)
    .join('')
  if (
    readSectionSettings(docx).textDirection !== 'tbLrV' ||
    !text.includes(marker) ||
    !text.includes(MONGOL_BICHIG_SAMPLE) ||
    !text.includes(MONGOLIAN_CYRILLIC_SAMPLE)
  ) {
    throw new Error('Saved DOCX is missing the vertical direction, new text or original text')
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      case: { type: 'string', multiple: true },
      screenshots: { type: 'boolean' },
      list: { type: 'boolean' },
    },
  })
  if (values.list) {
    for (const name of caseNames) console.log(`${name}: ${guiCases[name].description}`)
    return
  }
  const unknown = values.case?.find((name) => !caseNames.includes(name as GuiCaseName))
  if (unknown !== undefined) throw new Error(`Unknown GUI case "${unknown}". Use --list.`)
  const selected = values.case ? caseNames.filter((name) => values.case?.includes(name)) : caseNames
  const started = performance.now()
  const sessionName = `todoffice-gui-${randomUUID()}`
  const session = `-s=${sessionName}`
  const scratch = await mkdtemp(join(tmpdir(), 'todoffice-gui-'))
  const artifacts = resolve('output/playwright', sessionName)
  const results: Array<{ case: GuiCaseName; elapsedMs: number; result?: string; error?: string }> =
    []
  const errors: string[] = []
  const controller = new AbortController()
  const abort = () => controller.abort(new Error('GUI verification interrupted'))
  process.on('SIGINT', abort)
  process.on('SIGTERM', abort)

  let launched: LaunchedApp | undefined
  let attachAttempted = false
  try {
    await mkdir(artifacts, { recursive: true })
    console.log(`GUI evidence: ${artifacts}`)
    await runCli(scratch, ['--version'], controller.signal).catch((error) => {
      if (error.code !== 'ENOENT' && process.platform !== 'win32') throw error
      throw new Error('Install Playwright CLI first. See docs/gui-verification.md.', {
        cause: error,
      })
    })
    const profile = join(scratch, 'profile')
    const fixtures = join(scratch, 'documents')
    const fixture = join(fixtures, fixtureName)
    await Promise.all([mkdir(profile), mkdir(fixtures)])
    if (selected.includes('docs')) await writeFile(fixture, await mongolianDocxFixture())
    await writeFile(
      join(scratch, 'cli.json'),
      JSON.stringify({ codegen: 'none', timeouts: { settle: 0 } }),
    )
    launched = await launchShell({
      userDataDir: profile,
      onboardingSeen: true,
      recordVideo: false,
      videoDir: '',
      settings: { aiFeatures: false, defaultSaveDir: fixtures },
    })
    controller.signal.throwIfAborted()
    const [port, browserPath] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split(
      /\r?\n/,
    )
    if (
      !/^\d+$/.test(port) ||
      Number(port) < 1 ||
      Number(port) > 65_535 ||
      !/^\/devtools\/browser\/[a-f\d-]+$/i.test(browserPath)
    ) {
      throw new Error('The scratch Electron profile did not publish a valid DevTools endpoint')
    }
    attachAttempted = true
    await runCli(
      scratch,
      [
        session,
        'attach',
        `--cdp=ws://127.0.0.1:${port}${browserPath}`,
        '--config=cli.json',
        '--idle-timeout=120000',
      ],
      controller.signal,
    )

    for (const name of selected) {
      controller.signal.throwIfAborted()
      const caseStarted = performance.now()
      try {
        let result = await checkCase(
          name,
          scratch,
          artifacts,
          session,
          values.screenshots ?? false,
          controller.signal,
        )
        if (name === 'docs') {
          await checkSavedDocx(fixture)
          result += '. The DOCX on disk preserved both scripts and the vertical section direction'
        }
        results.push({ case: name, elapsedMs: Math.round(performance.now() - caseStarted), result })
        console.log(`PASS ${name} — ${result}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        results.push({
          case: name,
          elapsedMs: Math.round(performance.now() - caseStarted),
          error: message,
        })
        console.error(`FAIL ${name} — ${message.split('\n')[0]}`)
      }
    }
  } catch (error) {
    errors.push(String(error))
  } finally {
    if (attachAttempted) {
      await runCli(scratch, [session, 'detach']).catch((error) => errors.push(String(error)))
    }
    if (launched) await closeShell(launched.app).catch((error) => errors.push(String(error)))
    await rm(scratch, { recursive: true, force: true }).catch((error) => errors.push(String(error)))
    process.off('SIGINT', abort)
    process.off('SIGTERM', abort)
  }

  if (controller.signal.aborted) errors.push(String(controller.signal.reason))
  const status =
    errors.length || results.some((entry) => entry.error !== undefined) ? 'failed' : 'passed'
  const summary = {
    status,
    platform: process.platform,
    elapsedMs: Math.round(performance.now() - started),
    selected,
    results,
    errors,
  }
  await writeFile(join(artifacts, 'summary.json'), JSON.stringify(summary, null, 2) + '\n')
  for (const error of errors) console.error(error)
  if (status === 'failed') process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
