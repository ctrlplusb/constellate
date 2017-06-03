const spawn = require('cross-spawn')
const R = require('ramda')
const TerminalUtils = require('constellate-dev-utils/terminal')
const AppUtils = require('../utils/app')

module.exports = function update(projects) {
  const constellateAppConfig = AppUtils.getConfig()

  const client = constellateAppConfig.packageClient != null
    ? constellateAppConfig.packageClient
    : 'npm'

  if (['npm', 'yarn'].find(R.equals(client)) == null) {
    throw new Error(
      `Unsupported packageClient specified in constellate app configuration: ${client}`,
    )
  }

  const subCmd = client === 'npm' ? 'npm-check -u' : 'upgrade-interactive'

  const runUpdate = path =>
    spawn.sync(
      // Spawn the package manager
      client,
      // That runs the respective update command
      [subCmd],
      {
        cwd: path,
        stdio: 'inherit',
      },
    )

  // First run the update command at application root
  TerminalUtils.verbose('Updating dependencies for application root')
  runUpdate(process.cwd())

  // Then run it for each the projects
  projects.forEach((project) => {
    TerminalUtils.verbose(`Updating dependencies for ${project.name}`)
    runUpdate(project.paths.root)
  })
}
