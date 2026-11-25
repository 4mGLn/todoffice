import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { createPeer } from './a2a-client.mjs'

const peer = createPeer(process.argv[2])
const server = new McpServer({ name: 'todoffice-a2a', version: '1.0.0' })
const content = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }] })
server.registerTool('discover', { description: 'Read the configured peer card and advertised skills.' },
  async () => content(await peer.discover()))
server.registerTool('delegate', {
  description: 'Send the supplied text to the configured peer. Returns its message or task.',
  inputSchema: { text: z.string().min(1), taskId: z.string().optional(), contextId: z.string().optional() },
}, async ({ text, taskId, contextId }) => content(await peer.send(text, taskId, contextId)))
server.registerTool('get_task', {
  description: 'Read task state, status message and artifacts by task ID.',
  inputSchema: { id: z.string().min(1) },
}, async ({ id }) => content(await peer.get(id)))
await server.connect(new StdioServerTransport())
