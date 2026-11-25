import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { appBinaryForResources } from '../src/resources'

describe('appBinaryForResources', () => {
  it('finds the app in a custom Windows install directory', () => {
    expect(appBinaryForResources(join('D:\\Apps\\TodOffice', 'resources'), 'win32')).toBe(
      join('D:\\Apps\\TodOffice', 'TodOffice.exe'),
    )
  })

  it('resolves the same binary for the default Windows install directory', () => {
    const localAppData = 'C:\\Users\\test\\AppData\\Local'
    const resources = join(localAppData, 'Programs', 'TodOffice', 'resources')
    expect(appBinaryForResources(resources, 'win32')).toBe(
      join(localAppData, 'Programs', 'TodOffice', 'TodOffice.exe'),
    )
  })

  it('finds the app in a custom macOS bundle location', () => {
    expect(
      appBinaryForResources(join('/Volumes/Work/TodOffice.app/Contents/Resources'), 'darwin'),
    ).toBe(join('/Volumes/Work/TodOffice.app/Contents/MacOS/TodOffice'))
  })

  it('finds the app in a custom Linux prefix', () => {
    expect(appBinaryForResources(join('/opt/todoffice-custom/resources'), 'linux')).toBe(
      join('/opt/todoffice-custom/todoffice'),
    )
  })
})
