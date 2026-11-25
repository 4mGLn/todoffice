import { readdirSync, existsSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const seen = new Set()
function validateTree(dir) {
  if (existsSync(join(dir, 'SKILL.md'))) {
    const path = realpathSync(dir)
    if (seen.has(path)) return
    seen.add(path)
    const result = spawnSync('skills-ref', ['validate', dir], { stdio: 'inherit' })
    if (result.error)
      throw new Error('Install skills-ref on PATH (see docs/repository-layout.md)', {
        cause: result.error,
      })
    if (result.status !== 0) process.exitCode = 1
    return
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const child = join(dir, entry.name)
    if (entry.isDirectory()) validateTree(child)
    else if (entry.isSymbolicLink() && dir === '.claude/skills') {
      if (!existsSync(join(child, 'SKILL.md'))) throw new Error('Broken skill link: ' + child)
      validateTree(child)
    }
  }
}
for (const dir of ['.agents/skills', '.claude/skills', 'apps/shell/resources/builtin-skills'])
  validateTree(dir)
console.log('Checked ' + seen.size + ' distinct skill directories')
