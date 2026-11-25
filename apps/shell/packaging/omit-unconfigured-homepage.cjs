/** FPM's supported --edit hook: omit an unconfigured optional project URL. */
const { readFileSync, writeFileSync } = require('node:fs')

function omitUnconfiguredHomepage(text) {
  return (
    text
      .replace(/^Homepage:[ \t]*\r?\n/gm, '')
      // FPM's rpm.erb inserts this fallback when --url is empty.
      .replace(/^URL:[ \t]*http:\/\/nourlgiven\.example\.com\/?[ \t]*\r?\n/gm, '')
  )
}

module.exports = { omitUnconfiguredHomepage }

if (require.main === module) {
  const file = process.argv[2]
  if (!file || process.argv.length !== 3) throw new Error('Expected one FPM control/spec file')
  const text = omitUnconfiguredHomepage(readFileSync(file, 'utf8'))
  if (/^(?:Homepage|URL):/m.test(text)) {
    throw new Error('TodOffice has no configured homepage; refusing unexpected package URL')
  }
  writeFileSync(file, text)
}
