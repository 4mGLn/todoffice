import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { describe, expect, it } from 'vitest'
import { defaultRegistry } from '../src/cli'
import { createContext, disposeContext } from '../src/mcp/run'
import { createMcpServer } from '../src/mcp/server'
import { tempDir } from './helpers'

describe('mcp tool list', () => {
  it('serves map_read, map_apply and map_create', async () => {
    const dir = tempDir()
    const ctx = createContext({
      cwd: dir,
      env: { ...process.env, GENOFFICE_AUDIT_LOG: 'off' },
      log: () => {},
    })
    try {
      const server = await createMcpServer(ctx, { registry: defaultRegistry() })
      const [a, b] = InMemoryTransport.createLinkedPair()
      await server.connect(a)
      const client = new Client({ name: 'smoke', version: '0' })
      await client.connect(b)
      const { tools } = await client.listTools()
      const names = tools.map((t) => t.name)
      console.log(
        'SERVED MAP TOOLS:',
        names.filter((n) => n.startsWith('map_')),
      )
      expect(names).toContain('map_read')
      expect(names).toContain('map_apply')
      expect(names).toContain('map_create')
      await client.close()
    } finally {
      disposeContext(ctx)
    }
  })
})
