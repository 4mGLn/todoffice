import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { AppInfo } from 'app-builder-lib/out/appInfo'
import FpmTarget from 'app-builder-lib/out/targets/FpmTarget'

const require = createRequire(import.meta.url)
const shell = resolve(import.meta.dirname, '..')
const { omitUnconfiguredHomepage } = require('../packaging/omit-unconfigured-homepage.cjs')

function configForLinux() {
  const configModule = { exports: {} as ReturnType<typeof require> }
  const env: Record<string, string> = {}
  runInNewContext(readFileSync(join(shell, 'electron-builder.cjs'), 'utf8'), {
    module: configModule,
    __dirname: shell,
    process: { platform: 'linux', arch: 'x64', execPath: process.execPath, env },
    require: (id: string) =>
      id === 'node:fs' ? { ...require(id), existsSync: () => true } : require(id),
  })
  return { config: configModule.exports, env }
}

describe('local Linux packages without a public TodOffice homepage', () => {
  it('passes installed electron-builder metadata validation without a fabricated URL', async () => {
    const { config, env } = configForLinux()
    const metadata = { name: 'todoffice', version: '0.13.0', ...config.extraMetadata }
    // A single-package project shares merged metadata with devMetadata.
    const appInfo = new AppInfo({
      metadata,
      devMetadata: metadata,
      config,
      repositoryInfo: null,
    } as never)
    expect(await appInfo.computePackageUrl()).toBe('')
    const method = FpmTarget.prototype as unknown as {
      computeFpmMetaInfoOptions(this: unknown): Promise<{ url: string; maintainer: string }>
    }
    const meta = await method.computeFpmMetaInfoOptions.call({
      packager: { appInfo },
      options: { maintainer: config.linux.maintainer },
    })
    expect(meta.url).toBe('')
    expect(meta.maintainer).toBe('TodOffice contributors')
    expect(config.deb.fpm).toContain('--edit')
    expect(config.rpm.fpm).toContain('--edit')
    expect(config.publish).toBeNull()
    expect(env.FPM_EDITOR).toContain('omit-unconfigured-homepage.cjs')
  })

  it('omits only the empty DEB field and FPM-generated RPM fallback', () => {
    expect(
      omitUnconfiguredHomepage('Package: todoffice\nHomepage: \nDescription: TodOffice\n'),
    ).toBe('Package: todoffice\nDescription: TodOffice\n')
    expect(
      omitUnconfiguredHomepage(
        'Name: todoffice\nURL: http://nourlgiven.example.com/\nVendor: TodOffice contributors\n',
      ),
    ).toBe('Name: todoffice\nVendor: TodOffice contributors\n')
    expect(omitUnconfiguredHomepage('URL: https://configured.test/\n')).toBe(
      'URL: https://configured.test/\n',
    )
  })
})
