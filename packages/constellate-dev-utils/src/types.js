// @flow
/* eslint-disable no-use-before-define */

export type PackageVersions = { [string]: string }

export type PackageWatcher = {
  start: () => void,
  stop: () => void,
}

export type PackagePaths = {
  monoRepoRoot: string,
  monoRepoRootNodeModules: string,
  packageBuildOutput: string,
  packageEntryFile: string,
  packageJson: string,
  packageLockJson: string,
  packageNodeModules: string,
  packageRoot: string,
  packageSrc: string,
  packageWebpackCache: string,
}

export type BuildPlugin = {
  name: string,
  clean: () => Promise<mixed>,
  build: () => Promise<mixed>,
}

export type DeployPath = string

export type DeployPlugin = {
  name: string,
  deploy: DeployPath => Promise<mixed>,
}

export type DevelopInstance = {
  kill: () => Promise<void>,
}

export type DevelopPlugin = {
  name: string,
  develop: PackageWatcher => Promise<DevelopInstance>,
}

export type PackagePlugins = {
  buildPlugin: ?BuildPlugin,
  deployPlugin: ?DeployPlugin,
  developPlugin: ?DevelopPlugin,
}

export type Package = {
  config: Object,
  dependants: Array<string>,
  dependencies: Array<string>,
  devDependencies: Array<string>,
  name: string,
  packageJson: Object,
  packageName: string,
  paths: PackagePaths,
  plugins: PackagePlugins,
  version: string,
}

export type PackageMap = { [string]: Package }