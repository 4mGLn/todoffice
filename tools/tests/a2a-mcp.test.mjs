import assert from 'node:assert/strict'
import http from 'node:http'
import test from 'node:test'
import { once } from 'node:events'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

test('MCP discovery, delegation and task results over A2A JSON-RPC', async (t) => {
  const task = { id: 'job', contextId: 'ctx', status: { state: 'TASK_STATE_WORKING' } }
  let endpoint
  const peer = http.createServer(async (req, res) => {
    res.setHeader('content-type', 'application/json')
    if (req.method === 'GET') {
      assert.equal(req.url, '/.well-known/agent-card.json')
      res.end(
        JSON.stringify({
          skills: [{ id: 'edit' }],
          supportedInterfaces: [
            { protocolVersion: '1.0', protocolBinding: 'JSONRPC', url: endpoint },
          ],
        }),
      )
      return
    }
    assert.equal(req.headers['a2a-version'], '1.0')
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const { id, method, params } = JSON.parse(Buffer.concat(chunks))
    let result
    if (method === 'SendMessage') {
      assert.equal(params.message.parts[0].text, 'selected text')
      result = { task }
    } else {
      assert.equal(method, 'GetTask')
      assert.equal(params.id, 'job')
      result = {
        ...task,
        status: { state: 'TASK_STATE_COMPLETED' },
        artifacts: [{ parts: [{ text: 'done' }] }],
      }
    }
    res.end(JSON.stringify({ id, jsonrpc: '2.0', result }))
  })
  peer.listen(0, '127.0.0.1')
  await once(peer, 'listening')
  t.after(() => peer.close())
  const origin = 'http://127.0.0.1:' + peer.address().port
  endpoint = origin + '/rpc'
  const client = new Client({ name: 'test', version: '1' })
  await client.connect(
    new StdioClientTransport({ command: process.execPath, args: ['tools/a2a-mcp.mjs', origin] }),
  )
  t.after(() => client.close())
  async function call(name, args) {
    const reply = await client.callTool({ name, arguments: args })
    assert.ok(!reply.isError, reply.content[0].text)
    return JSON.parse(reply.content[0].text)
  }
  assert.equal((await call('discover', {})).skills[0].id, 'edit')
  assert.equal((await call('delegate', { text: 'selected text' })).task.id, 'job')
  assert.equal((await call('get_task', { id: 'job' })).artifacts[0].parts[0].text, 'done')
  endpoint = 'https://other.example/'
  assert.equal(
    (await client.callTool({ name: 'delegate', arguments: { text: 'private' } })).isError,
    true,
  )
})
