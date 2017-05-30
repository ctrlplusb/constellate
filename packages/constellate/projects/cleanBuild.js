const fs = require('fs-extra')
const path = require('path')
const terminal = require('constellate-dev-utils/terminal')

module.exports = function cleanBuild() {
  const buildPath = path.resolve(process.cwd(), './build')
  if (fs.existsSync(buildPath)) {
    terminal.verbose('Removing build')
    fs.removeSync(buildPath)
  }
}
