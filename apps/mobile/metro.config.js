const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const repositoryRoot = path.resolve(projectRoot, "../..");
const config = getDefaultConfig(projectRoot);

// Mobile installs its own dependencies; expose only the generated public API source.
config.watchFolders = [path.resolve(repositoryRoot, "convex")];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(repositoryRoot, "node_modules"),
];

module.exports = config;
