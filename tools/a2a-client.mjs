// The operator supplies the peer origin when registering the MCP server.
import { randomUUID } from 'node:crypto'

export function createPeer(address, request = fetch) {
  const base = new URL(address)
  if (!(base.protocol === 'https:' || (base.protocol === 'http:' &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname))) ||
      base.href !== base.origin + '/') throw new Error('Expected HTTPS origin or loopback HTTP origin')

  async function json(url, options) {
    const response = await request(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(30000) })
    if (!response.ok) throw new Error('Peer HTTP status ' + response.status)
    const chunks = []
    let length = 0
    for await (const chunk of response.body) {
      length += chunk.length
      if (length > 1024 * 1024) throw new Error('Peer response exceeds 1 MiB')
      chunks.push(chunk)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  }

  const discover = () => json(new URL('/.well-known/agent-card.json', base))
  async function rpc(method, params) {
    const card = await discover()
    const iface = card.supportedInterfaces?.find(i => i.protocolVersion === '1.0' &&
      i.protocolBinding === 'JSONRPC' && !i.tenant && new URL(i.url).origin === base.origin)
    if (!iface) throw new Error('No same-origin A2A 1.0 JSONRPC interface')
    const id = randomUUID()
    const reply = await json(iface.url, {
      method: 'POST', headers: { 'content-type': 'application/json', 'A2A-Version': '1.0' },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    })
    if (reply.id !== id || reply.jsonrpc !== '2.0') throw new Error('Invalid RPC envelope')
    if (reply.error) throw new Error('Peer RPC error ' + reply.error.code + ': ' + reply.error.message)
    return reply.result
  }
  return {
    discover,
    async send(text, taskId, contextId) {
      const result = await rpc('SendMessage', { message: {
        role: 'ROLE_USER', messageId: randomUUID(), parts: [{ text }], taskId, contextId,
      } })
      if (!result?.message?.parts && !result?.task?.status?.state) throw new Error('Invalid SendMessage result')
      return result
    },
    async get(id) {
      const task = await rpc('GetTask', { id })
      if (task?.id !== id || !task.status?.state) throw new Error('Invalid GetTask result')
      return task
    },
  }
}
