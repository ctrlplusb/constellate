const R = require('ramda')
const readPkg = require('read-pkg')
const TerminalUtils = require('../../terminal')
const ChildProcessUtils = require('../../childProcess')
const DevelopPluginUtils = require('../utils')

const childProcessMap = {}

const killChildProcessFor = project => {
  const childProcess = childProcessMap[project.name]
  if (!childProcess) {
    TerminalUtils.verbose(
      `No running child process for ${project.name} to kill`,
    )
    return Promise.resolve()
  }
  return DevelopPluginUtils.killChildProcess(project, childProcess).then(() => {
    TerminalUtils.verbose(`${project.name} killed successfully`)
    if (childProcessMap[project.name]) {
      delete childProcessMap[project.name]
    }
  })
}

// :: (Project, DevelopOptions, Watcher) -> DevelopAPI
module.exports = function scriptDevelop(project, options) {
  if (!options.scriptName) {
    throw new Error(
      `No scriptName was provided for the develop configuration of ${
        project.name
      }.`,
    )
  }

  const pkgJson = readPkg.sync(project.paths.packageJson)

  const returnAPI = {
    kill: () => killChildProcessFor(project),
  }

  const runScript = async () => {
    const existingProcess = childProcessMap[project.name]
    if (options.scriptRunOnce && existingProcess) {
      return returnAPI
    }

    if (existingProcess) {
      await killChildProcessFor(project)
    }

    await new Promise((resolve, reject) => {
      const scriptCmd = R.path(['scripts', options.scriptName], pkgJson)
      if (!scriptCmd || R.isEmpty(scriptCmd)) {
        throw new Error(
          `Could not resolve script named "${options.scriptName}" on ${
            project.name
          }`,
        )
      }

      TerminalUtils.info(
        `Executing script "${options.scriptName}" for ${project.name}`,
      )

      const childProcess = ChildProcessUtils.spawn(
        'npm',
        ['run', options.scriptName],
        {
          stdio: 'inherit',
          cwd: project.paths.root,
        },
      )
      childProcess.catch(err => {
        TerminalUtils.verbose(
          `Error executing script "${options.scriptName}" for ${project.name}`,
        )
        reject(err)
      })

      // Give the catch above a tick of space, so that it can resolve any
      // error that may have occurred
      process.nextTick(() => {
        childProcess.on('close', () => {
          TerminalUtils.verbose(
            `Stopped script "${options.scriptName}" process for ${
              project.name
            }`,
          )
        })
        childProcessMap[project.name] = childProcess
        resolve()
      })
    })

    return returnAPI
  }

  return {
    build: runScript,
    clean: runScript,
    develop: runScript,
    deploy: runScript,
  }
}
