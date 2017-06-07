const { EOL } = require('os')
const fs = require('fs-extra')
const dedent = require('dedent')
const path = require('path')
const toposort = require('toposort')
const readPkg = require('read-pkg')
const R = require('ramda')
const TerminalUtils = require('../terminal')
const AppUtils = require('../app')

let cache = null
const compilerCache = {}

const defaultConfig = {
  role: 'library', // server, client
  compiler: 'none',
  nodeVersion: process.versions.node,
  allDependencies: [],
  dependencies: [],
  bundledDependencies: [],
}

function resolveCompiler(projectName, compilerName) {
  if (compilerName === 'none' || R.isEmpty(compilerName) || R.isNil(compilerName)) {
    return null
  }
  if (compilerCache[compilerName]) {
    return compilerCache[compilerName]
  }
  const pluginName = `constellate-plugin-compiler-${compilerName}`
  const pluginPath = path.resolve(process.cwd(), `./node_modules/${pluginName}`)
  let plugin
  try {
    // eslint-disable-next-line global-require,import/no-dynamic-require
    plugin = require(pluginPath)
  } catch (err) {
    throw new Error(
      dedent(
        `Could not resolve "${compilerName}" compiler for ${projectName}. Make sure you have the plugin installed:
          npm install ${pluginName}`,
      ),
    )
  }
  compilerCache[compilerName] = plugin
  return plugin
}

// :: string -> string -> string
const resolveProjectPath = projectName => relativePath =>
  path.resolve(process.cwd(), `./projects/${projectName}`, relativePath)

// :: string -> Project
const toProject = (projectName) => {
  const appConfig = AppUtils.getConfig()

  const thisProjectPath = resolveProjectPath(projectName)

  const config = Object.assign(
    {},
    defaultConfig,
    appConfig.projectDefaults || {},
    R.path(['projects', projectName], appConfig) || {},
  )

  const compiler = resolveCompiler(projectName, config.compiler)
  const buildRoot = path.resolve(process.cwd(), `./build/${projectName}`)
  const packageJsonPath = thisProjectPath('./package.json')

  return R.pipe(
    x =>
      Object.assign({}, x, {
        name: projectName,
        compiler,
        config,
        packageName: readPkg.sync(packageJsonPath, { normalize: false }).name,
        paths: {
          root: thisProjectPath('./'),
          packageJson: packageJsonPath,
          packageLockJson: thisProjectPath('./package-lock.json'),
          nodeModules: thisProjectPath('./node_modules'),
          modules: thisProjectPath('./modules'),
          modulesEntry: thisProjectPath('./modules/index.js'),
          webpackCache: path.resolve(buildRoot, './.webpackcache'),
        },
      }),
    x =>
      Object.assign({}, x, {
        paths: Object.assign(
          {},
          x.paths,
          compiler == null
            ? {
              buildRoot: x.paths.root,
              buildPackageJson: x.paths.packageJson,
              buildModules: x.paths.modules,
              buildModulesEntry: x.paths.modulesEntry,
              buildNodeModules: x.paths.nodeModules,
            }
            : {
              buildRoot,
              buildPackageJson: path.resolve(buildRoot, './package.json'),
              buildModules: path.resolve(buildRoot, './modules'),
              buildModulesEntry: path.resolve(buildRoot, './modules/index.js'),
              buildNodeModules: path.resolve(buildRoot, './node_modules'),
            },
        ),
      }),
  )({})
}

// :: Array<Project> -> Array<Project>
function orderByAllDependencies(projects) {
  const packageDependencyGraph = project =>
    R.pipe(R.prop('allDependencies'), R.map(dependencyName => [dependencyName, project.name]))(
      project,
    )

  // :: Array<Project> -> Array<Array<string, string>>
  const dependencyGraph = R.chain(packageDependencyGraph)

  // :: Project -> bool
  const hasNoDependencies = ({ allDependencies }) => allDependencies.length === 0

  // :: Array<Project>
  const projectsWithNoDependencies = R.pipe(R.filter(hasNoDependencies), R.map(R.prop('name')))(
    projects,
  )

  // :: string -> Project
  const findProjectByName = R.map(name => R.find(R.propEq('name', name), projects))

  return R.pipe(
    dependencyGraph,
    toposort,
    R.without(projectsWithNoDependencies),
    R.concat(projectsWithNoDependencies),
    findProjectByName,
  )(projects)
}

/**
 * Gets all the projects for the constellate application.
 *
 * The projects are ordered based on their dependency graph.
 * i.e. build them in order.
 *
 * @return {Array<Project>} The project meta object
 */
module.exports = function getAllProjects() {
  if (cache) {
    return cache
  }

  const projectsRoot = path.resolve(process.cwd(), './projects')

  // :: Array<Project>
  const projects = fs
    .readdirSync(projectsRoot)
    // only include directories
    .filter(file => fs.lstatSync(path.join(projectsRoot, file)).isDirectory())
    // convert into a Project
    .map(toProject)

  // :: Project -> Array<string>
  const getDependencies = (project, dependencyType) =>
    project.config[dependencyType].reduce((acc, dependencyName) => {
      const dependency = R.find(R.propEq('name', dependencyName), projects)
      if (!dependency) {
        TerminalUtils.warning(
          `Could not find ${dependencyName} referenced as dependency for ${project.name}`,
        )
        return acc
      }
      return acc.concat([dependencyName])
    }, [])

  // :: Project -> Array<string>
  const getDependants = project =>
    projects.filter(x => R.contains(project.name, x.allDependencies)).map(R.prop('name'))

  const getAllDependants = (project, allProjects) => {
    const findProject = name => R.find(R.propEq('name', name), allProjects)

    // :: String -> Array<String>
    const resolveDependants = (dependantName) => {
      const dependant = findProject(dependantName)
      return [
        dependant.name,
        ...dependant.dependants,
        ...R.map(resolveDependants, dependant.dependants),
      ]
    }

    const allDependants = R.chain(resolveDependants, project.dependants)

    // Let's get a sorted version of allDependants by filtering allProjects
    // which will already be in a safe build order.
    return allProjects.filter(cur => !!R.find(R.equals(cur), allDependants))
  }

  cache = R.pipe(
    // The projects this project directly depends on.
    R.map((project) => {
      const dependencies = getDependencies(project, 'dependencies')
      const bundledDependencies = getDependencies(project, 'bundledDependencies')
      return Object.assign(project, {
        dependencies,
        bundledDependencies,
        allDependencies: [...dependencies, ...bundledDependencies],
      })
    }),
    // Projects that directly depend on this project.
    R.map(project =>
      Object.assign(project, {
        dependants: getDependants(project),
      }),
    ),
    R.map(project =>
      Object.assign(project, {
        allDependencies: [...project.dependencies, ...project.bundledDependencies],
      }),
    ),
    // Projects ordered based on their dependencies based order,
    // which mean building them in order should be safe.
    orderByAllDependencies,
    // Add the FULL dependant tree
    x =>
      R.map(project =>
        Object.assign(project, {
          allDependants: getAllDependants(project, x),
        }),
      )(x),
    // Convert into an object map
    R.reduce((acc, cur) => Object.assign(acc, { [cur.name]: cur }), {}),
  )(projects)

  TerminalUtils.verbose(
    `Project build order: \n\t- ${R.values(cache).map(R.prop('name')).join(`${EOL}\t- `)}`,
  )

  return cache
}
