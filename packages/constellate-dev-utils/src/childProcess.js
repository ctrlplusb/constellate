// @flow

import type { Chalk } from 'chalk'
import type { ExecaChildProcess } from 'execa'

const execa = require('execa')
const TerminalUtils = require('./terminal')

function exec(
  command: string,
  args?: Array<string> = [],
  opts?: Object = {},
): ExecaChildProcess {
  TerminalUtils.verbose(
    `exec child process: ${command} ${args.join(' ')}${
      opts.cwd ? ` (${opts.cwd})` : ''
    }`,
  )

  process.env.FORCE_COLOR = 'true'

  return execa(
    command,
    args,
    Object.assign(
      {},
      {
        env: process.env,
        stdio: 'pipe',
      },
      opts,
    ),
  ).then(result => result.stdout)
}

function execHijack(
  color: Chalk,
  title: string,
  titleMinLength: number,
  command: string,
  args?: Array<string> = [],
  opts?: Object = {},
): ExecaChildProcess {
  process.env.FORCE_COLOR = 'true'

  const childProcess = execa(
    command,
    args,
    Object.assign({}, opts, {
      env: process.env,
    }),
  )

  const cleanData = data =>
    data
      .toString()
      .replace(/^(\n)+/, '')
      .replace(/(\n)+$/, '')

  const formattedPrefix = color(`${title.padEnd(titleMinLength, ' ')}|`)

  const formatMsg = msg =>
    `${formattedPrefix} ${msg.replace(/\n/gi, `\n${formattedPrefix} `)}`

  childProcess.stdout.on('data', data => {
    const cleaned = cleanData(data)
    // eslint-disable-next-line no-console
    console.log(formatMsg(cleaned))
  })

  childProcess.stderr.on('data', data => {
    const cleaned = cleanData(data)
    // eslint-disable-next-line no-console
    console.error(formatMsg(cleaned))
  })

  return childProcess
}

function execSync(
  command: string,
  args?: Array<string> = [],
  opts?: Object = {},
): string {
  process.env.FORCE_COLOR = 'true'

  TerminalUtils.verbose(
    `execSync child process: ${command} ${args.join(' ')}${
      opts.cwd ? ` (${opts.cwd})` : ''
    }`,
  )

  return execa.sync(
    command,
    args,
    Object.assign(
      {},
      {
        env: process.env,
      },
      opts,
    ),
  ).stdout
}

function spawn(
  command: string,
  args?: Array<string> = [],
  opts?: Object = {},
): ExecaChildProcess {
  TerminalUtils.verbose(
    `spawn child process: ${command} ${args.join(' ')}${
      opts.cwd ? ` (${opts.cwd})` : ''
    }`,
  )

  return execa(
    command,
    args,
    Object.assign(
      {},
      {
        env: process.env,
        stdio: 'inherit',
      },
      opts,
    ),
  )
}

module.exports = {
  exec,
  execHijack,
  execSync,
  spawn,
}
