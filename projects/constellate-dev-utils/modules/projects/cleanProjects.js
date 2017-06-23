const fs = require('fs-extra')
const TerminalUtils = require('../terminal')

module.exports = function cleanProjects(projects) {
  projects.forEach((project) => {
    if (fs.existsSync(project.paths.nodeModules)) {
      TerminalUtils.verbose(`Removing node_modules for ${project.name}`)
      fs.removeSync(project.paths.packageLockJson)
      fs.removeSync(project.paths.nodeModules)
    }
  })
}
